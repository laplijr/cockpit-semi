import type { PlanSession } from '~/stores/plan'
import {
  averagePrescribedPace,
  hasSeveralPaces,
  keyStepIndex,
  keyStepPace,
} from '~~/server/domain/running/splits'

/**
 * Les trois chiffres d'une séance, et eux seuls (§ 8, P11.1). Une séance
 * décrite par ce qu'elle n'a pas n'est pas décrite : le renforcement montrait
 * une distance et une allure cible, donc deux tirets sur trois colonnes. La
 * grille ne bouge pas — trois colonnes, mêmes positions — ce sont les libellés
 * et les valeurs qui changent avec le sport.
 */
export interface SessionFigure {
  key: 'un' | 'deux' | 'trois'
  label: string
  value: string
  /** Valeur prescrite, quand ce n'est plus celle qu'on affiche (§ 8, P7.4). */
  planned?: string
}

/** L'allure qui donne le ton de la séance : celle de son étape clé. */
function targetPace(session: PlanSession): string {
  const key = keyStepIndex(session.prescription)
  const pace = key === undefined ? undefined : session.prescription.steps[key]!.paceSecPerKm
  return pace ? `${formatPace(pace)}/km` : '—'
}

/** L'allure moyenne se déduit du réalisé ; il faut les deux mesures. */
function averagePace(session: PlanSession): string | null {
  const { actualDistanceM, actualDurationMin } = session
  if (!actualDistanceM || !actualDurationMin) return null
  return `${formatPace((actualDurationMin * 60) / (actualDistanceM / 1000))}/km`
}

/**
 * L'allure réalisée se compare à une allure prescrite de même nature. L'étape
 * clé chronométrée se lit contre l'allure visée ; sans elle, la moyenne
 * d'une séance à plusieurs allures se lit contre la moyenne prescrite — la
 * moyenne d'un progressif contre l'allure de son dernier tiers ne disait rien.
 */
function heldPaceFigure(session: PlanSession): Omit<SessionFigure, 'key'> {
  const onKeyStep = keyStepPace(session.prescription, session.actualSteps ?? [])
  if (onKeyStep !== null) return { label: 'allure tenue', value: `${formatPace(onKeyStep)}/km` }

  const average = averagePace(session) ?? ''
  if (!hasSeveralPaces(session.prescription)) return { label: 'allure tenue', value: average }
  return {
    label: 'allure moyenne',
    value: average,
    planned: `${formatPace(averagePrescribedPace(session.prescription))}/km`,
  }
}

function distance(session: PlanSession): string {
  return session.prescription.totalDistanceM > 0
    ? formatDistance(session.prescription.totalDistanceM)
    : '—'
}

/** L'intensité du vélo est dite par ses étapes : celle de la première qui en porte une. */
function intensity(session: PlanSession): string {
  return session.prescription.steps.find((step) => step.intensity)?.intensity ?? '—'
}

/** La taille honnête d'une séance de renforcement : le nombre d'exercices. */
function exerciseCount(session: PlanSession): number {
  return new Set(
    session.prescription.steps
      .filter((step) => step.exerciseId)
      .map((step) => step.exerciseId as string),
  ).size
}

function plannedFigures(session: PlanSession): SessionFigure[] {
  const minutes = formatMinutes(prescribedMinutes(session.prescription))

  if (session.sport === 'muscu') {
    const count = exerciseCount(session)
    return [
      { key: 'un', label: 'durée', value: minutes },
      { key: 'deux', label: 'exercices', value: count > 0 ? String(count) : '—' },
      { key: 'trois', label: 'effort attendu', value: `RPE ${session.prescription.expectedRpe}` },
    ]
  }

  if (session.sport === 'velo') {
    return [
      { key: 'un', label: 'distance', value: distance(session) },
      { key: 'deux', label: 'durée', value: minutes },
      { key: 'trois', label: 'intensité', value: intensity(session) },
    ]
  }

  return [
    { key: 'un', label: 'distance', value: distance(session) },
    { key: 'deux', label: 'durée', value: minutes },
    { key: 'trois', label: 'allure cible', value: targetPace(session) },
  ]
}

