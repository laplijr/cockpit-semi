CREATE TABLE "meal_plan" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"day_kind" text NOT NULL,
	"sessions_key" text NOT NULL,
	"meals" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_plan_date" UNIQUE("date")
);
