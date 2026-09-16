import { z } from 'zod'
import { LookupKey, LookupStatus, type RaceLookupFields } from '../../domain/races/lookup'
import { LLM_MODEL, assertUsable, callLlm, textOf, useLlm } from '../llm/client'

/** Le § 6 borne la recherche à cinq usages de l'outil web. */
export const MAX_WEB_SEARCHES = 5

const fieldSchema = z.object({
  value: z.string().min(1).nullable(),
  status: z.enum(LookupStatus),
  sources: z.array(z.string().url()).max(5).default([]),
})

const lookupSchema = z.object({
  name: fieldSchema,
  date: fieldSchema,
  distanceM: fieldSchema,
  location: fieldSchema,
  elevationGainM: fieldSchema,
  registration: fieldSchema,
})

const FIELD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['value', 'status', 'sources'],
  properties: {
    value: { type: ['string', 'null'] },
    status: { type: 'string', enum: Object.values(LookupStatus) },
    sources: { type: 'array', items: { type: 'string' } },
  },
} as const

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: Object.values(LookupKey),
  properties: Object.fromEntries(Object.values(LookupKey).map((key) => [key, FIELD_SCHEMA])),
} as const

const SYSTEM = `Tu cherches les informations publiques d'une course à pied et tu les renvoies champ par champ.

Pour chaque champ, donne la valeur, un statut et les URL qui l'appuient :
- sur : la valeur figure telle quelle sur le site officiel ou une source de référence.
- a_confirmer : la valeur vient d'une source secondaire, ou l'édition trouvée n'est pas celle demandée.
- estime : aucune source ne la donne, tu la déduis des éditions précédentes.

Formats attendus :
- date : AAAA-MM-JJ.
- distanceM : la distance en mètres, en chiffres seuls (21097.5 pour un semi-marathon).
- elevationGainM : le dénivelé positif en mètres, en chiffres seuls.
- registration : « ouvertes », « fermees » ou « a_venir ».
- location : ville et pays.

N'invente pas de source : une valeur sans URL est au mieux estimée. Si tu ne trouves pas la course, mets toutes les valeurs à null avec le statut estime et aucune source.`

export interface RaceSearcher {
  search(query: string): Promise<RaceLookupFields>
}

/**
 * Un appel avec l'outil serveur de recherche web. Seul le nom tapé quitte le
 * serveur : aucune donnée personnelle n'accompagne la requête (§ 6).
 */
export function createRaceSearcher(): RaceSearcher {
  return {
    async search(query) {
      const message = await callLlm(() =>
        useLlm().messages.create({
          model: LLM_MODEL,
          max_tokens: 8000,
          system: SYSTEM,
          thinking: { type: 'adaptive' },
          /** Lire quelques pages et recopier six champs ne demande pas de réflexion longue. */
          tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: MAX_WEB_SEARCHES }],
          output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
          messages: [{ role: 'user', content: `Course recherchée : ${query}` }],
        }),
      )

      assertUsable(message)
      return parseLookup(textOf(message))
    },
  }
}

/** Sortie hors schéma : la fenêtre retombe sur la saisie manuelle (§ 6). */
export function parseLookup(raw: string): RaceLookupFields {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw createError({ statusCode: 422, statusMessage: 'Réponse du modèle illisible.' })
  }

  const result = lookupSchema.safeParse(parsed)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Réponse du modèle hors schéma.' })
  }

  return result.data
}
