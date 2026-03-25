import { redirect } from "next/navigation";

import {
  AppPageBackLink,
  AppPageCard,
  AppPageHeader,
  AppPageShell,
} from "@/app/components/AppPageShell";
import HouseholdInviteAcceptanceForm from "@/app/household/invite/HouseholdInviteAcceptanceForm";
import { getSession } from "@/auth";
import {
  buildHouseholdInviteSignInRedirectUrl,
  toHouseholdInvitePagePath,
} from "@/lib/household-invite-paths";
import { parsePositiveInt } from "@/lib/organization-api";
import { resolveActiveHousehold } from "@/lib/services/active-household-service";
import { getPendingHouseholdInvite } from "@/lib/services/household-invite-service";
import { parseSessionContext } from "@/lib/session-context";

export const dynamic = "force-dynamic";

const inviteErrorMessages: Record<string, string> = {
  invalid: "This invite is invalid or expired. Ask for a fresh invite.",
  "sign-in": "Sign in with the invited email address to continue.",
  "signout-failed": "We could not sign you out. Please try again.",
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

  const numericInvitationId = parsePositiveInt(invitationId);
  if (numericInvitationId === null || !inviteSecret) {
    redirect("/auth");
  }

  const invite = await getPendingHouseholdInvite({
    invitationId: numericInvitationId,
    secret: inviteSecret,
  });
  if (!invite) {
    return (
      <AppPageShell>
        <AppPageHeader
          aside={<AppPageBackLink href="/auth" label="Back to sign in" />}
          description="This invite is invalid or has expired. Ask a household member to send a new one."
          eyebrow="Invite"
          title="Invite unavailable"
        />
      </AppPageShell>
    );
  }

  const session = await getSession();
  const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? "";
  const sessionContext = parseSessionContext(session);
  const householdResolution = sessionContext.ok
    ? await resolveActiveHousehold({
        sessionActiveHouseholdId: sessionContext.sessionActiveHouseholdId,
        userId: sessionContext.userId,
      })
    : null;
  const exitAction = sessionContext.ok
    ? householdResolution?.status === "resolved"
      ? { href: "/household", label: "Back to board" }
      : householdResolution?.status === "selection-required"
        ? { href: "/household/select", label: "Back to household selection" }
        : { href: "/household/setup", label: "Back to household setup" }
    : { href: "/auth", label: "Back to sign in" };
  const inviteEmail = invite.email.trim().toLowerCase();
  const needsAccountSwitch = !!sessionEmail && sessionEmail !== inviteEmail;
  const canRecoverBySwitchingAccount =
    !!sessionEmail && (needsAccountSwitch || errorCode === "sign-in");
  const switchAccountRedirectTo = canRecoverBySwitchingAccount
    ? buildHouseholdInviteSignInRedirectUrl({
        email: invite.email,
        invitationId: numericInvitationId,
        secret: inviteSecret,
      })
    : null;
  const switchAccountFailureRedirectTo = canRecoverBySwitchingAccount
    ? toHouseholdInvitePagePath({
        error: "signout-failed",
        invitationId: numericInvitationId,
        secret: inviteSecret,
      })
    : null;

  return (
    <AppPageShell>
      <AppPageHeader
        aside={<AppPageBackLink href={exitAction.href} label={exitAction.label} />}
        description={`This invite is for ${invite.email}. Accepting it will sign you in if needed and switch you into this household.`}
        eyebrow="Invite"
        title={`Join ${invite.householdName}`}
      />

      <AppPageCard>
        {canRecoverBySwitchingAccount &&
        switchAccountRedirectTo &&
        switchAccountFailureRedirectTo ? (
          <div className="flex flex-col gap-4">
            {needsAccountSwitch ? (
              <p className="text-sm leading-7 text-[var(--muted)]">
                This invite is for{" "}
                <span className="font-semibold text-[var(--ink)]">{invite.email}</span>, but you are
                currently signed in as{" "}
                <span className="font-semibold text-[var(--ink)]">{sessionEmail}</span>.
              </p>
            ) : (
              <p className="text-sm leading-7 text-[var(--muted)]">
                Sign-out recovery is available if this session is no longer valid for the invited
                account.
              </p>
            )}
            {initialError ? (
              <div className="rounded-2xl border border-[var(--danger-stroke)] bg-[var(--danger-bg)] px-4 py-3 text-xs font-semibold text-[var(--danger-ink)]">
                {initialError}
              </div>
            ) : null}
            <form action="/signout" className="flex flex-col gap-4" method="post">
              <input name="redirectTo" type="hidden" value={switchAccountRedirectTo} />
              <input
                name="failureRedirectTo"
                type="hidden"
                value={switchAccountFailureRedirectTo}
              />
              <button
                className="inline-flex w-fit rounded-full border border-[var(--accent)] bg-[var(--accent)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
                type="submit"
              >
                Sign out and continue
              </button>
            </form>
          </div>
        ) : (
          <HouseholdInviteAcceptanceForm
            householdName={invite.householdName}
            initialError={initialError}
            invitationId={numericInvitationId}
            secret={inviteSecret}
          />
        )}
      </AppPageCard>
    </AppPageShell>
  );
}
