import { describe, expect, it } from 'vitest'
import { CycleSessionCode } from '~~/server/domain/cycling/session-types'
import { TrainingZone, paceFor } from '~~/server/domain/fitness/vdot'
import {
  EditKind,
  EditWarning,
  draftPrescription,
  editImpact,
  editRefusal,
  type ImpactInput,
  type SessionDraft,
} from '~~/server/domain/plan/manual-edit'
import { SessionStatus, type PlannedSessionRecord } from '~~/server/domain/plan/session'
import { RacePriority } from '~~/server/domain/races/race'
import { RunSessionCode } from '~~/server/domain/running/session-types'
import { Sport } from '~~/server/domain/shared/sport'

const VDOT = 35
const EASY_PACE = paceFor(VDOT, TrainingZone.Easy)
const TODAY = '2026-11-18'
const TARGET_RUN_M = 40_000

function run(
  id: number,
  date: string,
  distanceM: number,
  code: RunSessionCode = RunSessionCode.Endurance,
  key = false,
): PlannedSessionRecord {
  return {
    id,
    date,
    sport: Sport.Running,
    code,
    status: SessionStatus.Planned,
    key,
    prescription: {
      code,
      label: code,
      totalDistanceM: distanceM,
      qualityDistanceM: key ? Math.round(distanceM * 0.4) : 0,
      expectedRpe: key ? 7 : 3,
      steps: [{ label: 'Course', distanceM, paceSecPerKm: EASY_PACE }],
    },
  }
}

/** Semaine à la cible : 40 km posés pour 40 km visés. */
function week(): PlannedSessionRecord[] {
  return [
    run(1, '2026-11-17', 10_000, RunSessionCode.Vma, true),
    run(2, '2026-11-19', 9000),
    run(3, '2026-11-21', 9000),
    run(4, '2026-11-22', 12_000, RunSessionCode.LongRun, true),
  ]
}

function impact(overrides: Partial<ImpactInput> = {}) {
  const before = overrides.before ?? week()
  return editImpact({
    date: TODAY,
    before,
    after: overrides.after ?? before,
    targetRunM: TARGET_RUN_M,
    previousWeekRunM: 38_000,
    maxWeeklyIncreasePct: 10,
    races: [],
    ...overrides,
  })
}

const codes = (result: { notices: { code: EditWarning }[] }) => result.notices.map((n) => n.code)

describe('les seuls refus durs de l’édition manuelle (§ 5, P6.43)', () => {
  const base = { date: TODAY, today: TODAY, withinPlan: true }

  it('refuse d’ajouter une séance dans le passé, l’accepte aujourd’hui et demain', () => {
    expect(editRefusal({ ...base, kind: EditKind.Add, date: '2026-11-17' })).toMatch(/passé/)
    expect(editRefusal({ ...base, kind: EditKind.Add })).toBeUndefined()
    expect(editRefusal({ ...base, kind: EditKind.Add, date: '2026-11-25' })).toBeUndefined()
  })

  it('refuse de toucher une séance déjà faite ou déjà retirée', () => {
    const done = { status: SessionStatus.Done }
    const cancelled = { status: SessionStatus.Cancelled }
    const planned = { status: SessionStatus.Planned }

    expect(editRefusal({ ...base, kind: EditKind.Replace, session: done })).toMatch(/déjà faite/)
    expect(editRefusal({ ...base, kind: EditKind.Cancel, session: cancelled })).toMatch(
      /déjà retirée/,
    )
    expect(editRefusal({ ...base, kind: EditKind.Cancel, session: planned })).toBeUndefined()
  })

  it('refuse une date hors du plan actif', () => {
    expect(editRefusal({ ...base, kind: EditKind.Add, withinPlan: false })).toMatch(/hors du plan/)
  })

  /** Un dépassement de volume n'est pas un refus : c'est un avertissement. */
  it('ne refuse jamais pour une raison d’entraînement', () => {
    const huge = [...week(), run(9, TODAY, 30_000)]
    expect(codes(impact({ after: huge, posed: run(9, TODAY, 30_000) }))).toContain(
      EditWarning.OverWeeklyTarget,
    )
    expect(editRefusal({ ...base, kind: EditKind.Add })).toBeUndefined()
  })
})

