"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function DeleteAccountConfirmationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const identifier = searchParams.get("identifier") ?? "";
  const token = searchParams.get("token") ?? "";
  const hasToken = Boolean(identifier && token);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete your account? This action cannot be undone.",
    );
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/me/delete-confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          token,
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json") ? await response.json() : null;
      if (!data?.ok) {
        setError(data?.error ?? "Failed to delete account");
        setLoading(false);
        return;
      }

      router.push("/auth");
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to delete account";
      setError(message);
      setLoading(false);
    }
  };

  if (!hasToken) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-[var(--danger-stroke)] bg-[var(--danger-bg)] px-4 py-3 text-xs font-semibold text-[var(--danger-ink)]">
          This confirmation link is invalid.
        </div>
        <Link
          className="inline-flex w-fit rounded-full border border-[var(--stroke)] bg-[var(--card)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
          href="/user/edit"
        >
          Back to profile
        </Link>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <p className="text-sm text-[var(--muted)]">
        This action cannot be undone. If you are the last member of your household, the household
        will be deleted too.
      </p>
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
        {loading ? "Deleting..." : "Delete account"}
      </button>
    </form>
  );
}
