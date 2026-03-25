"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AppFormField,
  AppFormSection,
  appDangerMessageClass,
  appInputClass,
  appPrimaryButtonClass,
  appReadOnlyClass,
  appSecondaryButtonClass,
} from "@/app/components/AppFormPrimitives";
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
      <AppFormSection
        description="Keep your personal details current while showing the household context this profile uses."
        title="Profile details"
      >
        <AppFormField
          description="This is the name shown in household menus and member lists."
          htmlFor="user-details-name"
          label="Name"
        >
          <input
            className={appInputClass}
            id="user-details-name"
            onChange={(event) => setName(event.target.value)}
            required
            type="text"
            value={name}
          />
        </AppFormField>

        <AppFormField
          description="Your sign-in email cannot be edited here."
          htmlFor="user-details-email"
          label="Email"
        >
          <input
            className={appReadOnlyClass}
            id="user-details-email"
            placeholder="No email available"
            readOnly
            type="email"
            value={email}
          />
        </AppFormField>

        <AppFormField
          description="The active household time zone stays read only on the profile page."
          htmlFor="user-details-household-time-zone"
          label="Household time zone"
        >
          <select
            className={appReadOnlyClass}
            disabled
            id="user-details-household-time-zone"
            value={householdTimeZone}
          >
            {timeZoneOptions.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </AppFormField>
      </AppFormSection>

      {error ? <div className={appDangerMessageClass}>{error}</div> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button className={appPrimaryButtonClass} disabled={loading} type="submit">
          {loading ? "Saving..." : "Save profile"}
        </button>
        <Link className={appSecondaryButtonClass} href="/household">
          Cancel
        </Link>
      </div>
    </form>
  );
}
