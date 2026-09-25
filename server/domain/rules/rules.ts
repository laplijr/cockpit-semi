import {
  ForecastHorizon,
  accuracy,
  adjustedGainPerBlock,
  forecastGap,
  horizonOf,
  type ResolvedForecast,
} from '../fitness/accuracy'
import { VDOT_GAIN_PER_BLOCK } from '../fitness/projection'
import { EMPTY_ADJUSTMENTS, type PersonalAdjustments } from '../learning/personal-rules'
import { FATIGUE_SENSATIONS, type Pain, type Sensation } from '../load/feedback'
import { CONFORMING_SHARE } from '../load/week-summary'
import { addDays, weekday as weekdayOf, type IsoDate } from '../plan/calendar'
import { RunSessionCode, runSessionType } from '../running/session-types'
import { frenchKm, frenchShortDate } from '../shared/french'
import { Sport } from '../shared/sport'

/** Identifiants des règles de recalcul (§ 5). Les règles apprises prendront R100+. */
export enum RuleId {
  R1 = 'R1',
  R2 = 'R2',
  R3 = 'R3',
  R4 = 'R4',
  R5 = 'R5',
  R6 = 'R6',
  R7 = 'R7',
  R8 = 'R8',
  /** Le moteur se trompe toujours dans le même sens : sa progression estimée se recale. */
  R9 = 'R9',
  /** La semaine close n'a pas couru son volume : la suivante ne monte pas. */
  R10 = 'R10',
  /** Imprévu : une indisponibilité déclarée en texte libre touche une séance (§ 6). */
  I1 = 'I1',
  /** Calendrier : la date annoncée d'une course a changé depuis la recherche (§ 6). */
  C1 = 'C1',
  /** Apprise : la séance se fait un autre jour que celui prévu (§ 5, R100+). */
  R100 = 'R100',
  /** Apprise : un jour de la semaine où rien n'est jamais fait. */
  R101 = 'R101',
  /** Apprise : un type de séance ressenti autrement que prévu. */
  R102 = 'R102',
}

export enum ProposalEffect {
  ReduceStrengthSet = 'muscu_serie_en_moins',
  ReduceEasyVolume = 'faciles_reduites',
  ReduceLongRun = 'sortie_longue_reduite',
  ReduceRepeats = 'repetitions_en_moins',
  FreezeProgression = 'progression_gelee',
  ProposePause = 'pause_proposee',
  ForcePause = 'pause_imposee',
  RescheduleKeySession = 'seance_replacee',
  RestoreProgression = 'progression_retablie',
  ConvertToCycling = 'conversion_velo',
  MoveSession = 'seance_deplacee',
  CancelSession = 'seance_retiree',
  MoveRace = 'course_redatee',
  /** La progression estimée d'ici une échéance est recalée sur le réalisé. */
  AdjustExpectedGain = 'progression_estimee_ajustee',
  /** Apprise : le RPE attendu d'une séance est recalé sur le ressenti observé. */
  AdjustExpectedRpe = 'rpe_attendu_ajuste',
}

export interface ProposalTarget {
  kind: 'session' | 'week' | 'plan' | 'race'
  id: number | null
}

export interface Proposal {
  ruleId: RuleId
  effect: ProposalEffect
  target: ProposalTarget
  /** Valeur actuelle, affichée barrée à l'écran (§ 8). */
  before: string
  after: string
  explanation: string
  /** Ce que le texte d'une proposition ne peut pas porter : une date de destination. */
  payload?: Record<string, unknown>
}

export const SLEEP_DEBT_HOURS = 6
export const PAIN_PROPOSE_PAUSE = 3
export const PAIN_FORCE_PAUSE = 4
export const MIN_HOURS_BETWEEN_KEY_SESSIONS = 48
/** Une règle ne propose jamais d'ajuster plus de séances que ça d'un coup. */
export const MAX_TARGETS_PER_RULE = 3
/** Au-delà de cinq comparaisons résolues, un horizon se juge (§ 5, R9). */
export const BIAS_MIN_FORECASTS = 6
/** En deçà, l'écart moyen tient dans le bruit des tests (§ 5, R9). */
export const BIAS_VDOT_THRESHOLD = 0.5

