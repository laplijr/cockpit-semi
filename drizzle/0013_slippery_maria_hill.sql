CREATE TYPE "public"."athlete_profile" AS ENUM('athlete', 'sportif_regulier', 'sportif_occasionnel', 'reprise', 'debutant');--> statement-breakpoint
ALTER TABLE "athlete" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "athlete" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "athlete" ADD COLUMN "profile" "athlete_profile";--> statement-breakpoint
ALTER TABLE "athlete" ADD COLUMN "avatar" text;