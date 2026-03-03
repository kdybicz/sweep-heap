import { pool } from "@/lib/db";

const deleteAccountTokenPrefix = "delete-account";

export const buildDeleteAccountTokenIdentifier = ({
  userId,
  nonce,
}: {
  userId: number;
  nonce: string;
}) => `${deleteAccountTokenPrefix}:${userId}:${nonce}`;

export const extractUserIdFromDeleteAccountTokenIdentifier = (identifier: string) => {
  const match = /^delete-account:(\d+):[A-Za-z0-9_-]+$/.exec(identifier);
  if (!match) {
    return null;
  }

  const userId = Number(match[1]);
  if (!Number.isFinite(userId)) {
    return null;
  }

  return userId;
};

export const updateUserNameById = async ({ userId, name }: { userId: number; name: string }) => {
  const result = await pool.query<{
    id: number;
    name: string | null;
    email: string | null;
  }>("update users set name = $1 where id = $2 returning id, name, email", [name.trim(), userId]);
  return result.rows[0] ?? null;
};

export const deleteUserById = async ({ userId }: { userId: number }) => {
  const client = await pool.connect();
  try {
    await client.query("begin");

    const membershipResult = await client.query<{ householdId: number }>(
      "select distinct household_id as \"householdId\" from household_memberships where user_id = $1 and status = 'active'",
      [userId],
    );
    const householdIds = membershipResult.rows.map((row) => row.householdId);

    const userResult = await client.query<{ id: number }>(
      "delete from users where id = $1 returning id",
      [userId],
    );
    const deletedUser = userResult.rows[0];
    if (!deletedUser) {
      await client.query("rollback");
      return null;
    }

    const deletedHouseholdIds: number[] = [];
    if (householdIds.length > 0) {
      const deletedHouseholdsResult = await client.query<{ id: number }>(
        "delete from households where id = any($1::int[]) and not exists (select 1 from household_memberships where household_memberships.household_id = households.id and household_memberships.status = 'active') returning id",
        [householdIds],
      );
      deletedHouseholdIds.push(...deletedHouseholdsResult.rows.map((row) => row.id));
    }

    await client.query("commit");
    return {
      id: deletedUser.id,
      deletedHouseholdIds,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const createDeleteAccountToken = async ({
  userId,
  identifier,
  tokenHash,
  expiresAt,
}: {
  userId: number;
  identifier: string;
  tokenHash: string;
  expiresAt: Date;
}) => {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [userId]);
    await client.query("delete from delete_account_tokens where user_id = $1", [userId]);
    await client.query(
      "insert into delete_account_tokens (user_id, identifier, token_hash, expires_at) values ($1, $2, $3, $4)",
      [userId, identifier, tokenHash, expiresAt],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const consumeDeleteAccountToken = async ({
  identifier,
  tokenHash,
}: {
  identifier: string;
  tokenHash: string;
}) => {
  const result = await pool.query<{ identifier: string }>(
    "delete from delete_account_tokens where identifier = $1 and token_hash = $2 and expires_at > now() returning identifier",
    [identifier, tokenHash],
  );
  return result.rows[0]?.identifier ?? null;
};
