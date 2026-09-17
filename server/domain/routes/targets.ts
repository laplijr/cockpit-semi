import type { IsoDate } from '../plan/calendar'
import { Sport } from '../shared/sport'
import { RouteKind, type RouteTarget } from './route'

export interface RouteSession {
  id: number
  date: IsoDate
  sport: string
  code: string
  distanceM: number
}

export interface RouteTargetsInput {
  /** Séances du plan actif, tous sports confondus. */
  sessions: RouteSession[]
  /** Arrivée sur place ; par défaut la veille de la course (§ 9). */
  arrivalDate: IsoDate
  raceDate: IsoDate
  /** Vrai quand la course porte l'adresse de sa ligne de départ (§ 4). */
  hasStartAddress: boolean
}

/**
 * Ce qu'il y a à tracer sur place : chaque sortie de course à pied planifiée
 * entre l'arrivée et la course — footing de veille, déblocage, échauffement —
 * plus l'aller logement → ligne de départ quand l'adresse est connue (§ 9).
 * Le jour de la course ne porte pas de séance (§ 5) : sa ligne est cet aller.
 */
export function routeTargets(input: RouteTargetsInput): RouteTarget[] {
  const loops = input.sessions
    .filter((session) => session.sport === Sport.Running)
    .filter((session) => session.date >= input.arrivalDate && session.date <= input.raceDate)
    .filter((session) => session.distanceM > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((session): RouteTarget => ({
      sessionId: session.id,
      date: session.date,
      code: session.code,
      distanceM: session.distanceM,
      kind: RouteKind.Loop,
    }))

  if (!input.hasStartAddress) return loops

  return [
    ...loops,
    {
      sessionId: null,
      date: input.raceDate,
      code: null,
      distanceM: 0,
      kind: RouteKind.Outbound,
    },
  ]
}
