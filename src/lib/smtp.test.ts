import { afterEach, describe, expect, it } from "vitest";

import { getSmtpSettings } from "@/lib/smtp";

const smtpEnvKeys = [
  "SMTP_HOST",
  "SMTP_FROM",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
] as const;

const originalSmtpEnv = {
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_FROM: process.env.SMTP_FROM,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
};

const clearSmtpEnv = () => {
  for (const key of smtpEnvKeys) {
    delete process.env[key];
  }
};

afterEach(() => {
  clearSmtpEnv();

  for (const key of smtpEnvKeys) {
    const value = originalSmtpEnv[key];
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
});

describe("getSmtpSettings", () => {
  it("uses default port and non-secure transport", () => {
    clearSmtpEnv();

    const settings = getSmtpSettings();

    expect(settings).toEqual({
      host: undefined,
      from: undefined,
      port: 587,
      secure: false,
      auth: undefined,
    });
  });

  it("enables secure transport by default on port 465", () => {
    process.env.SMTP_PORT = "465";

    const settings = getSmtpSettings();

    expect(settings.port).toBe(465);
    expect(settings.secure).toBe(true);
  });

  it("respects SMTP_SECURE override when set", () => {
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "false";

    const settings = getSmtpSettings();

    expect(settings.secure).toBe(false);
  });

  it("trims host/from and only enables auth with both credentials", () => {
    process.env.SMTP_HOST = " smtp.example.com ";
    process.env.SMTP_FROM = " Chore Share <no-reply@example.com> ";
    process.env.SMTP_USER = " user ";
    process.env.SMTP_PASS = " pass ";

    const settings = getSmtpSettings();

    expect(settings.host).toBe("smtp.example.com");
    expect(settings.from).toBe("Chore Share <no-reply@example.com>");
    expect(settings.auth).toEqual({ user: "user", pass: "pass" });
  });

  it("disables auth when only one credential is provided", () => {
    process.env.SMTP_USER = "user";

    const settings = getSmtpSettings();

    expect(settings.auth).toBeUndefined();
  });
});
