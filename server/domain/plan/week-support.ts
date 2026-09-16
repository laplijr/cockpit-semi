import type { AthleteConstraints } from '../athlete/constraints'
import type { PauseAllowances } from '../pause/pause'
import { CycleSessionCode, cycleSessionType, cyclingPrescription } from '../cycling/session-types'
import { RunSessionCode } from '../running/session-types'
import type { Prescription } from '../shared/prescription'
import { prescribedUnits } from '../shared/prescription'
import { Sport } from '../shared/sport'
import { strengthPhaseFor } from '../strength/phases'
import { StrengthSessionCode, strengthPrescription } from '../strength/session-types'
import type { IsoDate } from './calendar'
import { addDays } from './calendar'
import { PhaseType } from './phases'
import type { PlannedSession } from './week-template'
import type { PlanWeek } from './weeks'

/** Séances muscu de la semaine, par phase et par ordre de priorité (§ 5). */
export const STRENGTH_PER_PHASE: Record<PhaseType, StrengthSessionCode[]> = {
  [PhaseType.Base]: [StrengthSessionCode.Legs, StrengthSessionCode.Push, StrengthSessionCode.Pull],
  [PhaseType.ShortBase]: [
    StrengthSessionCode.Legs,
    StrengthSessionCode.Push,
    StrengthSessionCode.Pull,
  ],
  [PhaseType.Development]: [
    StrengthSessionCode.Legs,
    StrengthSessionCode.Push,
    StrengthSessionCode.Pull,
  ],
  [PhaseType.Speed]: [StrengthSessionCode.Legs, StrengthSessionCode.Push, StrengthSessionCode.Pull],
  [PhaseType.Specific]: [StrengthSessionCode.Legs, StrengthSessionCode.Push],
  [PhaseType.Rebuild]: [StrengthSessionCode.Legs, StrengthSessionCode.Push],
  [PhaseType.Taper]: [StrengthSessionCode.Push],
  [PhaseType.Recovery]: [StrengthSessionCode.Mobility, StrengthSessionCode.Push],
  [PhaseType.Transition]: [],
}

/** Nombre de sorties vélo par semaine : deux en base, une ensuite (§ 5). */
export const CYCLING_PER_PHASE: Record<PhaseType, number> = {
  [PhaseType.Base]: 2,
  [PhaseType.ShortBase]: 2,
  [PhaseType.Development]: 1,
  [PhaseType.Specific]: 1,
  [PhaseType.Speed]: 1,
  [PhaseType.Rebuild]: 1,
  [PhaseType.Taper]: 0,
  [PhaseType.Recovery]: 1,
  [PhaseType.Transition]: 0,
}

/** La muscu s'arrête une semaine avant une course A (§ 5). */
export const STRENGTH_STOP_DAYS_BEFORE_RACE = 7

/** Part maximale de la charge hebdomadaire laissée au vélo en spécifique (§ 5). */
export const CYCLING_MAX_LOAD_SHARE = 0.3

export interface PlannedSupportSession {
  date: IsoDate
  weekday: number
  sport: Sport.Cycling | Sport.Strength
  code: CycleSessionCode | StrengthSessionCode
  prescription: Prescription
}

export interface WeekSupportInput {
  week: PlanWeek
  constraints: AthleteConstraints
  /** Courses déjà posées : elles décident des jours durs et des jours libres. */
  runs: PlannedSession[]
  /** Rang de la semaine dans sa phase, à partir de 1 : pilote les doses muscu. */
  weekInPhase: number
  /** Date de la prochaine course A : la muscu s'arrête sept jours avant. */
  nextRaceADate?: IsoDate | null
  /** Autorisations de la pause en cours : une blessure basse gèle les jambes. */
  allowances?: PauseAllowances
}

export interface WeekSupport {
  sessions: PlannedSupportSession[]
  targetCyclingMin: number
  targetStrengthCount: number
}

/**
 * Pose le vélo et la muscu sur la semaine, une fois les courses placées :
 * la muscu le soir des jours durs, le vélo sur les jours sans course, de
 * préférence le lendemain d'une séance clé (§ 5).
 */
export function buildWeekSupport({
  week,
  constraints,
  runs,
  weekInPhase,
  nextRaceADate = null,
  allowances,
}: WeekSupportInput): WeekSupport {
  const available = [...constraints.availableDays].sort((a, b) => a - b)
  if (available.length === 0) return EMPTY

  const runDays = new Set(runs.map((run) => run.weekday))
  const keyDays = new Set(runs.filter((run) => run.key).map((run) => run.weekday))
  const longRunDay = runs.find((run) => run.code === RunSessionCode.LongRun)?.weekday

  const strength = placeStrength({
    week,
    available,
    runDays,
    keyDays,
    longRunDay,
    weekInPhase,
    nextRaceADate,
    allowances,
  })

  const cycling = placeCycling({
    week,
    available,
    runDays,
    keyDays,
    taken: new Set(strength.map((session) => session.weekday)),
    runs,
    strength,
  })

  const sessions = [...strength, ...cycling].sort((a, b) => a.weekday - b.weekday)

  return {
    sessions,
    targetCyclingMin: cycling.reduce(
      (total, session) => total + (session.prescription.durationMin ?? 0),
      0,
    ),
    targetStrengthCount: strength.length,
  }
}

const EMPTY: WeekSupport = { sessions: [], targetCyclingMin: 0, targetStrengthCount: 0 }

interface StrengthPlacementInput {
  week: PlanWeek
  available: number[]
  runDays: Set<number>
  keyDays: Set<number>
  longRunDay: number | undefined
  weekInPhase: number
  nextRaceADate: IsoDate | null
  allowances: PauseAllowances | undefined
}

