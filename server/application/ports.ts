import type { AthleteConstraints } from '../domain/athlete/constraints'
import type { IsoDate } from '../domain/plan/calendar'
import type { GeneratedPlan } from '../domain/plan/generate'
import type { PlanTrigger } from '../domain/plan/session'
import type { PlannedRace } from '../domain/plan/periodization'

export interface Clock {
  today(): IsoDate
}

export interface AthleteSnapshot {
  constraints: AthleteConstraints
  onboarded: boolean
}

export interface OpenPauseSnapshot {
  id: number
  startDate: IsoDate
  estimatedEndDate: IsoDate | null
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
  loadOpenPause(): Promise<OpenPauseSnapshot | undefined>
  loadCurrentFitness(): Promise<FitnessSnapshot | undefined>
  savePlan(plan: GeneratedPlan, trigger: PlanTrigger, parameters: PlanParameters): Promise<number>
}

export interface PlanParameters extends Record<string, unknown> {
  baseWeeklyVolumeM: number
  vdot: number
  vdotIsFloor: boolean
  provisional: boolean
}
