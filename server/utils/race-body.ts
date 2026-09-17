import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { levelsAreOrdered } from '../domain/fitness/objective'
import { ObjectiveMode, RacePriority, RaceStatus } from '../domain/races/race'
import type { Database } from '../infra/db/client'
import { race } from '../infra/db/schema'

/**
 * Champs saisissables d'une course. Création et modification partagent le même
 * schéma : une règle d'objectif ne doit pas exister d'un seul côté (§ 9, P5.15).
 */
export const raceFieldsSchema = z.object({
  name: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  distanceM: z.number().positive(),
  priority: z.enum(RacePriority),
  objectiveMode: z.enum(ObjectiveMode).default(ObjectiveMode.Time),
  /** Le bon jour : la borne basse de l'intervalle de projection. */
  objectifAmbitionS: z.number().int().positive().nullable().default(null),
  /** Le niveau réaliste, seul obligatoire en mode temps. */
  objectifS: z.number().int().positive().nullable().default(null),
  /** Le chrono à ne pas manquer : la borne haute de l'intervalle. */
  objectifPlancherS: z.number().int().positive().nullable().default(null),
  elevationGainM: z.number().int().nullable().default(null),
  expectedTempC: z.number().nullable().default(null),
  /** Ligne de départ : arrivée de l'itinéraire logement → départ (§ 9, P5.5). */
  startAddress: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
})

export type RaceFields = z.infer<typeof raceFieldsSchema>

export function objectiveLevelsOf(body: RaceFields) {
  return {
    ambitionS: body.objectifAmbitionS,
    realisticS: body.objectifS,
    floorS: body.objectifPlancherS,
  }
}

function checkObjective(body: RaceFields, ctx: z.RefinementCtx) {
  const levels = objectiveLevelsOf(body)

  if (body.objectiveMode === ObjectiveMode.Record) {
    const chronos = Object.values(levels).some((value) => value !== null)
    if (chronos) {
      ctx.addIssue({
        code: 'custom',
        message: 'Battre son record ne se double pas d’un chrono cible.',
        path: ['objectifS'],
      })
    }
    return
  }

  if (!levelsAreOrdered(levels)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Ambition, réaliste et plancher doivent aller du plus rapide au plus lent.',
      path: ['objectifS'],
    })
  }
}

export const raceBodySchema = raceFieldsSchema.superRefine(checkObjective)

export const newRaceBodySchema = raceFieldsSchema
  .extend({
    /** Recherche qui a pré-rempli le formulaire : rattachée à la course créée (§ 6). */
    lookupId: z.number().int().positive().nullable().default(null),
  })
  .superRefine(checkObjective)

/** En mode record, aucun des trois niveaux n'est stocké : la référence est le record. */
export function objectiveColumns(body: RaceFields) {
  if (body.objectiveMode !== ObjectiveMode.Record) return {}
  return { objectifS: null, objectifAmbitionS: null, objectifPlancherS: null }
}

/**
 * Le mode record exige un record : un résultat représentatif sur la même
 * distance. Sans lui, la référence à battre n'existe pas et le mode est refusé.
 */
export async function assertRecordExists(db: Database, body: RaceFields): Promise<void> {
  if (body.objectiveMode !== ObjectiveMode.Record) return

  const [existing] = await db
    .select({ id: race.id })
    .from(race)
    .where(
      and(
        eq(race.status, RaceStatus.Raced),
        eq(race.representative, true),
        isNotNull(race.resultatS),
        sql`abs(${race.distanceM} - ${body.distanceM}) < 1`,
      ),
    )
    .limit(1)

  if (!existing) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Aucun record sur cette distance : le mode « battre mon record » est indisponible.',
    })
  }
}
