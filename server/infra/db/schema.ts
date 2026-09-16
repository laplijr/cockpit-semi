import { boolean, integer, jsonb, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Application mono-utilisateur : `athlete` ne contient qu'une ligne, `id = 1`.
 * Les tables du plan d'entraînement (race, plan_version, session…) arrivent en P1.
 */
export const athlete = pgTable('athlete', {
  id: integer('id').primaryKey().default(1),
  weightKg: real('weight_kg'),
  maxHr: integer('max_hr'),
  /** Jours de la semaine disponibles, 1 = lundi … 7 = dimanche. */
  availableDays: jsonb('available_days').$type<number[]>().notNull().default([]),
  /** Contraintes libres exprimées par l'athlète (« sortie longue le dimanche »…). */
  constraints: jsonb('constraints').$type<string[]>().notNull().default([]),
  onboarded: boolean('onboarded').notNull().default(false),
  notes: text('notes'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Athlete = typeof athlete.$inferSelect
export type NewAthlete = typeof athlete.$inferInsert
