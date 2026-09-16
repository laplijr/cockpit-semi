import { describe, expect, it } from 'vitest'
import { confirmUnplanned, draftUnplanned } from '~~/server/application/record-unplanned'
import type { UnplannedGateway } from '~~/server/application/record-unplanned'
import { ProposalTrigger } from '~~/server/domain/rules/proposal-status'
import {
  ProposalEffect,
  RuleId,
  type Proposal,
  type UpcomingSession,
} from '~~/server/domain/rules/rules'
import { RunSessionCode } from '~~/server/domain/running/session-types'
import { fixedClock } from '~~/server/domain/shared/clock'
import { Sport } from '~~/server/domain/shared/sport'
import {
  IntensityProfile,
  UnavailabilityScope,
  UnplannedKind,
  type UnplannedEvent,
} from '~~/server/domain/unplanned/events'

const TODAY = '2026-11-23'

const UPCOMING: UpcomingSession[] = [
  {
    sessionId: 7,
    date: '2026-11-27',
    sport: Sport.Running,
    code: RunSessionCode.Endurance,
    key: false,
    distanceM: 7400,
    repeats: null,
  },
]

const EVENTS: UnplannedEvent[] = [
  {
    kind: UnplannedKind.Activity,
    sport: Sport.Other,
    date: TODAY,
    durationMin: 60,
    rpeEstimate: 6,
    intensityProfile: IntensityProfile.Moderate,
    label: '1 h de squash',
  },
  {
    kind: UnplannedKind.Unavailability,
    from: '2026-11-27',
    to: '2026-11-27',
    scope: UnavailabilityScope.All,
    label: 'pas disponible vendredi',
  },
]

interface Recorded {
  activities: { date: string; sport: Sport; rpe: number; durationMin: number }[]
  recomputed: string[]
  proposals: { proposals: Proposal[]; trigger: ProposalTrigger }[]
  confirmed: number[]
  contextSent: { date: string; sport: Sport; label: string }[]
}

function fakeGateway(recorded: Recorded, events = EVENTS): UnplannedGateway {
  const drafts = new Map<number, UnplannedEvent[]>()

  return {
    async plannedSessions() {
      return recorded.contextSent
    },
    async upcoming() {
      return UPCOMING
    },
    async saveDraft(_rawText, saved) {
      drafts.set(1, saved)
      return 1
    },
    async loadDraft(id) {
      const found = drafts.get(id) ?? (id === 1 ? events : undefined)
      return found ? { id, events: found } : undefined
    },
    async markConfirmed(id) {
      recorded.confirmed.push(id)
    },
    async recordActivity(item, rpe) {
      recorded.activities.push({
        date: item.date,
        sport: item.sport,
        rpe,
        durationMin: item.durationMin,
      })
    },
    async recomputeLoad(date) {
      recorded.recomputed.push(date)
    },
    async storeProposals(proposals, trigger) {
      recorded.proposals.push({ proposals, trigger })
      return proposals
    },
  }
}

function emptyRecord(): Recorded {
  return { activities: [], recomputed: [], proposals: [], confirmed: [], contextSent: [] }
}

describe('parcours de l’Imprévu (§ 6)', () => {
  it('n’envoie au modèle que la date du jour et les séances prévues', async () => {
    const recorded = emptyRecord()
    recorded.contextSent = [{ date: '2026-11-24', sport: Sport.Running, label: 'VMA' }]

    let seen: { today: string; plannedSessions: unknown[] } | undefined
    const interpreter = {
      async interpret(_text: string, context: { today: string; plannedSessions: unknown[] }) {
        seen = context
        return EVENTS
      },
    }

    const draft = await draftUnplanned(
      fakeGateway(recorded),
      interpreter,
      fixedClock(TODAY),
      '1 h de squash ce midi, pas dispo vendredi',
    )

    expect(seen).toEqual({ today: TODAY, plannedSessions: recorded.contextSent })
    expect(draft.events).toHaveLength(2)
  })

  it('ne touche à rien avant la confirmation', async () => {
    const recorded = emptyRecord()
    await draftUnplanned(
      fakeGateway(recorded),
      {
        async interpret() {
          return EVENTS
        },
      },
      fixedClock(TODAY),
      'texte',
    )

    expect(recorded.activities).toEqual([])
    expect(recorded.proposals).toEqual([])
    expect(recorded.confirmed).toEqual([])
  })

  it('à la confirmation, l’activité entre dans la charge et l’indisponibilité devient une proposition', async () => {
    const recorded = emptyRecord()
    const result = await confirmUnplanned(fakeGateway(recorded), fixedClock(TODAY), 1)

    expect(recorded.activities).toEqual([
      { date: TODAY, sport: Sport.Other, rpe: 6, durationMin: 60 },
    ])
    expect(recorded.recomputed).toEqual([TODAY])
    expect(recorded.confirmed).toEqual([1])

    expect(result.proposals).toHaveLength(1)
    expect(result.proposals[0]).toMatchObject({
      ruleId: RuleId.I1,
      effect: ProposalEffect.CancelSession,
      target: { kind: 'session', id: 7 },
    })
    expect(recorded.proposals[0]!.trigger).toBe(ProposalTrigger.Unplanned)
  })

  it('applique les corrections de l’athlète plutôt que l’interprétation brute', async () => {
    const recorded = emptyRecord()
    const corrected: UnplannedEvent[] = [{ ...EVENTS[0]!, durationMin: 90, rpeEstimate: 4 }]

    await confirmUnplanned(fakeGateway(recorded), fixedClock(TODAY), 1, corrected)

    expect(recorded.activities).toEqual([
      { date: TODAY, sport: Sport.Other, rpe: 4, durationMin: 90 },
    ])
    expect(recorded.proposals.flatMap((item) => item.proposals)).toEqual([])
  })

  it('refuse un imprévu inconnu', async () => {
    const recorded = emptyRecord()
    await expect(confirmUnplanned(fakeGateway(recorded), fixedClock(TODAY), 99)).rejects.toThrow()
  })
})
