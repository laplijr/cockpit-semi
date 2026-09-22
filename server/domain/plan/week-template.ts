import type { AthleteConstraints } from '../athlete/constraints'
import { MAX_RUNS_PER_WEEK, MIN_RUNS_PER_WEEK, MONDAY, SUNDAY } from '../athlete/constraints'
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

/** Nombre maximal de séances d'endurance portant des lignes droites (§ 5). */
export const MAX_STRIDES_PER_WEEK = 2

/** Dans un cycle 5 km, la sortie longue est bornée en durée, pas en distance (§ 5). */
export const SHORT_CYCLE_LONG_RUN_MAX_MIN = 75

/** Bornes de durée d'une endurance, à l'allure E (§ 5). */
export const EASY_MIN_MIN = 35
export const EASY_MAX_MIN = 75

/** Séances clés candidates par phase, hors sortie longue, par ordre de priorité. */
const KEY_CANDIDATES: Record<PhaseType, RunSessionCode[]> = {
  [PhaseType.Base]: [RunSessionCode.Progressive, RunSessionCode.Hills],
  [PhaseType.ShortBase]: [RunSessionCode.Hills, RunSessionCode.Progressive],
  [PhaseType.Development]: [RunSessionCode.Vma, RunSessionCode.Threshold],
  // En spécifique, l'allure semi se court dans la sortie longue, pas à part (§ 5).
  [PhaseType.Specific]: [RunSessionCode.Threshold, RunSessionCode.Vma],
  [PhaseType.Speed]: [RunSessionCode.Vma, RunSessionCode.Hills],
  [PhaseType.Rebuild]: [RunSessionCode.Threshold],
  [PhaseType.Taper]: [RunSessionCode.Threshold],
  [PhaseType.Recovery]: [],
  [PhaseType.Transition]: [],
}

/** Nombre de séances clés par phase, sortie longue comprise (§ 5). */
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

export interface WeekTemplate {
  sessions: PlannedSession[]
  /** Vrai quand le volume visé dépassait ce que les courses peuvent porter. */
  volumeCapped: boolean
}

function dayOfWeek(week: PlanWeek, weekday: number): IsoDate {
  return addDays(week.startDate, weekday - 1)
}

/**
 * Phases dont le nombre de courses est une réduction et non un défaut : y
 * laisser passer une fréquence déclarée, c'est défaire l'affûtage (§ 5).
 */
const REDUCING_PHASES: PhaseType[] = [PhaseType.Taper, PhaseType.Recovery, PhaseType.Transition]

function reducesRuns(week: PlanWeek): boolean {
  return week.comebackRatio !== undefined || REDUCING_PHASES.includes(week.phaseType)
}

/** Nombre de courses de la semaine : jamais plus que de jours praticables. */
export function runsFor(week: PlanWeek, constraints: AthleteConstraints, days: number): number {
  const declared = constraints.runsPerWeek ?? week.runs
  const wanted = reducesRuns(week) ? Math.min(declared, week.runs) : declared
  const bounded = Math.min(MAX_RUNS_PER_WEEK, Math.max(MIN_RUNS_PER_WEEK, wanted))
  return Math.min(bounded, days)
}

export const DAYS_PER_WEEK = 7

/**
 * Écart entre deux jours de la semaine, qui boucle : le lundi est à un jour du
 * dimanche, pas à six. Sans ce bouclage, un lundi n'est jamais vu comme le
 * lendemain d'une sortie longue du dimanche (§ 5).
 */
export function dayGap(from: number, to: number): number {
  const straight = Math.abs(from - to)
  return Math.min(straight, DAYS_PER_WEEK - straight)
}

/** Choisit des jours espacés d'au moins un jour de repos. */
function spread(candidates: number[], count: number): number[] {
  const chosen: number[] = []
  for (const day of candidates) {
    if (chosen.length >= count) break
    if (chosen.some((taken) => dayGap(taken, day) < 2)) continue
    chosen.push(day)
  }

  for (const day of candidates) {
    if (chosen.length >= count) break
    if (!chosen.includes(day)) chosen.push(day)
  }

  return chosen.sort((a, b) => a - b)
}

