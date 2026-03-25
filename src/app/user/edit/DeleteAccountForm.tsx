"use client";

import { useState } from "react";
import {
  AppFormSection,
  appDangerButtonClass,
  appDangerMessageClass,
  appInfoMessageClass,
} from "@/app/components/AppFormPrimitives";

export default function DeleteAccountForm() {
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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
      <AppFormSection
        description="Start by sending yourself a confirmation link. Deletion only proceeds after you open that email."
        title="Request account deletion"
      >
        {confirmationSent ? (
          <div className={appInfoMessageClass}>
            Please check your email. We just sent a confirmation link to continue account deletion.
            Open that link only if you want to permanently delete your account. The link expires in
            30 minutes.
          </div>
        ) : null}
        {error ? <div className={appDangerMessageClass}>{error}</div> : null}
        <p className="text-sm leading-7 text-[var(--muted)]">
          You can delete your account only after any households you own no longer have other active
          members.
        </p>
        <button className={appDangerButtonClass} disabled={loading} type="submit">
          {loading ? "Sending link..." : "Delete account"}
        </button>
      </AppFormSection>
    </form>
  );
}
