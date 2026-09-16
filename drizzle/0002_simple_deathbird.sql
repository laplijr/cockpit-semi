CREATE TYPE "public"."pause_type" AS ENUM('blessure', 'maladie', 'voyage', 'autre');--> statement-breakpoint
CREATE TYPE "public"."phase_type" AS ENUM('base', 'base_courte', 'developpement', 'specifique', 'vitesse', 'affutage', 'recup', 'relance', 'transition');--> statement-breakpoint
CREATE TYPE "public"."plan_trigger" AS ENUM('onboarding', 'course_ajoutee', 'pause', 'reprise', 'recalcul_accepte');--> statement-breakpoint
CREATE TYPE "public"."session_origin" AS ENUM('plan', 'imprevu', 'import');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('prevue', 'faite', 'modifiee', 'sautee');--> statement-breakpoint
CREATE TABLE "pause" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "pause_type" NOT NULL,
	"zone" text,
	"pain_level" integer,
	"start_date" date NOT NULL,
	"estimated_end_date" date,
	"end_date" date,
	"allowances" jsonb NOT NULL,
	"watch_zones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "phase" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_version_id" integer NOT NULL,
	"type" "phase_type" NOT NULL,
	"start_week" integer NOT NULL,
	"end_week" integer NOT NULL,
	"race_id" integer
);
--> statement-breakpoint
CREATE TABLE "plan_version" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trigger" "plan_trigger" NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"start_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_id" integer NOT NULL,
	"date" date NOT NULL,
	"sport" "sport" NOT NULL,
	"code" text NOT NULL,
	"prescription" jsonb NOT NULL,
	"status" "session_status" DEFAULT 'prevue' NOT NULL,
	"origin" "session_origin" DEFAULT 'plan' NOT NULL,
	"key" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "week" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_version_id" integer NOT NULL,
	"index" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"phase_type" "phase_type" NOT NULL,
	"race_id" integer,
	"target_run_m" integer NOT NULL,
	"target_cycling_min" integer DEFAULT 0 NOT NULL,
	"target_strength_count" integer DEFAULT 0 NOT NULL,
	"long_run_max_m" integer NOT NULL,
	"light" boolean DEFAULT false NOT NULL,
	"comeback_ratio" real,
	CONSTRAINT "week_plan_index" UNIQUE("plan_version_id","index")
);
--> statement-breakpoint
ALTER TABLE "athlete" ALTER COLUMN "constraints" SET DEFAULT '{"availableDays":[]}'::jsonb;--> statement-breakpoint
ALTER TABLE "phase" ADD CONSTRAINT "phase_plan_version_id_plan_version_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase" ADD CONSTRAINT "phase_race_id_race_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."race"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_week_id_week_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."week"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week" ADD CONSTRAINT "week_plan_version_id_plan_version_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week" ADD CONSTRAINT "week_race_id_race_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."race"("id") ON DELETE set null ON UPDATE no action;