/** Veille d'un jour de la semaine, en bouclant : la veille du lundi est le dimanche. */
export const dayBefore = (day: number) => (day === MONDAY ? SUNDAY : day - 1)

/**
 * Jours d'endurance : parmi les jours libres, ceux les plus éloignés des jours
 * durs, pour garder un jour vide après la sortie longue et après chaque clé.
 */
function easyDaysFor(
  free: number[],
  hard: number[],
  count: number,
  longRunDay: number | undefined,
): number[] {
  const distance = (day: number) =>
    hard.length === 0 ? DAYS_PER_WEEK : Math.min(...hard.map((taken) => dayGap(taken, day)))

  /**
   * Le lendemain d'un jour dur est un mauvais choix ; le lendemain de la sortie
   * longue est le pire, c'est la séance la plus coûteuse de la semaine. Ce jour
   * revient au vélo, pas à une endurance au plafond (§ 5).
   */
  const cost = (day: number) => {
    const previous = dayBefore(day)
    if (previous === longRunDay) return 2
    return hard.includes(previous) ? 1 : 0
  }

  return [...free]
    .sort((a, b) => cost(a) - cost(b) || distance(b) - distance(a) || a - b)
    .slice(0, count)
    .sort((a, b) => a - b)
}

/**
 * Semaine type : un nombre de courses borné par la phase, chacune avec un rôle.
 * Les jours disponibles disent où courir, pas combien (§ 5).
 */
export function buildWeekTemplate({
  week,
  constraints,
  vdot,
  blockedDates = [],
  shortCycle = false,
}: WeekTemplateInput): WeekTemplate {
  const blocked = new Set(blockedDates)
  const available = [...constraints.availableDays]
    .sort((a, b) => a - b)
    .filter((weekday) => !blocked.has(dayOfWeek(week, weekday)))

  if (available.length === 0) return { sessions: [], volumeCapped: false }

  const runs = runsFor(week, constraints, available.length)
  if (runs === 0) return { sessions: [], volumeCapped: false }

  const easyPreferred = new Set(constraints.easyDays ?? [MONDAY])
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

  const wantsLongRun =
    KEY_COUNT[week.phaseType] > 0 &&
    allowed(RunSessionCode.LongRun) &&
    available.includes(longRunDay)
  const keyBudget = Math.max(0, Math.min(KEY_COUNT[week.phaseType], runs) - (wantsLongRun ? 1 : 0))

  const otherKeys = KEY_CANDIDATES[week.phaseType].filter(allowed).slice(0, keyBudget)
  if (week.test && keyBudget > 0) {
    if (otherKeys.length > 0) otherKeys[0] = RunSessionCode.Test
    else otherKeys.push(RunSessionCode.Test)
  }

  const assignments = new Map<number, RunSessionCode>()
  if (wantsLongRun) assignments.set(longRunDay, RunSessionCode.LongRun)

  const hardCandidates = available.filter((day) => !easyPreferred.has(day) && !assignments.has(day))
  spread(hardCandidates, otherKeys.length).forEach((day, index) =>
    assignments.set(day, otherKeys[index]!),
  )

  const hardDays = [...assignments.keys()]
  const free = available.filter((day) => !assignments.has(day))
  const easySlots = Math.max(0, runs - assignments.size)
  const placedLongRun = wantsLongRun ? longRunDay : undefined
  for (const day of easyDaysFor(free, hardDays, easySlots, placedLongRun)) {
    assignments.set(day, RunSessionCode.Endurance)
  }

  return buildPrescriptions({ week, assignments, context, vdot, shortCycle, allowed })
}

interface PrescriptionInput {
  week: PlanWeek
  assignments: Map<number, RunSessionCode>
  context: PrescriptionContext
  vdot: number
  shortCycle: boolean
  allowed: (code: RunSessionCode) => boolean
}

