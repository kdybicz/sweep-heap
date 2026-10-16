/** Normalize submitted notes once: trim before applying storage's 500-character cap. */
export const normalizeChoreNotes = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
};
