"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HouseholdInviteAcceptanceForm({
  householdName,
  identifier,
  initialError,
  token,
}: {
  householdName: string;
  identifier: string;
  initialError: string | null;
  token: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/households/invites/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          token,
        }),
      });

      const data = await response.json();
      if (!data?.ok) {
        setError(data?.error ?? "Failed to accept invite");
        setLoading(false);
        return;
      }

      if (typeof data.redirectUrl === "string" && data.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }

      router.push("/household");
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to accept invite";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <p className="text-sm text-[var(--muted)]">
        Join <span className="font-semibold text-[var(--ink)]">{householdName}</span> using this
        invite.
      </p>

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
        {loading ? "Accepting..." : "Accept invite"}
      </button>
    </form>
  );
}
