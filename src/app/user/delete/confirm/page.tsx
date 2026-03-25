import { createHash } from "node:crypto";
import { redirect } from "next/navigation";

import {
  AppPageBackLink,
  AppPageCard,
  AppPageHeader,
  AppPageShell,
} from "@/app/components/AppPageShell";
import DeleteAccountConfirmationForm from "@/app/user/delete/confirm/DeleteAccountConfirmationForm";
import { isDeleteAccountTokenValid } from "@/lib/repositories";
import { getOptionalSessionContext } from "@/lib/session-context";

export const dynamic = "force-dynamic";

export default async function DeleteAccountConfirmationPage({
  searchParams,
}: {
  searchParams?: Promise<{ identifier?: string; token?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const identifier =
    typeof resolvedSearchParams?.identifier === "string" ? resolvedSearchParams?.identifier : "";
  const token = typeof resolvedSearchParams?.token === "string" ? resolvedSearchParams?.token : "";
  if (!identifier || !token) {
    redirect("/auth");
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const hasValidToken = await isDeleteAccountTokenValid({ identifier, tokenHash });
  if (!hasValidToken) {
    redirect("/auth");
  }

  const sessionContext = await getOptionalSessionContext();
  const exitAction = sessionContext
    ? { href: "/user/edit", label: "Back to profile" }
    : { href: "/auth", label: "Back to sign in" };

  return (
    <AppPageShell>
      <AppPageHeader
        aside={<AppPageBackLink href={exitAction.href} label={exitAction.label} />}
        description="Use the emailed confirmation link only if you want to permanently remove your account."
        eyebrow="Confirm"
        title="Delete account"
      />
      <AppPageCard tone="danger">
        <DeleteAccountConfirmationForm />
      </AppPageCard>
    </AppPageShell>
  );
}
