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
import type { AthleteConstraints } from '../../domain/athlete/constraints'
import { FitnessOrigin } from '../../domain/fitness/fitness-point'
import { Sensation, type Pain } from '../../domain/load/feedback'
import { PauseType, type PauseAllowances } from '../../domain/pause/pause'
import { ProposalStatus, ProposalTrigger } from '../../domain/rules/proposal-status'
import { PhaseType } from '../../domain/plan/phases'
import { PlanTrigger, SessionOrigin, SessionStatus } from '../../domain/plan/session'
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
  ProposalStatus,
  ProposalTrigger,
  Sensation,
  PauseType,
  PlanTrigger,
  SessionOrigin,
  SessionStatus,
  ObjectiveMode,
  PhaseType,
  RacePriority,
  RaceSource,
  RaceStatus,
  SegmentMode,
  Sport,
}
export type { AthleteConstraints, Pain, PauseAllowances, RaceIncident }

export const sportEnum = pgEnum('sport', enumValues(Sport))
export const racePriorityEnum = pgEnum('race_priority', enumValues(RacePriority))
export const objectiveModeEnum = pgEnum('objective_mode', enumValues(ObjectiveMode))
export const raceStatusEnum = pgEnum('race_status', enumValues(RaceStatus))
export const raceSourceEnum = pgEnum('race_source', enumValues(RaceSource))
export const segmentModeEnum = pgEnum('segment_mode', enumValues(SegmentMode))
export const fitnessOriginEnum = pgEnum('fitness_origin', enumValues(FitnessOrigin))
export const phaseTypeEnum = pgEnum('phase_type', enumValues(PhaseType))
export const planTriggerEnum = pgEnum('plan_trigger', enumValues(PlanTrigger))
export const sessionStatusEnum = pgEnum('session_status', enumValues(SessionStatus))
export const sessionOriginEnum = pgEnum('session_origin', enumValues(SessionOrigin))
export const pauseTypeEnum = pgEnum('pause_type', enumValues(PauseType))
export const proposalStatusEnum = pgEnum('proposal_status', enumValues(ProposalStatus))
export const proposalTriggerEnum = pgEnum('proposal_trigger', enumValues(ProposalTrigger))

/** Conserve les types littéraux de l'énumération pour que Drizzle les propage. */
function enumValues<T extends Record<string, string>>(source: T): [T[keyof T], ...T[keyof T][]] {
  return Object.values(source) as [T[keyof T], ...T[keyof T][]]
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
  /** Jours disponibles, jour de sortie longue, jours faciles (§ 5). */
  constraints: jsonb('constraints')
    .$type<AthleteConstraints>()
    .notNull()
    .default({ availableDays: [] }),
  /** Volume de course de la première semaine pleine, en mètres (§ 5). */
  startWeeklyVolumeM: integer('start_weekly_volume_m'),
  /** Volume hebdomadaire maximal visé sur un cycle, en mètres (§ 5). */
  peakWeeklyVolumeM: integer('peak_weekly_volume_m'),
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

/** Chaque génération produit une version immuable ; le plan actif est la dernière. */
export const planVersion = pgTable('plan_version', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  trigger: planTriggerEnum('trigger').notNull(),
  /** Paramètres de génération, rejouables : date de départ, volume de base, VDOT. */
  parameters: jsonb('parameters').$type<Record<string, unknown>>().notNull().default({}),
  /** Nul tant qu'une pause ouverte n'a pas de date de reprise estimée (§ 5). */
  startDate: date('start_date'),
})

export const phase = pgTable('phase', {
  id: serial('id').primaryKey(),
  planVersionId: integer('plan_version_id')
    .notNull()
    .references(() => planVersion.id, { onDelete: 'cascade' }),
  type: phaseTypeEnum('type').notNull(),
  startWeek: integer('start_week').notNull(),
  endWeek: integer('end_week').notNull(),
  raceId: integer('race_id').references(() => race.id, { onDelete: 'set null' }),
})

export const week = pgTable(
  'week',
  {
    id: serial('id').primaryKey(),
    planVersionId: integer('plan_version_id')
      .notNull()
      .references(() => planVersion.id, { onDelete: 'cascade' }),
    index: integer('index').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    phaseType: phaseTypeEnum('phase_type').notNull(),
    raceId: integer('race_id').references(() => race.id, { onDelete: 'set null' }),
    targetRunM: integer('target_run_m').notNull(),
    targetCyclingMin: integer('target_cycling_min').notNull().default(0),
    targetStrengthCount: integer('target_strength_count').notNull().default(0),
    longRunMaxM: integer('long_run_max_m').notNull(),
    light: boolean('light').notNull().default(false),
    comebackRatio: real('comeback_ratio'),
    /** Position dans la phase, de 0 à 1 : pilote la progression des séances clés. */
    phaseProgress: real('phase_progress').notNull().default(0),
    /** La séance clé du milieu de semaine est un test 20′. */
    test: boolean('test').notNull().default(false),
    /** Nombre de courses posées cette semaine (§ 5). */
    runs: integer('runs').notNull().default(4),
    /** Le volume visé a dû être réduit faute de séances pour le porter. */
    volumeCapped: boolean('volume_capped').notNull().default(false),
  },
  (table) => [unique('week_plan_index').on(table.planVersionId, table.index)],
)

