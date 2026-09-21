import { and, eq, sql } from 'drizzle-orm'
import { DAILY_QUOTA, type ExternalCall } from '../domain/shared/external-call'
import { useDatabase } from '../infra/db/client'
import { apiUsage } from '../infra/db/schema'
import { systemClock } from './context'

/**
 * Un appel payé par les clés de Ronan. Le quota se vérifie avant, le compteur
 * monte après : un appel qui n'a pas eu lieu — clé absente, service en panne —
 * ne se facture pas à celui qui l'a demandé (§ 11, P8.4).
 *
 * Deux appels simultanés peuvent passer ensemble le dernier cran. C'est un
 * garde-fou de coût, pas une barrière de sécurité : la borne tient au détail
 * près sur la journée, et c'est tout ce qu'on lui demande.
 */
export async function withExternalCall<T>(
  athleteId: number,
  kind: ExternalCall,
  run: () => Promise<T>,
): Promise<T> {
  const date = systemClock.today()
  const db = useDatabase()

  const [current] = await db
    .select({ calls: apiUsage.calls })
    .from(apiUsage)
    .where(and(eq(apiUsage.athleteId, athleteId), eq(apiUsage.date, date), eq(apiUsage.kind, kind)))
    .limit(1)

  if ((current?.calls ?? 0) >= DAILY_QUOTA[kind]) {
    throw createError({
      statusCode: 503,
      statusMessage: `Quota du jour atteint pour cette fonction (${DAILY_QUOTA[kind]} appels). Elle revient demain ; le reste du cockpit fonctionne.`,
    })
  }

  const result = await run()

  await db
    .insert(apiUsage)
    .values({ athleteId, date, kind, calls: 1 })
    .onConflictDoUpdate({
      target: [apiUsage.athleteId, apiUsage.date, apiUsage.kind],
      set: { calls: sql`${apiUsage.calls} + 1` },
    })

  return result
}

/** Ce qui a été consommé aujourd'hui, pour la page « Mes données ». */
export async function usageToday(athleteId: number) {
  const rows = await useDatabase()
    .select()
    .from(apiUsage)
    .where(and(eq(apiUsage.athleteId, athleteId), eq(apiUsage.date, systemClock.today())))

  return rows.map((row) => ({ kind: row.kind, calls: row.calls, quota: DAILY_QUOTA[row.kind] }))
}
