import { pool } from "@/lib/db";

const deleteAccountTokenPrefix = "delete-account";

type BlockedOwnedHousehold = {
  householdId: number;
  householdName: string;
  otherActiveMemberCount: number;
};

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

export type DeleteUserByIdResult =
  | {
      ok: true;
      deletedHouseholdIds: number[];
      id: number;
    }
  | {
      ok: false;
      reason: "invalid-token";
    }
  | {
      ok: false;
      reason: "not-found";
    }
  | {
      ok: false;
      reason: "ownership-conflict";
      blockingHouseholds: BlockedOwnedHousehold[];
    };

export const deleteUserById = async ({
  deleteAccountToken,
  userId,
}: {
  deleteAccountToken?: {
    identifier: string;
    tokenHash: string;
  };
  userId: number;
}) => {
  const client = await pool.connect();
  try {
    await client.query("begin");

    if (deleteAccountToken) {
      const deleteTokenResult = await client.query<{ identifier: string }>(
        "delete from delete_account_tokens where identifier = $1 and token_hash = $2 and expires_at > now() returning identifier",
        [deleteAccountToken.identifier, deleteAccountToken.tokenHash],
      );
      if (!deleteTokenResult.rows[0]) {
        await client.query("rollback");
        return {
          ok: false as const,
          reason: "invalid-token" as const,
        };
      }
    }

    const ownedHouseholdIdsResult = await client.query<{ householdId: number }>(
      "select distinct household_id as \"householdId\" from household_memberships where user_id = $1 and status = 'active' and role = 'owner' order by household_id asc",
      [userId],
    );
    for (const row of ownedHouseholdIdsResult.rows) {
      await client.query("select pg_advisory_xact_lock($1)", [row.householdId]);
    }

    const blockingHouseholdsResult = await client.query<BlockedOwnedHousehold>(
      "select h.id as \"householdId\", h.name as \"householdName\", count(other_members.user_id)::int as \"otherActiveMemberCount\" from household_memberships owner_membership join households h on h.id = owner_membership.household_id left join household_memberships other_members on other_members.household_id = h.id and other_members.status = 'active' and other_members.user_id <> $1 where owner_membership.user_id = $1 and owner_membership.status = 'active' and owner_membership.role = 'owner' group by h.id, h.name having count(other_members.user_id) > 0 order by h.id asc",
      [userId],
    );
    if (blockingHouseholdsResult.rows.length > 0) {
      await client.query("rollback");
      return {
        ok: false as const,
        reason: "ownership-conflict" as const,
        blockingHouseholds: blockingHouseholdsResult.rows,
      };
    }

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
      return {
        ok: false as const,
        reason: "not-found" as const,
      };
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
      ok: true as const,
      id: deletedUser.id,
      deletedHouseholdIds,
    } satisfies DeleteUserByIdResult;
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

export const isDeleteAccountTokenValid = async ({
  identifier,
  tokenHash,
}: {
  identifier: string;
  tokenHash: string;
}) => {
  const result = await pool.query(
    "select 1 from delete_account_tokens where identifier = $1 and token_hash = $2 and expires_at > now()",
    [identifier, tokenHash],
  );
  return (result.rowCount ?? 0) > 0;
};
