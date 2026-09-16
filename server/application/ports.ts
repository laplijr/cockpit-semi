import type { AthleteConstraints } from '../domain/athlete/constraints'
import type { PauseAllowances } from '../domain/pause/pause'
import type { IsoDate } from '../domain/plan/calendar'
import type { GeneratedPlan } from '../domain/plan/generate'
import type { PlannedRace } from '../domain/plan/periodization'
import type { PlanTrigger } from '../domain/plan/session'

export type { Clock } from '../domain/shared/clock'

export interface AthleteSnapshot {
  constraints: AthleteConstraints
  startWeeklyVolumeM: number
  peakWeeklyVolumeM: number
  onboarded: boolean
}

export interface PauseSnapshot {
  id: number
  type: string
  zone: string | null
  startDate: IsoDate
  estimatedEndDate: IsoDate | null
  /** Nulle tant que la pause est ouverte. */
  endDate: IsoDate | null
  allowances: PauseAllowances
  watchZones: string[]
  notes: string | null
}

export interface FitnessSnapshot {
  vdot: number
  isFloor: boolean
  date: IsoDate
}

/** Tout ce dont la génération a besoin pour lire l'état courant et l'écrire. */
export interface PlanGateway {
  loadAthlete(): Promise<AthleteSnapshot | undefined>
  loadRaces(): Promise<PlannedRace[]>
  /** Dernière pause, ouverte ou fermée : sa fin déclenche la reprise surveillée. */
  loadLatestPause(): Promise<PauseSnapshot | undefined>
  loadCurrentFitness(): Promise<FitnessSnapshot | undefined>
  /** Date du dernier test 20′, qui borne la replanification du suivant. */
  loadLastTestDate(): Promise<IsoDate | null>
  savePlan(plan: GeneratedPlan, trigger: PlanTrigger, parameters: PlanParameters): Promise<number>
}

export interface PlanParameters extends Record<string, unknown> {
  baseWeeklyVolumeM: number
  peakWeeklyVolumeM: number
  vdot: number
  vdotIsFloor: boolean
  provisional: boolean
}
