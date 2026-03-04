import type { Metadata } from "next";
import { Geist_Mono, Oxanium } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const oxanium = Oxanium({
  variable: "--font-oxanium",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Sweep Heap",
  description: "Weekly chores overview for The Sweep Heap",
};

const THEME_PREFERENCE_COOKIE_KEY = "sweep-heap-theme";

const themePreferenceScript = `
(() => {
  try {
    const storedTheme = window.localStorage.getItem("sweep-heap-theme");
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
      <body className={`${oxanium.variable} ${geistMono.variable} antialiased`}>
        <Script id="theme-preference" strategy="beforeInteractive">
          {themePreferenceScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
