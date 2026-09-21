import { FitnessDeclaration, type StartingFitness } from '../domain/fitness/declaration'
import { FitnessOrigin } from '../domain/fitness/fitness-point'
import { vdotFromEasyPace, vdotFromRace } from '../domain/fitness/vdot'
import type { IsoDate } from '../domain/plan/calendar'
import type { FitnessGateway } from './record-test'

export interface DeclaredFitness {
  vdot: number
  isFloor: boolean
}

/**
 * Point de forme de départ, déclaré à l'arrivée. Un chrono mesure la forme ;
 * une allure d'endurance la borne par le bas ; « je ne sais pas » n'écrit
 * rien, et le plan démarre alors en endurance seule jusqu'au test (§ 5).
 */
export async function declareFitness(
  fitness: FitnessGateway,
  today: IsoDate,
  input: StartingFitness,
): Promise<DeclaredFitness | undefined> {
  if (input.kind === FitnessDeclaration.Unknown) return undefined

  const point =
    input.kind === FitnessDeclaration.Chrono
      ? {
          date: input.date,
          vdot: vdotFromRace(input.distanceM, input.timeS),
          origin: FitnessOrigin.InitialImport,
          isFloor: false,
          note: `Chrono déclaré · ${Math.round(input.distanceM)} m`,
        }
      : {
          date: today,
          vdot: vdotFromEasyPace(input.paceSecPerKm),
          origin: FitnessOrigin.Declared,
          isFloor: true,
          note: `Allure d’endurance déclarée · ${paceLabel(input.paceSecPerKm)}/km`,
        }

  await fitness.saveFitnessPoint(point)
  return { vdot: point.vdot, isFloor: point.isFloor }
}

function paceLabel(secPerKm: number): string {
  const total = Math.round(secPerKm)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
