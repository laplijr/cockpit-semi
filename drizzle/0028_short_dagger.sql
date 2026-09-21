ALTER TABLE "activity" DROP CONSTRAINT "activity_external_id_unique";--> statement-breakpoint
ALTER TABLE "calibration" DROP CONSTRAINT "calibration_date";--> statement-breakpoint
ALTER TABLE "habit" DROP CONSTRAINT "habit_key";--> statement-breakpoint
ALTER TABLE "meal_plan" DROP CONSTRAINT "meal_plan_date";--> statement-breakpoint
ALTER TABLE "athlete" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "athlete_id_seq" AS integer OWNED BY "athlete"."id";--> statement-breakpoint
SELECT setval('athlete_id_seq', coalesce((SELECT max(id) FROM "athlete"), 0) + 1, false);--> statement-breakpoint
ALTER TABLE "athlete" ALTER COLUMN "id" SET DEFAULT nextval('athlete_id_seq');--> statement-breakpoint
ALTER TABLE "load_daily" DROP CONSTRAINT "load_daily_pkey";--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "athlete_id" integer;--> statement-breakpoint
UPDATE "activity" SET "athlete_id" = (SELECT min(id) FROM "athlete") WHERE "athlete_id" IS NULL;--> statement-breakpoint
ALTER TABLE "activity" ALTER COLUMN "athlete_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calibration" ADD COLUMN "athlete_id" integer;--> statement-breakpoint
UPDATE "calibration" SET "athlete_id" = (SELECT min(id) FROM "athlete") WHERE "athlete_id" IS NULL;--> statement-breakpoint
ALTER TABLE "calibration" ALTER COLUMN "athlete_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fitness_point" ADD COLUMN "athlete_id" integer;--> statement-breakpoint
UPDATE "fitness_point" SET "athlete_id" = (SELECT min(id) FROM "athlete") WHERE "athlete_id" IS NULL;--> statement-breakpoint
ALTER TABLE "fitness_point" ALTER COLUMN "athlete_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "forecast" ADD COLUMN "athlete_id" integer;--> statement-breakpoint
UPDATE "forecast" SET "athlete_id" = (SELECT min(id) FROM "athlete") WHERE "athlete_id" IS NULL;--> statement-breakpoint
ALTER TABLE "forecast" ALTER COLUMN "athlete_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "habit" ADD COLUMN "athlete_id" integer;--> statement-breakpoint
UPDATE "habit" SET "athlete_id" = (SELECT min(id) FROM "athlete") WHERE "athlete_id" IS NULL;--> statement-breakpoint
ALTER TABLE "habit" ALTER COLUMN "athlete_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "load_daily" ADD COLUMN "athlete_id" integer;--> statement-breakpoint
UPDATE "load_daily" SET "athlete_id" = (SELECT min(id) FROM "athlete") WHERE "athlete_id" IS NULL;--> statement-breakpoint
ALTER TABLE "load_daily" ALTER COLUMN "athlete_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_plan" ADD COLUMN "athlete_id" integer;--> statement-breakpoint
UPDATE "meal_plan" SET "athlete_id" = (SELECT min(id) FROM "athlete") WHERE "athlete_id" IS NULL;--> statement-breakpoint
ALTER TABLE "meal_plan" ALTER COLUMN "athlete_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pause" ADD COLUMN "athlete_id" integer;--> statement-breakpoint
UPDATE "pause" SET "athlete_id" = (SELECT min(id) FROM "athlete") WHERE "athlete_id" IS NULL;--> statement-breakpoint
ALTER TABLE "pause" ALTER COLUMN "athlete_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_version" ADD COLUMN "athlete_id" integer;--> statement-breakpoint
UPDATE "plan_version" SET "athlete_id" = (SELECT min(id) FROM "athlete") WHERE "athlete_id" IS NULL;--> statement-breakpoint
ALTER TABLE "plan_version" ALTER COLUMN "athlete_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "proposal" ADD COLUMN "athlete_id" integer;--> statement-breakpoint
UPDATE "proposal" SET "athlete_id" = (SELECT min(id) FROM "athlete") WHERE "athlete_id" IS NULL;--> statement-breakpoint
ALTER TABLE "proposal" ALTER COLUMN "athlete_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "race" ADD COLUMN "athlete_id" integer;--> statement-breakpoint
UPDATE "race" SET "athlete_id" = (SELECT min(id) FROM "athlete") WHERE "athlete_id" IS NULL;--> statement-breakpoint
ALTER TABLE "race" ALTER COLUMN "athlete_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "race_lookup" ADD COLUMN "athlete_id" integer;--> statement-breakpoint
UPDATE "race_lookup" SET "athlete_id" = (SELECT min(id) FROM "athlete") WHERE "athlete_id" IS NULL;--> statement-breakpoint
ALTER TABLE "race_lookup" ALTER COLUMN "athlete_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "unplanned_event" ADD COLUMN "athlete_id" integer;--> statement-breakpoint
UPDATE "unplanned_event" SET "athlete_id" = (SELECT min(id) FROM "athlete") WHERE "athlete_id" IS NULL;--> statement-breakpoint
ALTER TABLE "unplanned_event" ALTER COLUMN "athlete_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibration" ADD CONSTRAINT "calibration_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_point" ADD CONSTRAINT "fitness_point_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast" ADD CONSTRAINT "forecast_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit" ADD CONSTRAINT "habit_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_daily" ADD CONSTRAINT "load_daily_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan" ADD CONSTRAINT "meal_plan_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pause" ADD CONSTRAINT "pause_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_version" ADD CONSTRAINT "plan_version_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race" ADD CONSTRAINT "race_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_lookup" ADD CONSTRAINT "race_lookup_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unplanned_event" ADD CONSTRAINT "unplanned_event_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_external" UNIQUE("athlete_id","external_id");--> statement-breakpoint
ALTER TABLE "calibration" ADD CONSTRAINT "calibration_date" UNIQUE("athlete_id","date");--> statement-breakpoint
ALTER TABLE "habit" ADD CONSTRAINT "habit_key" UNIQUE("athlete_id","key");--> statement-breakpoint
ALTER TABLE "meal_plan" ADD CONSTRAINT "meal_plan_date" UNIQUE("athlete_id","date");
--> statement-breakpoint
ALTER TABLE "load_daily" ADD CONSTRAINT "load_daily_athlete_id_date_pk" PRIMARY KEY("athlete_id","date");
