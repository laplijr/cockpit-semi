import { RunSessionCode } from '../running/session-types'
import { DayKind, type DaySession } from './daily'

/**
 * Les repas d'une journée d'entraînement : combien, à quelle heure, et ce que
 * chacun doit porter. Ce module ne choisit aucun aliment — c'est le modèle qui
 * remplit les créneaux (§ 6, P6.4). Il ne fait que déplacer les repas autour
 * des séances.
 */
export enum MealKind {
  Breakfast = 'petit_dejeuner',
  Snack = 'collation',
  Lunch = 'dejeuner',
  Dinner = 'diner',
}

/** Ce qu'un créneau doit porter, une fois les séances du jour connues. */
export enum MealEmphasis {
  /** Repas ordinaire de la journée. */
  Normal = 'normal',
  /** Avant l'effort : digeste, peu de fibres, glucides rapides. */
  PreSession = 'avant_seance',
  /** Après l'effort : glucides et protéines pour recharger. */
  Recovery = 'recuperation',
}

export interface TimedSession extends DaySession {
  /** Heure de départ en décimal : 18,5 vaut 18 h 30. */
  startHour: number
}

export interface MealSlot {
  kind: MealKind
  hour: number
  emphasis: MealEmphasis
}

/** Heures ordinaires, celles d'une journée sans séance. */
export const DEFAULT_HOURS = { breakfast: 7, lunch: 12.5, dinner: 20 } as const

/** Une séance partie avant cette heure est matinale : le petit-déjeuner la précède. */
export const MORNING_UNTIL = 10

/** À partir de cette heure, la séance est de fin de journée : une collation la précède. */
export const EVENING_FROM = 16

/** Délais fixés par la pratique : on mange avant, on recharge après. */
export const SNACK_LEAD_H = 1.5
export const LONG_BREAKFAST_LEAD_H = 2
export const SHORT_BREAKFAST_LEAD_H = 1.5
export const RECOVERY_DELAY_H = 0.5
/** Au-delà, la recharge n'attend pas le repas suivant. */
export const RECOVERY_WINDOW_H = 2

const MIN_SNACK_GAP_H = 1

/**
 * Les créneaux de la journée, de trois à cinq, dans l'ordre de l'horloge.
 * Une journée de repos garde ses trois repas et aucune collation : il n'y a
 * pas de séance à préparer.
 */
export function mealTiming(sessions: TimedSession[], dayKind: DayKind): MealSlot[] {
  const ordered = [...sessions].sort((a, b) => a.startHour - b.startHour)
  const morning = ordered.find((session) => session.startHour < MORNING_UNTIL)
  const evening = ordered.find((session) => session.startHour >= EVENING_FROM)
  /** Le dîner suit la séance qui finit le plus tard, pas celle qui part le plus tard. */
  const lastEnd = ordered.length === 0 ? null : Math.max(...ordered.map(endOf))

  const slots: MealSlot[] = [
    breakfastSlot(morning, dayKind),
    ...recoverySnack(morning),
    lunchSlot(morning),
  ]

  if (evening) {
    const hour = evening.startHour - SNACK_LEAD_H
    const lunch = slots.at(-1)!
    if (hour - lunch.hour >= MIN_SNACK_GAP_H) {
      slots.push({ kind: MealKind.Snack, hour, emphasis: MealEmphasis.PreSession })
    }
  }

  slots.push(dinnerSlot(lastEnd))
  return slots
}

function breakfastSlot(morning: TimedSession | undefined, dayKind: DayKind): MealSlot {
  if (!morning) {
    return {
      kind: MealKind.Breakfast,
      hour: DEFAULT_HOURS.breakfast,
      emphasis: MealEmphasis.Normal,
    }
  }

  const lead =
    dayKind === DayKind.Long || dayKind === DayKind.Race
      ? LONG_BREAKFAST_LEAD_H
      : SHORT_BREAKFAST_LEAD_H

  return {
    kind: MealKind.Breakfast,
    /** Avancé seulement quand la séance l'exige : sinon l'heure ordinaire tient. */
    hour: Math.min(DEFAULT_HOURS.breakfast, morning.startHour - lead),
    emphasis: MealEmphasis.PreSession,
  }
}

/** Une séance matinale qui finit loin du déjeuner recharge tout de suite. */
function recoverySnack(morning: TimedSession | undefined): MealSlot[] {
  if (!morning) return []

  const end = endOf(morning)
  if (DEFAULT_HOURS.lunch - end <= RECOVERY_WINDOW_H) return []

  return [{ kind: MealKind.Snack, hour: end + RECOVERY_DELAY_H, emphasis: MealEmphasis.Recovery }]
}

/** Le déjeuner reste à son heure ; c'est son contenu qui change après une séance. */
function lunchSlot(morning: TimedSession | undefined): MealSlot {
  return {
    kind: MealKind.Lunch,
    hour: DEFAULT_HOURS.lunch,
    emphasis: morning ? MealEmphasis.Recovery : MealEmphasis.Normal,
  }
}

/** Une séance du soir décale le dîner : on ne dîne pas avant d'avoir couru. */
function dinnerSlot(lastEnd: number | null): MealSlot {
  if (lastEnd === null) {
    return { kind: MealKind.Dinner, hour: DEFAULT_HOURS.dinner, emphasis: MealEmphasis.Normal }
  }

  return {
    kind: MealKind.Dinner,
    hour: Math.max(DEFAULT_HOURS.dinner, lastEnd + RECOVERY_DELAY_H),
    emphasis:
      lastEnd >= DEFAULT_HOURS.dinner - RECOVERY_WINDOW_H
        ? MealEmphasis.Recovery
        : MealEmphasis.Normal,
  }
}

function endOf(session: TimedSession): number {
  return session.startHour + session.durationMin / 60
}

/**
 * Heure de départ d'une séance, faute de la connaître : le cockpit ne demande
 * pas encore à quelle heure on s'entraîne. La sortie longue part le matin, le
 * reste après le travail — c'est déjà l'hypothèse de placement de P4, qui pose
 * le renforcement « le soir des jours durs ».
 */
export const DEFAULT_START_HOUR = { morning: 9, evening: 18 } as const

export function defaultStartHour(session: { code: string }): number {
  return session.code === RunSessionCode.LongRun
    ? DEFAULT_START_HOUR.morning
    : DEFAULT_START_HOUR.evening
}

/** « 7 h 30 », jamais « 7.5 » : l'heure se lit, elle ne se calcule pas à l'écran. */
export function formatHour(hour: number): string {
  const hours = Math.floor(hour)
  const minutes = Math.round((hour - hours) * 60)
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')}`
}
