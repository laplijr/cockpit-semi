import type { PauseAllowances, PauseType } from '../domain/pause/pause'
import type { IsoDate } from '../domain/plan/calendar'
import { PlanTrigger } from '../domain/plan/session'
import type { Clock } from '../domain/shared/clock'
import type { PlanGateway } from './ports'
import { regeneratePlan } from './regenerate-plan'

export interface OpenPauseInput {
  type: PauseType
  zone: string | null
  painLevel: number | null
  /** Nulle quand la reprise n'est pas prévisible : le plan repart non daté (§ 5). */
  estimatedEndDate: IsoDate | null
  allowances: PauseAllowances
  watchZones: string[]
  notes: string | null
}

export interface PauseWriter {
  /** Une seule pause ouverte à la fois : déclarer la suivante ferme la précédente. */
  closeOpenPauses(date: IsoDate): Promise<number>
  createPause(input: OpenPauseInput & { startDate: IsoDate }): Promise<number>
}

export interface OpenPauseResult {
  pauseId: number
  startDate: IsoDate | null
  weeks: number
}

/**
 * Déclarer une pause gèle le plan et le régénère : les semaines couvertes
 * perdent leurs séances, et sans date de reprise estimée le plan repart en
 * semaines non datées (§ 5).
 */
export async function openPause(
  pauses: PauseWriter,
  plans: PlanGateway,
  clock: Clock,
  input: OpenPauseInput,
): Promise<OpenPauseResult> {
  const startDate = clock.today()
  await pauses.closeOpenPauses(startDate)
  const pauseId = await pauses.createPause({ ...input, startDate })

  const { plan } = await regeneratePlan(plans, clock, PlanTrigger.Pause)

  return { pauseId, startDate: plan.startDate, weeks: plan.weeks.length }
}
