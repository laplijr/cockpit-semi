import type { StepTarget } from '~~/server/domain/tracking/steps'
import { WorkoutStepKind, type WorkoutBlock } from '~~/server/domain/watch/workout'

/** La taille d'une étape : sa durée, sa distance, ou rien à mesurer. */
export function describeTarget(step: StepTarget): string {
  if (step.durationS) return formatSeconds(step.durationS)
  if (step.distanceM) return formatDistance(step.distanceM)
  return 'à la sensation'
}

/**
 * Ce qu'il y a à tenir sur l'étape. Une récupération ne porte ni allure ni
 * effort : elle ne dit que sa durée, et « à RPE — » n'aurait rien dit.
 */
export function targetLine(step: StepTarget): string {
  if (step.paceSecPerKm) return `${describeTarget(step)} à ${formatPace(step.paceSecPerKm)}/km`
  if (step.rpe) return `${describeTarget(step)} à RPE ${step.rpe}`
  return describeTarget(step)
}

/**
 * Une ligne par bloc, avant de partir : « 4 × (500 m à 5:23/km + récup 2′30) »,
 * comme dans la fenêtre de séance. Dépliées, les répétitions faisaient dix
 * lignes et poussaient « Démarrer » hors de l'écran (P21).
 */
export function stepBlockLines(blocks: WorkoutBlock[]): { label: string; line: string }[] {
  return blocks.flatMap((block) => {
    if (block.repeats <= 1)
      return block.steps.map((step) => ({ label: step.label, line: targetLine(step) }))
    const parts = block.steps.map((step) =>
      step.kind === WorkoutStepKind.Recovery ? `récup ${describeTarget(step)}` : targetLine(step),
    )
    return [
      { label: block.steps[0]?.label ?? '', line: `${block.repeats} × (${parts.join(' + ')})` },
    ]
  })
}

/**
 * La même étape, dite à voix haute. Ni « 8′ » ni « 4:15 » ne se lisent : la
 * synthèse vocale en fait un prime muet et des heures (§ 9, P18).
 */
export function speakLine(step: StepTarget): string {
  const size = step.durationS
    ? speakDuration(step.durationS)
    : step.distanceM
      ? speakDistance(step.distanceM)
      : 'à la sensation'

  if (step.paceSecPerKm) return `${size} à ${speakPace(step.paceSecPerKm)}`
  if (step.rpe) return `${size} à RPE ${step.rpe}`
  return size
}
