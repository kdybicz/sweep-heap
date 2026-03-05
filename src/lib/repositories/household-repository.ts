import type { PoolClient } from "pg";
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

export type HouseholdMemberRole = "admin" | "member";

export type HouseholdMemberRecord = {
  userId: number;
  name: string | null;
  email: string;
  role: HouseholdMemberRole;
  joinedAt: Date;
};

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

export type CreateHouseholdInviteResult =
  | {
      status: "invited";
      invite: HouseholdInviteRecord;
    }
  | {
      status: "already_invited";
      invite: HouseholdInviteRecord;
    }
  | {
      status: "already_member";
    }
  | {
      status: "belongs_to_other_household";
    };

export type AcceptHouseholdInviteResult =
  | {
      status: "accepted";
      householdId: number;
      householdName: string;
      wasAlreadyMember: boolean;
    }
  | {
      status: "invalid_or_expired";
    }
  | {
      status: "email_mismatch";
      inviteEmail: string;
    }
  | {
      status: "belongs_to_other_household";
    };

export type UpdateHouseholdMemberRoleWithGuardResult =
  | {
      status: "updated";
      member: HouseholdMemberRecord;
    }
  | {
      status: "member_not_found";
    }
  | {
      status: "last_admin";
    };

export type RemoveHouseholdMemberWithGuardResult =
  | {
      status: "removed";
      userId: number;
    }
  | {
      status: "member_not_found";
    }
  | {
      status: "last_admin";
    };

type ActiveMembershipLockRow = {
  userId: number;
  role: HouseholdMemberRole;
};

const lockActiveHouseholdMemberships = async ({
  client,
  householdId,
}: {
  client: PoolClient;
  householdId: number;
}) => {
  const result = await client.query<ActiveMembershipLockRow>(
    "select user_id as \"userId\", role as role from household_memberships where household_id = $1 and status = 'active' order by user_id for update",
    [householdId],
  );
  return result.rows;
};

const countLockedAdmins = (memberships: ActiveMembershipLockRow[]) =>
  memberships.reduce((count, membership) => count + (membership.role === "admin" ? 1 : 0), 0);

type PgErrorLike = {
  code?: string;
  constraint?: string;
};

const pendingInviteUniqueIndex = "household_member_invites_pending_email_unique";

const isUniqueViolationForConstraint = (error: unknown, constraint: string) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const pgError = error as PgErrorLike;
  return pgError.code === "23505" && pgError.constraint === constraint;
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

export const listActiveHouseholdMembers = async (householdId: number) => {
  const result = await pool.query<HouseholdMemberRecord>(
    "select hm.user_id as \"userId\", u.name as name, u.email as email, hm.role as role, hm.joined_at as \"joinedAt\" from household_memberships hm join users u on u.id = hm.user_id where hm.household_id = $1 and hm.status = 'active' order by lower(coalesce(u.name, '')), lower(u.email)",
    [householdId],
  );
  return result.rows;
};

export const listPendingHouseholdInvites = async (householdId: number) => {
  const result = await pool.query<HouseholdInviteRecord>(
    'select i.id as id, i.household_id as "householdId", h.name as "householdName", i.email as email, i.role as role, i.invited_by_user_id as "invitedByUserId", i.created_at as "createdAt", i.expires_at as "expiresAt" from household_member_invites i join households h on h.id = i.household_id where i.household_id = $1 and i.accepted_at is null and i.expires_at > now() order by i.created_at desc',
    [householdId],
  );
  return result.rows;
};

