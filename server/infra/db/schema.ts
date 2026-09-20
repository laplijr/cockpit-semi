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
import { AthleteProfile } from '../../domain/athlete/profile'
import { ForecastTarget } from '../../domain/fitness/accuracy'
import { FitnessOrigin } from '../../domain/fitness/fitness-point'
import { Sensation, type Pain } from '../../domain/load/feedback'
import { PauseType, type PauseAllowances } from '../../domain/pause/pause'
import { ProposalStatus, ProposalTrigger } from '../../domain/rules/proposal-status'
import type { UnplannedEvent } from '../../domain/unplanned/events'
import { UnplannedStatus } from '../../domain/unplanned/events'
import { LookupStatus, type LookupField } from '../../domain/races/lookup'
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
import { HabitStatus, HabitType } from '../../domain/learning/habit'
import type { FuelPlan } from '../../domain/nutrition/fuel-plan'
import type { Meal } from '../../domain/nutrition/meal'
import { Sport } from '../../domain/shared/sport'

export {
  AthleteProfile,
  FitnessOrigin,
  ForecastTarget,
  LookupStatus,
  UnplannedStatus,
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
  HabitStatus,
  HabitType,
  SegmentMode,
  Sport,
}
export type {
  AthleteConstraints,
  FuelPlan,
  LookupField,
  Pain,
  PauseAllowances,
  RaceIncident,
  UnplannedEvent,
}

export const sportEnum = pgEnum('sport', enumValues(Sport))
export const athleteProfileEnum = pgEnum('athlete_profile', enumValues(AthleteProfile))
export const racePriorityEnum = pgEnum('race_priority', enumValues(RacePriority))
export const objectiveModeEnum = pgEnum('objective_mode', enumValues(ObjectiveMode))
export const raceStatusEnum = pgEnum('race_status', enumValues(RaceStatus))
export const raceSourceEnum = pgEnum('race_source', enumValues(RaceSource))
export const segmentModeEnum = pgEnum('segment_mode', enumValues(SegmentMode))
export const fitnessOriginEnum = pgEnum('fitness_origin', enumValues(FitnessOrigin))
export const forecastTargetEnum = pgEnum('forecast_target', enumValues(ForecastTarget))
export const phaseTypeEnum = pgEnum('phase_type', enumValues(PhaseType))
export const planTriggerEnum = pgEnum('plan_trigger', enumValues(PlanTrigger))
export const sessionStatusEnum = pgEnum('session_status', enumValues(SessionStatus))
export const sessionOriginEnum = pgEnum('session_origin', enumValues(SessionOrigin))
export const pauseTypeEnum = pgEnum('pause_type', enumValues(PauseType))
export const proposalStatusEnum = pgEnum('proposal_status', enumValues(ProposalStatus))
export const proposalTriggerEnum = pgEnum('proposal_trigger', enumValues(ProposalTrigger))
export const unplannedStatusEnum = pgEnum('unplanned_status', enumValues(UnplannedStatus))
export const habitTypeEnum = pgEnum('habit_type', enumValues(HabitType))
export const habitStatusEnum = pgEnum('habit_status', enumValues(HabitStatus))

/** Conserve les types littéraux de l'énumération pour que Drizzle les propage. */
function enumValues<T extends Record<string, string>>(source: T): [T[keyof T], ...T[keyof T][]] {
  return Object.values(source) as [T[keyof T], ...T[keyof T][]]
}

/**
 * Application mono-utilisateur : `athlete` ne contient qu'une ligne, `id = 1`.
 */
