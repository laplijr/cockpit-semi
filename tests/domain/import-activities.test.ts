import { Encoder, Profile } from '@garmin/fitsdk'
import type { Encodable, FileIdMesg, SessionMesg } from '@garmin/fitsdk'
import { describe, expect, it } from 'vitest'
import {
  ImportOutcome,
  importActivities,
  type ActivityImportGateway,
  type ActivityRow,
  type CapturedOuting,
  type DecodedFile,
} from '~~/server/application/import-activities'
import type { FeedbackGateway, FeedbackInput } from '~~/server/application/record-feedback'
import type { CandidateSession } from '~~/server/domain/matching/match-activity'
import { fixedClock } from '~~/server/domain/shared/clock'
import { Sport } from '~~/server/domain/shared/sport'
import { decodeActivity } from '~~/server/infra/watch/fit-activity'

const TODAY = '2027-03-02'

/**
 * Une activité `.FIT` réelle au sens du format : écrite par l'encodeur
 * officiel de Garmin, avec le même profil de messages qu'une montre. Elle
 * n'est pas commitée — la licence du SDK interdit d'en redistribuer les
 * fichiers (§ 9, P6.7).
 */
function fitActivity(overrides: Record<string, unknown> = {}): Uint8Array {
  const start = new Date('2027-03-01T08:00:00Z')
  const encoder = new Encoder()

  const fileId: Encodable<FileIdMesg> = {
    mesgNum: Profile.MesgNum.FILE_ID as number,
    type: 'activity',
    manufacturer: 'garmin',
    product: 4440,
    serialNumber: 12345,
    timeCreated: start,
  }

  const session: Encodable<SessionMesg> = {
    mesgNum: Profile.MesgNum.SESSION as number,
    messageIndex: 0,
    timestamp: new Date(start.getTime() + 3_600_000),
    startTime: start,
    sport: 'running',
    totalElapsedTime: 3600,
    totalTimerTime: 3540,
    totalDistance: 12_000,
    totalAscent: 140,
    avgHeartRate: 148,
    maxHeartRate: 172,
    event: 'session',
    eventType: 'stop',
    ...overrides,
  }

  encoder.writeMesg(fileId)
  encoder.writeMesg(session)

  return encoder.close()
}

function fileNamed(name: string, bytes: Uint8Array): DecodedFile {
  return { name, activity: decodeActivity(bytes) }
}

interface Spy {
  gateway: ActivityImportGateway
  feedback: FeedbackGateway
  saved: ActivityRow[]
  recorded: FeedbackInput[]
  recomputed: string[]
}

function spy(
  sessions: CandidateSession[] = [],
  known: string[] = [],
  captured: CapturedOuting[] = [],
): Spy {
  const saved: ActivityRow[] = []
  const recorded: FeedbackInput[] = []
  const recomputed: string[] = []

  return {
    saved,
    recorded,
    recomputed,
    gateway: {
      knownExternalIds: async (ids) => ids.filter((id) => known.includes(id)),
      capturedOutings: async () => captured,
      maxHeartRate: async () => 185,
      candidateSessions: async () => sessions,
      saveActivity: async (row) => saved.push(row),
      sessionCode: async () => 'EF',
      recomputeLoad: async (date) => void recomputed.push(date),
    },
    feedback: {
      sessionDate: async () => '2027-03-01',
      saveFeedback: async (input) => void recorded.push(input),
      markDone: async () => {},
      recomputeLoad: async (date) => {
        recomputed.push(date)
        return { date, runningUa: 0, cyclingUa: 0, strengthUa: 0, otherUa: 0, totalUa: 0 }
      },
      evaluateRules: async () => [],
      markSkipped: async () => {},
    },
  }
}

const planned: CandidateSession[] = [
  { id: 42, date: '2027-03-01', sport: Sport.Running, alreadyMatched: false },
]

describe('décodage d’une activité de montre (§ 9, P6.7)', () => {
  it('lit le sport, le départ, la durée, la distance, le dénivelé et la FC', () => {
    const activity = decodeActivity(fitActivity())!

    expect(activity.sport).toBe(Sport.Running)
    expect(activity.date).toBe('2027-03-01')
    expect(activity.durationS).toBe(3540)
    expect(activity.distanceM).toBe(12_000)
    expect(activity.elevationGainM).toBe(140)
    expect(activity.averageHr).toBe(148)
    expect(activity.maxHr).toBe(172)
  })

  it('ignore un fichier illisible au lieu de lever', () => {
    expect(decodeActivity(new Uint8Array([1, 2, 3, 4]))).toBeUndefined()
    expect(decodeActivity(new Uint8Array(0))).toBeUndefined()
  })

  it('ignore un sport qu’il ne sait pas ranger', () => {
    expect(decodeActivity(fitActivity({ sport: 'swimming' }))).toBeUndefined()
  })
})

