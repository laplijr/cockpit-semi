import { desc, isNotNull } from 'drizzle-orm'
import type { ResolvedForecast } from '../../domain/fitness/accuracy'
import { VDOT_GAIN_PER_BLOCK } from '../../domain/fitness/projection'
import type { Database } from './client'
import { athlete, forecast } from './schema'

/** Les prévisions déjà confrontées au réalisé, la plus récente en tête (§ 9, P6.6). */
export async function loadResolvedForecasts(db: Database): Promise<ResolvedForecast[]> {
  const rows = await db
    .select()
    .from(forecast)
    .where(isNotNull(forecast.actualVdot))
    .orderBy(desc(forecast.resolvedDate), desc(forecast.id))

  return rows.map((row) => ({
    issuedDate: row.issuedDate,
    targetDate: row.targetDate,
    projectedVdot: row.projectedVdot,
    lowVdot: row.lowVdot,
    highVdot: row.highVdot,
    actualVdot: row.actualVdot!,
  }))
}

/** Progression estimée en vigueur : celle du § 5 tant que R9 ne l'a pas recalée. */
export async function loadGainPerBlock(db: Database): Promise<number> {
  const [row] = await db.select({ gain: athlete.vdotGainPerBlock }).from(athlete).limit(1)
  return row?.gain ?? VDOT_GAIN_PER_BLOCK
}
