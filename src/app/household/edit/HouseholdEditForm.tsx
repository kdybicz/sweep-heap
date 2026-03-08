"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import HouseholdIconPicker from "@/app/household/components/HouseholdIconPicker";
import { householdTimeZones } from "@/lib/time-zones";

type HouseholdEditFormProps = {
  canDeleteHousehold: boolean;
  initialName: string;
  initialIcon: string;
  initialTimeZone: string;
};

export default function HouseholdEditForm({
  canDeleteHousehold,
  initialName,
  initialIcon,
  initialTimeZone,
}: HouseholdEditFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);
  const [timeZone, setTimeZone] = useState(initialTimeZone);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/households", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          icon,
          timeZone,
        }),
      });
      const data = await response.json();
      if (!data?.ok) {
        setError(data?.error ?? "Failed to update household");
        setLoading(false);
        return;
      }
      router.push("/household");
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to update household";
      setError(message);
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Delete this household permanently? This only works when no other active members remain.",
    );
    if (!confirmed) {
      return;
    }

    setDeleteLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/households", {
        method: "DELETE",
      });
      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json") ? await response.json() : null;
      if (!data?.ok) {
        setError(data?.error ?? "Failed to delete household");
        setDeleteLoading(false);
        return;
      }

      router.push(typeof data.nextPath === "string" ? data.nextPath : "/household/setup");
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to delete household";
      setError(message);
      setDeleteLoading(false);
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
          required
        />
      </label>

      <HouseholdIconPicker onChange={setIcon} showEmptyIconPreview={false} value={icon} />

      <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        Time zone
        <select
          className="rounded-xl border border-[var(--stroke)] bg-[var(--card)] px-4 py-3 text-sm font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
          value={timeZone}
          onChange={(event) => setTimeZone(event.target.value)}
        >
          {householdTimeZones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
          {householdTimeZones.includes(timeZone) ? null : (
            <option value={timeZone}>{timeZone}</option>
          )}
        </select>
      </label>

      {error ? (
        <div className="rounded-2xl border border-[var(--danger-stroke)] bg-[var(--danger-bg)] px-4 py-3 text-xs font-semibold text-[var(--danger-ink)]">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={loading || deleteLoading}
        >
          {loading ? "Saving..." : "Save household"}
        </button>
        <Link
          className="rounded-full border border-[var(--stroke)] bg-[var(--card)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
          href="/household"
        >
          Cancel
        </Link>
        {canDeleteHousehold ? (
          <button
            className="rounded-full border border-[var(--danger)] bg-[var(--danger)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--danger-ink)] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={handleDelete}
            disabled={loading || deleteLoading}
          >
            {deleteLoading ? "Deleting..." : "Delete household"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