function placeStrength({
  week,
  available,
  runDays,
  keyDays,
  longRunDay,
  weekInPhase,
  nextRaceADate,
  allowances,
}: StrengthPlacementInput): PlannedSupportSession[] {
  const legsAllowed = allowances?.legStrength ?? true
  const codes = STRENGTH_PER_PHASE[week.phaseType].filter(
    (code) => legsAllowed || code !== StrengthSessionCode.Legs,
  )

  const phase = strengthPhaseFor(week.phaseType, weekInPhase)
  const sessions: PlannedSupportSession[] = []
  const taken = new Set<number>()

  for (const code of codes) {
    const day = available
      .filter((weekday) => !taken.has(weekday))
      .filter((weekday) => !isRaceWeek(week, weekday, nextRaceADate))
      .sort((a, b) => strengthScore(b, code) - strengthScore(a, code) || a - b)
      .at(0)

    if (day === undefined) break
    taken.add(day)
    sessions.push({
      date: addDays(week.startDate, day - 1),
      weekday: day,
      sport: Sport.Strength,
      code,
      prescription: strengthPrescription(code, { phase, weekInPhase }),
    })
  }

  return sessions.sort((a, b) => a.weekday - b.weekday)

  /**
   * Le Legs va sur un jour dur, jamais la veille de la sortie longue ni d'une
   * séance clé ; le haut du corps suit les autres jours de course, pour laisser
   * les jours vides au vélo.
   */
  function strengthScore(weekday: number, code: StrengthSessionCode): number {
    const isKey = keyDays.has(weekday)
    const isRun = runDays.has(weekday)
    const eveOfLongRun = longRunDay !== undefined && weekday === longRunDay - 1
    const eveOfKey = keyDays.has(weekday + 1)

    if (code !== StrengthSessionCode.Legs) return isRun ? 2 : 1

    let score = isKey && weekday !== longRunDay ? 4 : isRun && weekday !== longRunDay ? 2 : 1
    if (weekday === longRunDay) score -= 4
    if (eveOfLongRun) score -= 5
    if (eveOfKey) score -= 3
    return score
  }
}

/** Sept jours avant une course A, la muscu s'arrête (§ 5). */
function isRaceWeek(week: PlanWeek, weekday: number, nextRaceADate: IsoDate | null): boolean {
  if (!nextRaceADate) return false
  const date = addDays(week.startDate, weekday - 1)
  return date > addDays(nextRaceADate, -STRENGTH_STOP_DAYS_BEFORE_RACE) && date <= nextRaceADate
}

interface CyclingPlacementInput {
  week: PlanWeek
  available: number[]
  runDays: Set<number>
  keyDays: Set<number>
  taken: Set<number>
  runs: PlannedSession[]
  strength: PlannedSupportSession[]
}

function placeCycling({
  week,
  available,
  runDays,
  keyDays,
  taken,
  runs,
  strength,
}: CyclingPlacementInput): PlannedSupportSession[] {
  const wanted = CYCLING_PER_PHASE[week.phaseType]
  if (wanted === 0) return []

  const free = available
    .filter((weekday) => !runDays.has(weekday) && !taken.has(weekday))
    .sort((a, b) => Number(keyDays.has(b - 1)) - Number(keyDays.has(a - 1)) || a - b)
    .slice(0, wanted)

  if (free.length === 0) return []

  const otherUnits =
    sumUnits(runs.map((run) => run.prescription)) +
    sumUnits(strength.map((session) => session.prescription))

  const sessions: PlannedSupportSession[] = []
  for (const [index, weekday] of free.entries()) {
    const code = cyclingCodeFor(week, index, free.length)
    const duration = durationFor(code, week, otherUnits, free.length)
    /** Sous la durée minimale du type, la séance n'a plus de sens : on la retire. */
    if (duration !== undefined && duration < cycleSessionType(code).minDurationMin) continue

    sessions.push({
      date: addDays(week.startDate, weekday - 1),
      weekday,
      sport: Sport.Cycling,
      code,
      prescription: cyclingPrescription(code, duration),
    })
  }

  return sessions
}

/**
 * Sortie longue vélo dans la semaine allégée d'une base ou d'un développement
 * qui porte deux sorties : elle remplace alors l'une des deux, sans ajouter de
 * charge à une semaine qui allège. Force basse cadence en relance pour le
 * dénivelé de Madrid, Z2 partout ailleurs (§ 5).
 */
function cyclingCodeFor(week: PlanWeek, index: number, rides: number): CycleSessionCode {
  if (week.phaseType === PhaseType.Rebuild) return CycleSessionCode.LowCadenceForce

  const longRideWeek =
    week.light &&
    rides > 1 &&
    (week.phaseType === PhaseType.Base || week.phaseType === PhaseType.Development)
  return longRideWeek && index === 0 ? CycleSessionCode.LongRide : CycleSessionCode.EnduranceZ2
}

/**
 * En phase spécifique, le vélo reste sous 30 % de la charge de la semaine :
 * c'est la course qui porte le stimulus, le vélo n'est qu'un complément (§ 5).
 */
function durationFor(
  code: CycleSessionCode,
  week: PlanWeek,
  otherUnits: number,
  rides: number,
): number | undefined {
  if (week.phaseType !== PhaseType.Specific) return undefined

  const share = CYCLING_MAX_LOAD_SHARE
  const budgetUnits = (share * otherUnits) / (1 - share)
  return Math.floor(budgetUnits / cycleSessionType(code).expectedRpe / rides)
}

function sumUnits(prescriptions: Prescription[]): number {
  return prescriptions.reduce((total, item) => total + prescribedUnits(item), 0)
}
