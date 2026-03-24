"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import HouseholdIconPicker from "@/app/household/components/HouseholdIconPicker";
import { householdTimeZones } from "@/lib/time-zones";

const getDefaultTimeZone = () => {
  if (typeof Intl === "undefined" || !Intl.DateTimeFormat) {
    return "UTC";
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
};

export default function HouseholdSetupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [membersCanManageChores, setMembersCanManageChores] = useState(true);
  const suggestedTimeZone = useMemo(() => getDefaultTimeZone(), []);
  const [timeZone, setTimeZone] = useState(suggestedTimeZone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/households", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          timeZone,
          icon,
          membersCanManageChores,
        }),
      });
      const data = await response.json();
      if (!data?.ok) {
        setError(data?.error ?? "Failed to create household");
        setLoading(false);
        return;
      }
      router.push("/household");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to create";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        Household name
        <input
          className="rounded-xl border border-[var(--stroke)] bg-[var(--card)] px-4 py-3 text-sm font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="The Sweep Heap"
          required
        />
      </label>
      <HouseholdIconPicker onChange={setIcon} value={icon} />
      <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        Time zone
        <select
          className="rounded-xl border border-[var(--stroke)] bg-[var(--card)] px-4 py-3 text-sm font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
          value={timeZone}
          onChange={(event) => setTimeZone(event.target.value)}
        >
          <option value={suggestedTimeZone}>Suggested ({suggestedTimeZone})</option>
          {householdTimeZones
            .filter((zone) => zone !== suggestedTimeZone)
            .map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
        </select>
      </label>
      <label className="flex items-start gap-3 rounded-2xl border border-[var(--stroke)] bg-[var(--card)] px-4 py-4 text-left">
        <input
          checked={membersCanManageChores}
          className="mt-1 h-4 w-4 rounded border-[var(--stroke)] text-[var(--accent)] focus:ring-[var(--accent)]"
          onChange={(event) => setMembersCanManageChores(event.target.checked)}
          type="checkbox"
        />
        <span className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Chore editing permissions
          </span>
          <span className="text-sm font-semibold text-[var(--ink)]">
            Allow regular members to add, edit, and delete chores
          </span>
          <span className="text-sm text-[var(--muted)]">
            Owners and admins can always manage chores, even when this is turned off.
          </span>
        </span>
      </label>
      {error ? (
        <div className="rounded-2xl border border-[var(--danger-stroke)] bg-[var(--danger-bg)] px-4 py-3 text-xs font-semibold text-[var(--danger-ink)]">
          {error}
        </div>
      ) : null}
      <button
        className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={loading}
      >
        {loading ? "Creating..." : "Create household"}
      </button>
    </form>
  );
}