describe('import d’un lot d’activités (§ 9, P6.7)', () => {
  it('rattache une activité à la séance prévue et passe par le ressenti', async () => {
    const tools = spy(planned)
    const report = await importActivities(tools.gateway, tools.feedback, fixedClock(TODAY), [
      fileNamed('2027-03-01-08-00-00.fit', fitActivity()),
    ])

    expect(report.linked).toBe(1)
    expect(report.lines[0]!.outcome).toBe(ImportOutcome.Linked)
    expect(report.lines[0]!.sessionCode).toBe('EF')
    expect(tools.recorded[0]!.sessionId).toBe(42)
    expect(tools.recorded[0]!.durationMin).toBe(59)
    expect(tools.recorded[0]!.distanceM).toBe(12_000)
  })

  it('ne remplit ni sensations ni sommeil ni douleur : un fichier ne les connaît pas', async () => {
    const tools = spy(planned)
    await importActivities(tools.gateway, tools.feedback, fixedClock(TODAY), [
      fileNamed('a.fit', fitActivity()),
    ])

    expect(tools.recorded[0]!.sensations).toEqual([])
    expect(tools.recorded[0]!.sleepHours).toBeNull()
    expect(tools.recorded[0]!.pain).toBeNull()
    expect(tools.recorded[0]!.rpe).toBeGreaterThan(0)
  })

  it('range une activité sans séance correspondante en hors plan', async () => {
    const tools = spy()
    const report = await importActivities(tools.gateway, tools.feedback, fixedClock(TODAY), [
      fileNamed('a.fit', fitActivity()),
    ])

    expect(report.unplanned).toBe(1)
    expect(tools.saved[0]!.sessionId).toBeNull()
    expect(tools.recorded).toHaveLength(0)
    expect(tools.recomputed).toContain('2027-03-01')
  })

  it('reconnaît un fichier déjà importé et ne le compte qu’une fois', async () => {
    const known = decodeActivity(fitActivity())!.externalId
    const tools = spy(planned, [known])

    const report = await importActivities(tools.gateway, tools.feedback, fixedClock(TODAY), [
      fileNamed('a.fit', fitActivity()),
    ])

    expect(report.duplicates).toBe(1)
    expect(tools.saved).toHaveLength(0)
  })

  it('ne rattache pas deux fois la même séance dans un même lot', async () => {
    const tools = spy(planned)
    const report = await importActivities(tools.gateway, tools.feedback, fixedClock(TODAY), [
      fileNamed('a.fit', fitActivity()),
      fileNamed('b.fit', fitActivity({ totalTimerTime: 2400 })),
    ])

    expect(report.linked).toBe(1)
    expect(report.unplanned).toBe(1)
  })

  it('reconnaît une sortie déjà courue dans le cockpit et ne la compte pas deux fois', async () => {
    const tools = spy(planned, [], [{ sport: Sport.Running, date: '2027-03-01', durationS: 3500 }])
    const report = await importActivities(tools.gateway, tools.feedback, fixedClock(TODAY), [
      fileNamed('2027-03-01-08-00-00.fit', fitActivity()),
    ])

    expect(report.duplicates).toBe(1)
    expect(report.unplanned).toBe(0)
    expect(tools.saved).toHaveLength(0)
  })

  it('n’écarte pas une sortie de durée franchement différente le même jour', async () => {
    const tools = spy(planned, [], [{ sport: Sport.Running, date: '2027-03-01', durationS: 1200 }])
    const report = await importActivities(tools.gateway, tools.feedback, fixedClock(TODAY), [
      fileNamed('2027-03-01-08-00-00.fit', fitActivity()),
    ])

    expect(report.duplicates).toBe(0)
    expect(report.linked).toBe(1)
  })

  it('traverse un lot mixte sans qu’un fichier corrompu arrête les autres', async () => {
    const tools = spy(planned)
    const report = await importActivities(tools.gateway, tools.feedback, fixedClock(TODAY), [
      fileNamed('casse.fit', new Uint8Array([9, 9, 9])),
      fileNamed('bonne.fit', fitActivity()),
    ])

    expect(report.unreadable).toBe(1)
    expect(report.linked).toBe(1)
    expect(report.lines.map((line) => line.outcome)).toEqual([
      ImportOutcome.Unreadable,
      ImportOutcome.Linked,
    ])
  })
})
