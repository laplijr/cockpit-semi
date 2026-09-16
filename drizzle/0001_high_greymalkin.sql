CREATE TYPE "public"."fitness_origin" AS ENUM('course', 'test', 'import_initial');--> statement-breakpoint
CREATE TYPE "public"."objective_mode" AS ENUM('temps', 'performance_max');--> statement-breakpoint
CREATE TYPE "public"."race_priority" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."race_source" AS ENUM('manuel', 'recherche');--> statement-breakpoint
CREATE TYPE "public"."race_status" AS ENUM('planifiee', 'courue', 'annulee');--> statement-breakpoint
CREATE TYPE "public"."segment_mode" AS ENUM('course', 'marche_course', 'marche');--> statement-breakpoint
CREATE TYPE "public"."sport" AS ENUM('course', 'velo', 'muscu', 'autre');--> statement-breakpoint
CREATE TABLE "fitness_point" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"vdot" real NOT NULL,
	"origin" "fitness_origin" NOT NULL,
	"race_id" integer,
	"is_floor" boolean DEFAULT false NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "race" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"distance_m" real NOT NULL,
	"priority" "race_priority" NOT NULL,
	"objective_mode" "objective_mode" DEFAULT 'temps' NOT NULL,
	"objectif_s" integer,
	"elevation_gain_m" integer,
	"profile_type" text,
	"expected_temp_c" real,
	"source" "race_source" DEFAULT 'manuel' NOT NULL,
	"status" "race_status" DEFAULT 'planifiee' NOT NULL,
	"resultat_s" integer,
	"representative" boolean DEFAULT true NOT NULL,
	"incident" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "race_segment" (
	"id" serial PRIMARY KEY NOT NULL,
	"race_id" integer NOT NULL,
	"km_debut" real NOT NULL,
	"km_fin" real NOT NULL,
	"mode" "segment_mode" NOT NULL,
	"allure_s_km" real,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "session_type" (
	"id" serial PRIMARY KEY NOT NULL,
	"sport" "sport" NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"default_structure" jsonb NOT NULL,
	"quota" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"allowed_phases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_rpe" real,
	CONSTRAINT "session_type_sport_code" UNIQUE("sport","code")
);
--> statement-breakpoint
ALTER TABLE "fitness_point" ADD CONSTRAINT "fitness_point_race_id_race_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."race"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_segment" ADD CONSTRAINT "race_segment_race_id_race_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."race"("id") ON DELETE cascade ON UPDATE no action;