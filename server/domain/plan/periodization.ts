import { RacePriority, type ObjectiveMode } from '../races/race'
import type { IsoDate } from './calendar'
import { addWeeks, startOfWeek, weeksBetween } from './calendar'
import { PhaseType } from './phases'

/** Au-delà, une course B ouvre son propre cycle au lieu de s'accrocher à la précédente (§ 5). */
export const MAX_WEEKS_FOR_MINI_CYCLE = 8
/** En deçà, une course A relève du cycle vitesse plutôt que du cycle long (§ 5). */
export const SHORT_RACE_MAX_M = 10_000

export interface PlannedRace {
  id: number
  name: string
  date: IsoDate
  distanceM: number
  priority: RacePriority
  objectiveMode: ObjectiveMode
}

export interface PlanPhase {
  type: PhaseType
  /** Index 1-based de la première et de la dernière semaine de la phase. */
  startWeek: number
  endWeek: number
  raceId: number
}

interface PhaseSpec {
  type: PhaseType
  weeks: number
  /** Phase qui absorbe le mou quand le calendrier est plus long que le gabarit. */
  flexible?: boolean
}

/** Rétro-planning d'un cycle long vers une course A (semi, marathon). */
function longCycle(totalWeeks: number): PhaseSpec[] {
  const fixed = [
    { type: PhaseType.Taper, weeks: 2 },
    { type: PhaseType.Specific, weeks: 7 },
    { type: PhaseType.Development, weeks: 8 },
  ]
  const base = Math.max(4, totalWeeks - 17)
  return [{ type: PhaseType.Base, weeks: base, flexible: true }, ...fixed.reverse()]
}

/** Cycle vitesse vers une course A courte : 5 km ou 10 km (§ 5). */
function speedCycle(): PhaseSpec[] {
  return [
    { type: PhaseType.Recovery, weeks: 2 },
    { type: PhaseType.ShortBase, weeks: 4, flexible: true },
    { type: PhaseType.Speed, weeks: 8 },
    { type: PhaseType.Taper, weeks: 1 },
  ]
}

/** Mini-cycle vers une course B proche : Récup 2 · Relance N−3 · Affûtage 1. */
function miniCycle(totalWeeks: number): PhaseSpec[] {
  return [
    { type: PhaseType.Recovery, weeks: 2 },
    { type: PhaseType.Rebuild, weeks: Math.max(0, totalWeeks - 3), flexible: true },
    { type: PhaseType.Taper, weeks: 1 },
  ]
}

function specsFor(race: PlannedRace, previous: PlannedRace | undefined, totalWeeks: number) {
  if (!previous) return longCycle(totalWeeks)
  if (race.priority === RacePriority.B) return miniCycle(totalWeeks)
  return race.distanceM <= SHORT_RACE_MAX_M ? speedCycle() : longCycle(totalWeeks)
}

/**
 * Découpe le calendrier en cycles, un par course qui structure le plan, et
 * pose les phases de chaque cycle en rétro-planning depuis sa course.
 */
export function buildPhases(startDate: IsoDate, races: PlannedRace[]): PlanPhase[] {
  const structuring = races
    .filter((race) => race.priority !== RacePriority.C)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))

  const phases: PlanPhase[] = []
  let cursorWeek = 1
  let cursorDate = startOfWeek(startDate)
  let previous: PlannedRace | undefined

  for (const race of structuring) {
    const totalWeeks = Math.max(1, weeksBetween(cursorDate, race.date))
    const specs = specsFor(race, previous, totalWeeks)
    const planned = fitSpecs(specs, totalWeeks)

    for (const spec of planned) {
      if (spec.weeks <= 0) continue
      phases.push({
        type: spec.type,
        startWeek: cursorWeek,
        endWeek: cursorWeek + spec.weeks - 1,
        raceId: race.id,
      })
      cursorWeek += spec.weeks
    }

    cursorDate = addWeeks(cursorDate, totalWeeks)
    previous = race
  }

  return phases
}

/**
 * Ajuste un gabarit de phases au nombre de semaines réellement disponibles.
 * On rogne d'abord les phases les plus longues, l'affûtage en dernier.
 */
function fitSpecs(specs: PhaseSpec[], totalWeeks: number): PhaseSpec[] {
  const result = specs.map((spec) => ({ ...spec }))
  let surplus = result.reduce((sum, spec) => sum + spec.weeks, 0) - totalWeeks

  while (surplus > 0) {
    const trimmable = result.filter((spec) => spec.type !== PhaseType.Taper && spec.weeks > 0)
    if (trimmable.length === 0) break
    const longest = trimmable.reduce((a, b) => (b.weeks > a.weeks ? b : a))
    longest.weeks -= 1
    surplus -= 1
  }

  const deficit = totalWeeks - result.reduce((sum, spec) => sum + spec.weeks, 0)
  if (deficit > 0) {
    const grown =
      result.find((spec) => spec.flexible) ??
      result.find((spec) => spec.type !== PhaseType.Taper) ??
      result[0]!
    grown.weeks += deficit
  }

  return result
}

export function phaseAtWeek(phases: PlanPhase[], week: number): PlanPhase | undefined {
  return phases.find((phase) => week >= phase.startWeek && week <= phase.endWeek)
}
