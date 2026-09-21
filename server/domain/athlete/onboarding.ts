/** Les six écrans de l'arrivée, dans l'ordre (§ 9, P8.2). */
export enum OnboardingStep {
  Welcome = 1,
  Identity = 2,
  Level = 3,
  Fitness = 4,
  Objective = 5,
  Schedule = 6,
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  OnboardingStep.Welcome,
  OnboardingStep.Identity,
  OnboardingStep.Level,
  OnboardingStep.Fitness,
  OnboardingStep.Objective,
  OnboardingStep.Schedule,
]

export const STEP_TITLES: Record<OnboardingStep, string> = {
  [OnboardingStep.Welcome]: 'Ce que fait ce cockpit',
  [OnboardingStep.Identity]: 'Qui tu es',
  [OnboardingStep.Level]: 'Ton niveau d’entraînement',
  [OnboardingStep.Fitness]: 'Où tu en es en course à pied',
  [OnboardingStep.Objective]: 'Ce que tu prépares',
  [OnboardingStep.Schedule]: 'Quand et quoi',
}

/** Au moins trois jours : le plan ne tient pas sur deux (§ 5). */
export const MIN_AVAILABLE_DAYS = 3

/**
 * Traces laissées en base par les écrans déjà passés. Rien n'est stocké de
 * l'avancement lui-même : l'état de l'athlète le dit (§ 9, P8.2).
 */
export interface OnboardingState {
  /** Le prénom suffit à dire que l'écran d'identité a été rempli. */
  hasIdentity: boolean
  hasLevel: boolean
  /** Un point de forme existe, quelle qu'en soit l'origine. */
  hasFitness: boolean
  /** Une course est inscrite au calendrier. */
  hasObjective: boolean
  hasConstraints: boolean
}

/**
 * Écran où reprendre : le premier dont la trace manque. Les deux réponses qui
 * ne laissent rien derrière elles — « je ne sais pas » et « aucune course » —
 * se redonnent donc à la reprise, en un clic ; c'est le prix d'un état de
 * moins à tenir cohérent (§ 9, P8.2).
 */
export function resumeStep(state: OnboardingState): OnboardingStep {
  if (!state.hasIdentity) return OnboardingStep.Identity
  if (!state.hasLevel) return OnboardingStep.Level
  if (!state.hasFitness) return OnboardingStep.Fitness
  if (!state.hasObjective) return OnboardingStep.Objective
  return OnboardingStep.Schedule
}

/** Vrai quand rien n'a encore été écrit : l'arrivant voit l'écran d'accueil. */
export function isUntouched(state: OnboardingState): boolean {
  return Object.values(state).every((value) => !value)
}
