import type { IsoDate } from '../plan/calendar'

/** Niveau d'entraînement déclaré, qui donne les repères de départ (§ 9, P5.7). */
export enum AthleteProfile {
  Athlete = 'athlete',
  Regular = 'sportif_regulier',
  Occasional = 'sportif_occasionnel',
  Comeback = 'reprise',
  Beginner = 'debutant',
}

export const PROFILE_LABELS: Record<AthleteProfile, string> = {
  [AthleteProfile.Athlete]: 'Athlète',
  [AthleteProfile.Regular]: 'Sportif régulier',
  [AthleteProfile.Occasional]: 'Sportif occasionnel',
  [AthleteProfile.Comeback]: 'Reprise',
  [AthleteProfile.Beginner]: 'Débutant',
}

export const PROFILE_DESCRIPTIONS: Record<AthleteProfile, string> = {
  [AthleteProfile.Athlete]: 'Entraînement structuré depuis des années.',
  [AthleteProfile.Regular]: 'Trois séances et plus par semaine, toute l’année.',
  [AthleteProfile.Occasional]: 'Une à deux fois par semaine, irrégulier.',
  [AthleteProfile.Comeback]: 'Arrêt de plusieurs mois derrière soi.',
  [AthleteProfile.Beginner]: 'Jamais entraîné en endurance.',
}

export interface ProfileDefaults {
  startWeeklyVolumeM: number
  peakWeeklyVolumeM: number
  runsPerWeek: number
  /** Montée maximale d'une semaine à la suivante, en pourcentage (§ 5). */
  maxWeeklyIncreasePct: number
}

/** Montée prudente : c'est la seule prise du profil sur le moteur (§ 9, P5.7). */
export const CAREFUL_INCREASE_PCT = 5
export const STANDARD_INCREASE_PCT = 10

const DEFAULTS: Record<AthleteProfile, ProfileDefaults> = {
  [AthleteProfile.Beginner]: {
    startWeeklyVolumeM: 10_000,
    peakWeeklyVolumeM: 25_000,
    runsPerWeek: 3,
    maxWeeklyIncreasePct: CAREFUL_INCREASE_PCT,
  },
  [AthleteProfile.Comeback]: {
    startWeeklyVolumeM: 15_000,
    peakWeeklyVolumeM: 35_000,
    runsPerWeek: 3,
    maxWeeklyIncreasePct: CAREFUL_INCREASE_PCT,
  },
  [AthleteProfile.Occasional]: {
    startWeeklyVolumeM: 20_000,
    peakWeeklyVolumeM: 45_000,
    runsPerWeek: 4,
    maxWeeklyIncreasePct: STANDARD_INCREASE_PCT,
  },
  [AthleteProfile.Regular]: {
    startWeeklyVolumeM: 30_000,
    peakWeeklyVolumeM: 60_000,
    runsPerWeek: 5,
    maxWeeklyIncreasePct: STANDARD_INCREASE_PCT,
  },
  [AthleteProfile.Athlete]: {
    startWeeklyVolumeM: 45_000,
    peakWeeklyVolumeM: 85_000,
    runsPerWeek: 6,
    maxWeeklyIncreasePct: STANDARD_INCREASE_PCT,
  },
}

export function defaultsFor(profile: AthleteProfile): ProfileDefaults {
  return DEFAULTS[profile]
}

/** Profils du plus prudent au plus chargé : c'est l'ordre d'affichage. */
export const PROFILES_BY_LOAD: AthleteProfile[] = [
  AthleteProfile.Beginner,
  AthleteProfile.Comeback,
  AthleteProfile.Occasional,
  AthleteProfile.Regular,
  AthleteProfile.Athlete,
]

/**
 * FC max estimée par la formule de Tanaka, plus fidèle après 40 ans que le
 * « 220 − âge ». Elle n'est qu'une proposition : une FC max mesurée la remplace.
 */
export function estimatedMaxHr(age: number): number {
  return Math.round(208 - 0.7 * age)
}

/** Âge à une date donnée, qui suit l'horloge simulée comme le reste (§ P3.5). */
export function ageOn(birthDate: IsoDate, today: IsoDate): number {
  const [year, month, day] = birthDate.split('-').map(Number) as [number, number, number]
  const [nowYear, nowMonth, nowDay] = today.split('-').map(Number) as [number, number, number]

  const beforeBirthday = nowMonth < month || (nowMonth === month && nowDay < day)
  return nowYear - year - (beforeBirthday ? 1 : 0)
}

/** Au-delà, la photo n'a plus sa place dans une colonne Postgres (§ 9, P5.7). */
export const MAX_AVATAR_BYTES = 100_000
