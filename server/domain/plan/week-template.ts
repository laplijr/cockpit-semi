import type { Prescription, PrescriptionContext } from '../running/session-types'
import {
  RunSessionCode,
  fitsInWeek,
  isAllowedInPhase,
  prescription,
} from '../running/session-types'
import type { AthleteConstraints } from '../athlete/constraints'
import { MONDAY } from '../athlete/constraints'
import type { IsoDate } from './calendar'
import { addDays } from './calendar'
import { PhaseType } from './phases'
import type { PlanWeek } from './weeks'

/** Séances clés appelées par chaque phase, dans l'ordre de priorité. */
const KEY_SESSIONS: Record<PhaseType, RunSessionCode[]> = {
  [PhaseType.Base]: [RunSessionCode.LongRun, RunSessionCode.Progressive],
  [PhaseType.ShortBase]: [RunSessionCode.LongRun, RunSessionCode.Hills],
  [PhaseType.Development]: [RunSessionCode.LongRun, RunSessionCode.Vma, RunSessionCode.Threshold],
  [PhaseType.Specific]: [RunSessionCode.LongRun, RunSessionCode.Threshold, RunSessionCode.HalfPace],
  [PhaseType.Speed]: [RunSessionCode.LongRun, RunSessionCode.Vma, RunSessionCode.Hills],
  [PhaseType.Taper]: [RunSessionCode.Threshold],
  [PhaseType.Recovery]: [],
  [PhaseType.Rebuild]: [RunSessionCode.LongRun, RunSessionCode.Threshold],
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
 * garde son jour, et la reprise limite les types autorisés.
 */
export function buildWeekTemplate({
  week,
  constraints,
  vdot,
}: WeekTemplateInput): PlannedSession[] {
  const available = [...constraints.availableDays].sort((a, b) => a - b)
  if (available.length === 0) return []

  const easyDays = new Set(constraints.easyDays ?? [MONDAY])
  const longRunDay = constraints.longRunDay ?? available.at(-1)!
  const context: PrescriptionContext = { vdot, weeklyVolumeM: week.targetRunM }

  const allowed = (code: RunSessionCode) =>
    isAllowedInPhase(code, week.phaseType) &&
    (week.allowedCodes === undefined || week.allowedCodes.includes(code)) &&
    fitsInWeek(code, vdot, week.targetRunM)

  const keyCodes = KEY_SESSIONS[week.phaseType].filter(allowed)
  const wantsLongRun = keyCodes.includes(RunSessionCode.LongRun)
  const otherKeys = keyCodes.filter((code) => code !== RunSessionCode.LongRun)

  const hardCandidates = available.filter(
    (day) => !easyDays.has(day) && (!wantsLongRun || day !== longRunDay),
  )
  const hardDays = spreadKeyDays(hardCandidates, otherKeys.length)

  const assignments = new Map<number, RunSessionCode>()
  if (wantsLongRun && available.includes(longRunDay)) {
    assignments.set(longRunDay, RunSessionCode.LongRun)
  }
  hardDays.forEach((day, index) => assignments.set(day, otherKeys[index]!))

  const filler = allowed(RunSessionCode.Strides) ? RunSessionCode.Strides : RunSessionCode.Endurance

  const codes = available.map((weekday) => ({
    weekday,
    code:
      assignments.get(weekday) ??
      (easyDays.has(weekday) || !allowed(filler) ? RunSessionCode.Endurance : filler),
    key: assignments.has(weekday),
  }))

  // Les séances clés prennent leur part réglée par les quotas ; le reste du
  // volume de la semaine se répartit également sur les séances faciles.
  const keyPrescriptions = new Map(
    codes
      .filter((entry) => entry.key)
      .map((entry) => [entry.weekday, prescription(entry.code, context)] as const),
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
