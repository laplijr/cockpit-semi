import { FATIGUE_SENSATIONS, type Sensation } from '../load/feedback'
import { RunSessionCode, runSessionType } from '../running/session-types'
import { frenchKm, frenchShortDate } from '../shared/french'
import { Sport } from '../shared/sport'
import { learnedMoves, learnedRpe } from './learned-rules'
import { r10, r9 } from './plan-rules'
import {
  MAX_TARGETS_PER_RULE,
  MIN_HOURS_BETWEEN_KEY_SESSIONS,
  PAIN_FORCE_PAUSE,
  PAIN_PROPOSE_PAUSE,
  ProposalEffect,
  RuleId,
  SLEEP_DEBT_HOURS,
  type Proposal,
  type RuleContext,
  type SessionOutcome,
  type UpcomingSession,
} from './rule-types'

/**
 * Les règles de recalcul (§ 5). Les types, les identifiants et les seuils
 * vivent dans `rule-types.ts`, R9 et R10 dans `plan-rules.ts`, les règles
 * apprises dans `learned-rules.ts` : ce fichier les réunit et reste la porte
 * d'entrée du moteur.
 */
export * from './rule-types'

const isFatigueSensation = (sensation: Sensation) =>
  (FATIGUE_SENSATIONS as readonly Sensation[]).includes(sensation)

function hasFatigueSensation(outcome: SessionOutcome): boolean {
  return outcome.sensations.some(isFatigueSensation)
}

function rpeOverrun(outcome: SessionOutcome): boolean {
  return outcome.rpe !== null && outcome.rpe >= outcome.expectedRpe + 1
}

function shortNight(outcome: SessionOutcome): boolean {
  return outcome.sleepHours !== null && outcome.sleepHours < SLEEP_DEBT_HOURS
}

/** Nombre de signaux de fatigue actifs sur la séance la plus récente (§ 5, R2). */
export function fatigueSignals(outcome: SessionOutcome): number {
  return [rpeOverrun(outcome), hasFatigueSensation(outcome), shortNight(outcome)].filter(Boolean)
    .length
}

const keyRuns = (sessions: UpcomingSession[]) =>
  sessions.filter((session) => session.key && session.sport === Sport.Running)

const easyRuns = (sessions: UpcomingSession[]) =>
  sessions.filter((session) => !session.key && session.sport === Sport.Running)

const nextLongRun = (sessions: UpcomingSession[]) =>
  sessions.find((session) => session.code === RunSessionCode.LongRun)

/** R1 — séance clé trop dure → la muscu du soir perd une série. */
function r1(context: RuleContext): Proposal[] {
  const last = context.recent[0]
  if (!last?.key || !rpeOverrun(last)) return []

  return context.sameDayStrength.map((strength) => ({
    ruleId: RuleId.R1,
    effect: ProposalEffect.ReduceStrengthSet,
    target: { kind: 'session' as const, id: strength.sessionId },
    before: `${strength.repeats ?? 0} séries`,
    after: `${Math.max(1, (strength.repeats ?? 1) - 1)} séries, sans excentrique lourd`,
    explanation: `La séance clé du ${frenchShortDate(last.date)} a été courue à RPE ${last.rpe} pour ${last.expectedRpe} prévu.`,
  }))
}

/** R2 — deux signaux de fatigue → séances faciles allégées et sortie longue réduite. */
function r2(context: RuleContext): Proposal[] {
  const last = context.recent[0]
  if (!last || fatigueSignals(last) < 2) return []

  const proposals: Proposal[] = easyRuns(context.upcoming)
    .slice(0, MAX_TARGETS_PER_RULE)
    .map((session) => ({
      ruleId: RuleId.R2,
      effect: ProposalEffect.ReduceEasyVolume,
      target: { kind: 'session' as const, id: session.sessionId },
      before: frenchKm(session.distanceM),
      after: `${frenchKm(session.distanceM * 0.7)}, sous 70 % de FCmax`,
      explanation: 'Deux signaux de fatigue sont actifs sur ta dernière séance.',
    }))

  const longRun = nextLongRun(context.upcoming)
  if (longRun) {
    proposals.push({
      ruleId: RuleId.R2,
      effect: ProposalEffect.ReduceLongRun,
      target: { kind: 'session', id: longRun.sessionId },
      before: frenchKm(longRun.distanceM),
      after: frenchKm(longRun.distanceM * 0.9),
      explanation: 'Deux signaux de fatigue sont actifs : la sortie longue suivante perd 10 %.',
    })
  }

  return proposals
}

/** R3 — deux nuits courtes → une répétition en moins, allure inchangée. */
function r3(context: RuleContext): Proposal[] {
  const shortNights = context.recent.filter(shortNight)
  /** R103 apprise : une seule nuit courte suffit, quand elle se paie à chaque fois. */
  const needed = context.personal?.sleepSensitive ? 1 : 2
  if (shortNights.length < needed) return []

  const next = keyRuns(context.upcoming)[0]
  if (!next?.repeats) return []

  return [
    {
      ruleId: RuleId.R3,
      effect: ProposalEffect.ReduceRepeats,
      target: { kind: 'session', id: next.sessionId },
      before: `${next.repeats} répétitions`,
      after: `${next.repeats - 1} répétitions, allure inchangée`,
      explanation: `${shortNights.length === 1 ? 'Une nuit' : `${shortNights.length} nuits`} sous ${SLEEP_DEBT_HOURS} h.`,
    },
  ]
}

