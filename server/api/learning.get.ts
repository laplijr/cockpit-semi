import { desc } from 'drizzle-orm'
import { HABIT_THRESHOLDS } from '../domain/learning/habit'
import { useDatabase } from '../infra/db/client'
import { calibration, habit } from '../infra/db/schema'

/**
 * Habitudes détectées et calibration des dernières semaines (§ 9, P6). Rien
 * n'est appliqué ici : l'écran propose, Ronan accepte.
 */
export default defineEventHandler(async () => {
  const db = useDatabase()

  const [habits, weeks] = await Promise.all([
    db.select().from(habit).orderBy(desc(habit.confidence), desc(habit.detectedAt)),
    db.select().from(calibration).orderBy(desc(calibration.date)).limit(8),
  ])

  return { habits, calibrations: weeks, thresholds: HABIT_THRESHOLDS }
})
