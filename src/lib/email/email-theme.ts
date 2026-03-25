import type { CSSProperties } from "react";

export type EmailTone = "blue" | "coral" | "teal" | "gold" | "danger";

export const emailColors = {
  background: "#f4ecdf",
  surface: "#fffaf3",
  surfaceStrong: "#f8efe2",
  ink: "#1d2742",
  muted: "#66657a",
  border: "#dccab7",
  coral: "#ff623d",
  coralSoft: "#ffe2d9",
  blue: "#285ef0",
  blueSoft: "#dde7ff",
  teal: "#14b38f",
  tealSoft: "#dbf4ec",
  gold: "#f2b94d",
  goldSoft: "#ffefcb",
  danger: "#d54b36",
  dangerSoft: "#ffe7df",
  white: "#fffdfa",
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
