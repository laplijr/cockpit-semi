import { describe, expect, it } from 'vitest'
import { ProposalEffect, RuleId, type UpcomingSession } from '~~/server/domain/rules/rules'
import { RunSessionCode } from '~~/server/domain/running/session-types'
import { Sport } from '~~/server/domain/shared/sport'
import {
  IntensityProfile,
  UnavailabilityScope,
  UnplannedKind,
  coversDate,
  rpeFor,
} from '~~/server/domain/unplanned/events'
import { proposeForUnavailabilities } from '~~/server/domain/unplanned/propose'

/** Semaine du lundi 23 au dimanche 29 novembre 2026. */
const session = (
  sessionId: number,
  date: string,
  code: RunSessionCode,
  key: boolean,
  sport = Sport.Running,
): UpcomingSession => ({
  sessionId,
  date,
  sport,
  code,
  key,
  distanceM: 8000,
  repeats: null,
})

const WEEK: UpcomingSession[] = [
  session(1, '2026-11-23', RunSessionCode.Endurance, false),
  session(2, '2026-11-24', RunSessionCode.Vma, true),
  session(3, '2026-11-27', RunSessionCode.Endurance, false),
  session(4, '2026-11-29', RunSessionCode.LongRun, true),
]

const unavailability = (from: string, to: string, scope = UnavailabilityScope.All) => ({
  kind: UnplannedKind.Unavailability as const,
  from,
  to,
  scope,
  label: `pas dispo du ${from} au ${to}`,
})

describe('règle I1 — indisponibilité (§ 6)', () => {
  it('déplace une séance clé vers un jour libre de la semaine', () => {
    const [proposal, ...rest] = proposeForUnavailabilities(
      [unavailability('2026-11-24', '2026-11-24')],
      { upcoming: WEEK },
    )

    expect(rest).toHaveLength(0)
    expect(proposal!.ruleId).toBe(RuleId.I1)
    expect(proposal!.effect).toBe(ProposalEffect.MoveSession)
    expect(proposal!.target.id).toBe(2)
    expect(proposal!.payload).toEqual({ date: '2026-11-25' })
  })

  it('retire une séance facile plutôt que de la rattraper (§ 5, R6)', () => {
    const [proposal] = proposeForUnavailabilities([unavailability('2026-11-27', '2026-11-27')], {
      upcoming: WEEK,
    })

    expect(proposal!.effect).toBe(ProposalEffect.CancelSession)
    expect(proposal!.target.id).toBe(3)
  })

  it('retire la séance clé quand aucun jour ne respecte les 48 h', () => {
    const packed = [
      session(1, '2026-11-23', RunSessionCode.Threshold, true),
      session(2, '2026-11-25', RunSessionCode.Vma, true),
      session(3, '2026-11-27', RunSessionCode.Threshold, true),
      session(4, '2026-11-29', RunSessionCode.LongRun, true),
    ]

    const [proposal] = proposeForUnavailabilities([unavailability('2026-11-25', '2026-11-25')], {
      upcoming: packed,
    })

    expect(proposal!.effect).toBe(ProposalEffect.CancelSession)
  })

  it('ne touche que le sport visé par la portée', () => {
    const mixed = [
      ...WEEK,
      session(5, '2026-11-24', 'legs' as RunSessionCode, false, Sport.Strength),
    ]

    const proposals = proposeForUnavailabilities(
      [unavailability('2026-11-24', '2026-11-24', UnavailabilityScope.Strength)],
      { upcoming: mixed },
    )

    expect(proposals).toHaveLength(1)
    expect(proposals[0]!.target.id).toBe(5)
  })

  it('ne propose rien quand l’indisponibilité ne couvre aucune séance', () => {
    expect(
      proposeForUnavailabilities([unavailability('2026-12-14', '2026-12-16')], { upcoming: WEEK }),
    ).toEqual([])
  })

  it('couvre plusieurs jours d’un coup sans doublon', () => {
    const proposals = proposeForUnavailabilities(
      [unavailability('2026-11-23', '2026-11-27'), unavailability('2026-11-24', '2026-11-24')],
      { upcoming: WEEK },
    )

    expect(proposals.map((item) => item.target.id)).toEqual([1, 2, 3])
  })
})

describe('événements d’imprévu (§ 6)', () => {
  it('garde le RPE du modèle quand il est crédible', () => {
    expect(rpeFor({ rpeEstimate: 6, intensityProfile: IntensityProfile.Easy })).toBe(6)
  })

  it('retombe sur le profil d’intensité quand le RPE est hors bornes', () => {
    expect(rpeFor({ rpeEstimate: 0, intensityProfile: IntensityProfile.Hard })).toBe(7)
    expect(rpeFor({ rpeEstimate: 42, intensityProfile: IntensityProfile.Easy })).toBe(3)
  })

  it('couvre les bornes de l’indisponibilité, incluses', () => {
    const range = unavailability('2026-11-23', '2026-11-25')
    expect(coversDate(range, '2026-11-23')).toBe(true)
    expect(coversDate(range, '2026-11-25')).toBe(true)
    expect(coversDate(range, '2026-11-26')).toBe(false)
  })
})
