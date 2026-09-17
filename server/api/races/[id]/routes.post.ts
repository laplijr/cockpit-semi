import { z } from 'zod'
import { generateRoutes } from '../../../application/generate-routes'
import { routeGateway, routingService } from '../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

const bodySchema = z.object({
  /** Adresse du logement sur place. */
  address: z.string().min(3),
  /** Arrivée sur place ; par défaut la veille de la course. */
  arrivalDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
})

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

  const gateway = routeGateway()
  const race = await gateway.loadRace(id)
  if (!race) throw createError({ statusCode: 404, statusMessage: 'Course inconnue' })

  const variants = await generateRoutes(gateway, routingService(), {
    race,
    address: body.address,
    arrivalDate: body.arrivalDate ?? undefined,
  })

  return { generated: variants.length }
})
