import {
  bigint,
  date,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const households = pgTable("households", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  timeZone: text("time_zone").notNull().default("UTC"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date", withTimezone: true }),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: bigint("expires_at", { mode: "number" }),
    idToken: text("id_token"),
    scope: text("scope"),
    sessionState: text("session_state"),
    tokenType: text("token_type"),
  },
  (table) => [
    unique("accounts_provider_providerAccountId_unique").on(
      table.provider,
      table.providerAccountId,
    ),
  ],
);

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  sessionToken: text("sessionToken").notNull().unique(),
});

export const verificationToken = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
    token: text("token").notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

export const householdMemberships = pgTable(
  "household_memberships",
  {
    id: serial("id").primaryKey(),
    householdId: integer("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("household_memberships_household_user_unique").on(table.householdId, table.userId),
  ],
);

export const chores = pgTable("chores", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  seriesEndDate: date("series_end_date"),
  repeatRule: text("repeat_rule").notNull(),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const choreOccurrenceOverrides = pgTable(
  "chore_occurrence_overrides",
  {
    id: serial("id").primaryKey(),
    choreId: integer("chore_id")
      .notNull()
      .references(() => chores.id, { onDelete: "cascade" }),
    occurrenceDate: date("occurrence_date").notNull(),
    status: text("status").notNull(),
    closedReason: text("closed_reason"),
    undoUntil: timestamp("undo_until", { mode: "date", withTimezone: true }),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("chore_occurrence_overrides_chore_date_unique").on(table.choreId, table.occurrenceDate),
  ],
);
