import type { IsoDate } from '../domain/plan/calendar'
import { PlanTrigger } from '../domain/plan/session'
import type { Clock } from '../domain/shared/clock'
import type { PlanGateway } from './ports'
import { regeneratePlan } from './regenerate-plan'

export interface PauseGateway {
  /** Ferme toutes les pauses ouvertes à la date donnée. Retourne le nombre fermé. */
  closeOpenPauses(date: IsoDate): Promise<number>
}

export interface ResumePauseResult {
  resumedOn: IsoDate
  closed: number
  startDate: IsoDate | null
  weeks: number
}

/**
 * L'athlète marque lui-même la reprise : c'est elle qui date le plan (§ 0).
 * Le plan est régénéré immédiatement, ce qui pose enfin les séances.
 */
export async function resumePause(
  pauses: PauseGateway,
  plans: PlanGateway,
  clock: Clock,
): Promise<ResumePauseResult> {
  const resumedOn = clock.today()
  const closed = await pauses.closeOpenPauses(resumedOn)
  const { plan } = await regeneratePlan(plans, clock, PlanTrigger.Resume)

  return { resumedOn, closed, startDate: plan.startDate, weeks: plan.weeks.length }
}
