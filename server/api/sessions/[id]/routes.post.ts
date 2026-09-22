import { z } from 'zod'
import { generateRoutes } from '../../../application/generate-routes'
import { CURRENT_POSITION_LABEL } from '../../../domain/routes/route'
import { ExternalCall } from '../../../domain/shared/external-call'
import { currentAthleteId, routeGateway, routingService } from '../../../utils/context'
import { withExternalCall } from '../../../utils/quota'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

const bodySchema = z.object({
  /** Adresse d'où l'on part ; vide, celle du profil est reprise. */
  address: z.string().nullable().default(null),
  /** Position de l'appareil : elle remplace l'adresse et le géocodage (P10.3). */
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
})

export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

  const gateway = routeGateway(athleteId)
  const target = await gateway.loadTarget(id)
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Séance inconnue' })

  if (target.distanceM <= 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Cette séance n’a pas de distance : il n’y a pas de boucle à tracer.',
    })
  }

  /** Une position d'appareil se suffit : il n'y a rien à géocoder (P10.3). */
  const origin =
    body.lat !== undefined && body.lon !== undefined ? { lat: body.lat, lon: body.lon } : undefined

  const address = origin
    ? CURRENT_POSITION_LABEL
    : body.address?.trim() || (await gateway.loadHomeAddress())

  if (!address) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Aucune adresse de départ : renseigne-la ici ou dans Profil.',
    })
  }

  const variants = await withExternalCall(athleteId, ExternalCall.Route, () =>
    generateRoutes(gateway, routingService(), { target, address, origin }),
  )
  return { generated: variants.length }
})
