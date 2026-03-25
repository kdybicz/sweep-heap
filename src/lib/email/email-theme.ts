import type { CSSProperties } from "react";

export type EmailTone = "blue" | "coral" | "teal" | "gold" | "danger";

export const emailColors = {
  background: "#eaf1f8",
  surface: "#f7fbff",
  surfaceStrong: "#dde7f2",
  ink: "#1d2742",
  muted: "#66657a",
  border: "#c4d2e1",
  coral: "#ff623d",
  coralSoft: "#ffd8ce",
  blue: "#285ef0",
  blueSoft: "#dde7ff",
  teal: "#14b38f",
  tealSoft: "#d7f3ea",
  gold: "#f2b94d",
  goldSoft: "#ffefcb",
  danger: "#d54b36",
  dangerSoft: "#ffe7df",
  white: "#fcfdff",
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
