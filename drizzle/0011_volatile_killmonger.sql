CREATE TYPE "public"."unplanned_status" AS ENUM('a_confirmer', 'confirmee', 'abandonnee');--> statement-breakpoint
ALTER TYPE "public"."proposal_trigger" ADD VALUE 'imprevu';--> statement-breakpoint
ALTER TYPE "public"."proposal_trigger" ADD VALUE 'reverification_course';--> statement-breakpoint
CREATE TABLE "race_lookup" (
	"id" serial PRIMARY KEY NOT NULL,
	"race_id" integer,
	"query" text NOT NULL,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unplanned_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"raw_text" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "unplanned_status" DEFAULT 'a_confirmer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "proposal" ADD COLUMN "payload" jsonb;--> statement-breakpoint
ALTER TABLE "race_lookup" ADD CONSTRAINT "race_lookup_race_id_race_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."race"("id") ON DELETE cascade ON UPDATE no action;