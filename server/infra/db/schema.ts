import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'
import { FitnessOrigin } from '../../domain/fitness/fitness-point'
import { PhaseType } from '../../domain/plan/phases'
import {
  ObjectiveMode,
  RacePriority,
  RaceSource,
  RaceStatus,
  SegmentMode,
  type RaceIncident,
} from '../../domain/races/race'
import { Sport } from '../../domain/shared/sport'

export {
  FitnessOrigin,
  ObjectiveMode,
  PhaseType,
  RacePriority,
  RaceSource,
  RaceStatus,
  SegmentMode,
  Sport,
}
export type { RaceIncident }

export const sportEnum = pgEnum('sport', enumValues(Sport))
export const racePriorityEnum = pgEnum('race_priority', enumValues(RacePriority))
export const objectiveModeEnum = pgEnum('objective_mode', enumValues(ObjectiveMode))
export const raceStatusEnum = pgEnum('race_status', enumValues(RaceStatus))
export const raceSourceEnum = pgEnum('race_source', enumValues(RaceSource))
export const segmentModeEnum = pgEnum('segment_mode', enumValues(SegmentMode))
export const fitnessOriginEnum = pgEnum('fitness_origin', enumValues(FitnessOrigin))

function enumValues<T extends Record<string, string>>(source: T) {
  return Object.values(source) as [string, ...string[]]
}

/**
 * Application mono-utilisateur : `athlete` ne contient qu'une ligne, `id = 1`.
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

export const race = pgTable('race', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  date: date('date').notNull(),
  distanceM: real('distance_m').notNull(),
  priority: racePriorityEnum('priority').notNull(),
  objectiveMode: objectiveModeEnum('objective_mode').notNull().default(ObjectiveMode.Time),
  /** Nul tant que l'objectif n'est pas fixé, et toujours nul en performance maximale. */
  objectifS: integer('objectif_s'),
  elevationGainM: integer('elevation_gain_m'),
  profileType: text('profile_type'),
  expectedTempC: real('expected_temp_c'),
  source: raceSourceEnum('source').notNull().default(RaceSource.Manual),
  status: raceStatusEnum('status').notNull().default(RaceStatus.Planned),
  resultatS: integer('resultat_s'),
  /** Faux quand le chrono ne reflète pas la forme : il ne calibre alors pas le VDOT. */
  representative: boolean('representative').notNull().default(true),
  incident: jsonb('incident').$type<RaceIncident>(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Découpage d'une course en portions homogènes. Facultatif : une course sans
 * segment se lit comme un chrono unique.
 */
export const raceSegment = pgTable('race_segment', {
  id: serial('id').primaryKey(),
  raceId: integer('race_id')
    .notNull()
    .references(() => race.id, { onDelete: 'cascade' }),
  kmDebut: real('km_debut').notNull(),
  kmFin: real('km_fin').notNull(),
  mode: segmentModeEnum('mode').notNull(),
  allureSKm: real('allure_s_km'),
  note: text('note'),
})

export interface SessionQuota {
  /** Part maximale du volume hebdomadaire, en fraction (0.08 = 8 %). */
  maxShareOfWeeklyVolume?: number
  maxPerWeek?: number
}

export const sessionType = pgTable(
  'session_type',
  {
    id: serial('id').primaryKey(),
    sport: sportEnum('sport').notNull(),
    code: text('code').notNull(),
    label: text('label').notNull(),
    defaultStructure: jsonb('default_structure').$type<Record<string, unknown>>().notNull(),
    quota: jsonb('quota').$type<SessionQuota>().notNull().default({}),
    allowedPhases: jsonb('allowed_phases').$type<PhaseType[]>().notNull().default([]),
    expectedRpe: real('expected_rpe'),
  },
  (table) => [unique('session_type_sport_code').on(table.sport, table.code)],
)

export const fitnessPoint = pgTable('fitness_point', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  vdot: real('vdot').notNull(),
  origin: fitnessOriginEnum('origin').notNull(),
  raceId: integer('race_id').references(() => race.id, { onDelete: 'set null' }),
  /** Un plancher borne le VDOT par le bas sans prétendre le mesurer (§ 5). */
  isFloor: boolean('is_floor').notNull().default(false),
  note: text('note'),
})

export type Athlete = typeof athlete.$inferSelect
export type NewAthlete = typeof athlete.$inferInsert
export type Race = typeof race.$inferSelect
export type NewRace = typeof race.$inferInsert
export type RaceSegment = typeof raceSegment.$inferSelect
export type NewRaceSegment = typeof raceSegment.$inferInsert
export type SessionType = typeof sessionType.$inferSelect
export type NewSessionType = typeof sessionType.$inferInsert
export type FitnessPoint = typeof fitnessPoint.$inferSelect
export type NewFitnessPoint = typeof fitnessPoint.$inferInsert
