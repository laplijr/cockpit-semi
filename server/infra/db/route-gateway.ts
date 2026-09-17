import { desc, eq } from 'drizzle-orm'
import type { RouteGateway, RouteRaceSnapshot, RouteVariant } from '../../application/ports'
import type { RouteSession } from '../../domain/routes/targets'
import type { Database } from './client'
import { planVersion, race, raceRoute, session, week } from './schema'

export function createRouteGateway(db: Database): RouteGateway {
  return {
    async loadRace(raceId): Promise<RouteRaceSnapshot | undefined> {
      const [row] = await db.select().from(race).where(eq(race.id, raceId)).limit(1)
      if (!row) return undefined
      return { id: row.id, name: row.name, date: row.date, startAddress: row.startAddress }
    },

    async loadPlannedSessions(): Promise<RouteSession[]> {
      const [version] = await db.select().from(planVersion).orderBy(desc(planVersion.id)).limit(1)
      if (!version) return []

      const rows = await db
        .select({
          id: session.id,
          date: session.date,
          sport: session.sport,
          code: session.code,
          prescription: session.prescription,
        })
        .from(session)
        .innerJoin(week, eq(session.weekId, week.id))
        .where(eq(week.planVersionId, version.id))

      return rows.map((row) => ({
        id: row.id,
        date: row.date,
        sport: row.sport,
        code: row.code,
        distanceM: (row.prescription as { totalDistanceM?: number }).totalDistanceM ?? 0,
      }))
    },

    async replaceRoutes(raceId, variants: RouteVariant[]): Promise<void> {
      await db.delete(raceRoute).where(eq(raceRoute.raceId, raceId))
      if (variants.length === 0) return
      await db.insert(raceRoute).values(variants.map((variant) => ({ ...variant, raceId })))
    },
  }
}
