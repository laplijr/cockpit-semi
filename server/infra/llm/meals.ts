import { z } from 'zod'
import type { MealContext, MealPlanner } from '../../application/generate-meal-plan'
import type { Meal } from '../../domain/nutrition/meal'
import {
  MealEmphasis,
  MealKind,
  formatHour,
  type MealSlot,
} from '../../domain/nutrition/meal-timing'
import { LLM_MODEL, assertUsable, callLlm, textOf, useLlm } from './client'

/** Sortie attendue du modèle, validée avant tout usage (§ 6). */
const mealSchema = z.object({
  kind: z.enum(MealKind),
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(320),
})

const proposalSchema = z.object({ meals: z.array(mealSchema).min(3).max(5) })

/** Schéma JSON envoyé au modèle : il contraint la sortie, il ne la valide pas. */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['meals'],
  properties: {
    meals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'name', 'description'],
        properties: {
          kind: { type: 'string', enum: Object.values(MealKind) },
          name: { type: 'string', description: 'Le repas en trois ou quatre mots' },
          description: {
            type: 'string',
            description: 'Les aliments et les quantités, en une phrase',
          },
        },
      },
    },
  },
} as const

const SYSTEM = `Tu proposes les repas d'une journée d'entraînement à un coureur de fond.

On te donne les créneaux de la journée : un repas par créneau, dans le même ordre, ni plus ni moins.

Règles :
- Respecte le rôle de chaque créneau : « avant_seance » est digeste et pauvre en fibres, « recuperation » apporte glucides et protéines, « normal » est un repas ordinaire.
- Tiens la cible de glucides de la journée : c'est elle qui commande les portions.
- Donne des aliments courants et des quantités concrètes, en une phrase par repas.
- Cuisine française du quotidien, rien d'exotique ni de produit de marque.
- N'invente aucun conseil d'entraînement, aucune heure, aucun complément.`

const EMPHASIS_WORDS: Record<MealEmphasis, string> = {
  [MealEmphasis.Normal]: 'repas ordinaire',
  [MealEmphasis.PreSession]: 'avant la séance',
  [MealEmphasis.Recovery]: 'après la séance, recharge',
}

function contextBlock(context: MealContext): string {
  const slots = context.slots
    .map((slot) => `- ${slot.kind} à ${formatHour(slot.hour)} · ${EMPHASIS_WORDS[slot.emphasis]}`)
    .join('\n')

  const sessions = context.sessions
    .map((item) => `- ${item.day} · ${item.sport} · ${item.code} · ${item.durationMin} min`)
    .join('\n')

  const grams = (range: readonly [number, number]) =>
    context.weightKg === null
      ? `${range[0]} à ${range[1]} g/kg`
      : `${Math.round(range[0] * context.weightKg)} à ${Math.round(range[1] * context.weightKg)} g`

  return [
    `Date : ${context.date}. Type de journée : ${context.dayKind}.`,
    `Cibles du jour : glucides ${grams(context.targets.carbsGPerKg)}, protéines ${grams(context.targets.proteinGPerKg)}, lipides ${grams(context.targets.fatGPerKg)}.`,
    context.readinessScore === null
      ? 'Forme du jour non mesurée.'
      : `Forme du jour : ${context.readinessScore} sur 100.`,
    sessions ? `Séances :\n${sessions}` : 'Aucune séance aujourd’hui ni demain.',
    `Créneaux à remplir, dans cet ordre :\n${slots}`,
  ].join('\n\n')
}

/**
 * Un appel par jour demandé, sortie JSON stricte, effort bas : choisir des
 * aliments n'est pas un raisonnement (§ 6). Le contexte se limite au plan du
 * jour et aux repères déjà calculés — aucun réalisé ne quitte le serveur.
 */
export function createMealPlanner(): MealPlanner {
  return {
    async propose(context) {
      const message = await callLlm(() =>
        useLlm().messages.create({
          model: LLM_MODEL,
          max_tokens: 2000,
          system: SYSTEM,
          output_config: {
            effort: 'low',
            format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
          },
          messages: [{ role: 'user', content: contextBlock(context) }],
        }),
      )

      assertUsable(message)
      return parseMeals(textOf(message), context.slots)
    },
  }
}

/**
 * Le modèle ne rend que le contenu : l'heure et le rôle restent ceux du
 * moteur. Une liste qui ne recouvre pas les créneaux est hors contrat.
 */
export function parseMeals(raw: string, slots: MealSlot[]): Meal[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw createError({ statusCode: 422, statusMessage: 'Réponse du modèle illisible.' })
  }

  const result = proposalSchema.safeParse(parsed)
  if (!result.success || result.data.meals.length !== slots.length) {
    throw createError({ statusCode: 422, statusMessage: 'Réponse du modèle hors schéma.' })
  }

  return slots.map((slot, index) => {
    const meal = result.data.meals[index]!
    return {
      kind: slot.kind,
      hour: slot.hour,
      emphasis: slot.emphasis,
      name: meal.name,
      description: meal.description,
    }
  })
}
