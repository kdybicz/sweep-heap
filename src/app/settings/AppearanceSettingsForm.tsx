"use client";

import { useEffect, useState } from "react";

import {
  THEME_PREFERENCE_COOKIE_KEY,
  THEME_PREFERENCE_COOKIE_MAX_AGE_SECONDS,
  THEME_PREFERENCE_STORAGE_KEY,
} from "@/lib/theme-preference";

const themeOptions = [
  {
    value: "system",
    label: "System",
    description: "Follow your device setting",
  },
  {
    value: "light",
    label: "Light",
    description: "Always use the light theme",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always use the dark theme",
  },
] as const;

type ThemePreference = (typeof themeOptions)[number]["value"];

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === "system" || value === "light" || value === "dark";

const applyThemePreference = (preference: ThemePreference) => {
  if (typeof document === "undefined") {
    return;
  }

  if (preference === "light" || preference === "dark") {
    document.documentElement.dataset.theme = preference;
    return;
  }

  document.documentElement.removeAttribute("data-theme");
};

const persistThemePreferenceCookie = (preference: ThemePreference) => {
  if (typeof document === "undefined") {
    return;
  }

  if (preference === "system") {
    // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not universally supported.
    document.cookie = `${THEME_PREFERENCE_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }

  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not universally supported.
  document.cookie = `${THEME_PREFERENCE_COOKIE_KEY}=${preference}; Path=/; Max-Age=${THEME_PREFERENCE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
};

export default function AppearanceSettingsForm() {
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const storedThemePreference = window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
      if (isThemePreference(storedThemePreference)) {
        setThemePreference(storedThemePreference);
        applyThemePreference(storedThemePreference);
        persistThemePreferenceCookie(storedThemePreference);
        return;
      }

      applyThemePreference("system");
    } catch {
      setThemePreference("system");
      applyThemePreference("system");
    }
  }, []);

  const handleThemePreferenceChange = (nextPreference: ThemePreference) => {
    setThemePreference(nextPreference);
    applyThemePreference(nextPreference);
    persistThemePreferenceCookie(nextPreference);

    if (typeof window === "undefined") {
      return;
    }

    try {
      if (nextPreference === "system") {
        window.localStorage.removeItem(THEME_PREFERENCE_STORAGE_KEY);
        return;
      }

      window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, nextPreference);
    } catch {}
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Appearance
        </p>
        <p className="text-xs text-[var(--muted)]">
          Changes apply immediately and are saved for this browser.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {themeOptions.map((themeOption) => {
          const isSelected = themePreference === themeOption.value;

          return (
            <label
              key={themeOption.value}
              className={`flex cursor-pointer flex-col gap-1 rounded-xl border px-3 py-2 text-left transition ${
                isSelected
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--stroke)] bg-[var(--surface)] hover:border-[var(--accent)]"
              }`}
            >
              <input
                className="sr-only"
                type="radio"
                name="theme-preference"
                value={themeOption.value}
                checked={isSelected}
                onChange={() => handleThemePreferenceChange(themeOption.value)}
              />
              <span className="text-sm font-semibold text-[var(--ink)]">{themeOption.label}</span>
              <span className="text-xs text-[var(--muted)]">{themeOption.description}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
