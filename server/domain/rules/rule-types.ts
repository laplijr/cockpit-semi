import type { ResolvedForecast } from '../fitness/accuracy'
import type { PersonalAdjustments } from '../learning/personal-rules'
import type { Pain, Sensation } from '../load/feedback'
import type { IsoDate } from '../plan/calendar'
import type { RunSessionCode } from '../running/session-types'
import type { Sport } from '../shared/sport'

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
