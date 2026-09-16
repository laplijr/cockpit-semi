CREATE TABLE "athlete" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"weight_kg" real,
	"max_hr" integer,
	"available_days" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"constraints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"onboarded" boolean DEFAULT false NOT NULL,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
