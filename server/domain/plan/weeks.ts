import { RunSessionCode } from '../running/session-types'
import type { IsoDate } from './calendar'
import { addDays, addWeeks, startOfWeek } from './calendar'
import type { PlanPhase } from './periodization'
import { phaseAtWeek } from './periodization'
import { PhaseType } from './phases'

export const BLOCK_WEEKS = 4
/** Montée par défaut, quand le profil ne dit rien : +10 %/semaine (§ 5). */
export const WEEKLY_PROGRESSION = 1.1
export const LIGHT_WEEK_FACTOR = 0.7
export const LONG_RUN_MAX_SHARE = 0.3

/** Montée de charge d'une reprise surveillée après pause (§ 0). */
export const COMEBACK_RATIOS = [0.6, 0.8, 1] as const

/** Nombre de courses par semaine selon la phase, à défaut de valeur dans le profil (§ 5). */
export const RUNS_PER_PHASE: Record<PhaseType, number> = {
  [PhaseType.Base]: 4,
  [PhaseType.ShortBase]: 4,
  [PhaseType.Development]: 4,
  [PhaseType.Specific]: 4,
  [PhaseType.Speed]: 4,
  [PhaseType.Rebuild]: 3,
  [PhaseType.Taper]: 3,
  [PhaseType.Recovery]: 2,
  [PhaseType.Transition]: 2,
}

/** Pendant la reprise surveillée, trois courses quelle que soit la phase. */
export const RUNS_DURING_COMEBACK = 3

/** Un test 20′ en semaine 4 de reprise, puis toutes les six semaines (§ 5). */
export const TEST_INTERVAL_WEEKS = 6

/** Semaine 1 en endurance seule, pas de lignes droites avant la semaine 3 (§ 5). */
const COMEBACK_ALLOWED: RunSessionCode[][] = [
  [RunSessionCode.Endurance],
  [RunSessionCode.Endurance, RunSessionCode.LongRun],
  [
    RunSessionCode.Endurance,
    RunSessionCode.Strides,
    RunSessionCode.LongRun,
    RunSessionCode.Threshold,
    RunSessionCode.Progressive,
  ],
]

/**
 * Facteurs de volume des phases hors rythme de bloc, appliqués au dernier
 * volume plein (§ 5). L'affûtage décroît semaine après semaine.
 */
const TAPER_FACTORS = [0.7, 0.5] as const
const SINGLE_WEEK_TAPER_FACTOR = 0.6
const RECOVERY_FACTOR = 0.5
const REBUILD_FACTOR = 0.8

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
  /** Position dans la phase, de 0 à 1 : pilote la progression des séances clés. */
  phaseProgress: number
  /** La séance clé du milieu de semaine devient un test 20′. */
  test: boolean
  /** Nombre de courses à poser cette semaine (§ 5). */
  runs: number
  /** Minutes de vélo posées sur la semaine, renseignées à la génération. */
  targetCyclingMin: number
  /** Nombre de séances de muscu posées sur la semaine. */
  targetStrengthCount: number
  /** Vrai quand le volume visé a dû être réduit faute de séances pour le porter. */
  volumeCapped: boolean
  /** Restriction de la reprise : quand elle existe, seuls ces types sont plaçables. */
  allowedCodes?: RunSessionCode[]
}

export interface WeekPlanInput {
  startDate: IsoDate
  phases: PlanPhase[]
  /** Volume de course de la première semaine pleine, en mètres. */
  baseWeeklyVolumeM: number
  /** Volume hebdomadaire maximal visé sur le cycle. */
  peakWeeklyVolumeM: number
  /** Nombre de semaines de reprise surveillée ; 0 quand il n'y a pas eu de pause. */
  comebackWeeks?: number
  /** Date du dernier test 20′ : l'intervalle de six semaines repart de là. */
  lastTestDate?: IsoDate | null
  /** Montée maximale d'une semaine à la suivante, lue dans le profil (§ 5). */
  weeklyProgression?: number
}

function phaseFactor(phase: PlanPhase, weekInPhase: number): number | undefined {
  const length = phase.endWeek - phase.startWeek + 1

  switch (phase.type) {
    case PhaseType.Taper:
      return length === 1
        ? SINGLE_WEEK_TAPER_FACTOR
        : (TAPER_FACTORS[weekInPhase - 1] ?? TAPER_FACTORS.at(-1)!)
    case PhaseType.Recovery:
    case PhaseType.Transition:
      return RECOVERY_FACTOR
    case PhaseType.Rebuild:
      return REBUILD_FACTOR
    default:
      return undefined
  }
}

