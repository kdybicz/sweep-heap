"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AppFormSection,
  appDangerMessageClass,
  appPrimaryButtonClass,
} from "@/app/components/AppFormPrimitives";

export default function HouseholdInviteAcceptanceForm({
  householdName,
  invitationId,
  secret,
  initialError,
}: {
  householdName: string;
  invitationId: number;
  secret: string;
  initialError: string | null;
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
          invitationId,
          secret,
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
      <AppFormSection
        description={`Join ${householdName} using this invite. If the household was already active for you, we will switch you into it after acceptance.`}
        title="Accept household invite"
      >
        {error ? <div className={appDangerMessageClass}>{error}</div> : null}

        <button className={appPrimaryButtonClass} disabled={loading} type="submit">
          {loading ? "Accepting..." : "Accept invite"}
        </button>
      </AppFormSection>
    </form>
  );
}
