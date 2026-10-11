import { afterEach, describe, expect, it, vi } from "vitest";

const { createTransport, sendMail } = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport },
}));

import { sendTransactionalEmail } from "@/lib/email/send-transactional-email";

const smtpEnvKeys = ["SMTP_HOST", "SMTP_FROM", "SMTP_PORT", "SMTP_SECURE"] as const;

const originalSmtpEnv = {
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_FROM: process.env.SMTP_FROM,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
};

afterEach(() => {
  vi.clearAllMocks();

  for (const key of smtpEnvKeys) {
    const value = originalSmtpEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("sendTransactionalEmail", () => {
  it("sends HTML and text content through the configured SMTP transport", async () => {
    process.env.SMTP_HOST = "mailpit";
    process.env.SMTP_FROM = "The Sweep Heap <no-reply@example.com>";
    process.env.SMTP_PORT = "1125";
    process.env.SMTP_SECURE = "false";
    createTransport.mockReturnValue({ sendMail });

    await sendTransactionalEmail({
      to: "member@example.com",
      subject: "You are invited",
      text: "Join the household",
      html: "<p>Join the household</p>",
    });

    expect(createTransport).toHaveBeenCalledWith({
      host: "mailpit",
      port: 1125,
      secure: false,
      auth: undefined,
    });
    expect(sendMail).toHaveBeenCalledWith({
      to: "member@example.com",
      from: "The Sweep Heap <no-reply@example.com>",
      subject: "You are invited",
      text: "Join the household",
      html: "<p>Join the household</p>",
    });
  });

  it("does not create a transport without SMTP host and sender settings", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;

    await expect(
      sendTransactionalEmail({
        to: "member@example.com",
        subject: "You are invited",
        text: "Join the household",
        html: "<p>Join the household</p>",
      }),
    ).rejects.toThrow("Email is not configured");

    expect(createTransport).not.toHaveBeenCalled();
  });
});