export const athlete = pgTable('athlete', {
  id: integer('id').primaryKey().default(1),
  /** Prénom : il porte l'identité de la barre du haut et les initiales de l'avatar. */
  firstName: text('first_name'),
  birthDate: date('birth_date'),
  /** Niveau déclaré : il pré-remplit les volumes et borne la montée (§ 9, P5.7). */
  profile: athleteProfileEnum('profile'),
  /** Photo en data URL, 160 × 160 webp ; nulle tant qu'il n'y en a pas. */
  avatar: text('avatar'),
  weightKg: real('weight_kg'),
  maxHr: integer('max_hr'),
  /** Adresse d'où partent les sorties : point de départ des itinéraires (§ 9, P5.5). */
  homeAddress: text('home_address'),
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
  /** Progression estimée par bloc de huit semaines, quand R9 l'a recalée (§ 5). */
  vdotGainPerBlock: real('vdot_gain_per_block'),
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
  /** Niveau réaliste, nul tant qu'il n'est pas fixé et toujours nul en mode record. */
  objectifS: integer('objectif_s'),
  /** Niveau ambition : le chrono du bon jour, la borne basse de l'intervalle. */
  objectifAmbitionS: integer('objectif_ambition_s'),
  /** Niveau plancher : le chrono à ne pas manquer, la borne haute de l'intervalle. */
  objectifPlancherS: integer('objectif_plancher_s'),
  elevationGainM: integer('elevation_gain_m'),
  profileType: text('profile_type'),
  expectedTempC: real('expected_temp_c'),
  source: raceSourceEnum('source').notNull().default(RaceSource.Manual),
  status: raceStatusEnum('status').notNull().default(RaceStatus.Planned),
  resultatS: integer('resultat_s'),
  /** Faux quand le chrono ne reflète pas la forme : il ne calibre alors pas le VDOT. */
  representative: boolean('representative').notNull().default(true),
  incident: jsonb('incident').$type<RaceIncident>(),
  /** Ravito et hydratation, généré à J−7 et modifiable ; nul quand inutile (§ 4). */
  fuelPlan: jsonb('fuel_plan').$type<FuelPlan>(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
/**
 * Une variante d'itinéraire proposée pour une séance : une boucle à sa
 * distance, depuis l'adresse d'où l'on part (§ 4). Une ligne par variante
 * conservée ; le GPX est stocké tel qu'il sera téléchargé.
 */
export const route = pgTable('route', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .notNull()
    .references(() => session.id, { onDelete: 'cascade' }),
  /** Adresse de départ, telle que saisie. */
  address: text('address').notNull(),
  lat: real('lat').notNull(),
  lon: real('lon').notNull(),
  date: date('date').notNull(),
  code: text('code').notNull(),
  targetDistanceM: real('target_distance_m').notNull(),
  seed: integer('seed').notNull(),
  distanceM: real('distance_m').notNull(),
  elevationGainM: integer('elevation_gain_m').notNull(),
  turns: integer('turns').notNull(),
  /** Rang dans le classement des variantes : 0 = la meilleure. */
  rank: integer('rank').notNull().default(0),
  gpx: text('gpx').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
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
  /** Effort perçu, quand il est connu : saisi pour un imprévu, déduit de la FC sinon. */
  rpe: integer('rpe'),
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

/**
 * Séries réalisées d'une séance de musculation. C'est d'elles que se déduit la
 * charge proposée à la séance suivante (§ 9, P4).
 */
export const strengthSet = pgTable(
  'strength_set',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => session.id, { onDelete: 'cascade' }),
    /** Identifiant de l'exercice dans la bibliothèque muscu. */
    exerciseId: text('exercise_id').notNull(),
    /** Rang de la série dans l'exercice, à partir de 1. */
    index: integer('index').notNull(),
    reps: integer('reps').notNull(),
    loadKg: real('load_kg').notNull(),
    rpe: integer('rpe').notNull(),
  },
  (table) => [
    unique('strength_set_session_exercise_index').on(
      table.sessionId,
      table.exerciseId,
      table.index,
    ),
  ],
)

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
  /** Ce que le texte d'une proposition ne peut pas porter : une date de destination. */
  payload: jsonb('payload').$type<Record<string, unknown>>(),
  status: proposalStatusEnum('status').notNull().default(ProposalStatus.Proposed),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
})

/**
 * Texte libre de l'Imprévu et son interprétation par le modèle (§ 6). Rien
 * n'est appliqué tant que l'athlète n'a pas confirmé l'interprétation.
 */
export const unplannedEvent = pgTable('unplanned_event', {
  id: serial('id').primaryKey(),
  rawText: text('raw_text').notNull(),
  events: jsonb('events').$type<UnplannedEvent[]>().notNull().default([]),
  status: unplannedStatusEnum('status').notNull().default(UnplannedStatus.ToConfirm),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
})

/**
 * Résultat brut de la recherche automatique d'une course, champ par champ,
 * avec son statut et ses sources (§ 6). Revérifié par le cron jusqu'à
 * l'ouverture des inscriptions.
 */
