import type { AthleteConstraints } from '../athlete/constraints'
import { MONDAY } from '../athlete/constraints'
import { TrainingZone, paceFor } from '../fitness/vdot'
import type { Prescription, PrescriptionContext } from '../running/session-types'
import {
  RunSessionCode,
  fitsInWeek,
  isAllowedInPhase,
  prescription,
} from '../running/session-types'
import type { IsoDate } from './calendar'
import { addDays } from './calendar'
import { PhaseType } from './phases'
import type { PlanWeek } from './weeks'

/** Nombre maximal de séances d'éducatifs dans une semaine (§ 5). */
export const MAX_STRIDES_PER_WEEK = 2

/** Dans un cycle 5 km, la sortie longue est bornée en durée, pas en distance (§ 5). */
export const SHORT_CYCLE_LONG_RUN_MAX_MIN = 75

/**
 * Nombre de séances clés par phase, sortie longue comprise (§ 5).
 * Base et développement en portent deux, spécifique et vitesse trois.
 */
const KEY_COUNT: Record<PhaseType, number> = {
  [PhaseType.Base]: 2,
  [PhaseType.ShortBase]: 2,
  [PhaseType.Development]: 2,
  [PhaseType.Specific]: 3,
  [PhaseType.Speed]: 3,
  [PhaseType.Rebuild]: 2,
  [PhaseType.Taper]: 1,
  [PhaseType.Recovery]: 0,
  [PhaseType.Transition]: 0,
}

/** Séances clés candidates par phase, hors sortie longue, par ordre de priorité. */
const KEY_CANDIDATES: Record<PhaseType, RunSessionCode[]> = {
  [PhaseType.Base]: [RunSessionCode.Progressive, RunSessionCode.Hills],
  [PhaseType.ShortBase]: [RunSessionCode.Hills, RunSessionCode.Progressive],
  [PhaseType.Development]: [RunSessionCode.Vma, RunSessionCode.Threshold],
  [PhaseType.Specific]: [RunSessionCode.Threshold, RunSessionCode.HalfPace],
  [PhaseType.Speed]: [RunSessionCode.Vma, RunSessionCode.Hills],
  [PhaseType.Rebuild]: [RunSessionCode.Threshold],
  [PhaseType.Taper]: [RunSessionCode.Threshold],
  [PhaseType.Recovery]: [],
  [PhaseType.Transition]: [],
}

export interface PlannedSession {
  date: IsoDate
  weekday: number
  code: RunSessionCode
  key: boolean
  prescription: Prescription
}

export interface WeekTemplateInput {
  week: PlanWeek
  constraints: AthleteConstraints
  vdot: number
  /** Jours sans séance : jour de course, lendemain d'une course A (§ 5). */
  blockedDates?: IsoDate[]
  /** Vrai dans un cycle 5 km : la sortie longue passe alors en durée. */
  shortCycle?: boolean
}

function dayOfWeek(week: PlanWeek, weekday: number): IsoDate {
  return addDays(week.startDate, weekday - 1)
}

/** Deux séances clés ne se suivent pas : on garde au moins un jour d'écart. */
function spreadKeyDays(candidates: number[], count: number): number[] {
  const chosen: number[] = []
  for (const day of candidates) {
    if (chosen.length >= count) break
    if (chosen.some((taken) => Math.abs(taken - day) < 2)) continue
    chosen.push(day)
  }

  for (const day of candidates) {
    if (chosen.length >= count) break
    if (!chosen.includes(day)) chosen.push(day)
  }

  return chosen.sort((a, b) => a - b)
}

/**
 * Semaine type : place les séances clés de la phase sur les jours disponibles,
 * puis comble le reste en endurance. Le lundi reste facile, la sortie longue
 * garde son jour, la reprise limite les types autorisés et les jours de course
 * ne portent rien.
 */
