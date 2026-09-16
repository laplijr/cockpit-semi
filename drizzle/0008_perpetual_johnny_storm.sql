CREATE TYPE "public"."proposal_status" AS ENUM('proposee', 'acceptee', 'refusee', 'expiree');--> statement-breakpoint
CREATE TYPE "public"."proposal_trigger" AS ENUM('ressenti', 'cron_quotidien', 'regeneration');--> statement-breakpoint
CREATE TABLE "proposal" (
	"id" serial PRIMARY KEY NOT NULL,
	"trigger" "proposal_trigger" NOT NULL,
	"rule_id" text NOT NULL,
	"effect" text NOT NULL,
	"target_kind" text NOT NULL,
	"target_id" integer,
	"before" text NOT NULL,
	"after" text NOT NULL,
	"explanation" text NOT NULL,
	"status" "proposal_status" DEFAULT 'proposee' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
