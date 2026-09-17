CREATE TYPE "public"."route_kind" AS ENUM('boucle', 'aller');--> statement-breakpoint
CREATE TABLE "race_route" (
	"id" serial PRIMARY KEY NOT NULL,
	"race_id" integer NOT NULL,
	"address" text NOT NULL,
	"lat" real NOT NULL,
	"lon" real NOT NULL,
	"session_id" integer,
	"date" date NOT NULL,
	"code" text,
	"kind" "route_kind" NOT NULL,
	"target_distance_m" real DEFAULT 0 NOT NULL,
	"seed" integer NOT NULL,
	"distance_m" real NOT NULL,
	"elevation_gain_m" integer NOT NULL,
	"turns" integer NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"gpx" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "race" ADD COLUMN "start_address" text;--> statement-breakpoint
ALTER TABLE "race_route" ADD CONSTRAINT "race_route_race_id_race_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."race"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_route" ADD CONSTRAINT "race_route_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;