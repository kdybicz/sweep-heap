"use client";

import { useState } from "react";

export default function DeleteAccountForm() {
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const confirmed = window.confirm(
      "We will email you a delete confirmation link. Deleting your account cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError(null);
    setConfirmationSent(false);

    try {
      const response = await fetch("/api/me/delete-request", {
        method: "POST",
      });
      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json") ? await response.json() : null;
      if (!data?.ok) {
        setError(data?.error ?? "Failed to delete account");
        setLoading(false);
        return;
      }

      setConfirmationSent(true);
      setLoading(false);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to delete account";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {confirmationSent ? (
        <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--card)] px-4 py-3 text-xs font-semibold text-[var(--ink)]">
          Check your email for the confirmation link. This deletion cannot be undone.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-[var(--danger-stroke)] bg-[var(--danger-bg)] px-4 py-3 text-xs font-semibold text-[var(--danger-ink)]">
          {error}
        </div>
      ) : null}
      <button
        className="rounded-full border border-[var(--danger)] bg-[var(--danger)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--danger-ink)] disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={loading}
      >
        {loading ? "Sending link..." : "Delete account"}
      </button>
    </form>
  );
}
