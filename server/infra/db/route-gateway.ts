import { eq } from 'drizzle-orm'
import type { RouteGateway, RouteVariant } from '../../application/ports'
import type { RouteTarget } from '../../domain/routes/route'
import type { Prescription } from '../../domain/shared/prescription'
import type { Database } from './client'
import { athlete, route, session } from './schema'

export function createRouteGateway(db: Database): RouteGateway {
  return {
    async loadTarget(sessionId): Promise<RouteTarget | undefined> {
      const [row] = await db.select().from(session).where(eq(session.id, sessionId)).limit(1)
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
      const [row] = await db.select({ address: athlete.homeAddress }).from(athlete).limit(1)
      return row?.address ?? null
    },

    async replaceRoutes(sessionId, variants: RouteVariant[]): Promise<void> {
      await db.delete(route).where(eq(route.sessionId, sessionId))
      if (variants.length === 0) return
      await db.insert(route).values(variants)
    },
  }
}
