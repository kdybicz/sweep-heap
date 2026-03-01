"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const getDefaultTimeZone = () => {
  if (typeof Intl === "undefined" || !Intl.DateTimeFormat) {
    return "UTC";
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
};

const timeZones = [
  "UTC",
  "Europe/London",
  "Europe/Warsaw",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Singapore",
  "Australia/Sydney",
];

export default function HouseholdSetupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
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
        }),
      });
      const data = await response.json();
      if (!data?.ok) {
        setError(data?.error ?? "Failed to create household");
        setLoading(false);
        return;
      }
      router.push("/heap");
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
      <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        Time zone
        <select
          className="rounded-xl border border-[var(--stroke)] bg-[var(--card)] px-4 py-3 text-sm font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
          value={timeZone}
          onChange={(event) => setTimeZone(event.target.value)}
        >
          <option value={suggestedTimeZone}>Suggested ({suggestedTimeZone})</option>
          {timeZones
            .filter((zone) => zone !== suggestedTimeZone)
            .map((zone) => (
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
