import Link from "next/link";
import type { ReactNode } from "react";

type AppPageShellProps = {
  children: ReactNode;
  size?: "form" | "list" | "wide";
};

type AppPageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  aside?: ReactNode;
};

type AppPageCardProps = {
  children: ReactNode;
  tone?: "default" | "danger";
  padding?: "md" | "lg";
  className?: string;
};

type AppPageBackLinkProps = {
  href: string;
  label: string;
};

const shellWidths: Record<NonNullable<AppPageShellProps["size"]>, string> = {
  form: "max-w-2xl",
  list: "max-w-3xl",
  wide: "max-w-5xl",
};

const cardPadding: Record<NonNullable<AppPageCardProps["padding"]>, string> = {
  md: "p-6 sm:p-7",
  lg: "p-6 sm:p-8",
};

const cardTone: Record<NonNullable<AppPageCardProps["tone"]>, string> = {
  default: "border-[var(--stroke)] bg-[var(--surface)]",
  danger: "border-[var(--danger-stroke)] bg-[var(--surface)]",
};

const joinClasses = (...values: Array<string | undefined>) => values.filter(Boolean).join(" ");

export function AppPageShell({ children, size = "form" }: AppPageShellProps) {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.72),transparent_30%),radial-gradient(circle_at_82%_14%,rgba(42,91,215,0.16),transparent_30%),linear-gradient(180deg,var(--bg),var(--surface))] dark:bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.05),transparent_28%),radial-gradient(circle_at_82%_14%,rgba(110,160,255,0.12),transparent_30%),linear-gradient(180deg,var(--bg),var(--surface))]" />
      <div
        className={joinClasses(
          "mx-auto flex w-full flex-col gap-8 px-4 pb-20 pt-8 sm:pt-10 lg:gap-10 lg:pb-24",
          shellWidths[size],
        )}
      >
        {children}
      </div>
    </main>
  );
}

export function AppPageHeader({ eyebrow, title, description, aside }: AppPageHeaderProps) {
  return (
    <header className="landing-reveal flex flex-col gap-6 border-b border-[var(--stroke-soft)] pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
      <div className="max-w-xl space-y-3">
        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.32em] text-[var(--muted)]">
          {eyebrow}
        </div>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{title}</h1>
        {description ? (
          <p className="max-w-lg text-sm leading-7 text-[var(--muted)] sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {aside ? <div className="landing-reveal landing-reveal-delay-1 shrink-0">{aside}</div> : null}
    </header>
  );
}

export function AppPageCard({
  children,
  tone = "default",
  padding = "lg",
  className,
}: AppPageCardProps) {
  return (
    <div
      className={joinClasses(
        "landing-reveal landing-reveal-delay-1 rounded-[2rem] border shadow-[var(--shadow)]",
        cardTone[tone],
        cardPadding[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AppPageBackLink({ href, label }: AppPageBackLinkProps) {
  return (
    <Link
      className="inline-flex w-fit rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
      href={href}
    >
      {label}
    </Link>
  );
}
