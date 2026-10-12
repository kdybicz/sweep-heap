export { withHouseholdMutationLock } from "@/lib/household-mutation-lock";

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
