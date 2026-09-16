ALTER TYPE "public"."plan_trigger" ADD VALUE 'test_enregistre';--> statement-breakpoint
ALTER TABLE "plan_version" ALTER COLUMN "start_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "athlete" ADD COLUMN "start_weekly_volume_m" integer;--> statement-breakpoint
ALTER TABLE "athlete" ADD COLUMN "peak_weekly_volume_m" integer;