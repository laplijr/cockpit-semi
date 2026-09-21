CREATE TYPE "public"."external_call" AS ENUM('imprevu', 'recherche_course', 'itineraire');--> statement-breakpoint
CREATE TABLE "api_usage" (
	"athlete_id" integer NOT NULL,
	"date" date NOT NULL,
	"kind" "external_call" NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_usage_athlete_id_date_kind_pk" PRIMARY KEY("athlete_id","date","kind")
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_by" integer,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "invitation_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" serial PRIMARY KEY NOT NULL,
	"login" text NOT NULL,
	"password_hash" text NOT NULL,
	"athlete_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "user_login_unique" UNIQUE("login")
);
--> statement-breakpoint
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_consumed_by_user_id_fk" FOREIGN KEY ("consumed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;