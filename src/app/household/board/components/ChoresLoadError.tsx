import { appDangerMessageClass } from "@/app/components/AppFormPrimitives";
import type { ChoresLoadState } from "@/app/household/board/useHouseholdChoresData.types";

export default function ChoresLoadError({
  scope,
  loadState,
  onRetry,
}: {
  scope: "week" | "today";
  loadState: ChoresLoadState;
  onRetry: () => void;
}) {
  if (!loadState.hasError) return null;
  return (
    <div
      role="alert"
      aria-label={`${scope === "week" ? "Week" : "Today"} chores load error`}
      className={appDangerMessageClass}
    >
      <p className="font-semibold">
        {scope === "week" ? "Couldn't load this week's chores." : "Couldn't load today's chores."}
      </p>
      {loadState.hasData ? (
        <p className="mt-1 text-xs leading-5">
          Showing last-known chores. They may be out of date.
        </p>
      ) : null}
      <button
        type="button"
        onClick={onRetry}
        disabled={loadState.fetching}
        className="mt-3 rounded-[var(--radius-sm)] border border-[var(--danger-stroke)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--danger-ink)] transition hover:border-[var(--danger)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--danger)] disabled:cursor-wait disabled:opacity-60"
      >
        {loadState.fetching ? "Retrying..." : scope === "week" ? "Retry week" : "Retry today"}
      </button>
    </div>
  );
}
