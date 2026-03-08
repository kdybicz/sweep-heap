import { pool } from "@/lib/db";
import type { HouseholdRole } from "@/lib/household-roles";

export type MembershipSummary = {
  householdId: number;
  role: string;
  status: string;
};

export type ActiveHouseholdSummary = {
  id: number;
  name: string;
  timeZone: string;
  icon: string | null;
  role: string;
};

export type HouseholdMemberRole = HouseholdRole;

export type HouseholdInviteRecord = {
  id: number;
  householdId: number;
  householdName: string;
  email: string;
  role: HouseholdMemberRole;
  invitedByUserId: number;
  createdAt: Date;
  expiresAt: Date;
};

export const getUserMemberships = async (userId: number) => {
  const result = await pool.query<MembershipSummary>(
    "select household_id as \"householdId\", role, status from household_memberships where user_id = $1 and status = 'active' order by joined_at desc",
    [userId],
  );
  return result.rows;
};

export const getActiveHouseholdId = async (userId: number) => {
  const result = await pool.query<MembershipSummary>(
    "select household_id as \"householdId\", role, status from household_memberships where user_id = $1 and status = 'active' order by joined_at desc limit 1",
    [userId],
  );
  return result.rows[0]?.householdId ?? null;
};

export const listActiveHouseholdsForUser = async (userId: number) => {
  const result = await pool.query<ActiveHouseholdSummary>(
    "select h.id as id, h.name as name, h.time_zone as \"timeZone\", h.icon as icon, hm.role as role from household_memberships hm join households h on h.id = hm.household_id where hm.user_id = $1 and hm.status = 'active' order by hm.joined_at desc, h.id desc",
    [userId],
  );
  return result.rows;
};

export const createHouseholdWithOwner = async ({
  userId,
  name,
  slug,
  timeZone,
  icon,
}: {
  userId: number;
  name: string;
  slug: string;
  timeZone: string;
  icon: string | null;
}) => {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const householdResult = await client.query(
      "insert into households (name, slug, time_zone, icon, metadata) values ($1, $2, $3, $4, $5) returning id",
      [name.trim(), slug, timeZone, icon, null],
    );
    const householdId = householdResult.rows[0]?.id as number | undefined;
    if (!householdId) {
      throw new Error("Failed to create household");
    }
    await client.query(
      "insert into household_memberships (household_id, user_id, role) values ($1, $2, $3)",
      [householdId, userId, "owner"],
    );
    await client.query("commit");
    return householdId;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const getHouseholdTimeZoneById = async (householdId: number) => {
  const result = await pool.query<{ time_zone: string }>(
    "select time_zone from households where id = $1",
    [householdId],
  );
  return result.rows[0]?.time_zone ?? "UTC";
};

export const getActiveHouseholdSummary = async (userId: number) => {
  const result = await pool.query<ActiveHouseholdSummary>(
    "select h.id as id, h.name as name, h.time_zone as \"timeZone\", h.icon as icon, hm.role as role from household_memberships hm join households h on h.id = hm.household_id where hm.user_id = $1 and hm.status = 'active' order by hm.joined_at desc limit 1",
    [userId],
  );
  return result.rows[0] ?? null;
};

export const getHouseholdSummaryForUser = async ({
  householdId,
  userId,
}: {
  householdId: number;
  userId: number;
}) => {
  const result = await pool.query<ActiveHouseholdSummary>(
    "select h.id as id, h.name as name, h.time_zone as \"timeZone\", h.icon as icon, hm.role as role from household_memberships hm join households h on h.id = hm.household_id where hm.user_id = $1 and hm.household_id = $2 and hm.status = 'active' limit 1",
    [userId, householdId],
  );
  return result.rows[0] ?? null;
};

export const getPendingHouseholdInviteByIdAndSecret = async ({
  inviteId,
  secretHash,
}: {
  inviteId: number;
  secretHash: string;
}) => {
  const result = await pool.query<HouseholdInviteRecord>(
    'select i.id as "id", i.household_id as "householdId", h.name as "householdName", i.email as "email", i.role as "role", i.invited_by_user_id as "invitedByUserId", i.created_at as "createdAt", i.expires_at as "expiresAt" from household_member_invites i join households h on h.id = i.household_id where i.id = $1 and i.accept_secret_hash = $2 and i.status = \'pending\' and i.expires_at > now() limit 1',
    [inviteId, secretHash],
  );
  return result.rows[0] ?? null;
};

export const setPendingHouseholdInviteSecretHash = async ({
  inviteId,
  secretHash,
}: {
  inviteId: number;
  secretHash: string;
}) => {
  const result = await pool.query<{ id: number }>(
    "update household_member_invites set accept_secret_hash = $1 where id = $2 and status = 'pending' and expires_at > now() returning id",
    [secretHash, inviteId],
  );

  return result.rows[0]?.id ?? null;
};

export const updateHouseholdById = async ({
  householdId,
  name,
  timeZone,
  icon,
}: {
  householdId: number;
  name: string;
  timeZone: string;
  icon: string | null;
}) => {
  const result = await pool.query<{
    id: number;
    name: string;
    timeZone: string;
    icon: string | null;
  }>(
    'update households set name = $1, time_zone = $2, icon = $3 where id = $4 returning id, name, time_zone as "timeZone", icon',
    [name.trim(), timeZone, icon, householdId],
  );
  return result.rows[0] ?? null;
};
