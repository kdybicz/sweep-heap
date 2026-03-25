"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AppFormField,
  AppFormSection,
  appDangerButtonClass,
  appDangerMessageClass,
  appInputClass,
  appPrimaryButtonClass,
  appSecondaryButtonClass,
  appToggleCardClass,
} from "@/app/components/AppFormPrimitives";
import HouseholdIconPicker from "@/app/household/components/HouseholdIconPicker";
import {
  readApiJsonResponse,
  recoverFromHouseholdContextError,
} from "@/app/household/household-context-client";
import { householdTimeZones } from "@/lib/time-zones";

type HouseholdEditFormProps = {
  canDeleteHousehold: boolean;
  initialName: string;
  initialIcon: string;
  initialTimeZone: string;
  initialMembersCanManageChores: boolean;
};

export default function HouseholdEditForm({
  canDeleteHousehold,
  initialName,
  initialIcon,
  initialMembersCanManageChores,
  initialTimeZone,
}: HouseholdEditFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);
  const [timeZone, setTimeZone] = useState(initialTimeZone);
  const [membersCanManageChores, setMembersCanManageChores] = useState(
    initialMembersCanManageChores,
  );
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
          membersCanManageChores,
        }),
      });
      const data = await readApiJsonResponse<{ ok?: boolean; error?: string; code?: string }>(
        response,
      );
      if (recoverFromHouseholdContextError(data)) {
        setLoading(false);
        return;
      }
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
      const data = await readApiJsonResponse<{
        ok?: boolean;
        error?: string;
        code?: string;
        nextPath?: string;
      }>(response);
      if (recoverFromHouseholdContextError(data)) {
        setDeleteLoading(false);
        return;
      }
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
      <AppFormSection
        description="Update the shared details people see across menus, invites, and the weekly board."
        title="Household details"
      >
        <AppFormField
          description="Keep the household name recognizable for everyone already using the board."
          htmlFor="household-edit-name"
          label="Household name"
        >
          <input
            className={appInputClass}
            id="household-edit-name"
            onChange={(event) => setName(event.target.value)}
            required
            type="text"
            value={name}
          />
        </AppFormField>

        <HouseholdIconPicker onChange={setIcon} showEmptyIconPreview={false} value={icon} />

        <AppFormField
          description="Weekly grouping and recurring chores continue to use this household time zone."
          htmlFor="household-edit-time-zone"
          label="Time zone"
        >
          <select
            className={appInputClass}
            id="household-edit-time-zone"
            onChange={(event) => setTimeZone(event.target.value)}
            value={timeZone}
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
        </AppFormField>
      </AppFormSection>

      <AppFormSection
        description="Fine-tune what regular members can do without affecting owner or admin access."
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

      {canDeleteHousehold ? (
        <AppFormSection
          description="This is permanent. Deletion only succeeds when no other active members remain in the household."
          title="Danger zone"
        >
          <button
            className={appDangerButtonClass}
            disabled={loading || deleteLoading}
            onClick={handleDelete}
            type="button"
          >
            {deleteLoading ? "Deleting..." : "Delete household"}
          </button>
        </AppFormSection>
      ) : null}

      {error ? <div className={appDangerMessageClass}>{error}</div> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button className={appPrimaryButtonClass} disabled={loading || deleteLoading} type="submit">
          {loading ? "Saving..." : "Save household"}
        </button>
        <Link className={appSecondaryButtonClass} href="/household">
          Cancel
        </Link>
      </div>
    </form>
  );
}
