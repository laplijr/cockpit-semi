import type { IsoDate } from '../plan/calendar'
import type { PhaseType } from '../plan/phases'
import { SessionStatus } from '../plan/session'
import { isConforming, type WeekSummary } from './week-summary'

/** Ce que la semaine a valu, une fois close. */
export enum ReviewVerdict {
  /** Quatre séances sur cinq au moins : la semaine compte (§ 5). */
  Conforming = 'conforme',
  /** Allégée par le moteur ou par une pause : ce n'est pas un échec (§ 1). */
  Eased = 'allegee',
  /** Une partie est passée, pas tout. */
  Partial = 'partielle',
  /** Rien ou presque n'a eu lieu. */
  Missed = 'manquee',
}

/**
 * Un fait que le bilan met en avant. Typé et non rédigé : la phrase appartient
 * au composant qui l'affiche (§ 8).
 */
export enum ReviewHighlight {
  TestPassed = 'test_passe',
  VdotGained = 'vdot_gagne',
  VdotLost = 'vdot_perdu',
  LongRunMissed = 'sortie_longue_manquee',
  KeySessionsMissed = 'seances_cles_manquees',
  VolumeOverTarget = 'volume_au_dessus',
  VolumeUnderTarget = 'volume_en_dessous',
  ShortNights = 'nuits_courtes',
  PainReported = 'douleur_signalee',
  EverythingDone = 'tout_fait',
}

/** Au-delà, l'écart au volume visé mérite d'être dit. */
const VOLUME_GAP_SHARE = 0.1
/** En deçà, la semaine n'a pas eu lieu. */
const MISSED_SHARE = 0.4
/** Une nuit en dessous n'est pas courte ; trois le sont. */
const SHORT_NIGHT_H = 6.5
const SHORT_NIGHTS_COUNT = 3

export interface ReviewSession {
  sport: string
  code: string
  status: SessionStatus
  key: boolean
  longRun: boolean
}

export interface ReviewFeedback {
  sleepH: number | null
  pain: boolean
}

export interface WeeklyReviewInput {
  weekStart: IsoDate
  weekEnd: IsoDate
  summary: WeekSummary
  sessions: ReviewSession[]
  feedbacks: ReviewFeedback[]
  /** Allégée par le moteur ou couverte par une pause : la même excuse qu'au § 5. */
  excused: boolean
  /** Forme au premier et au dernier point de la semaine ; nuls sans mesure. */
  vdotBefore: number | null
  vdotAfter: number | null
  /** Ce que la semaine qui s'ouvre demande ; nuls quand le plan s'arrête là. */
  nextTargetRunM: number | null
  nextPhase: PhaseType | null
}

export interface WeeklyReview {
  weekStart: IsoDate
  weekEnd: IsoDate
  verdict: ReviewVerdict
  runM: { done: number | null; target: number; gapM: number | null }
  sessions: { done: number; planned: number; key: number; keyDone: number }
  loadUa: number
  /** Variation de VDOT sur la semaine ; nulle sans deux mesures. */
  vdotChange: number | null
  highlights: ReviewHighlight[]
  next: { targetRunM: number | null; phase: PhaseType | null }
}

const DONE = [SessionStatus.Done]

/**
 * Le bilan d'une semaine close (§ 9, P7.1). Il ne calcule rien de neuf : il
 * compose `summariseWeek`, les séances, les ressentis et les points de forme
 * en un verdict et une poignée de faits. Une semaine allégée par le moteur
 * n'est jamais un échec — le cockpit doit pouvoir dire de lever le pied sans
 * que ça coûte quelque chose (§ 1).
 */
export function weeklyReview(input: WeeklyReviewInput): WeeklyReview {
  const { summary, sessions } = input

  const key = sessions.filter((item) => item.key && item.status !== SessionStatus.Cancelled)
  const keyDone = key.filter((item) => DONE.includes(item.status))

  return {
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
    verdict: verdictFor(input),
    runM: { done: summary.actualRunM, target: summary.targetRunM, gapM: summary.runGapM },
    sessions: {
      done: summary.sessionsDone,
      planned: summary.sessionsPlanned,
      key: key.length,
      keyDone: keyDone.length,
    },
    loadUa: summary.loadUa,
    vdotChange: vdotChange(input),
    highlights: highlightsFor(input, key.length - keyDone.length),
    next: { targetRunM: input.nextTargetRunM, phase: input.nextPhase },
  }
}

function verdictFor(input: WeeklyReviewInput): ReviewVerdict {
  const { summary } = input
  if (input.excused || summary.light || summary.comeback) return ReviewVerdict.Eased
  if (isConforming(summary)) return ReviewVerdict.Conforming
  if (summary.sessionsPlanned === 0) return ReviewVerdict.Missed
  if (summary.sessionsDone <= summary.sessionsPlanned * MISSED_SHARE) return ReviewVerdict.Missed
  return ReviewVerdict.Partial
}

function vdotChange({ vdotBefore, vdotAfter }: WeeklyReviewInput): number | null {
  if (vdotBefore === null || vdotAfter === null) return null
  return Math.round((vdotAfter - vdotBefore) * 100) / 100
}

function highlightsFor(input: WeeklyReviewInput, keyMissed: number): ReviewHighlight[] {
  const { summary, sessions, feedbacks } = input
  const found: ReviewHighlight[] = []
  const change = vdotChange(input)

  if (summary.test && change !== null) {
    found.push(ReviewHighlight.TestPassed)
  }
  if (change !== null && change > 0) found.push(ReviewHighlight.VdotGained)
  if (change !== null && change < 0) found.push(ReviewHighlight.VdotLost)

  const longRun = sessions.find((item) => item.longRun && item.status !== SessionStatus.Cancelled)
  if (longRun && !DONE.includes(longRun.status)) found.push(ReviewHighlight.LongRunMissed)
  if (keyMissed > 0) found.push(ReviewHighlight.KeySessionsMissed)

  /**
   * L'écart de volume ne se dit que sur une semaine pleine : pendant une
   * reprise ou une semaine allégée, être en dessous de la cible est le but.
   */
  if (summary.runGapM !== null && !summary.light && !summary.comeback) {
    const tolerated = summary.targetRunM * VOLUME_GAP_SHARE
    if (summary.runGapM > tolerated) found.push(ReviewHighlight.VolumeOverTarget)
    if (summary.runGapM < -tolerated) found.push(ReviewHighlight.VolumeUnderTarget)
  }

  const shortNights = feedbacks.filter(
    (item) => item.sleepH !== null && item.sleepH < SHORT_NIGHT_H,
  ).length
  if (shortNights >= SHORT_NIGHTS_COUNT) found.push(ReviewHighlight.ShortNights)
  if (feedbacks.some((item) => item.pain)) found.push(ReviewHighlight.PainReported)

  if (summary.sessionsPlanned > 0 && summary.sessionsDone === summary.sessionsPlanned) {
    found.push(ReviewHighlight.EverythingDone)
  }

  return found
}
