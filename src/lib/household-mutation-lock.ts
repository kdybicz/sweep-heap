import { householdLockPool } from "@/lib/db";
import { HouseholdMutationBusyError } from "@/lib/household-mutation-error";

export const withHouseholdMutationLock = async <T>({
  householdId,
  task,
}: {
  householdId: number;
  task: () => Promise<T>;
}): Promise<T> => {
  const client = await householdLockPool.connect();
  let connectionError: Error | undefined;
  const onError = (error: Error) => {
    connectionError = error;
  };
  client.on("error", onError);
  try {
    await client.query("begin");
    await client.query("set local lock_timeout = '5s'");
    try {
      await client.query("select pg_advisory_xact_lock($1)", [householdId]);
    } catch (error) {
      if ((error as { code?: string }).code === "55P03") throw new HouseholdMutationBusyError();
      throw error;
    }
    if (connectionError) throw connectionError;
    const result = await task();
    if (connectionError) throw connectionError;
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch (rollbackError) {
      connectionError =
        rollbackError instanceof Error ? rollbackError : new Error("Lock rollback failed");
    }
    throw error;
  } finally {
    client.removeListener("error", onError);
    client.release(connectionError);
  }
};
