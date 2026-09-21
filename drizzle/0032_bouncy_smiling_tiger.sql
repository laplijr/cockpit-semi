CREATE TYPE "public"."run_status" AS ENUM('en_cours', 'terminee', 'abandonnee');--> statement-breakpoint
CREATE TABLE "run" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"session_id" integer,
	"status" "run_status" DEFAULT 'en_cours' NOT NULL,
	"date" date NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"fixes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"distance_m" real,
	"duration_s" integer,
	"elevation_gain_m" real,
	"activity_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE set null ON UPDATE no action;