describe('la structure d’une séance posée à la main (§ 5, P6.43)', () => {
  it('lit une durée de course en distance à l’allure E', () => {
    const draft: SessionDraft = {
      sport: Sport.Running,
      code: RunSessionCode.Endurance,
      durationMin: 30,
    }
    const built = draftPrescription(draft, { vdot: VDOT, targetRunM: TARGET_RUN_M })

    expect(built.totalDistanceM).toBe(Math.round((30 * 60 * 1000) / EASY_PACE))
  })

  it('respecte la distance quand c’est elle qui est donnée', () => {
    const draft: SessionDraft = {
      sport: Sport.Running,
      code: RunSessionCode.Endurance,
      distanceM: 7000,
    }
    expect(draftPrescription(draft, { vdot: VDOT, targetRunM: TARGET_RUN_M }).totalDistanceM).toBe(
      7000,
    )
  })

  /** Le générateur est borné par le type ; la main de Ronan ne l'est pas. */
  it('pose un vélo de 30′ là où le générateur en imposerait 75', () => {
    const draft: SessionDraft = {
      sport: Sport.Cycling,
      code: CycleSessionCode.EnduranceZ2,
      durationMin: 30,
    }
    expect(draftPrescription(draft, { vdot: VDOT, targetRunM: TARGET_RUN_M }).durationMin).toBe(30)
  })
})

describe('ce que l’édition coûte, dit et jamais bloqué (§ 5, P6.43)', () => {
  it('signale le volume au-dessus de la cible, et se tait dans la marge', () => {
    const posed = run(9, TODAY, 8000)
    expect(codes(impact({ after: [...week(), posed], posed }))).toContain(
      EditWarning.OverWeeklyTarget,
    )

    const small = run(9, TODAY, 1000)
    expect(codes(impact({ after: [...week(), small], posed: small }))).not.toContain(
      EditWarning.OverWeeklyTarget,
    )
  })

  it('signale le volume sous la cible quand une séance est retirée', () => {
    const after = week().filter((item) => item.id !== 4)
    expect(codes(impact({ after }))).toContain(EditWarning.BelowWeeklyTarget)
  })

  it('signale la montée au-delà du plafond du profil, et se tait en dessous', () => {
    const posed = run(9, TODAY, 8000)
    expect(codes(impact({ after: [...week(), posed], posed }))).toContain(
      EditWarning.OverWeeklyIncrease,
    )
    expect(
      codes(impact({ after: [...week(), posed], posed, previousWeekRunM: 60_000 })),
    ).not.toContain(EditWarning.OverWeeklyIncrease)
  })

  it('signale deux séances clés à moins de 48 h, et se tait à trois jours', () => {
    const close = run(9, '2026-11-18', 8000, RunSessionCode.Threshold, true)
    expect(
      codes(impact({ date: '2026-11-18', after: [...week(), close], posed: close })),
    ).toContain(EditWarning.KeySessionsTooClose)

    const far = run(9, '2026-11-20', 8000, RunSessionCode.Threshold, true)
    expect(
      codes(impact({ date: '2026-11-20', after: [...week(), far], posed: far })),
    ).not.toContain(EditWarning.KeySessionsTooClose)
  })

  it('signale un jour de course et le lendemain d’une course A', () => {
    const posed = run(9, TODAY, 5000)
    const races = [{ date: TODAY, priority: RacePriority.A }]
    expect(codes(impact({ after: [...week(), posed], posed, races }))).toContain(
      EditWarning.RaceDay,
    )

    const eve = [{ date: '2026-11-17', priority: RacePriority.A }]
    expect(codes(impact({ after: [...week(), posed], posed, races: eve }))).toContain(
      EditWarning.DayAfterRaceA,
    )
    expect(codes(impact({ after: [...week(), posed], posed }))).not.toContain(EditWarning.RaceDay)
  })

  it('signale une course posée pendant une pause qui l’interdit', () => {
    const posed = run(9, TODAY, 5000)
    const allowances = {
      running: false,
      cycling: true,
      upperBodyStrength: true,
      legStrength: false,
    }
    expect(codes(impact({ after: [...week(), posed], posed, allowances }))).toContain(
      EditWarning.ForbiddenByPause,
    )
    expect(
      codes(
        impact({ after: [...week(), posed], posed, allowances: { ...allowances, running: true } }),
      ),
    ).not.toContain(EditWarning.ForbiddenByPause)
  })

  it('rend le volume avant et après, pour que l’écran montre le coût', () => {
    const posed = run(9, TODAY, 5000)
    const result = impact({ after: [...week(), posed], posed })

    expect(result.runBeforeM).toBe(40_000)
    expect(result.runAfterM).toBe(45_000)
    expect(result.targetRunM).toBe(TARGET_RUN_M)
  })
})
