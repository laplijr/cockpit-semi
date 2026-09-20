CREATE TYPE "public"."forecast_target" AS ENUM('test', 'course');--> statement-breakpoint
CREATE TABLE "forecast" (
	"id" serial PRIMARY KEY NOT NULL,
	"target" "forecast_target" NOT NULL,
	"race_id" integer,
	"issued_date" date NOT NULL,
	"target_date" date NOT NULL,
	"projected_vdot" real NOT NULL,
	"low_vdot" real NOT NULL,
	"high_vdot" real NOT NULL,
	"confidence_pct" integer,
	"actual_vdot" real,
	"gap_vdot" real,
	"resolved_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "athlete" ADD COLUMN "vdot_gain_per_block" real;--> statement-breakpoint
ALTER TABLE "forecast" ADD CONSTRAINT "forecast_race_id_race_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."race"("id") ON DELETE cascade ON UPDATE no action;