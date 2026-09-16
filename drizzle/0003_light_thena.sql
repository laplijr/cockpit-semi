CREATE TABLE "activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"name" text,
	"sport" "sport" NOT NULL,
	"date" date NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"duration_s" integer NOT NULL,
	"distance_m" real,
	"average_pace_s_km" real,
	"average_hr" integer,
	"max_hr" integer,
	"average_watts" real,
	"elevation_gain_m" real,
	"session_id" integer,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"rpe" integer NOT NULL,
	"sensations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sleep_hours" real,
	"pain" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "load_daily" (
	"date" date PRIMARY KEY NOT NULL,
	"running_ua" integer DEFAULT 0 NOT NULL,
	"cycling_ua" integer DEFAULT 0 NOT NULL,
	"strength_ua" integer DEFAULT 0 NOT NULL,
	"other_ua" integer DEFAULT 0 NOT NULL,
	"total_ua" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_token" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"athlete_id" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"scope" text,
	"last_sync_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;