/** R4 — un signal de fatigue actif → progression du bloc gelée. */
function r4(context: RuleContext): Proposal[] {
  const last = context.recent[0]
  if (!last || fatigueSignals(last) < 1) return []

  return [
    {
      ruleId: RuleId.R4,
      effect: ProposalEffect.FreezeProgression,
      target: { kind: 'week', id: null },
      before: 'progression du bloc',
      after: 'volume maintenu cette semaine',
      explanation: 'Un signal de fatigue est actif : le bloc ne monte pas cette semaine.',
    },
  ]
}

/** R5 — douleur répétée → pause proposée ; douleur forte → pause imposée. */
function r5(context: RuleContext): Proposal[] {
  const painful = context.recent.filter((outcome) => (outcome.pain?.intensity ?? 0) > 0)
  const severe = painful.find((outcome) => (outcome.pain?.intensity ?? 0) >= PAIN_FORCE_PAUSE)

  if (severe) {
    return [
      {
        ruleId: RuleId.R5,
        effect: ProposalEffect.ForcePause,
        target: { kind: 'plan', id: null },
        before: 'course à pied au programme',
        after: 'course suspendue, vélo si indolore',
        explanation: `Douleur ${severe.pain!.intensity}/10 à ${severe.pain!.zone}.`,
      },
    ]
  }

  const repeated = painful.filter((outcome) => (outcome.pain?.intensity ?? 0) > PAIN_PROPOSE_PAUSE)
  if (repeated.length < 2) return []

  return [
    {
      ruleId: RuleId.R5,
      effect: ProposalEffect.ProposePause,
      target: { kind: 'plan', id: null },
      before: 'plan en cours',
      after: 'pause proposée',
      explanation: `Douleur supérieure à ${PAIN_PROPOSE_PAUSE}/10 sur deux séances à ${repeated[0]!.pain!.zone}.`,
    },
  ]
}

/** R6 — séance clé sautée : replacée seulement si l'écart avec la suivante tient. */
function r6(context: RuleContext): Proposal[] {
  const skipped = context.recent.find((outcome) => outcome.skipped && outcome.key)
  if (!skipped) return []

  const nextKey = keyRuns(context.upcoming)[0]
  if (!nextKey) return []

  const hours = (Date.parse(nextKey.date) - Date.parse(context.today)) / 3_600_000
  if (hours < MIN_HOURS_BETWEEN_KEY_SESSIONS) return []

  return [
    {
      ruleId: RuleId.R6,
      effect: ProposalEffect.RescheduleKeySession,
      target: { kind: 'session', id: nextKey.sessionId },
      before: 'séance sautée, perdue',
      after: `replacée avant le ${frenchShortDate(nextKey.date)}`,
      explanation: `L'écart avec la prochaine séance clé atteint ${Math.round(hours)} h.`,
    },
  ]
}

/** R7 — deux séances clés tenues → progression restaurée (règle inverse). */
function r7(context: RuleContext): Proposal[] {
  const lastKeys = context.recent.filter((outcome) => outcome.key && !outcome.skipped).slice(0, 2)
  if (lastKeys.length < 2) return []

  const held = lastKeys.every(
    (outcome) => outcome.rpe !== null && outcome.rpe <= outcome.expectedRpe && outcome.paceHeld,
  )
  if (!held) return []

  return [
    {
      ruleId: RuleId.R7,
      effect: ProposalEffect.RestoreProgression,
      target: { kind: 'week', id: null },
      before: 'progression gelée',
      after: 'progression restaurée',
      explanation: 'Deux séances clés tenues au RPE prévu ou en dessous, allures respectées.',
    },
  ]
}

/** R8 — conversion course → vélo à charge égale, jamais la sortie longue sauf douleur. */
function r8(context: RuleContext): Proposal[] {
  const last = context.recent[0]
  const inPain = (last?.pain?.intensity ?? 0) >= PAIN_FORCE_PAUSE
  if (!inPain) return []

  return context.upcoming
    .filter((session) => session.sport === Sport.Running)
    .filter((session) => session.code !== RunSessionCode.LongRun || inPain)
    .slice(0, MAX_TARGETS_PER_RULE)
    .map((session) => ({
      ruleId: RuleId.R8,
      effect: ProposalEffect.ConvertToCycling,
      target: { kind: 'session' as const, id: session.sessionId },
      before: `${runSessionType(session.code).label} en course`,
      after: 'vélo à charge équivalente',
      explanation: 'La douleur interdit la course : la charge est reportée sur le vélo.',
    }))
}

const RULES = [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, learnedMoves, learnedRpe]

/**
 * Évalue les règles R1 à R10 puis les règles apprises, et retourne des
 * propositions. Rien n'est appliqué ici : la décision revient à l'athlète
 * (§ 1.3). Une famille refusée systématiquement est retirée en dernier — une
 * règle apprise ne dépasse jamais une règle de sécurité, elle la tait.
 */
export function evaluateRules(context: RuleContext): Proposal[] {
  const suppressed = context.personal?.suppressed ?? []

  return RULES.flatMap((rule) => rule(context)).filter(
    (proposal) =>
      !suppressed.some(
        (family) => family.ruleId === proposal.ruleId && family.effect === proposal.effect,
      ),
  )
}
