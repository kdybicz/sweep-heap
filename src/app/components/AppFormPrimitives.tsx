import type { ReactNode } from "react";

type AppFormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

type AppFormFieldProps = {
  label: string;
  description?: string;
  children: ReactNode;
  htmlFor?: string;
};

export const appInputClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--stroke)] bg-[var(--card)] px-4 py-3 text-sm font-medium text-[var(--ink)] outline-none transition focus:border-[var(--accent-secondary)] focus:ring-2 focus:ring-[var(--accent-secondary-soft)]";

export const appReadOnlyClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--stroke-soft)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-medium text-[var(--ink)] opacity-90";

export const appInputButtonClass =
  "flex w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--stroke)] bg-[var(--card)] px-4 py-3 text-left text-sm font-medium text-[var(--ink)] outline-none transition hover:border-[var(--accent-secondary)] hover:bg-[var(--surface-weak)] focus:border-[var(--accent-secondary)] focus:ring-2 focus:ring-[var(--accent-secondary-soft)]";

export const appSectionClass =
  "rounded-[var(--radius-lg)] border border-[var(--stroke-soft)] bg-[color-mix(in_srgb,var(--surface-weak)_84%,white_16%)] p-5 shadow-[var(--shadow-soft)] sm:p-6";

export const appPrimaryButtonClass =
  "rounded-[var(--radius-md)] border border-transparent bg-[var(--accent)] px-5 py-3 text-xs font-bold uppercase tracking-[0.08em] text-white shadow-[0_10px_28px_rgba(217,90,58,0.2)] transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] hover:shadow-[0_16px_36px_rgba(217,90,58,0.28)] disabled:cursor-not-allowed disabled:opacity-60";

export const appSecondaryButtonClass =
  "rounded-[var(--radius-md)] border border-[var(--stroke)] bg-[var(--surface-weak)] px-5 py-3 text-xs font-bold uppercase tracking-[0.06em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:border-[var(--accent-secondary)] hover:bg-[var(--surface-weak)] hover:shadow-[var(--shadow-soft)]";

export const appDangerButtonClass =
  "rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger)] px-5 py-3 text-xs font-bold uppercase tracking-[0.08em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--danger-ink)] disabled:cursor-not-allowed disabled:opacity-60";

export const appInfoMessageClass =
  "rounded-[var(--radius-md)] border border-[var(--stroke-soft)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--ink)]";

export const appDangerMessageClass =
  "rounded-[var(--radius-md)] border border-[var(--danger-stroke)] bg-[var(--danger-bg)] px-4 py-3 text-sm font-medium leading-6 text-[var(--danger-ink)]";

export const appToggleCardClass =
  "flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-4 py-4 text-left";

export function AppFormSection({ title, description, children }: AppFormSectionProps) {
  return (
    <section className={appSectionClass}>
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-[var(--ink)]">
            {title}
          </h2>
          {description ? (
            <p className="text-sm leading-7 text-[var(--muted)]">{description}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </section>
  );
}

export function AppFormField({ label, description, children, htmlFor }: AppFormFieldProps) {
  return (
    <div className="flex flex-col gap-2.5 text-left">
      {htmlFor ? (
        <label
          className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]"
          htmlFor={htmlFor}
        >
          {label}
        </label>
      ) : (
        <span className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
          {label}
        </span>
      )}
      {description ? (
        <span className="text-sm leading-6 text-[var(--muted)]">{description}</span>
      ) : null}
      {children}
    </div>
  );
}