export const createHouseholdMemberInvite = async ({
  email,
  expiresAt,
  householdId,
  identifier,
  invitedByUserId,
  role,
  tokenHash,
}: {
  email: string;
  expiresAt: Date;
  householdId: number;
  identifier: string;
  invitedByUserId: number;
  role: HouseholdMemberRole;
  tokenHash: string;
}): Promise<CreateHouseholdInviteResult> => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  const client = await pool.connect();

  try {
    await client.query("begin");

    const userResult = await client.query<{ id: number }>(
      "select id from users where lower(email) = lower($1) limit 1",
      [normalizedEmail],
    );
    const invitedUserId = userResult.rows[0]?.id;

    if (invitedUserId) {
      const activeMembershipResult = await client.query<{ householdId: number }>(
        "select household_id as \"householdId\" from household_memberships where user_id = $1 and status = 'active' order by joined_at desc limit 1",
        [invitedUserId],
      );

      const activeHouseholdId = activeMembershipResult.rows[0]?.householdId ?? null;
      if (activeHouseholdId === householdId) {
        await client.query("commit");
        return {
          status: "already_member",
        };
      }

      if (activeHouseholdId !== null && activeHouseholdId !== householdId) {
        await client.query("commit");
        return {
          status: "belongs_to_other_household",
        };
      }
    }

    const deleteExpiredPendingInvites = async () => {
      await client.query(
        "delete from household_member_invites where household_id = $1 and lower(email) = lower($2) and accepted_at is null and expires_at <= now()",
        [householdId, normalizedEmail],
      );
    };

    const selectPendingInvite = async () => {
      const pendingInviteResult = await client.query<HouseholdInviteRecord>(
        'select i.id as id, i.household_id as "householdId", h.name as "householdName", i.email as email, i.role as role, i.invited_by_user_id as "invitedByUserId", i.created_at as "createdAt", i.expires_at as "expiresAt" from household_member_invites i join households h on h.id = i.household_id where i.household_id = $1 and lower(i.email) = lower($2) and i.accepted_at is null and i.expires_at > now() order by i.created_at desc limit 1',
        [householdId, normalizedEmail],
      );
      return pendingInviteResult.rows[0] ?? null;
    };

    const insertPendingInvite = async () => {
      await client.query(
        "insert into household_member_invites (household_id, invited_by_user_id, email, role, identifier, token_hash, expires_at) values ($1, $2, $3, $4, $5, $6, $7)",
        [householdId, invitedByUserId, normalizedEmail, role, identifier, tokenHash, expiresAt],
      );
    };

    await deleteExpiredPendingInvites();

    const existingInvite = await selectPendingInvite();
    if (existingInvite) {
      await client.query("commit");
      return {
        status: "already_invited",
        invite: existingInvite,
      };
    }

    await client.query("savepoint pending_invite_insert");

    try {
      await insertPendingInvite();
    } catch (error) {
      if (!isUniqueViolationForConstraint(error, pendingInviteUniqueIndex)) {
        throw error;
      }

      await client.query("rollback to savepoint pending_invite_insert");

      await deleteExpiredPendingInvites();

      const pendingInvite = await selectPendingInvite();
      if (pendingInvite) {
        await client.query("commit");
        return {
          status: "already_invited",
          invite: pendingInvite,
        };
      }

      await client.query("savepoint pending_invite_insert");

      try {
        await insertPendingInvite();
      } catch (retryError) {
        if (!isUniqueViolationForConstraint(retryError, pendingInviteUniqueIndex)) {
          throw retryError;
        }

        await client.query("rollback to savepoint pending_invite_insert");

        const retryPendingInvite = await selectPendingInvite();
        if (!retryPendingInvite) {
          throw retryError;
        }

        await client.query("commit");
        return {
          status: "already_invited",
          invite: retryPendingInvite,
        };
      }
    }

    const inviteResult = await client.query<HouseholdInviteRecord>(
      'select i.id as id, i.household_id as "householdId", h.name as "householdName", i.email as email, i.role as role, i.invited_by_user_id as "invitedByUserId", i.created_at as "createdAt", i.expires_at as "expiresAt" from household_member_invites i join households h on h.id = i.household_id where i.household_id = $1 and i.identifier = $2 limit 1',
      [householdId, identifier],
    );
    const invite = inviteResult.rows[0];
    if (!invite) {
      throw new Error("Failed to create household invite");
    }

    await client.query("commit");
    return {
      status: "invited",
      invite,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const resendPendingHouseholdInvite = async ({
  expiresAt,
  householdId,
  identifier,
  inviteId,
  invitedByUserId,
  tokenHash,
}: {
  expiresAt: Date;
  householdId: number;
  identifier: string;
  inviteId: number;
  invitedByUserId: number;
  tokenHash: string;
}) => {
  const result = await pool.query<HouseholdInviteRecord>(
    'with updated as (update household_member_invites set identifier = $1, token_hash = $2, expires_at = $3, invited_by_user_id = $4 where id = $5 and household_id = $6 and accepted_at is null and expires_at > now() returning id, household_id, email, role, invited_by_user_id, created_at, expires_at) select updated.id as id, updated.household_id as "householdId", h.name as "householdName", updated.email as email, updated.role as role, updated.invited_by_user_id as "invitedByUserId", updated.created_at as "createdAt", updated.expires_at as "expiresAt" from updated join households h on h.id = updated.household_id',
    [identifier, tokenHash, expiresAt, invitedByUserId, inviteId, householdId],
  );
  return result.rows[0] ?? null;
};

export const revokePendingHouseholdInvite = async ({
  householdId,
  inviteId,
}: {
  householdId: number;
  inviteId: number;
}) => {
  const result = await pool.query<{ id: number }>(
    "delete from household_member_invites where id = $1 and household_id = $2 and accepted_at is null and expires_at > now() returning id",
    [inviteId, householdId],
  );
  return result.rows[0]?.id ?? null;
};

export const getValidHouseholdInvite = async ({
  identifier,
  tokenHash,
}: {
  identifier: string;
  tokenHash: string;
}) => {
  const result = await pool.query<HouseholdInviteRecord>(
    'select i.id as id, i.household_id as "householdId", h.name as "householdName", i.email as email, i.role as role, i.invited_by_user_id as "invitedByUserId", i.created_at as "createdAt", i.expires_at as "expiresAt" from household_member_invites i join households h on h.id = i.household_id where i.identifier = $1 and i.token_hash = $2 and i.accepted_at is null and i.expires_at > now() limit 1',
    [identifier, tokenHash],
  );
  return result.rows[0] ?? null;
};

export const acceptHouseholdInvite = async ({
  email,
  identifier,
  tokenHash,
  userId,
}: {
  email: string;
  identifier: string;
  tokenHash: string;
  userId: number;
}): Promise<AcceptHouseholdInviteResult> => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  const client = await pool.connect();

  try {
    await client.query("begin");

    const inviteResult = await client.query<
      HouseholdInviteRecord & {
        id: number;
      }
    >(
      'select i.id as id, i.household_id as "householdId", h.name as "householdName", lower(i.email) as email, i.role as role, i.invited_by_user_id as "invitedByUserId", i.created_at as "createdAt", i.expires_at as "expiresAt" from household_member_invites i join households h on h.id = i.household_id where i.identifier = $1 and i.token_hash = $2 and i.accepted_at is null and i.expires_at > now() limit 1 for update',
      [identifier, tokenHash],
    );
    const invite = inviteResult.rows[0];
    if (!invite) {
      await client.query("rollback");
      return {
        status: "invalid_or_expired",
      };
    }

    if (invite.email !== normalizedEmail) {
      await client.query("rollback");
      return {
        status: "email_mismatch",
        inviteEmail: invite.email,
      };
    }

    const activeMembershipResult = await client.query<{ householdId: number }>(
      "select household_id as \"householdId\" from household_memberships where user_id = $1 and status = 'active' order by joined_at desc limit 1",
      [userId],
    );
    const activeHouseholdId = activeMembershipResult.rows[0]?.householdId ?? null;

    if (activeHouseholdId !== null && activeHouseholdId !== invite.householdId) {
      await client.query("rollback");
      return {
        status: "belongs_to_other_household",
      };
    }

    const wasAlreadyMember = activeHouseholdId === invite.householdId;
    if (!wasAlreadyMember) {
      await client.query(
        "insert into household_memberships (household_id, user_id, role, status, joined_at) values ($1, $2, $3, 'active', now()) on conflict (household_id, user_id) do update set role = excluded.role, status = 'active', joined_at = now()",
        [invite.householdId, userId, invite.role],
      );
    }

    await client.query(
      "update household_member_invites set accepted_at = now(), accepted_by_user_id = $1 where id = $2",
      [userId, invite.id],
    );

    await client.query("commit");
    return {
      status: "accepted",
      householdId: invite.householdId,
      householdName: invite.householdName,
      wasAlreadyMember,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const updateActiveHouseholdMemberRoleWithGuard = async ({
  householdId,
  userId,
  role,
}: {
  householdId: number;
  userId: number;
  role: HouseholdMemberRole;
}): Promise<UpdateHouseholdMemberRoleWithGuardResult> => {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const memberships = await lockActiveHouseholdMemberships({
      client,
      householdId,
    });
    const targetMember = memberships.find((membership) => membership.userId === userId);
    if (!targetMember) {
      await client.query("rollback");
      return {
        status: "member_not_found",
      };
    }

    if (targetMember.role === "admin" && role !== "admin" && countLockedAdmins(memberships) <= 1) {
      await client.query("rollback");
      return {
        status: "last_admin",
      };
    }

    const result = await client.query<HouseholdMemberRecord>(
      'with updated as (update household_memberships set role = $1 where household_id = $2 and user_id = $3 and status = \'active\' returning user_id, role, joined_at) select updated.user_id as "userId", u.name as name, u.email as email, updated.role as role, updated.joined_at as "joinedAt" from updated join users u on u.id = updated.user_id',
      [role, householdId, userId],
    );

    const updatedMember = result.rows[0] ?? null;
    if (!updatedMember) {
      await client.query("rollback");
      return {
        status: "member_not_found",
      };
    }

    await client.query("commit");
    return {
      status: "updated",
      member: updatedMember,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const removeActiveHouseholdMemberWithGuard = async ({
  householdId,
  userId,
}: {
  householdId: number;
  userId: number;
}): Promise<RemoveHouseholdMemberWithGuardResult> => {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const memberships = await lockActiveHouseholdMemberships({
      client,
      householdId,
    });
    const targetMember = memberships.find((membership) => membership.userId === userId);
    if (!targetMember) {
      await client.query("rollback");
      return {
        status: "member_not_found",
      };
    }

    if (targetMember.role === "admin" && countLockedAdmins(memberships) <= 1) {
      await client.query("rollback");
      return {
        status: "last_admin",
      };
    }

    const result = await client.query<{ userId: number }>(
      "delete from household_memberships where household_id = $1 and user_id = $2 and status = 'active' returning user_id as \"userId\"",
      [householdId, userId],
    );
    const removedUserId = result.rows[0]?.userId ?? null;
    if (!removedUserId) {
      await client.query("rollback");
      return {
        status: "member_not_found",
      };
    }

    await client.query("commit");
    return {
      status: "removed",
      userId: removedUserId,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
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
