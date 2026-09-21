import { FitnessDeclaration } from '~~/server/domain/fitness/declaration'

/** Saisie de l'écran « où tu en es » : les trois réponses partagent un seul état. */
export interface FitnessStartValue {
  kind: FitnessDeclaration
  distanceM: number
  date: string
  hours: number | null
  minutes: number | null
  seconds: number | null
  /** Allure d'endurance saisie telle qu'on la dit : « 6:47 ». */
  pace: string
}

export function emptyFitnessStart(today: string): FitnessStartValue {
  return {
    kind: FitnessDeclaration.Unknown,
    distanceM: 10_000,
    date: today,
    hours: null,
    minutes: null,
    seconds: null,
    pace: '',
  }
}

export const chronoSeconds = (item: FitnessStartValue) =>
  (item.hours ?? 0) * 3600 + (item.minutes ?? 0) * 60 + (item.seconds ?? 0)

/**
 * Une allure se dit d'un seul tenant : « 6:47 ». Le point, la virgule et
 * l'apostrophe passent aussi, parce que c'est ce qu'on tape sur un téléphone.
 */
export function easyPaceSeconds(item: FitnessStartValue): number | null {
  const match = /^(\d{1,2})\s*[:.,'′]\s*(\d{1,2})$/.exec(item.pace.trim())
  if (!match) return null

  const seconds = Number(match[2])
  if (seconds > 59) return null
  return Number(match[1]) * 60 + seconds
}

/** Bornes de l'allure déclarée, alignées sur le schéma de la route (§ 9, P8.2). */
export const MIN_EASY_PACE_S = 180
export const MAX_EASY_PACE_S = 900

/** Vrai quand la réponse en cours est complète : « je ne sais pas » l'est toujours. */
export function fitnessStartIsAnswered(item: FitnessStartValue): boolean {
  if (item.kind === FitnessDeclaration.Unknown) return true
  if (item.kind === FitnessDeclaration.Chrono) {
    return chronoSeconds(item) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
  }
  const pace = easyPaceSeconds(item)
  return pace !== null && pace >= MIN_EASY_PACE_S && pace <= MAX_EASY_PACE_S
}

export function fitnessStartBody(item: FitnessStartValue) {
  if (item.kind === FitnessDeclaration.Chrono) {
    return {
      kind: item.kind,
      distanceM: item.distanceM,
      timeS: chronoSeconds(item),
      date: item.date,
    }
  }
  if (item.kind === FitnessDeclaration.EasyPace) {
    return { kind: item.kind, paceSecPerKm: easyPaceSeconds(item) }
  }
  return { kind: FitnessDeclaration.Unknown }
}
