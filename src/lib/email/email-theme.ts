import type { CSSProperties } from "react";

export type EmailTone = "blue" | "coral" | "teal" | "gold" | "danger";

export const emailColors = {
  background: "#f4f0eb",
  surface: "#faf8f5",
  surfaceStrong: "#ece7e0",
  ink: "#2a2522",
  muted: "#8a7f77",
  border: "#d4cbc2",
  coral: "#d95a3a",
  coralSoft: "#fce8e0",
  blue: "#3d6be0",
  blueSoft: "#e0e8fa",
  teal: "#4a9e7e",
  tealSoft: "#ddf0e7",
  gold: "#d9a23a",
  goldSoft: "#faf0d8",
  danger: "#c44032",
  dangerSoft: "#fde8e4",
  white: "#fdfcfa",
} as const;

export const emailFontFamily = '"Trebuchet MS", "Segoe UI", Helvetica, Arial, sans-serif';

export const emailToneStyles: Record<EmailTone, CSSProperties> = {
  blue: {
    backgroundColor: emailColors.blueSoft,
    borderColor: emailColors.border,
  },
  coral: {
    backgroundColor: emailColors.coralSoft,
    borderColor: emailColors.border,
  },
  teal: {
    backgroundColor: emailColors.tealSoft,
    borderColor: emailColors.border,
  },
  gold: {
    backgroundColor: emailColors.goldSoft,
    borderColor: emailColors.border,
  },
  danger: {
    backgroundColor: emailColors.dangerSoft,
    borderColor: emailColors.border,
  },
};
