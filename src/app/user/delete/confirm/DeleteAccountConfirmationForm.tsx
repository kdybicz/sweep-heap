"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  AppFormField,
  AppFormSection,
  appDangerButtonClass,
  appDangerMessageClass,
  appInputClass,
  appSecondaryButtonClass,
} from "@/app/components/AppFormPrimitives";

export default function DeleteAccountConfirmationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const identifier = searchParams.get("identifier") ?? "";
  const token = searchParams.get("token") ?? "";
  const hasToken = Boolean(identifier && token);
  const isConfirmationValid = confirmationText.trim().toLowerCase() === "delete";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isConfirmationValid) {
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
        <div className={appDangerMessageClass}>This confirmation link is invalid.</div>
        <Link className={appSecondaryButtonClass} href="/user/edit">
          Back to profile
        </Link>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <AppFormSection
        description="This action cannot be undone. Any households left empty by deleting your account will be removed too."
        title="Final confirmation"
      >
        <p className="text-sm leading-7 text-[var(--muted)]">
          If you still own a household with other active members, remove those members first. Then
          type 'delete' below to confirm permanent account deletion.
        </p>
        <AppFormField
          description="Type the word exactly as shown to unlock the final action."
          htmlFor="delete-confirmation"
          label="Type delete"
        >
          <input
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className={`${appInputClass} border-[var(--danger-stroke)] placeholder:text-[var(--muted)] focus:border-[var(--danger)] focus:ring-[var(--danger-bg)]`}
            id="delete-confirmation"
            onChange={(event) => setConfirmationText(event.target.value)}
            placeholder="delete"
            spellCheck={false}
            type="text"
            value={confirmationText}
          />
        </AppFormField>
        {error ? <div className={appDangerMessageClass}>{error}</div> : null}
        <button
          className={appDangerButtonClass}
          disabled={loading || !isConfirmationValid}
          type="submit"
        >
          {loading ? "Deleting..." : "Delete account"}
        </button>
      </AppFormSection>
    </form>
  );
}