function buildPrescriptions({
  week,
  assignments,
  context,
  vdot,
  shortCycle,
  allowed,
}: PrescriptionInput): WeekTemplate {
  const days = [...assignments.keys()].sort((a, b) => a - b)
  const easyPace = paceFor(vdot, TrainingZone.Easy)
  const minEasyM = Math.round((EASY_MIN_MIN * 60 * 1000) / easyPace)
  const maxEasyM = Math.round((EASY_MAX_MIN * 60 * 1000) / easyPace)

  const keyDays = days.filter((day) => assignments.get(day) !== RunSessionCode.Endurance)
  const easyDays = days.filter((day) => assignments.get(day) === RunSessionCode.Endurance)

  const prescriptions = new Map<number, Prescription>()
  for (const day of keyDays) {
    prescriptions.set(day, prescribeKey(assignments.get(day)!, context, shortCycle, vdot, week))
  }

  const keyVolume = [...prescriptions.values()].reduce(
    (total, item) => total + item.totalDistanceM,
    0,
  )
  let remaining = Math.max(0, week.targetRunM - keyVolume)

  // Les lignes droites s'intègrent à une endurance, jamais en séance à part (§ 5).
  let stridesLeft = allowed(RunSessionCode.Strides) ? MAX_STRIDES_PER_WEEK : 0

  const easyShare = easyDays.length === 0 ? 0 : remaining / easyDays.length
  const floored = Math.min(maxEasyM, Math.max(minEasyM, Math.round(easyShare)))
  // Sur une semaine trop courte, le plancher de 35′ ferait dépasser le volume :
  // mieux vaut une endurance plus brève qu'une semaine hors cible.
  const overshoots = keyVolume + floored * easyDays.length > week.targetRunM * 1.05
  const clamped = overshoots ? Math.max(0, Math.round(easyShare)) : floored

  for (const day of easyDays) {
    prescriptions.set(
      day,
      prescription(RunSessionCode.Endurance, {
        ...context,
        targetDistanceM: clamped,
        withStrides: stridesLeft > 0,
      }),
    )
    if (stridesLeft > 0) stridesLeft -= 1
    remaining -= clamped
  }

  // Le surplus va d'abord à la sortie longue, dans la limite de son quota.
  let volumeCapped = false
  if (remaining > 0) {
    const longRunDay = keyDays.find((day) => assignments.get(day) === RunSessionCode.LongRun)
    if (longRunDay !== undefined) {
      const current = prescriptions.get(longRunDay)!
      // Le plafond du cycle 5 km prime sur le quota de 30 % (§ 5).
      const ceiling = shortCycle
        ? Math.min(week.longRunMaxM, shortCycleLongRunCap(vdot))
        : week.longRunMaxM
      const room = Math.max(0, ceiling - current.totalDistanceM)
      const added = Math.min(room, remaining)
      if (added > 0) {
        prescriptions.set(
          longRunDay,
          prescription(RunSessionCode.LongRun, {
            ...context,
            targetDistanceM: current.totalDistanceM + added,
          }),
        )
        remaining -= added
      }
    }
    volumeCapped = remaining > 1
  }

  return {
    volumeCapped,
    sessions: days.map((weekday) => ({
      date: addDays(week.startDate, weekday - 1),
      weekday,
      code: assignments.get(weekday)!,
      key: assignments.get(weekday) !== RunSessionCode.Endurance,
      prescription: prescriptions.get(weekday)!,
    })),
  }
}

/** Distance couverte en 75′ à l'allure E : plafond de la sortie longue d'un cycle 5 km. */
function shortCycleLongRunCap(vdot: number): number {
  return Math.round((SHORT_CYCLE_LONG_RUN_MAX_MIN * 60 * 1000) / paceFor(vdot, TrainingZone.Easy))
}

function prescribeKey(
  code: RunSessionCode,
  context: PrescriptionContext,
  shortCycle: boolean,
  vdot: number,
  week: PlanWeek,
): Prescription {
  if (code === RunSessionCode.LongRun && shortCycle) {
    // Cycle 5 km : la sortie longue est bornée à 75′ à l'allure E (§ 5).
    return prescription(code, {
      ...context,
      targetDistanceM: Math.min(week.longRunMaxM, shortCycleLongRunCap(vdot)),
    })
  }

  // En spécifique, la sortie longue porte sa portion à allure semi (§ 5).
  if (code === RunSessionCode.LongRun && week.phaseType === PhaseType.Specific) {
    return prescription(code, { ...context, withHalfPaceFinish: true })
  }

  return prescription(code, context)
}
