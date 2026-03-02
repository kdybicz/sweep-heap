import { pool } from "@/lib/db";

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

export const createHouseholdWithOwner = async ({
  userId,
  name,
  timeZone,
  icon,
}: {
  userId: number;
  name: string;
  timeZone: string;
  icon: string | null;
}) => {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const householdResult = await client.query(
      "insert into households (name, time_zone, icon) values ($1, $2, $3) returning id",
      [name.trim(), timeZone, icon],
    );
    const householdId = householdResult.rows[0]?.id as number | undefined;
    if (!householdId) {
      throw new Error("Failed to create household");
    }
    await client.query(
      "insert into household_memberships (household_id, user_id, role) values ($1, $2, $3)",
      [householdId, userId, "admin"],
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
