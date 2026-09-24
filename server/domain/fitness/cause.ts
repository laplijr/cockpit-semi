import type { RaceIncident } from '../races/race'
import { frenchDuration, frenchKm, frenchSignedDecimal } from '../shared/french'
import { FitnessOrigin } from './fitness-point'
import { TrainingZone, paceFor, vdotFromRace } from './vdot'

export interface CausePoint {
  date: string
  vdot: number
  isFloor: boolean
  origin: string
}

/** Ce que la base sait de l'événement qui a posé le point. */
export interface CauseContext {
  race?: {
    name: string
    distanceM: number
    resultatS: number | null
    incident: RaceIncident | null
  }
}

const TEST_S = 20 * 60

/**
 * La distance du test 20′, retrouvée depuis son VDOT : c'est d'elle qu'il
 * vient, l'inverse est exact. La séance, elle, compte aussi l'échauffement.
 */
function testDistanceM(vdot: number): number {
  let low = 1000
  let high = 8000
  for (let step = 0; step < 40; step++) {
    const middle = (low + high) / 2
    if (vdotFromRace(middle, TEST_S) < vdot) low = middle
    else high = middle
  }
  return (low + high) / 2
}

function origin(point: CausePoint, context: CauseContext): string {
  const race = context.race

  if (point.origin === FitnessOrigin.Race && race && point.isFloor) {
    const incident = race.incident
      ? `, ${race.incident.type} au km ${String(race.incident.km).replace('.', ',')}`
      : ''
    return `${race.name} : plancher${incident}`
  }
  if (point.origin === FitnessOrigin.Race && race) {
    const time = race.resultatS === null ? '' : ` en ${frenchDuration(race.resultatS)}`
    return `${race.name}${time}`
  }
  if (point.origin === FitnessOrigin.Test)
    return `Test 20′ : ${frenchKm(testDistanceM(point.vdot))}`
  if (point.origin === FitnessOrigin.Declared) {
    return `Allure d’endurance déclarée, ${frenchDuration(paceFor(point.vdot, TrainingZone.Easy))}/km`
  }
  return 'Chrono déclaré à l’arrivée'
}

/**
 * Pourquoi la forme a bougé, en une phrase et sans LLM (P22) : ce qui a posé
 * le point, puis l'écart signé au point d'avant. Le vieillissement d'un point
 * n'est pas une cause affichée : « fais au mieux, ne dis rien » (P7.5).
 */
export function fitnessCause(
  point: CausePoint,
  previous: CausePoint | undefined,
  context: CauseContext,
): string {
  const cause = origin(point, context)
  if (!previous) return cause
  return `${cause} · ${frenchSignedDecimal(point.vdot - previous.vdot, 1)}`
}
