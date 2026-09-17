import { z } from 'zod'
import { generateRoutes } from '../../../application/generate-routes'
import { routeGateway, routingService } from '../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

const bodySchema = z.object({
  /** Adresse d'où l'on part ; vide, celle du profil est reprise. */
  address: z.string().nullable().default(null),
})

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

  const gateway = routeGateway()
  const target = await gateway.loadTarget(id)
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Séance inconnue' })

  if (target.distanceM <= 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Cette séance n’a pas de distance : il n’y a pas de boucle à tracer.',
    })
  }

  const address = body.address?.trim() || (await gateway.loadHomeAddress())
  if (!address) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Aucune adresse de départ : renseigne-la ici ou dans Profil.',
    })
  }

  const variants = await generateRoutes(gateway, routingService(), { target, address })
  return { generated: variants.length }
})
