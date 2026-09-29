import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm'
import type { ActivityRpeGateway } from '../../application/correct-activity-rpe'
import { arbitraryUnits } from '../../domain/load/load'
import type { IsoDate } from '../../domain/plan/calendar'
import type { Sport } from '../../domain/shared/sport'
import type { Database } from './client'
import { DEFAULT_ACTIVITY_RPE, recomputeLoadFor } from './load-repository'
import { activity } from './schema'

/** Ce que la semaine montre d'une activité qu'aucune séance n'a absorbée. */
export interface OffPlanActivity {
  id: number
  date: IsoDate
  sport: Sport
  /** Ce que Ronan a écrit pour un imprévu ; rien pour un import de montre. */
  name: string | null
  durationMin: number
  /** L'effort que la charge compte, celui par défaut quand rien ne l'a fixé. */
  rpe: number
  rpeIsDefault: boolean
  loadUa: number
}

/** Activités sans séance rattachée : celles que la charge compte seule (§ 5). */
export async function loadOffPlanActivities(
  db: Database,
  athleteId: number,
  range: { from: IsoDate; to: IsoDate },
): Promise<OffPlanActivity[]> {
  const rows = await db
    .select({
      id: activity.id,
      date: activity.date,
      sport: activity.sport,
      name: activity.name,
      durationS: activity.durationS,
      rpe: activity.rpe,
    })
    .from(activity)
    .where(
      and(
        eq(activity.athleteId, athleteId),
        isNull(activity.sessionId),
        gte(activity.date, range.from),
        lte(activity.date, range.to),
      ),
    )
    .orderBy(asc(activity.date), asc(activity.startedAt))

  return rows.map(({ durationS, ...row }) => {
    const durationMin = durationS / 60
    const rpe = row.rpe ?? DEFAULT_ACTIVITY_RPE
    return {
      ...row,
      durationMin,
      rpe,
      rpeIsDefault: row.rpe === null,
      loadUa: Math.round(arbitraryUnits({ rpe, durationMin })),
    }
  })
}

export function createActivityRpeGateway(db: Database, athleteId: number): ActivityRpeGateway {
  return {
    async offPlanActivityDate(activityId) {
      const [row] = await db
        .select({ date: activity.date })
        .from(activity)
        .where(
          and(
            eq(activity.id, activityId),
            eq(activity.athleteId, athleteId),
            isNull(activity.sessionId),
          ),
        )
        .limit(1)
      return row?.date
    },

    async saveRpe(activityId, rpe) {
      await db
        .update(activity)
        .set({ rpe })
        .where(and(eq(activity.id, activityId), eq(activity.athleteId, athleteId)))
    },

    async recomputeLoad(date) {
      return recomputeLoadFor(db, athleteId, date)
    },
  }
}
