import { and, eq, inArray } from 'drizzle-orm'
import type { RouteGateway, RouteVariant } from '../../application/ports'
import type { RouteTarget } from '../../domain/routes/route'
import type { Prescription } from '../../domain/shared/prescription'
import type { Database } from './client'
import { athleteWeekIds } from './plan-gateway'
import { athlete, route, session } from './schema'

export function createRouteGateway(db: Database, athleteId: number): RouteGateway {
  const mine = () => athleteWeekIds(db, athleteId)

  return {
    async loadTarget(sessionId): Promise<RouteTarget | undefined> {
      const [row] = await db
        .select()
        .from(session)
        .where(and(eq(session.id, sessionId), inArray(session.weekId, mine())))
        .limit(1)
      if (!row) return undefined

      const prescription = row.prescription as unknown as Prescription
      return {
        sessionId: row.id,
        date: row.date,
        code: row.code,
        distanceM: prescription.totalDistanceM,
      }
    },

    async loadHomeAddress(): Promise<string | null> {
      const [row] = await db
        .select({ address: athlete.homeAddress })
        .from(athlete)
        .where(eq(athlete.id, athleteId))
        .limit(1)
      return row?.address ?? null
    },

    async replaceRoutes(sessionId, variants: RouteVariant[]): Promise<void> {
      const [owned] = await db
        .select({ id: session.id })
        .from(session)
        .where(and(eq(session.id, sessionId), inArray(session.weekId, mine())))
        .limit(1)
      if (!owned) return

      await db.delete(route).where(eq(route.sessionId, sessionId))
      if (variants.length === 0) return
      await db.insert(route).values(variants.map((variant) => ({ ...variant, sessionId })))
    },
  }
}
