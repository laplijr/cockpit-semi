ALTER TABLE "week" ADD COLUMN "runs" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "week" ADD COLUMN "volume_capped" boolean DEFAULT false NOT NULL;