"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { householdTimeZones } from "@/lib/time-zones";

type UserDetailsEditFormProps = {
  initialName: string;
  email: string;
  householdTimeZone: string;
};

export default function UserDetailsEditForm({
  initialName,
  email,
  householdTimeZone,
}: UserDetailsEditFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeZoneOptions = useMemo(() => {
    if (householdTimeZones.includes(householdTimeZone)) {
      return householdTimeZones;
    }
    return [householdTimeZone, ...householdTimeZones];
  }, [householdTimeZone]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json") ? await response.json() : null;
      if (!data?.ok) {
        setError(data?.error ?? "Failed to update user details");
        setLoading(false);
        return;
      }

      router.push("/household");
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to update user details";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        Name
        <input
          className="rounded-xl border border-[var(--stroke)] bg-[var(--card)] px-4 py-3 text-sm font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>

      <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        Email
        <input
          className="rounded-xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--ink)] opacity-90"
          type="email"
          value={email}
          readOnly
          placeholder="No email available"
        />
      </label>

      <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        Household time zone
        <select
          className="rounded-xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--ink)] opacity-90 disabled:cursor-not-allowed"
          value={householdTimeZone}
          disabled
        >
          {timeZoneOptions.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
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
          disabled={loading}
        >
          {loading ? "Saving..." : "Save profile"}
        </button>
        <Link
          className="rounded-full border border-[var(--stroke)] bg-[var(--card)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
          href="/household"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
