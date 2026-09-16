import { z } from 'zod'
import type { IsoDate } from '../../domain/plan/calendar'
import { Sport } from '../../domain/shared/sport'
import type { UnplannedEvent } from '../../domain/unplanned/events'
import { IntensityProfile, UnavailabilityScope, UnplannedKind } from '../../domain/unplanned/events'
import { LLM_MODEL, assertUsable, callLlm, textOf, useLlm } from './client'

/** Sortie attendue du modèle, validée avant tout usage (§ 6). */
const activitySchema = z.object({
  kind: z.literal(UnplannedKind.Activity),
  sport: z.enum(Sport),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMin: z
    .number()
    .positive()
    .max(24 * 60),
  rpeEstimate: z.number().int().min(1).max(10),
  intensityProfile: z.enum(IntensityProfile),
  label: z.string().min(1).max(120),
})

const unavailabilitySchema = z.object({
  kind: z.literal(UnplannedKind.Unavailability),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scope: z.enum(UnavailabilityScope),
  label: z.string().min(1).max(120),
})

const interpretationSchema = z.object({
  events: z.array(z.discriminatedUnion('kind', [activitySchema, unavailabilitySchema])).max(10),
})

/** Schéma JSON envoyé au modèle : il contraint la sortie, il ne la valide pas. */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['events'],
  properties: {
    events: {
      type: 'array',
      items: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: [
              'kind',
              'sport',
              'date',
              'durationMin',
              'rpeEstimate',
              'intensityProfile',
              'label',
            ],
            properties: {
              kind: { type: 'string', enum: [UnplannedKind.Activity] },
              sport: { type: 'string', enum: Object.values(Sport) },
              date: { type: 'string', description: 'AAAA-MM-JJ' },
              durationMin: { type: 'number' },
              rpeEstimate: { type: 'integer', minimum: 1, maximum: 10 },
              intensityProfile: { type: 'string', enum: Object.values(IntensityProfile) },
              label: { type: 'string', description: 'Ce que l’athlète a écrit, en clair' },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'from', 'to', 'scope', 'label'],
            properties: {
              kind: { type: 'string', enum: [UnplannedKind.Unavailability] },
              from: { type: 'string', description: 'AAAA-MM-JJ' },
              to: { type: 'string', description: 'AAAA-MM-JJ, dernier jour inclus' },
              scope: { type: 'string', enum: Object.values(UnavailabilityScope) },
              label: { type: 'string' },
            },
          },
        ],
      },
    },
  },
} as const

const SYSTEM = `Tu traduis le texte libre d'un athlète en événements structurés.

Deux formes, et rien d'autre :
- activity : une séance faite hors du plan (sport, date, durée en minutes, RPE estimé de 1 à 10, profil d'intensité).
- unavailability : une période où l'athlète ne peut pas s'entraîner (du, au inclus, portée).

Règles :
- Les dates sont absolues, au format AAAA-MM-JJ, déduites de la date du jour donnée dans le contexte.
- « vendredi » sans autre précision désigne le prochain vendredi à venir, aujourd'hui compris.
- Un sport inconnu du cockpit (squash, escalade, ski) prend le sport « autre ».
- Une durée absente s'estime à partir de l'activité décrite, jamais à zéro.
- Si le texte ne contient ni séance ni indisponibilité, renvoie une liste vide.
- N'invente rien : pas d'objectif, pas de séance de remplacement, pas de conseil.`

export interface UnplannedContextInput {
  today: IsoDate
  /** Séances *prévues* seulement, jamais de réalisé ni de ressenti (§ 6). */
  plannedSessions: { date: IsoDate; sport: Sport; label: string }[]
}

export interface UnplannedInterpreter {
  interpret(text: string, context: UnplannedContextInput): Promise<UnplannedEvent[]>
}

function contextBlock({ today, plannedSessions }: UnplannedContextInput): string {
  const week = plannedSessions
    .map((item) => `- ${item.date} · ${item.sport} · ${item.label}`)
    .join('\n')

  return [
    `Date du jour : ${today}.`,
    plannedSessions.length > 0 ? `Séances prévues :\n${week}` : 'Aucune séance prévue.',
  ].join('\n\n')
}

/**
 * Un appel, sortie JSON stricte, effort bas : la tâche est une traduction, pas
 * un raisonnement (§ 6). Le contexte se limite à la date et aux séances
 * prévues — aucune donnée de réalisé ne quitte le serveur.
 */
export function createUnplannedInterpreter(): UnplannedInterpreter {
  return {
    async interpret(text, context) {
      const message = await callLlm(() =>
        useLlm().messages.create({
          model: LLM_MODEL,
          max_tokens: 4000,
          system: SYSTEM,
          output_config: {
            effort: 'low',
            format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
          },
          messages: [{ role: 'user', content: `${contextBlock(context)}\n\nTexte : ${text}` }],
        }),
      )

      assertUsable(message)
      return parseInterpretation(textOf(message))
    },
  }
}

/** Sortie illisible ou hors schéma : l'écran demandera une saisie manuelle (§ 6). */
export function parseInterpretation(raw: string): UnplannedEvent[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw createError({ statusCode: 422, statusMessage: 'Réponse du modèle illisible.' })
  }

  const result = interpretationSchema.safeParse(parsed)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Réponse du modèle hors schéma.' })
  }

  return result.data.events.map(normalize)
}

/** Une plage inversée est une erreur de lecture du modèle, pas une intention. */
function normalize(event: UnplannedEvent): UnplannedEvent {
  if (event.kind !== UnplannedKind.Unavailability) return event
  return event.to >= event.from ? event : { ...event, from: event.to, to: event.from }
}
