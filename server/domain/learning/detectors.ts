import { HABIT_THRESHOLDS, HabitType, confidenceOf, type DetectedHabit } from './habit'

/** Une séance passée, telle que le moteur peut l'observer. */
export interface ObservedSession {
  code: string
  /** Jour prévu, 1 = lundi … 7 = dimanche. */
  weekday: number
  done: boolean
  skipped: boolean
  expectedRpe: number
  rpe: number | null
  sleepHours: number | null
}

/** Une décision prise sur une proposition, avec sa cible quand elle en a une. */
export interface ObservedDecision {
  ruleId: string
  effect: string
  accepted: boolean
  code: string | null
  fromWeekday: number | null
  toWeekday: number | null
}

export interface LearningInput {
  sessions: ObservedSession[]
  decisions: ObservedDecision[]
}

const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const dayName = (weekday: number) => WEEKDAYS[weekday - 1] ?? String(weekday)

export function detectHabits(input: LearningInput): DetectedHabit[] {
  return [
    ...detectDayShift(input.decisions),
    ...detectDeadSlot(input.sessions),
    ...detectRpeBias(input.sessions),
    ...detectSleepSensitivity(input.sessions),
    ...detectProposalRefusal(input.decisions),
  ]
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item])
  return groups
}

/**
 * Glissement de jour : une séance dont le déplacement vers le même jour a été
 * accepté au moins 60 % des fois, sur au moins huit déplacements observés.
 */
export function detectDayShift(decisions: ObservedDecision[]): DetectedHabit[] {
  const moves = decisions.filter(
    (decision) =>
      decision.accepted &&
      decision.code !== null &&
      decision.fromWeekday !== null &&
      decision.toWeekday !== null,
  )

  const { minOccurrences, minShare } = HABIT_THRESHOLDS.dayShift

  return [...groupBy(moves, (move) => `${move.code}|${move.fromWeekday}`).entries()].flatMap(
    ([key, group]) => {
      if (group.length < minOccurrences) return []

      const byDestination = groupBy(group, (move) => String(move.toWeekday))
      const [destination, matches] = [...byDestination.entries()].sort(
        (a, b) => b[1].length - a[1].length,
      )[0]!
      if (matches.length / group.length < minShare) return []

      const [code, from] = key.split('|')
      return [
        {
          type: HabitType.DayShift,
          key: `${HabitType.DayShift}|${key}`,
          parameters: { code: code!, fromWeekday: Number(from), toWeekday: Number(destination) },
          matched: matches.length,
          total: group.length,
          confidence: confidenceOf(matches.length, group.length, minOccurrences),
          statement: `Déplacer la séance ${code} du ${dayName(Number(from))} au ${dayName(Number(destination))}.`,
        },
      ]
    },
  )
}

/** Créneau jamais honoré : au moins huit séances posées ce jour-là, aucune faite. */
export function detectDeadSlot(sessions: ObservedSession[]): DetectedHabit[] {
  const { minOccurrences } = HABIT_THRESHOLDS.deadSlot

  return [...groupBy(sessions, (session) => String(session.weekday)).entries()].flatMap(
    ([weekday, group]) => {
      if (group.length < minOccurrences || group.some((session) => session.done)) return []

      return [
        {
          type: HabitType.DeadSlot,
          key: `${HabitType.DeadSlot}|${weekday}`,
          parameters: { weekday: Number(weekday) },
          matched: group.length,
          total: group.length,
          confidence: confidenceOf(group.length, group.length, minOccurrences),
          statement: `Ne plus rien poser le ${dayName(Number(weekday))} : aucune des ${group.length} séances n'y a été faite.`,
        },
      ]
    },
  )
}

/** Biais de RPE : un type de séance ressenti systématiquement autrement que prévu. */
export function detectRpeBias(sessions: ObservedSession[]): DetectedHabit[] {
  const rated = sessions.filter((session) => session.rpe !== null)
  const { minSamples, minBias } = HABIT_THRESHOLDS.rpeBias

  return [...groupBy(rated, (session) => session.code).entries()].flatMap(([code, group]) => {
    if (group.length < minSamples) return []

    const bias = group.reduce((sum, s) => sum + (s.rpe! - s.expectedRpe), 0) / group.length
    if (Math.abs(bias) < minBias) return []

    const rounded = Math.round(bias * 2) / 2
    const matched = group.filter(
      (s) => Math.sign(s.rpe! - s.expectedRpe) === Math.sign(bias),
    ).length

    return [
      {
        type: HabitType.RpeBias,
        key: `${HabitType.RpeBias}|${code}`,
        parameters: { code, bias: rounded },
        matched,
        total: group.length,
        confidence: confidenceOf(matched, group.length, minSamples),
        statement: `Attendre un RPE ${rounded > 0 ? 'plus haut' : 'plus bas'} de ${Math.abs(rounded)} sur les séances ${code}.`,
      },
    ]
  })
}

/** Sensibilité au sommeil : une nuit courte se paie d'au moins un point de RPE. */
export function detectSleepSensitivity(sessions: ObservedSession[]): DetectedHabit[] {
  const { minCases, minExcess } = HABIT_THRESHOLDS.sleepSensitivity
  const shortNights = sessions.filter(
    (session) => session.rpe !== null && session.sleepHours !== null && session.sleepHours < 6,
  )
  if (shortNights.length < minCases) return []

  const matched = shortNights.filter((s) => s.rpe! - s.expectedRpe >= minExcess).length
  const excess =
    shortNights.reduce((sum, s) => sum + (s.rpe! - s.expectedRpe), 0) / shortNights.length
  if (excess < minExcess) return []

  return [
    {
      type: HabitType.SleepSensitivity,
      key: HabitType.SleepSensitivity,
      parameters: { excess: Math.round(excess * 10) / 10 },
      matched,
      total: shortNights.length,
      confidence: confidenceOf(matched, shortNights.length, minCases),
      statement:
        'Alléger la séance clé dès une seule nuit sous six heures, sans attendre la deuxième.',
    },
  ]
}

/** Refus systématique : une famille de propositions refusée au moins 70 % du temps. */
export function detectProposalRefusal(decisions: ObservedDecision[]): DetectedHabit[] {
  const { minDecisions, minShare } = HABIT_THRESHOLDS.proposalRefusal

  return [
    ...groupBy(decisions, (decision) => `${decision.ruleId}|${decision.effect}`).entries(),
  ].flatMap(([key, group]) => {
    if (group.length < minDecisions) return []

    const refused = group.filter((decision) => !decision.accepted).length
    if (refused / group.length < minShare) return []

    const [ruleId, effect] = key.split('|')
    return [
      {
        type: HabitType.ProposalRefusal,
        key: `${HabitType.ProposalRefusal}|${key}`,
        parameters: { ruleId: ruleId!, effect: effect! },
        matched: refused,
        total: group.length,
        confidence: confidenceOf(refused, group.length, minDecisions),
        statement: `Ne plus proposer ${effect} au titre de ${ruleId} : ${refused} refus sur ${group.length}.`,
      },
    ]
  })
}
