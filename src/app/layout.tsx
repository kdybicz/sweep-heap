import type { Metadata } from "next";
import { Geist_Mono, Oxanium } from "next/font/google";
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

const themePreferenceScript = `
(() => {
  try {
    const storedTheme = window.localStorage.getItem("sweep-heap-theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      document.documentElement.dataset.theme = storedTheme;
      return;
    }

    document.documentElement.removeAttribute("data-theme");
  } catch {
    document.documentElement.removeAttribute("data-theme");
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${oxanium.variable} ${geistMono.variable} antialiased`}>
        <Script id="theme-preference" strategy="beforeInteractive">
          {themePreferenceScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