export interface SessionOutcome {
  sessionId: number
  date: IsoDate
  sport: Sport
  code: RunSessionCode
  key: boolean
  expectedRpe: number
  rpe: number | null
  sensations: Sensation[]
  sleepHours: number | null
  pain: Pain | null
  /** Faux quand l'allure prescrite n'a pas été tenue. */
  paceHeld: boolean
  skipped: boolean
}

export interface UpcomingSession {
  sessionId: number
  date: IsoDate
  sport: Sport
  code: RunSessionCode
  key: boolean
  distanceM: number
  repeats: number | null
  /** RPE prescrit, que R102 recale ; absent tant que rien ne le lit. */
  expectedRpe?: number
}

/** La dernière semaine close, que R10 juge sur ses kilomètres (§ 5). */
export interface ClosedWeek {
  weekId: number
  startDate: IsoDate
  targetRunM: number
  /** Mètres courus ; nul tant qu'une course de la semaine attend son réalisé. */
  runM: number | null
  /** Couverte par une pause, ou semaine de reprise : elle ne se juge pas. */
  excused: boolean
}

export interface RuleContext {
  today: IsoDate
  /** Séances passées, de la plus récente à la plus ancienne. */
  recent: SessionOutcome[]
  upcoming: UpcomingSession[]
  /** Séances de musculation du jour, cibles de R1. */
  sameDayStrength: UpcomingSession[]
  /** Règles apprises acceptées ; sans elles, le moteur se comporte comme avant. */
  personal?: PersonalAdjustments
  /** Prévisions déjà confrontées au réalisé, matière de R9 (§ 9, P6.6). */
  forecasts?: ResolvedForecast[]
  /** Progression estimée en vigueur, que R9 propose de corriger. */
  gainPerBlock?: number
  closedWeek?: ClosedWeek
}

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

/**
 * R100 et R101 — apprises : replacer une séance du jour prévu vers le jour
 * réellement tenu, et vider un créneau jamais honoré. Elles ne font que
 * déplacer ; la date de destination voyage dans le `payload`, pas dans le texte.
 */
function learnedMoves(context: RuleContext): Proposal[] {
  const personal = context.personal ?? EMPTY_ADJUSTMENTS
  if (personal.dayShifts.length === 0 && personal.deadWeekdays.length === 0) return []

  return context.upcoming
    .flatMap((session) => {
      const day = weekdayOf(session.date)
      const shift = personal.dayShifts.find(
        (entry) => entry.code === session.code && entry.fromWeekday === day,
      )
      if (shift) return [moveProposal(RuleId.R100, session, day, shift.toWeekday)]

      if (!personal.deadWeekdays.includes(day)) return []
      const destination = nextLivedDay(day, personal.deadWeekdays)
      return destination === null ? [] : [moveProposal(RuleId.R101, session, day, destination)]
    })
    .slice(0, MAX_TARGETS_PER_RULE)
}

const WEEKDAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

function moveProposal(
  ruleId: RuleId,
  session: UpcomingSession,
  from: number,
  to: number,
): Proposal {
  const date = addDays(session.date, (((to - from) % 7) + 7) % 7)
  return {
    ruleId,
    effect: ProposalEffect.MoveSession,
    target: { kind: 'session', id: session.sessionId },
    before: `${WEEKDAY_NAMES[from - 1]} ${frenchShortDate(session.date)}`,
    after: `${WEEKDAY_NAMES[to - 1]} ${frenchShortDate(date)}`,
    explanation:
      ruleId === RuleId.R100
        ? 'Habitude acceptée : cette séance se fait ce jour-là.'
        : 'Habitude acceptée : rien ne se fait ce jour-là.',
    payload: { date },
  }
}

/** Premier jour suivant qui n'est pas lui-même un créneau mort. */
function nextLivedDay(from: number, dead: number[]): number | null {
  for (let step = 1; step < 7; step += 1) {
    const day = ((from - 1 + step) % 7) + 1
    if (!dead.includes(day)) return day
  }
  return null
}

