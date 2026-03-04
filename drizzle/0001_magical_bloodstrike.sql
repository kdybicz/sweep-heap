CREATE TABLE "household_member_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"household_id" integer NOT NULL,
	"invited_by_user_id" integer NOT NULL,
	"accepted_by_user_id" integer,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"identifier" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_member_invites_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
ALTER TABLE "household_member_invites" ADD CONSTRAINT "household_member_invites_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_member_invites" ADD CONSTRAINT "household_member_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_member_invites" ADD CONSTRAINT "household_member_invites_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;