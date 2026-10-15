/** Canonical notes value used by persistence and preview save reconciliation. */
export const normalizeChoreNotes = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
};
