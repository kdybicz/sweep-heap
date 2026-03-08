import Link from "next/link";
import { redirect } from "next/navigation";

import HouseholdInviteAcceptanceForm from "@/app/household/invite/HouseholdInviteAcceptanceForm";
import { hashHouseholdInviteSecret } from "@/lib/household-invite-secret";
import { getPendingHouseholdInviteByIdAndSecret } from "@/lib/repositories";

export const dynamic = "force-dynamic";

const inviteErrorMessages: Record<string, string> = {
  invalid: "This invite is invalid or expired. Ask for a fresh invite.",
  "other-household": "This account already belongs to another household.",
  "sign-in": "Sign-in was not completed. Please try accepting again.",
  unexpected: "We could not complete your invite. Please try again.",
};

export default async function HouseholdInvitePage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; invitationId?: string; secret?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const invitationId =
    typeof resolvedSearchParams?.invitationId === "string" ? resolvedSearchParams.invitationId : "";
  const secret =
    typeof resolvedSearchParams?.secret === "string" ? resolvedSearchParams.secret : "";
  const inviteSecret = secret.trim();
  const errorCode =
    typeof resolvedSearchParams?.error === "string" ? resolvedSearchParams.error : "";
  const initialError = inviteErrorMessages[errorCode] ?? null;

  const numericInvitationId = Number(invitationId);
  if (!Number.isInteger(numericInvitationId) || numericInvitationId <= 0 || !inviteSecret) {
    redirect("/auth");
  }

  const invite = await getPendingHouseholdInviteByIdAndSecret({
    inviteId: numericInvitationId,
    secretHash: hashHouseholdInviteSecret(inviteSecret),
  });
  if (!invite) {
    return (
      <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,_var(--glow-1),_transparent_55%),radial-gradient(circle_at_80%_10%,_var(--glow-3),_transparent_45%),linear-gradient(180deg,_var(--glow-2),_transparent_55%)]" />
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pb-20 pt-16">
          <header className="flex flex-col gap-3">
            <div className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">Invite</div>
            <h1 className="text-3xl font-semibold">Invite unavailable</h1>
            <p className="text-sm text-[var(--muted)]">
              This invite is invalid or has expired. Ask a household member to send a new one.
            </p>
          </header>
          <div>
            <Link
              className="inline-flex rounded-full border border-[var(--stroke)] bg-[var(--card)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
              href="/auth"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,_var(--glow-1),_transparent_55%),radial-gradient(circle_at_80%_10%,_var(--glow-3),_transparent_45%),linear-gradient(180deg,_var(--glow-2),_transparent_55%)]" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pb-20 pt-16">
        <header className="flex flex-col gap-3">
          <div className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">Invite</div>
          <h1 className="text-3xl font-semibold">Join {invite.householdName}</h1>
          <p className="text-sm text-[var(--muted)]">
            This invite is for {invite.email}. Accepting it will sign you in if needed and switch
            you into this household.
          </p>
        </header>

        <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-8 shadow-[var(--shadow)]">
          <HouseholdInviteAcceptanceForm
            householdName={invite.householdName}
            invitationId={numericInvitationId}
            secret={inviteSecret}
            initialError={initialError}
          />
        </div>
      </div>
    </main>
  );
}