/** R102 — apprise : le RPE attendu d'un type de séance est recalé. */
function learnedRpe(context: RuleContext): Proposal[] {
  const biases = context.personal?.rpeBias ?? []
  if (biases.length === 0) return []

  return context.upcoming
    .flatMap((session) => {
      const bias = biases.find((entry) => entry.code === session.code)
      if (!bias || session.expectedRpe === undefined) return []

      const adjusted = Math.min(10, Math.max(1, session.expectedRpe + bias.bias))
      if (adjusted === session.expectedRpe) return []

      return [
        {
          ruleId: RuleId.R102,
          effect: ProposalEffect.AdjustExpectedRpe,
          target: { kind: 'session' as const, id: session.sessionId },
          before: `RPE ${session.expectedRpe}`,
          after: `RPE ${adjusted}`,
          explanation: 'Habitude acceptée : cette séance se ressent autrement que prévu.',
          payload: { expectedRpe: adjusted },
        },
      ]
    })
    .slice(0, MAX_TARGETS_PER_RULE)
}

const HORIZON_LABELS: Record<ForecastHorizon, string> = {
  [ForecastHorizon.Short]: 'à moins de quatre semaines',
  [ForecastHorizon.Medium]: 'de quatre à douze semaines',
  [ForecastHorizon.Long]: 'au-delà de douze semaines',
}

/** Un gain par bloc, tel qu'il se lit dans une proposition. */
function gainLabel(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(2).replace(/0$/, '').replace('.', ',')} VDOT par bloc de huit semaines`
}

function gapLabel(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1).replace('.', ',')}`
}

/**
 * R9 — le moteur se trompe toujours dans le même sens sur un horizon : sa
 * progression estimée se recale sur ce qui est arrivé. Un seul horizon parle à
 * la fois, le plus court qui déclenche : trois propositions de plan d'un coup
 * ne se décident pas (§ 5).
 */
function r9(context: RuleContext): Proposal[] {
  const resolved = context.forecasts ?? []
  if (resolved.length === 0) return []

  const current = context.gainPerBlock ?? VDOT_GAIN_PER_BLOCK

  return Object.values(ForecastHorizon)
    .flatMap((horizon) => {
      const items = resolved.filter(
        (item) => horizonOf(item.issuedDate, item.targetDate) === horizon,
      )
      if (items.length < BIAS_MIN_FORECASTS) return []

      const verdict = accuracy(items)
      if (!verdict || Math.abs(verdict.biasVdot) <= BIAS_VDOT_THRESHOLD) return []

      const adjusted = adjustedGainPerBlock(current, verdict)
      if (adjusted === current) return []

      const gaps = items.map(forecastGap).map(gapLabel).join(', ')

      return [
        {
          ruleId: RuleId.R9,
          effect: ProposalEffect.AdjustExpectedGain,
          target: { kind: 'plan' as const, id: null },
          before: gainLabel(current),
          after: gainLabel(adjusted),
          explanation: `${verdict.count} prévisions ${HORIZON_LABELS[horizon]} : écart moyen de ${gapLabel(verdict.biasVdot)} VDOT (${gaps}).`,
          payload: { gainPerBlock: adjusted },
        },
      ]
    })
    .slice(0, 1)
}

/**
 * R10 — la semaine close a couru moins de 80 % de sa cible : la suivante ne
 * monte pas. Le seuil est celui de la conformité (P6.5), en kilomètres au lieu
 * de séances. Une semaine allégée se juge sur sa cible allégée ; le gel part
 * de la semaine prochaine, celle en cours ayant déjà ses séances faites.
 */
function r10(context: RuleContext): Proposal[] {
  const closed = context.closedWeek
  if (!closed || closed.excused || closed.runM === null || closed.targetRunM === 0) return []
  if (closed.runM >= closed.targetRunM * CONFORMING_SHARE) return []

  return [
    {
      ruleId: RuleId.R10,
      effect: ProposalEffect.FreezeProgression,
      target: { kind: 'week', id: closed.weekId },
      before: 'progression du bloc',
      after: 'volume maintenu la semaine prochaine',
      explanation: `La semaine du ${frenchShortDate(closed.startDate)} a couru ${frenchKm(closed.runM)} sur ${frenchKm(closed.targetRunM)} visés.`,
    },
  ]
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