export const session = pgTable('session', {
  id: serial('id').primaryKey(),
  weekId: integer('week_id')
    .notNull()
    .references(() => week.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  sport: sportEnum('sport').notNull(),
  /** Code de la bibliothèque (EF, seuil, VMA…) ; voir `session_type`. */
  code: text('code').notNull(),
  prescription: jsonb('prescription').$type<Record<string, unknown>>().notNull(),
  status: sessionStatusEnum('status').notNull().default(SessionStatus.Planned),
  origin: sessionOriginEnum('origin').notNull().default(SessionOrigin.Plan),
  key: boolean('key').notNull().default(false),
  /** Réalisé saisi à la main, faute de connexion à une montre. */
  actualDurationMin: real('actual_duration_min'),
  actualDistanceM: real('actual_distance_m'),
})

export const pause = pgTable('pause', {
  id: serial('id').primaryKey(),
  type: pauseTypeEnum('type').notNull(),
  zone: text('zone'),
  painLevel: integer('pain_level'),
  startDate: date('start_date').notNull(),
  estimatedEndDate: date('estimated_end_date'),
  /** Nul tant que la pause est ouverte : c'est l'athlète qui marque la reprise. */
  endDate: date('end_date'),
  allowances: jsonb('allowances').$type<PauseAllowances>().notNull(),
  /** Zones à surveiller au retour, pré-cochées dans le retour de séance. */
  watchZones: jsonb('watch_zones').$type<string[]>().notNull().default([]),
  notes: text('notes'),
})

/** Activité importée de Strava, rattachée ou non à une séance prévue (§ 7). */
export const activity = pgTable('activity', {
  id: serial('id').primaryKey(),
  externalId: text('external_id').notNull().unique(),
  name: text('name'),
  sport: sportEnum('sport').notNull(),
  date: date('date').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  durationS: integer('duration_s').notNull(),
  distanceM: real('distance_m'),
  averagePaceSKm: real('average_pace_s_km'),
  averageHr: integer('average_hr'),
  maxHr: integer('max_hr'),
  averageWatts: real('average_watts'),
  elevationGainM: real('elevation_gain_m'),
  sessionId: integer('session_id').references(() => session.id, { onDelete: 'set null' }),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
})

export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .notNull()
    .references(() => session.id, { onDelete: 'cascade' })
    .unique(),
  rpe: integer('rpe').notNull(),
  sensations: jsonb('sensations').$type<Sensation[]>().notNull().default([]),
  sleepHours: real('sleep_hours'),
  pain: jsonb('pain').$type<Pain | null>(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Cache recalculable de la charge quotidienne, en unités arbitraires (§ 5). */
export const loadDaily = pgTable('load_daily', {
  date: date('date').primaryKey(),
  runningUa: integer('running_ua').notNull().default(0),
  cyclingUa: integer('cycling_ua').notNull().default(0),
  strengthUa: integer('strength_ua').notNull().default(0),
  otherUa: integer('other_ua').notNull().default(0),
  totalUa: integer('total_ua').notNull().default(0),
})

/**
 * Proposition d'ajustement issue d'une règle. Rien n'est appliqué sans décision
 * de l'athlète, et les décisions sont le signal d'apprentissage (§ 1.3).
 */
export const proposal = pgTable('proposal', {
  id: serial('id').primaryKey(),
  trigger: proposalTriggerEnum('trigger').notNull(),
  ruleId: text('rule_id').notNull(),
  effect: text('effect').notNull(),
  targetKind: text('target_kind').notNull(),
  targetId: integer('target_id'),
  before: text('before').notNull(),
  after: text('after').notNull(),
  explanation: text('explanation').notNull(),
  status: proposalStatusEnum('status').notNull().default(ProposalStatus.Proposed),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
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
export type PlanVersion = typeof planVersion.$inferSelect
export type NewPlanVersion = typeof planVersion.$inferInsert
export type Phase = typeof phase.$inferSelect
export type NewPhase = typeof phase.$inferInsert
export type Week = typeof week.$inferSelect
export type NewWeek = typeof week.$inferInsert
export type Session = typeof session.$inferSelect
export type NewSession = typeof session.$inferInsert
export type Proposal = typeof proposal.$inferSelect
export type NewProposal = typeof proposal.$inferInsert
export type Pause = typeof pause.$inferSelect
export type NewPause = typeof pause.$inferInsert
export type Activity = typeof activity.$inferSelect
export type NewActivity = typeof activity.$inferInsert
export type Feedback = typeof feedback.$inferSelect
export type NewFeedback = typeof feedback.$inferInsert
export type LoadDaily = typeof loadDaily.$inferSelect
export type NewLoadDaily = typeof loadDaily.$inferInsert
