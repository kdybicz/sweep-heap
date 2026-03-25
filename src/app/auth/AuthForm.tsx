"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
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
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-3">
        <label
          className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--accent-secondary)]"
          htmlFor="auth-email"
        >
          Email address
        </label>
        <p className="text-sm leading-6 text-[var(--muted)]">
          We send the sign-in link here. No password is required.
        </p>
        <input
          autoComplete="email"
          className={`${appInputClass} h-14 text-lg`}
          id="auth-email"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
      </div>
      {error ? <div className={appDangerMessageClass}>{error}</div> : null}
      <button className={`${appPrimaryButtonClass} w-full`} disabled={loading} type="submit">
        {loading ? "Sending link..." : "Send magic link"}
      </button>
    </form>
  );
}