export const raceLookup = pgTable('race_lookup', {
  id: serial('id').primaryKey(),
  raceId: integer('race_id').references(() => race.id, { onDelete: 'cascade' }),
  query: text('query').notNull(),
  fields: jsonb('fields').$type<Record<string, LookupField>>().notNull().default({}),
  checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
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
export type StrengthSet = typeof strengthSet.$inferSelect
export type NewStrengthSet = typeof strengthSet.$inferInsert
export type UnplannedEventRow = typeof unplannedEvent.$inferSelect
export type NewUnplannedEventRow = typeof unplannedEvent.$inferInsert
/**
 * Habitude détectée par observation (§ 5). Elle ne devient une règle apprise
 * qu'une fois acceptée ; la clé rend une détection idempotente.
 */
export const habit = pgTable(
  'habit',
  {
    id: serial('id').primaryKey(),
    type: habitTypeEnum('type').notNull(),
    key: text('key').notNull(),
    parameters: jsonb('parameters').$type<Record<string, number | string>>().notNull().default({}),
    /** Preuve : n cas sur N observés. */
    matched: integer('matched').notNull(),
    total: integer('total').notNull(),
    confidence: real('confidence').notNull(),
    statement: text('statement').notNull(),
    status: habitStatusEnum('status').notNull().default(HabitStatus.Detected),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (table) => [unique('habit_key').on(table.key)],
)

/** Mesure hebdomadaire de l'écart entre ce que le moteur annonce et ce qui arrive. */
export const calibration = pgTable(
  'calibration',
  {
    id: serial('id').primaryKey(),
    /** Lundi de la semaine mesurée. */
    date: date('date').notNull(),
    rpeError: real('rpe_error').notNull(),
    acceptanceRate: real('acceptance_rate'),
    projectionGap: real('projection_gap'),
    samples: jsonb('samples')
      .$type<{ rpe: number; decisions: number; tests: number }>()
      .notNull()
      .default({ rpe: 0, decisions: 0, tests: 0 }),
  },
  (table) => [unique('calibration_date').on(table.date)],
)

/**
 * Exemples de repas d'un jour, générés par le modèle à la demande (§ 6, P6.4).
 * Une ligne par jour : absente, le jour n'a simplement rien à montrer. La clé
 * des séances dit sur quoi la génération s'appuyait — le plan change, la
 * proposition se régénère.
 */
export const mealPlan = pgTable(
  'meal_plan',
  {
    id: serial('id').primaryKey(),
    date: date('date').notNull(),
    dayKind: text('day_kind').notNull(),
    /** Séances du jour au moment de la génération, sous forme stable. */
    sessionsKey: text('sessions_key').notNull(),
    meals: jsonb('meals').$type<Meal[]>().notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('meal_plan_date').on(table.date)],
)

/**
 * Ce que le cockpit avait annoncé, et ce qui est arrivé (§ 9, P6.6). Une ligne
 * par cible et par régénération, jamais écrasée : c'est l'historique des
 * annonces qui dit si le moteur mérite qu'on le croie. Le réalisé et l'écart
 * restent nuls tant que l'échéance n'a pas eu lieu.
 */
export const forecast = pgTable('forecast', {
  id: serial('id').primaryKey(),
  target: forecastTargetEnum('target').notNull(),
  /** La course visée ; nulle quand la cible est le prochain test. */
  raceId: integer('race_id').references(() => race.id, { onDelete: 'cascade' }),
  issuedDate: date('issued_date').notNull(),
  targetDate: date('target_date').notNull(),
  projectedVdot: real('projected_vdot').notNull(),
  lowVdot: real('low_vdot').notNull(),
  highVdot: real('high_vdot').notNull(),
  /** Confiance de tenir l'objectif au moment de l'émission ; nulle sans cible. */
  confidencePct: integer('confidence_pct'),
  actualVdot: real('actual_vdot'),
  /** Réalisé moins projeté : positif quand la forme a dépassé l'annonce. */
  gapVdot: real('gap_vdot'),
  resolvedDate: date('resolved_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Forecast = typeof forecast.$inferSelect
export type NewForecast = typeof forecast.$inferInsert

export type Habit = typeof habit.$inferSelect
export type NewHabit = typeof habit.$inferInsert
export type CalibrationRow = typeof calibration.$inferSelect
export type NewCalibrationRow = typeof calibration.$inferInsert
export type RaceLookup = typeof raceLookup.$inferSelect
export type NewRaceLookup = typeof raceLookup.$inferInsert
export type MealPlan = typeof mealPlan.$inferSelect
export type NewMealPlan = typeof mealPlan.$inferInsert
export type Route = typeof route.$inferSelect
export type NewRoute = typeof route.$inferInsert
