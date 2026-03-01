import { pool } from "@/lib/db";

type MembershipSummary = {
  householdId: number;
  role: string;
  status: string;
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
}: {
  userId: number;
  name: string;
  timeZone: string;
}) => {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const householdResult = await client.query(
      "insert into households (name, time_zone) values ($1, $2) returning id",
      [name.trim(), timeZone],
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
