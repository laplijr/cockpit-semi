import { describe, expect, it } from 'vitest'
import {
  MAX_NOTE_LENGTH,
  PostSource,
  commentRefusal,
  publishRace,
  publishSession,
  shiftWeek,
  weekOf,
  type PublishableRace,
  type PublishableSession,
} from '~~/server/domain/circle/post'
import { SessionStatus } from '~~/server/domain/plan/session'
import { RaceStatus } from '~~/server/domain/races/race'
import { Sport } from '~~/server/domain/shared/sport'

const doneSession: PublishableSession = {
  id: 12,
  sport: Sport.Running,
  code: 'SL',
  date: '2026-11-22',
  status: SessionStatus.Done,
  actualDistanceM: 16_400,
  actualDurationMin: 107,
  plannedDistanceM: 16_000,
  plannedDurationMin: 100,
}

const racedRace: PublishableRace = {
  id: 3,
  name: '10 km de Vannes',
  date: '2026-11-22',
  distanceM: 10_000,
  status: RaceStatus.Raced,
  resultatS: 2892,
}

/** Les sept champs de contenu, plus les deux qui disent d'où vient le post. */
const ALLOWED = [
  'source',
  'sourceId',
  'sport',
  'code',
  'date',
  'label',
  'distanceM',
  'durationMin',
  'note',
]

describe('publication au cercle (§ 1 principe 6, P9)', () => {
  it('ne laisse sortir que les champs de la liste blanche', () => {
    /**
     * Une séance complète, telle qu'elle vit en base : le retour de séance,
     * la douleur, le sommeil, la fréquence cardiaque, l'itinéraire, les
     * allures prescrites. Rien de tout ça n'a le droit de traverser le mur.
     */
    const fat = {
      ...doneSession,
      rpe: 6,
      sensations: ['jambes lourdes'],
      sleepHours: 7.5,
      pain: { zone: 'genou droit', intensity: 2 },
      notes: 'mal dormi',
      averageHr: 156,
      weightKg: 78,
      homeAddress: '12 rue des Lilas',
      gpx: '<gpx/>',
      prescription: { paces: { easy: 425 } },
      vdot: 33.75,
      confidencePct: 62,
    } as PublishableSession

    const outcome = publishSession(fat, 'Boucle du canal.')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(Object.keys(outcome.post).sort()).toEqual([...ALLOWED].sort())
  })

  it('publie le réalisé d’une séance, et son mot', () => {
    const outcome = publishSession(doneSession, '  Boucle du canal.  ')

    expect(outcome).toEqual({
      ok: true,
      post: {
        source: PostSource.Session,
        sourceId: 12,
        sport: Sport.Running,
        code: 'SL',
        date: '2026-11-22',
        label: null,
        distanceM: 16_400,
        durationMin: 107,
        note: 'Boucle du canal.',
      },
    })
  })

  it('retombe sur le prévu quand la séance n’a pas de réalisé chiffré', () => {
    const strength: PublishableSession = {
      ...doneSession,
      sport: Sport.Strength,
      code: 'legs',
      actualDistanceM: null,
      actualDurationMin: null,
      plannedDistanceM: null,
      plannedDurationMin: 45,
    }

    const outcome = publishSession(strength, null)

    expect(outcome.ok && outcome.post.durationMin).toBe(45)
    expect(outcome.ok && outcome.post.distanceM).toBe(null)
  })

  it('refuse une séance qui n’a pas eu lieu', () => {
    for (const status of [SessionStatus.Planned, SessionStatus.Skipped, SessionStatus.Cancelled]) {
      const outcome = publishSession({ ...doneSession, status }, null)
      expect(outcome).toEqual({ ok: false, refusal: 'On ne publie qu’une séance faite.' })
    }
  })

  it('publie une course courue avec son chrono en minutes', () => {
    const outcome = publishRace(racedRace, null)

    expect(outcome).toEqual({
      ok: true,
      post: {
        source: PostSource.Race,
        sourceId: 3,
        sport: Sport.Running,
        code: null,
        date: '2026-11-22',
        label: '10 km de Vannes',
        distanceM: 10_000,
        durationMin: 48.2,
        note: null,
      },
    })
  })

  it('refuse une course sans chrono, même marquée courue', () => {
    expect(publishRace({ ...racedRace, resultatS: null }, null).ok).toBe(false)
    expect(publishRace({ ...racedRace, status: RaceStatus.Planned }, null).ok).toBe(false)
  })

  it('vide un mot blanc et borne un mot trop long', () => {
    expect(publishSession(doneSession, '   ').ok && publishSession(doneSession, '   ')).toEqual({
      ok: true,
      post: expect.objectContaining({ note: null }),
    })

    const long = 'a'.repeat(MAX_NOTE_LENGTH + 1)
    expect(publishSession(doneSession, long).ok).toBe(false)
  })
})

describe('commentaire', () => {
  it('refuse le vide et la dissertation', () => {
    expect(commentRefusal('   ')).toBeDefined()
    expect(commentRefusal('a'.repeat(601))).toBeDefined()
    expect(commentRefusal('Belle sortie.')).toBeUndefined()
  })
})

describe('la semaine du cercle', () => {
  it('va du lundi au dimanche, quel que soit le jour donné', () => {
    expect(weekOf('2026-11-22')).toEqual({ from: '2026-11-16', to: '2026-11-22' })
    expect(weekOf('2026-11-16')).toEqual({ from: '2026-11-16', to: '2026-11-22' })
    expect(weekOf('2026-11-18')).toEqual({ from: '2026-11-16', to: '2026-11-22' })
  })

  it('recule et avance d’une semaine entière', () => {
    const week = weekOf('2026-11-22')
    expect(shiftWeek(week, -1)).toEqual({ from: '2026-11-09', to: '2026-11-15' })
    expect(shiftWeek(week, 1)).toEqual({ from: '2026-11-23', to: '2026-11-29' })
  })
})
