CREATE TABLE "strength_set" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"exercise_id" text NOT NULL,
	"index" integer NOT NULL,
	"reps" integer NOT NULL,
	"load_kg" real NOT NULL,
	"rpe" integer NOT NULL,
	CONSTRAINT "strength_set_session_exercise_index" UNIQUE("session_id","exercise_id","index")
);
--> statement-breakpoint
ALTER TABLE "strength_set" ADD CONSTRAINT "strength_set_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;