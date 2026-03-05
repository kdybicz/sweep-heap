DELETE FROM "household_member_invites" AS existing
USING "household_member_invites" AS duplicate
WHERE existing."accepted_at" IS NULL
  AND duplicate."accepted_at" IS NULL
  AND existing."household_id" = duplicate."household_id"
  AND lower(existing."email") = lower(duplicate."email")
  AND (
    existing."created_at" < duplicate."created_at"
    OR (existing."created_at" = duplicate."created_at" AND existing."id" < duplicate."id")
  );
--> statement-breakpoint
CREATE UNIQUE INDEX "household_member_invites_pending_email_unique" ON "household_member_invites" USING btree ("household_id",lower("email")) WHERE "household_member_invites"."accepted_at" is null;
