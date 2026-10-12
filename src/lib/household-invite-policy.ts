export const HOUSEHOLD_INVITE_EXPIRES_SECONDS = 7 * 24 * 60 * 60;

/** Match only the pending-invitation index, including errors wrapped by the auth adapter. */
export const isPendingInviteUniqueConflict = (error: unknown): boolean => {
  const visited = new Set<unknown>();
  const pending = [error];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== "object" || visited.has(value)) continue;
    visited.add(value);
    const candidate = value as {
      code?: unknown;
      constraint?: unknown;
      cause?: unknown;
      body?: unknown;
    };
    if (
      candidate.code === "23505" &&
      candidate.constraint === "household_member_invites_pending_email_unique"
    )
      return true;
    pending.push(candidate.cause, candidate.body);
  }
  return false;
};
