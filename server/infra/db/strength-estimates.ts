import { desc, eq } from 'drizzle-orm'
import type { EstimateSource } from '../../domain/strength/estimated-max'
import type { Database } from './client'
import { strengthEstimate } from './schema'

export interface CurrentEstimate {
  maxKg: number
  source: EstimateSource
  date: string
}

/** L'estimation courante de chaque exercice : la plus récente, pas la plus haute (P26). */
export async function loadCurrentEstimates(
  db: Database,
  athleteId: number,
): Promise<Map<string, CurrentEstimate>> {
  const rows = await db
    .select()
    .from(strengthEstimate)
    .where(eq(strengthEstimate.athleteId, athleteId))
    .orderBy(desc(strengthEstimate.date), desc(strengthEstimate.id))

  const current = new Map<string, CurrentEstimate>()
  for (const row of rows) {
    if (!current.has(row.exerciseId)) {
      current.set(row.exerciseId, { maxKg: row.maxKg, source: row.source, date: row.date })
    }
  }
  return current
}
