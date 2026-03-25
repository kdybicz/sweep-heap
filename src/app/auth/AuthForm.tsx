"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  AppFormField,
  AppFormSection,
  appDangerMessageClass,
  appInputClass,
  appPrimaryButtonClass,
} from "@/app/components/AppFormPrimitives";
import { authClient } from "@/lib/auth-client";
import { getSafeLocalPath } from "@/lib/safe-local-path";

export const getSafeCallbackUrl = (value: string) => getSafeLocalPath(value, "/auth");

const getPrefilledEmail = (value: string | null) => {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed.includes("@")) {
    return "";
  }

  return trimmed;
};

export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackURL = getSafeCallbackUrl(searchParams.get("callbackURL") ?? "/auth");
  const [email, setEmail] = useState(() => getPrefilledEmail(searchParams.get("email")));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL,
      });
      if (result.error) {
        setError(result.error.message ?? "Sign in failed");
        setLoading(false);
        return;
      }
      router.push("/auth/check-email");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Sign in failed";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <AppFormSection
        description="Use the email address you want this sign-in link sent to."
        title="Email sign-in"
      >
        <AppFormField
          description="We only send a magic link. No password is required."
          htmlFor="auth-email"
          label="Email"
        >
          <input
            className={appInputClass}
            id="auth-email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
        </AppFormField>
        {error ? <div className={appDangerMessageClass}>{error}</div> : null}
        <button className={appPrimaryButtonClass} disabled={loading} type="submit">
          {loading ? "Sending link..." : "Send magic link"}
        </button>
      </AppFormSection>
    </form>
  );
}