/**
 * Une séance faite se lit par ce qui a été fait, pas par ce qui avait été
 * demandé (§ 8, P7.4). Sans mesure, rien ne change — on ne montre pas ce
 * qu'on n'a pas — et le prescrit ne descend en dessous que là où il diffère.
 */
function measuredFigures(session: PlanSession): SessionFigure[] | null {
  const done = session.status === 'faite'
  if (!done) return null

  const minutes =
    session.actualDurationMin === null
      ? null
      : { label: 'durée', value: formatMinutes(session.actualDurationMin) }

  if (session.sport === 'muscu') {
    if (minutes === null && session.feedbackRpe === null) return null
    return [
      { key: 'un', ...(minutes ?? { label: 'durée', value: '' }) },
      { key: 'deux', label: 'exercices', value: '' },
      {
        key: 'trois',
        label: 'effort ressenti',
        value: session.feedbackRpe === null ? '' : `RPE ${session.feedbackRpe}`,
      },
    ]
  }

  if (session.actualDistanceM === null && minutes === null) return null

  const measured =
    session.actualDistanceM === null
      ? { label: 'distance', value: '' }
      : { label: 'distance', value: formatDistance(session.actualDistanceM) }

  if (session.sport === 'velo') {
    return [
      { key: 'un', ...measured },
      { key: 'deux', ...(minutes ?? { label: 'durée', value: '' }) },
      { key: 'trois', label: 'intensité', value: '' },
    ]
  }

  return [
    { key: 'un', ...measured },
    { key: 'deux', ...(minutes ?? { label: 'durée', value: '' }) },
    { key: 'trois', ...heldPaceFigure(session) },
  ]
}

export function sessionFigures(session: PlanSession): SessionFigure[] {
  const planned = plannedFigures(session)
  const measured = measuredFigures(session)
  if (!measured) return planned

  return measured.map(({ key, label, value, planned: reference }, index) => {
    const before = planned[index]!
    /** Sans mesure pour ce chiffre, c'est le prescrit qui reste, et seul. */
    if (value === '') return before
    /** Un chiffre réalisé peut nommer son propre prescrit : une moyenne contre une moyenne. */
    const prescribed = reference ?? before.value
    return value === prescribed ? { key, label, value } : { key, label, value, planned: prescribed }
  })
}

/** Sous cette part du prescrit, une séance faite garde sa coche, en ambre (P20). */
export const COMPLIANCE_FLOOR = 0.8

/**
 * Le réalisé tombe sous 80 % du prescrit, mesuré là où la séance se mesure :
 * la distance quand elle en prescrit une, la durée sinon. Sans mesure, on ne
 * juge pas.
 */
export function isShortOfPrescription(session: PlanSession): boolean {
  if (session.status !== 'faite') return false
  if (session.prescription.totalDistanceM > 0 && session.actualDistanceM !== null) {
    return session.actualDistanceM < session.prescription.totalDistanceM * COMPLIANCE_FLOOR
  }
  if (session.actualDurationMin === null) return false
  return session.actualDurationMin < prescribedMinutes(session.prescription) * COMPLIANCE_FLOOR
}

/**
 * Ni faite, ni manquée, ni retirée. Posée, remplacée ou déplacée à la main,
 * elle est « modifiée » et reste à faire.
 */
export function isToDo(session: PlanSession): boolean {
  return session.status === 'prevue' || session.status === 'modifiee'
}

/** Une séance prévue dont le jour est passé : ni faite ni sautée, elle attend son retour (P20). */
export function isAwaitingFeedback(session: PlanSession, today: string): boolean {
  return isToDo(session) && session.date < today
}
