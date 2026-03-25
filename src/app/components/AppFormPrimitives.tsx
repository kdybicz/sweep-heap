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
  "w-full rounded-[0.75rem] border border-[var(--stroke)] bg-[var(--card)] px-4 py-3 text-sm font-medium text-[var(--ink)] outline-none transition focus:border-[var(--accent-secondary)] focus:ring-2 focus:ring-[var(--accent-secondary-soft)]";

export const appReadOnlyClass =
  "w-full rounded-[0.75rem] border border-[var(--stroke-soft)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-medium text-[var(--ink)] opacity-90";

export const appInputButtonClass =
  "flex w-full items-center justify-between rounded-[0.75rem] border border-[var(--stroke)] bg-[var(--card)] px-4 py-3 text-left text-sm font-medium text-[var(--ink)] outline-none transition hover:border-[var(--accent-secondary)] hover:bg-[var(--surface-weak)] focus:border-[var(--accent-secondary)] focus:ring-2 focus:ring-[var(--accent-secondary-soft)]";

export const appSectionClass =
  "rounded-[0.95rem] border border-[var(--stroke-soft)] bg-[color-mix(in_srgb,var(--surface-weak)_84%,white_16%)] p-5 shadow-[var(--shadow-soft)] sm:p-6";

export const appPrimaryButtonClass =
  "rounded-[0.75rem] border border-transparent bg-[linear-gradient(135deg,var(--accent),var(--accent-secondary))] px-5 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-white shadow-[0_14px_28px_rgba(40,94,240,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_32px_rgba(40,94,240,0.24)] disabled:cursor-not-allowed disabled:opacity-60";

export const appSecondaryButtonClass =
  "rounded-[0.75rem] border border-[var(--stroke)] bg-[var(--card)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:border-[var(--accent-secondary)] hover:bg-[var(--surface-weak)]";

export const appDangerButtonClass =
  "rounded-[0.75rem] border border-[var(--danger)] bg-[var(--danger)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--danger-ink)] disabled:cursor-not-allowed disabled:opacity-60";

export const appInfoMessageClass =
  "rounded-[0.75rem] border border-[var(--stroke-soft)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--ink)]";

export const appDangerMessageClass =
  "rounded-[0.75rem] border border-[var(--danger-stroke)] bg-[var(--danger-bg)] px-4 py-3 text-sm font-medium leading-6 text-[var(--danger-ink)]";

export const appToggleCardClass =
  "flex items-start gap-3 rounded-[0.85rem] border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-4 py-4 text-left";

export function AppFormSection({ title, description, children }: AppFormSectionProps) {
  return (
    <section className={appSectionClass}>
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--ink)]">{title}</h2>
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
          className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]"
          htmlFor={htmlFor}
        >
          {label}
        </label>
      ) : (
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
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