export function buildWeekTemplate({
  week,
  constraints,
  vdot,
  blockedDates = [],
  shortCycle = false,
}: WeekTemplateInput): PlannedSession[] {
  const blocked = new Set(blockedDates)
  const available = [...constraints.availableDays]
    .sort((a, b) => a - b)
    .filter((weekday) => !blocked.has(dayOfWeek(week, weekday)))

  if (available.length === 0) return []

  const easyDays = new Set(constraints.easyDays ?? [MONDAY])
  const longRunDay = constraints.longRunDay ?? available.at(-1)!
  const context: PrescriptionContext = {
    vdot,
    weeklyVolumeM: week.targetRunM,
    phaseProgress: week.phaseProgress,
  }

  const allowed = (code: RunSessionCode) =>
    isAllowedInPhase(code, week.phaseType) &&
    (week.allowedCodes === undefined || week.allowedCodes.includes(code)) &&
    fitsInWeek(code, vdot, week.targetRunM, week.phaseProgress)

  const keyBudget = KEY_COUNT[week.phaseType]
  const wantsLongRun = keyBudget > 0 && allowed(RunSessionCode.LongRun)
  const otherKeyBudget = Math.max(0, keyBudget - (wantsLongRun ? 1 : 0))

  const otherKeys = KEY_CANDIDATES[week.phaseType].filter(allowed).slice(0, otherKeyBudget)

  // Le test 20′ prend la place de la séance clé du milieu de semaine (§ 5).
  if (week.test && otherKeyBudget > 0) {
    if (otherKeys.length > 0) otherKeys[0] = RunSessionCode.Test
    else otherKeys.push(RunSessionCode.Test)
  }

  const hardCandidates = available.filter(
    (day) => !easyDays.has(day) && (!wantsLongRun || day !== longRunDay),
  )
  const hardDays = spreadKeyDays(hardCandidates, otherKeys.length)

  const assignments = new Map<number, RunSessionCode>()
  if (wantsLongRun && available.includes(longRunDay)) {
    assignments.set(longRunDay, RunSessionCode.LongRun)
  }
  hardDays.forEach((day, index) => assignments.set(day, otherKeys[index]!))

  // Les éducatifs ponctuent la semaine, ils ne la remplissent pas.
  let stridesLeft = allowed(RunSessionCode.Strides) ? MAX_STRIDES_PER_WEEK : 0

  const codes = available.map((weekday) => {
    const assigned = assignments.get(weekday)
    if (assigned) return { weekday, code: assigned, key: true }

    if (!easyDays.has(weekday) && stridesLeft > 0) {
      stridesLeft -= 1
      return { weekday, code: RunSessionCode.Strides, key: false }
    }

    return { weekday, code: RunSessionCode.Endurance, key: false }
  })

  // Les séances clés prennent leur part réglée par les quotas ; le reste du
  // volume de la semaine se répartit également sur les séances faciles.
  const keyPrescriptions = new Map(
    codes
      .filter((entry) => entry.key)
      .map(
        (entry) =>
          [entry.weekday, prescribeKey(entry.code, context, shortCycle, vdot, week)] as const,
      ),
  )
  const keyVolume = [...keyPrescriptions.values()].reduce(
    (total, item) => total + item.totalDistanceM,
    0,
  )
  const easyCount = codes.length - keyPrescriptions.size
  const easyShare = easyCount > 0 ? Math.max(0, week.targetRunM - keyVolume) / easyCount : 0

  return codes.map((entry) => ({
    date: dayOfWeek(week, entry.weekday),
    weekday: entry.weekday,
    code: entry.code,
    key: entry.key,
    prescription:
      keyPrescriptions.get(entry.weekday) ??
      prescription(entry.code, { ...context, targetDistanceM: Math.round(easyShare) }),
  }))
}

function prescribeKey(
  code: RunSessionCode,
  context: PrescriptionContext,
  shortCycle: boolean,
  vdot: number,
  week: PlanWeek,
): Prescription {
  if (code !== RunSessionCode.LongRun || !shortCycle) return prescription(code, context)

  // Cycle 5 km : la sortie longue est bornée à 75′ à l'allure E (§ 5).
  const cap = (SHORT_CYCLE_LONG_RUN_MAX_MIN * 60 * 1000) / paceFor(vdot, TrainingZone.Easy)
  return prescription(code, {
    ...context,
    targetDistanceM: Math.min(week.longRunMaxM, Math.round(cap)),
  })
}
