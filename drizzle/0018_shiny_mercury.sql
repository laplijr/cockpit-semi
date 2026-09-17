DROP TABLE "race_route" CASCADE;--> statement-breakpoint
ALTER TABLE "athlete" ADD COLUMN "home_address" text;--> statement-breakpoint
ALTER TABLE "race" ADD COLUMN "fuel_plan" jsonb;--> statement-breakpoint
DROP TYPE "public"."route_kind";