CREATE TYPE "public"."estimate_source" AS ENUM('calage', 'seance');--> statement-breakpoint
CREATE TABLE "strength_estimate" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"exercise_id" text NOT NULL,
	"max_kg" real NOT NULL,
	"source" "estimate_source" NOT NULL,
	"date" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "strength_estimate" ADD CONSTRAINT "strength_estimate_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;