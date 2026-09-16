import { RunSessionCode } from '../running/session-types'
import type { IsoDate } from './calendar'
import { addDays, addWeeks, startOfWeek } from './calendar'
import type { PlanPhase } from './periodization'
import { phaseAtWeek } from './periodization'
import { PhaseType } from './phases'

export const BLOCK_WEEKS = 4
export const WEEKLY_PROGRESSION = 1.1
export const LIGHT_WEEK_FACTOR = 0.7
export const LONG_RUN_MAX_SHARE = 0.3
/**
 * Plafond de volume, exprimé en multiple du volume de départ. La progression
 * de +10 %/semaine du § 5 est un maximum, pas une obligation : sans plafond
 * elle compose et produit des semaines invraisemblables sur un plan long.
 */
export const PEAK_VOLUME_MULTIPLE = 2.2

/** Montée de charge d'une reprise surveillée après pause (§ 0). */
export const COMEBACK_RATIOS = [0.6, 0.8, 1] as const

/** Semaine 1 en endurance seule, VMA pas avant la semaine 3 (§ 0). */
const COMEBACK_ALLOWED: RunSessionCode[][] = [
  [RunSessionCode.Endurance],
  [RunSessionCode.Endurance, RunSessionCode.Strides, RunSessionCode.LongRun],
  [
    RunSessionCode.Endurance,
    RunSessionCode.Strides,
    RunSessionCode.LongRun,
    RunSessionCode.Threshold,
    RunSessionCode.Progressive,
  ],
]

/** Les phases de décharge ne suivent pas la progression du bloc. */
const PHASE_VOLUME_FACTOR: Partial<Record<PhaseType, number>> = {
  [PhaseType.Taper]: 0.6,
  [PhaseType.Recovery]: 0.5,
  [PhaseType.Transition]: 0.5,
}

export interface PlanWeek {
  index: number
  startDate: IsoDate
  endDate: IsoDate
  phaseType: PhaseType
  raceId: number
  targetRunM: number
  longRunMaxM: number
  light: boolean
  comebackRatio?: number
  /** Restriction de la reprise : quand elle existe, seuls ces types sont plaçables. */
  allowedCodes?: RunSessionCode[]
}

export interface WeekPlanInput {
  startDate: IsoDate
  phases: PlanPhase[]
  /** Volume de course de la première semaine pleine, en mètres. */
  baseWeeklyVolumeM: number
  /** Nombre de semaines de reprise surveillée ; 0 quand il n'y a pas eu de pause. */
  comebackWeeks?: number
  /** Volume hebdomadaire maximal ; par défaut un multiple du volume de départ. */
  peakWeeklyVolumeM?: number
}

export function buildWeeks({
  startDate,
  phases,
  baseWeeklyVolumeM,
  comebackWeeks = COMEBACK_RATIOS.length,
  peakWeeklyVolumeM = baseWeeklyVolumeM * PEAK_VOLUME_MULTIPLE,
}: WeekPlanInput): PlanWeek[] {
  const lastWeek = phases.reduce((max, phase) => Math.max(max, phase.endWeek), 0)
  const firstMonday = startOfWeek(startDate)
  const weeks: PlanWeek[] = []

  let blockBase = baseWeeklyVolumeM

  for (let index = 1; index <= lastWeek; index++) {
    const phase = phaseAtWeek(phases, index)
    if (!phase) continue

    const positionInBlock = (index - 1) % BLOCK_WEEKS
    const light = positionInBlock === BLOCK_WEEKS - 1
    const ramped = Math.min(
      peakWeeklyVolumeM,
      blockBase * WEEKLY_PROGRESSION ** Math.min(positionInBlock, BLOCK_WEEKS - 2),
    )
    const beforePhase = light ? ramped * LIGHT_WEEK_FACTOR : ramped
    const afterPhase = beforePhase * (PHASE_VOLUME_FACTOR[phase.type] ?? 1)

    const comebackRatio = index <= comebackWeeks ? COMEBACK_RATIOS[index - 1] : undefined
    const targetRunM = Math.round(afterPhase * (comebackRatio ?? 1))
    const startOfThisWeek = addWeeks(firstMonday, index - 1)

    weeks.push({
      index,
      startDate: startOfThisWeek,
      endDate: addDays(startOfThisWeek, 6),
      phaseType: phase.type,
      raceId: phase.raceId,
      targetRunM,
      longRunMaxM: Math.round(targetRunM * LONG_RUN_MAX_SHARE),
      light,
      comebackRatio,
      allowedCodes: index <= comebackWeeks ? COMEBACK_ALLOWED[index - 1] : undefined,
    })

    if (light) blockBase = Math.min(ramped, peakWeeklyVolumeM)
  }

  return weeks
}
