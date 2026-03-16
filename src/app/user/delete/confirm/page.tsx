import { createHash } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";

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
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,_var(--glow-1),_transparent_55%),radial-gradient(circle_at_80%_10%,_var(--glow-3),_transparent_45%),linear-gradient(180deg,_var(--glow-2),_transparent_55%)]" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pb-20 pt-16">
        <header className="flex flex-col gap-3">
          <div className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">Confirm</div>
          <h1 className="text-3xl font-semibold">Delete account</h1>
        </header>
        <div className="rounded-3xl border border-[var(--danger-stroke)] bg-[var(--surface)] p-8 shadow-[var(--shadow)]">
          <DeleteAccountConfirmationForm />
        </div>

        <div>
          <Link
            className="inline-flex rounded-full border border-[var(--stroke)] bg-[var(--card)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
            href={exitAction.href}
          >
            {exitAction.label}
          </Link>
        </div>
      </div>
    </main>
  );
}
