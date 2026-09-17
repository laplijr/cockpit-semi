ALTER TABLE "race" ALTER COLUMN "objective_mode" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "race" ALTER COLUMN "objective_mode" SET DEFAULT 'temps'::text;--> statement-breakpoint
DROP TYPE "public"."objective_mode";--> statement-breakpoint
CREATE TYPE "public"."objective_mode" AS ENUM('temps', 'record');--> statement-breakpoint
ALTER TABLE "race" ALTER COLUMN "objective_mode" SET DEFAULT 'temps'::"public"."objective_mode";--> statement-breakpoint
ALTER TABLE "race" ALTER COLUMN "objective_mode" SET DATA TYPE "public"."objective_mode" USING "objective_mode"::"public"."objective_mode";--> statement-breakpoint
ALTER TABLE "race" ADD COLUMN "objectif_ambition_s" integer;--> statement-breakpoint
ALTER TABLE "race" ADD COLUMN "objectif_plancher_s" integer;