export function buildWeeks({
  startDate,
  phases,
  baseWeeklyVolumeM,
  peakWeeklyVolumeM,
  comebackWeeks = COMEBACK_RATIOS.length,
  lastTestDate = null,
  weeklyProgression = WEEKLY_PROGRESSION,
}: WeekPlanInput): PlanWeek[] {
  const lastWeek = phases.reduce((max, phase) => Math.max(max, phase.endWeek), 0)
  const firstMonday = startOfWeek(startDate)
  const weeks: PlanWeek[] = []

  let blockBase = baseWeeklyVolumeM
  let blockPosition = 0
  let lastFullVolume = baseWeeklyVolumeM
  let currentRaceId: number | undefined
  let lastTestWeek: number | undefined

  for (let index = 1; index <= lastWeek; index++) {
    const phase = phaseAtWeek(phases, index)
    if (!phase) continue

    // Le compteur de bloc repart à 1 au début de chaque cycle (§ 5).
    if (phase.raceId !== currentRaceId) {
      currentRaceId = phase.raceId
      blockPosition = 0
      blockBase = Math.min(lastFullVolume, peakWeeklyVolumeM)
    }

    const length = phase.endWeek - phase.startWeek + 1
    const weekInPhase = index - phase.startWeek + 1
    const phaseProgress = length === 1 ? 1 : (weekInPhase - 1) / (length - 1)

    const comebackRatio = index <= comebackWeeks ? COMEBACK_RATIOS[index - 1] : undefined
    const factor = phaseFactor(phase, weekInPhase)

    let targetRunM: number
    let light = false

    if (comebackRatio !== undefined) {
      // Reprise : volume de départ fixe, progression de bloc gelée.
      targetRunM = baseWeeklyVolumeM * comebackRatio
    } else if (factor !== undefined) {
      targetRunM = lastFullVolume * factor
    } else {
      const positionInBlock = blockPosition % BLOCK_WEEKS
      light = positionInBlock === BLOCK_WEEKS - 1
      const ramped = Math.min(
        peakWeeklyVolumeM,
        blockBase * weeklyProgression ** Math.min(positionInBlock, BLOCK_WEEKS - 2),
      )
      targetRunM = light ? ramped * LIGHT_WEEK_FACTOR : ramped
      if (light) blockBase = ramped
      else lastFullVolume = targetRunM
      blockPosition += 1
    }

    const test = isTestWeek({
      index,
      comebackWeeks,
      phase,
      lastTestWeek,
      weekStart: addWeeks(firstMonday, index - 1),
      lastTestDate,
    })
    if (test) lastTestWeek = index

    const startOfThisWeek = addWeeks(firstMonday, index - 1)

    weeks.push({
      index,
      startDate: startOfThisWeek,
      endDate: addDays(startOfThisWeek, 6),
      phaseType: phase.type,
      raceId: phase.raceId,
      targetRunM: Math.round(targetRunM),
      longRunMaxM: Math.round(targetRunM * LONG_RUN_MAX_SHARE),
      light,
      comebackRatio,
      phaseProgress,
      test,
      runs: comebackRatio !== undefined ? RUNS_DURING_COMEBACK : RUNS_PER_PHASE[phase.type],
      targetCyclingMin: 0,
      targetStrengthCount: 0,
      volumeCapped: false,
      allowedCodes: comebackRatio !== undefined ? COMEBACK_ALLOWED[index - 1] : undefined,
    })
  }

  return weeks
}

interface TestWeekInput {
  index: number
  comebackWeeks: number
  phase: PlanPhase
  lastTestWeek: number | undefined
  weekStart: IsoDate
  lastTestDate: IsoDate | null
}

/** Test 20′ : semaine 4 après une reprise, puis tous les six semaines, hors affûtage et récup. */
function isTestWeek({
  index,
  comebackWeeks,
  phase,
  lastTestWeek,
  weekStart,
  lastTestDate,
}: TestWeekInput): boolean {
  if (phase.type === PhaseType.Taper || phase.type === PhaseType.Recovery) return false

  // Un test déjà passé impose son propre délai : régénérer le plan ne doit pas
  // en replanifier un aussitôt, mais la première semaine éligible en porte un.
  if (lastTestDate) {
    const earliest = addWeeks(lastTestDate, TEST_INTERVAL_WEEKS)
    if (weekStart < earliest) return false
    if (lastTestWeek === undefined) return true
    return index - lastTestWeek >= TEST_INTERVAL_WEEKS
  }

  const firstTestWeek = comebackWeeks + 1
  if (index < firstTestWeek) return false
  if (lastTestWeek === undefined) return index === firstTestWeek

  return index - lastTestWeek >= TEST_INTERVAL_WEEKS
}
