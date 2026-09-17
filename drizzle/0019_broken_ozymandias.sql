CREATE TABLE "route" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"address" text NOT NULL,
	"lat" real NOT NULL,
	"lon" real NOT NULL,
	"date" date NOT NULL,
	"code" text NOT NULL,
	"target_distance_m" real NOT NULL,
	"seed" integer NOT NULL,
	"distance_m" real NOT NULL,
	"elevation_gain_m" integer NOT NULL,
	"turns" integer NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"gpx" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "route" ADD CONSTRAINT "route_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;