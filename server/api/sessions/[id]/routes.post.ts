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
  /**
   * Un tirage de plus depuis le départ déjà utilisé, avec d'autres graines :
   * c'est « Autre boucle » une fois les tracés en place épuisés (P15).
   */
  again: z.boolean().default(false),
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
  const device =
    body.lat !== undefined && body.lon !== undefined ? { lat: body.lat, lon: body.lon } : undefined

  /** Un tirage de plus repart du départ en place, sans le redemander (P15). */
  const previous = body.again ? await gateway.loadLastDraw(id) : null
  if (body.again && !previous) {
    throw createError({ statusCode: 409, statusMessage: 'Aucune boucle à renouveler.' })
  }

  const origin = previous?.origin ?? device

  const address =
    previous?.address ??
    (device ? CURRENT_POSITION_LABEL : body.address?.trim() || (await gateway.loadHomeAddress()))

  if (!address) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Aucune adresse de départ : renseigne-la ici ou dans Profil.',
    })
  }

  const variants = await withExternalCall(athleteId, ExternalCall.Route, () =>
    generateRoutes(gateway, routingService(), {
      target,
      address,
      origin,
      seedBase: previous ? previous.lastSeed + 1 : 1,
    }),
  )
  return { generated: variants.length }
})
