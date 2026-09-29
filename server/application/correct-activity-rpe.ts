import type { IsoDate } from '../domain/plan/calendar'
import type { DailyLoadRow } from './record-feedback'

/** Ce dont la correction d'un effort perçu a besoin, sans savoir où c'est stocké. */
export interface ActivityRpeGateway {
  /** Rien pour une activité rattachée : son effort est celui du ressenti de la séance. */
  offPlanActivityDate(activityId: number): Promise<IsoDate | undefined>
  saveRpe(activityId: number, rpe: number): Promise<void>
  recomputeLoad(date: IsoDate): Promise<DailyLoadRow>
}

/**
 * Une activité hors plan porte un RPE estimé — par le modèle pour un imprévu,
 * par défaut pour un import. Ronan le corrige, et la charge du jour suit (§ 5).
 */
export async function correctActivityRpe(
  gateway: ActivityRpeGateway,
  activityId: number,
  rpe: number,
): Promise<DailyLoadRow> {
  const date = await gateway.offPlanActivityDate(activityId)
  if (!date) throw new Error(`Activité hors plan ${activityId} inconnue`)

  await gateway.saveRpe(activityId, rpe)
  return gateway.recomputeLoad(date)
}
