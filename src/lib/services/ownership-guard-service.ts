import { pool } from "@/lib/db";
import {
  countActiveHouseholdMembersExcludingUser,
  listOwnedHouseholdsWithOtherMembers,
} from "@/lib/repositories";

export const listAccountDeletionBlockingHouseholds = async (userId: number) =>
  listOwnedHouseholdsWithOtherMembers(userId);

export const householdHasOtherActiveMembers = async ({
  householdId,
  userId,
}: {
  householdId: number;
  userId: number;
}) => {
  const count = await countActiveHouseholdMembersExcludingUser({
    excludedUserId: userId,
    householdId,
  });
  return count > 0;
};

export const withHouseholdMutationLock = async <T>({
  householdId,
  task,
}: {
  householdId: number;
  task: () => Promise<T>;
}) => {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [householdId]);
    return await task();
  } finally {
    try {
      await client.query("select pg_advisory_unlock($1)", [householdId]);
    } finally {
      client.release();
    }
  }
};
