"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  readApiJsonResponse,
  recoverFromHouseholdContextError,
} from "@/app/household/household-context-client";

type HouseholdOption = {
  id: number;
  icon: string | null;
  name: string;
  role: string;
  timeZone: string;
};

export default function HouseholdSelectionList({ households }: { households: HouseholdOption[] }) {
  const router = useRouter();
  const [activeHouseholdId, setActiveHouseholdId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (householdId: number) => {
    setActiveHouseholdId(householdId);
    setError(null);

    try {
      const response = await fetch("/api/households/active", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ householdId }),
      });
      const data = await readApiJsonResponse<{ ok?: boolean; error?: string; code?: string }>(
        response,
      );
      if (recoverFromHouseholdContextError(data)) {
        setActiveHouseholdId(null);
        return;
      }
      if (!response.ok || !data?.ok) {
        setError(data?.error ?? "Failed to switch household");
        setActiveHouseholdId(null);
        return;
      }

      router.push("/household");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to switch household");
      setActiveHouseholdId(null);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="grid gap-3">
        {households.map((household) => {
          const isLoading = activeHouseholdId === household.id;

          return (
            <button
              key={household.id}
              className="flex w-full items-center justify-between rounded-2xl border border-[var(--stroke)] bg-[var(--card)] px-5 py-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={activeHouseholdId !== null}
              onClick={() => handleSelect(household.id)}
              type="button"
            >
              <span className="flex min-w-0 items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-strong)] text-xl">
                  {household.icon?.trim() || "H"}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-[var(--ink)]">
                    {household.name.trim() || "Untitled household"}
                  </span>
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {household.role} · {household.timeZone}
                  </span>
                </span>
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                {isLoading ? "Switching..." : "Open"}
              </span>
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-2xl border border-[var(--danger-stroke)] bg-[var(--danger-bg)] px-4 py-3 text-xs font-semibold text-[var(--danger-ink)]">
          {error}
        </div>
      ) : null}
    </section>
  );
}
