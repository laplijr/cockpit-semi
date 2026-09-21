import { z } from 'zod'
import { declareFitness } from '../../application/declare-fitness'
import { FitnessDeclaration } from '../../domain/fitness/declaration'
import { useDatabase } from '../../infra/db/client'
import { createFitnessGateway } from '../../infra/db/feedback-gateway'
import { systemClock } from '../../utils/context'

const bodySchema = z.discriminatedUnion('kind', [
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
])

/** Le VDOT de départ, déclaré. Le plan n'est régénéré qu'à la dernière étape. */
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)
  const declared = await declareFitness(
    createFitnessGateway(useDatabase()),
    systemClock.today(),
    body,
  )

  return { declared: declared ?? null }
})
