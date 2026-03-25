import type { Metadata } from "next";
import { Geist_Mono, Space_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";

import { THEME_PREFERENCE_COOKIE_KEY, THEME_PREFERENCE_STORAGE_KEY } from "@/lib/theme-preference";

import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Sweep Heap",
  description: "Weekly chores overview for The Sweep Heap",
};

const themePreferenceScript = `
(() => {
  try {
    const storedTheme = window.localStorage.getItem("${THEME_PREFERENCE_STORAGE_KEY}");
    if (storedTheme === "light" || storedTheme === "dark") {
      document.documentElement.dataset.theme = storedTheme;
      return;
    }
  } catch {
    // Keep server-rendered theme attribute when localStorage is unavailable.
  }
})();
`;

const toInitialTheme = (value: string | undefined) => {
  if (value === "light" || value === "dark") {
    return value;
  }
  return undefined;
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialTheme = toInitialTheme(cookieStore.get(THEME_PREFERENCE_COOKIE_KEY)?.value);

  return (
    <html lang="en" data-theme={initialTheme} suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${geistMono.variable} antialiased`}>
        <Script id="theme-preference" strategy="beforeInteractive">
          {themePreferenceScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
