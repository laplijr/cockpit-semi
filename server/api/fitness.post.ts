import { z } from 'zod'
import { declareFitness } from '../application/declare-fitness'
import { regeneratePlan } from '../application/regenerate-plan'
import { FitnessDeclaration } from '../domain/fitness/declaration'
import { PlanTrigger } from '../domain/plan/session'
import { useDatabase } from '../infra/db/client'
import { createFitnessGateway } from '../infra/db/feedback-gateway'
import { currentAthleteId, planGateway, systemClock } from '../utils/context'

const bodySchema = z.object({
  declaration: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal(FitnessDeclaration.Chrono),
      distanceM: z.number().positive(),
      timeS: z.number().int().positive(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    z.object({
      kind: z.literal(FitnessDeclaration.EasyPace),
      paceSecPerKm: z.number().int().min(180).max(900),
    }),
    z.object({ kind: z.literal(FitnessDeclaration.Unknown) }),
  ]),
  /**
   * L'onboarding garde sa génération unique à la dernière étape et la refuse
   * ici ; `/profil` régénère à chaque déclaration. Une route, deux appelants,
   * deux comportements assumés (§ 9, P7.5).
   */
  regenerate: z.boolean().default(true),
})

/** Le point de forme de départ, déclaré — à l'arrivée comme plus tard. */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { declaration, regenerate } = await readValidatedBody(event, bodySchema.parse)

  const declared = await declareFitness(
    createFitnessGateway(useDatabase(), athleteId),
    systemClock.today(),
    declaration,
  )

  if (regenerate) {
    await regeneratePlan(planGateway(athleteId), systemClock, PlanTrigger.FitnessDeclared)
  }

  return { declared: declared ?? null }
})
