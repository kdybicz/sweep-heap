ALTER TABLE "chore_occurrence_overrides"
  RENAME COLUMN "occurrence_date" TO "occurrence_start_date";
--> statement-breakpoint
ALTER TABLE "chore_occurrence_overrides"
  DROP CONSTRAINT IF EXISTS "chore_occurrence_overrides_chore_date_unique";
--> statement-breakpoint
ALTER TABLE "chore_occurrence_overrides"
  ADD CONSTRAINT "chore_occurrence_overrides_chore_start_unique"
  UNIQUE("chore_id", "occurrence_start_date");
--> statement-breakpoint
UPDATE "chores"
SET "end_date" = "end_date" + 1;
--> statement-breakpoint
CREATE TABLE "chore_occurrence_exclusions" (
	"id" serial PRIMARY KEY NOT NULL,
	"chore_id" integer NOT NULL,
	"occurrence_start_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chore_occurrence_exclusions_chore_start_unique" UNIQUE("chore_id", "occurrence_start_date")
);
--> statement-breakpoint
ALTER TABLE "chore_occurrence_exclusions"
  ADD CONSTRAINT "chore_occurrence_exclusions_chore_id_chores_id_fk"
  FOREIGN KEY ("chore_id") REFERENCES "public"."chores"("id") ON DELETE cascade ON UPDATE no action;
