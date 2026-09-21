import { FitnessDeclaration } from '~~/server/domain/fitness/declaration'

/** Saisie de l'écran « où tu en es » : les trois réponses partagent un seul état. */
export interface FitnessStartValue {
  kind: FitnessDeclaration
  distanceM: number
  date: string
  /** Chrono saisi tel qu'on le dit : « 1:42:17 », ou « 47:20 » sous l'heure. */
  chrono: string
  /** Allure d'endurance saisie telle qu'on la dit : « 6:47 ». */
  pace: string
}

export function emptyFitnessStart(today: string): FitnessStartValue {
  return {
    kind: FitnessDeclaration.Unknown,
    distanceM: 10_000,
    date: today,
    chrono: '',
    pace: '',
  }
}

/** Un chrono et une allure se séparent des mêmes signes : c'est ce qu'on tape. */
const SEPARATOR = String.raw`\s*[:.,'′h]\s*`

/**
 * Un chrono se dit d'un seul tenant. Deux nombres valent des minutes et des
 * secondes — « 47:20 » sur 10 km ; trois valent des heures, des minutes et
 * des secondes — « 1:42:17 » sur un semi.
 */
export function chronoSeconds(item: FitnessStartValue): number | null {
  const text = item.chrono.trim()

  const long = new RegExp(`^(\\d{1,2})${SEPARATOR}(\\d{1,2})${SEPARATOR}(\\d{1,2})$`).exec(text)
  if (long) return parts(Number(long[1]), Number(long[2]), Number(long[3]))

  const short = new RegExp(`^(\\d{1,3})${SEPARATOR}(\\d{1,2})$`).exec(text)
  if (short) return parts(0, Number(short[1]), Number(short[2]))

  return null
}

/** Soixante secondes font une minute : « 47:75 » n'est pas un chrono. */
function parts(hours: number, minutes: number, seconds: number): number | null {
  if (seconds > 59 || (hours > 0 && minutes > 59)) return null
  const total = hours * 3600 + minutes * 60 + seconds
  return total > 0 ? total : null
}

/**
 * Une allure se dit d'un seul tenant : « 6:47 ». Le point, la virgule et
 * l'apostrophe passent aussi, parce que c'est ce qu'on tape sur un téléphone.
 */
export function easyPaceSeconds(item: FitnessStartValue): number | null {
  const match = new RegExp(`^(\\d{1,2})${SEPARATOR}(\\d{1,2})$`).exec(item.pace.trim())
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
    return chronoSeconds(item) !== null && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
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
