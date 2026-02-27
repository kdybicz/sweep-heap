import type { Metadata } from "next";
import { Geist_Mono, Oxanium } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${oxanium.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
