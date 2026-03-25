"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AppFormField,
  AppFormSection,
  appDangerMessageClass,
  appInputClass,
  appPrimaryButtonClass,
  appToggleCardClass,
} from "@/app/components/AppFormPrimitives";
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
      <AppFormSection
        description="Name the household, pick a simple icon, and confirm the time zone the weekly board should follow."
        title="Household details"
      >
        <AppFormField
          description="Use the name people will recognize in menus and invite emails."
          htmlFor="household-setup-name"
          label="Household name"
        >
          <input
            className={appInputClass}
            id="household-setup-name"
            onChange={(event) => setName(event.target.value)}
            placeholder="The Sweep Heap"
            required
            type="text"
            value={name}
          />
        </AppFormField>

        <HouseholdIconPicker onChange={setIcon} value={icon} />

        <AppFormField
          description="We use this time zone for weekly grouping, today status, and recurring chores."
          htmlFor="household-setup-time-zone"
          label="Time zone"
        >
          <select
            className={appInputClass}
            id="household-setup-time-zone"
            onChange={(event) => setTimeZone(event.target.value)}
            value={timeZone}
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
        </AppFormField>
      </AppFormSection>

      <AppFormSection
        description="Choose how much control regular members have over chore management."
        title="Permissions"
      >
        <label className={appToggleCardClass}>
          <input
            checked={membersCanManageChores}
            className="mt-1 h-4 w-4 rounded border-[var(--stroke)] text-[var(--accent)] focus:ring-[var(--accent)]"
            onChange={(event) => setMembersCanManageChores(event.target.checked)}
            type="checkbox"
          />
          <span className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-[var(--ink)]">
              Allow regular members to add, edit, and delete chores
            </span>
            <span className="text-sm leading-6 text-[var(--muted)]">
              Owners and admins can always manage chores, even when this is turned off.
            </span>
          </span>
        </label>
      </AppFormSection>

      {error ? <div className={appDangerMessageClass}>{error}</div> : null}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button className={appPrimaryButtonClass} disabled={loading} type="submit">
          {loading ? "Creating..." : "Create household"}
        </button>
      </div>
    </form>
  );
}
