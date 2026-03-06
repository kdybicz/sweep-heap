ALTER TABLE "households" ADD COLUMN "slug" text;
--> statement-breakpoint
UPDATE "households"
SET "slug" = concat(
  coalesce(nullif(regexp_replace(lower(trim("name")), '[^a-z0-9]+', '-', 'g'), ''), 'household'),
  '-',
  "id"
)
WHERE "slug" IS NULL;
--> statement-breakpoint
ALTER TABLE "households" ALTER COLUMN "slug" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_slug_unique" UNIQUE("slug");
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "metadata" text;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "active_household_id" text;
--> statement-breakpoint
ALTER TABLE "household_member_invites" ADD COLUMN "status" text;
--> statement-breakpoint
UPDATE "household_member_invites"
SET "status" = CASE
  WHEN "accepted_at" IS NOT NULL THEN 'accepted'
  WHEN "expires_at" <= now() THEN 'canceled'
  ELSE 'pending'
END
WHERE "status" IS NULL;
--> statement-breakpoint
ALTER TABLE "household_member_invites" ALTER COLUMN "status" SET DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE "household_member_invites" ALTER COLUMN "status" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "household_member_invites" ADD COLUMN "accept_secret_hash" text;
--> statement-breakpoint
DROP INDEX IF EXISTS "household_member_invites_pending_email_unique";
--> statement-breakpoint
ALTER TABLE "household_member_invites" DROP CONSTRAINT IF EXISTS "household_member_invites_identifier_unique";
--> statement-breakpoint
ALTER TABLE "household_member_invites" DROP COLUMN IF EXISTS "identifier";
--> statement-breakpoint
ALTER TABLE "household_member_invites" DROP COLUMN IF EXISTS "token_hash";
--> statement-breakpoint
CREATE UNIQUE INDEX "household_member_invites_pending_email_unique"
ON "household_member_invites" USING btree ("household_id", lower("email"))
WHERE "status" = 'pending';
