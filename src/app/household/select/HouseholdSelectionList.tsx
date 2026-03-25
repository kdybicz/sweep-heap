"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AppFormSection,
  appDangerMessageClass,
  appInfoMessageClass,
} from "@/app/components/AppFormPrimitives";
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
      <AppFormSection
        description="Pick the household you want to work in now. Your choice becomes the active household for this session."
        title="Available households"
      >
        <div className="grid gap-3">
          {households.map((household) => {
            const isLoading = activeHouseholdId === household.id;

            return (
              <button
                key={household.id}
                className="flex w-full items-center justify-between rounded-[1.4rem] border border-[var(--stroke-soft)] bg-[var(--surface)] px-5 py-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--surface-weak)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={activeHouseholdId !== null}
                onClick={() => handleSelect(household.id)}
                type="button"
              >
                <span className="flex min-w-0 items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-[1rem] border border-[var(--stroke-soft)] bg-[var(--surface-weak)] text-xl">
                    {household.icon?.trim() || "H"}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm font-semibold text-[var(--ink)]">
                      {household.name.trim() || "Untitled household"}
                    </span>
                    <span className="flex flex-wrap gap-2 text-[0.7rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                      <span>{household.role}</span>
                      <span aria-hidden="true">-</span>
                      <span>{household.timeZone}</span>
                    </span>
                  </span>
                </span>
                <span className="rounded-full border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                  {isLoading ? "Switching..." : "Open"}
                </span>
              </button>
            );
          })}
        </div>
      </AppFormSection>

      {activeHouseholdId !== null && !error ? (
        <div className={appInfoMessageClass}>Updating your active household...</div>
      ) : null}

      {error ? <div className={appDangerMessageClass}>{error}</div> : null}
    </section>
  );
}
