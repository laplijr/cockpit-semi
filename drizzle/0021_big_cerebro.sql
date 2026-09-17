CREATE TYPE "public"."habit_status" AS ENUM('detectee', 'acceptee', 'refusee');--> statement-breakpoint
CREATE TYPE "public"."habit_type" AS ENUM('glissement_de_jour', 'creneau_jamais_honore', 'biais_rpe', 'sensibilite_sommeil', 'refus_systematique');--> statement-breakpoint
CREATE TABLE "calibration" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"rpe_error" real NOT NULL,
	"acceptance_rate" real,
	"projection_gap" real,
	"samples" jsonb DEFAULT '{"rpe":0,"decisions":0,"tests":0}'::jsonb NOT NULL,
	CONSTRAINT "calibration_date" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "habit" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "habit_type" NOT NULL,
	"key" text NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"matched" integer NOT NULL,
	"total" integer NOT NULL,
	"confidence" real NOT NULL,
	"statement" text NOT NULL,
	"status" "habit_status" DEFAULT 'detectee' NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "habit_key" UNIQUE("key")
);
