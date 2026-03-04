import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { headers } from "next/headers";
import nodemailer from "nodemailer";

import { pool } from "@/lib/db";
import { getSmtpSettings } from "@/lib/smtp";

const appUrl = process.env.AUTH_URL;
const smtpSettings = getSmtpSettings();

const transporter = nodemailer.createTransport({
  host: smtpSettings.host,
  port: smtpSettings.port,
  secure: smtpSettings.secure,
  auth: smtpSettings.auth,
});

const magicLinkHtml = ({ url, host }: { url: string; host: string }) => {
  const escapedHost = host.replace(/\./g, "&#8203;.");
  const brandColor = "#346df1";
  const color = {
    background: "#f9f9f9",
    text: "#444",
    mainBackground: "#fff",
    buttonBackground: brandColor,
    buttonBorder: brandColor,
    buttonText: "#fff",
  };

  return `<body style="background: ${color.background};">
  <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${color.mainBackground}; max-width: 600px; margin: auto; border-radius: 10px;">
    <tr>
      <td align="center" style="padding: 10px 0; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        Sign in to <strong>${escapedHost}</strong>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 10px 0;">
        <table border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="border-radius: 5px;" bgcolor="${color.buttonBackground}">
              <a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${color.buttonText}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${color.buttonBorder}; display: inline-block; font-weight: bold;">
                Sign in
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 10px 0; font-size: 14px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        If you did not request this email, you can safely ignore it.
      </td>
    </tr>
  </table>
</body>`;
};

const magicLinkText = ({ url, host }: { url: string; host: string }) =>
  `Sign in to ${host}\n${url}\n\n`;

export const auth = betterAuth({
  appName: "Chores",
  baseURL: appUrl,
  trustedOrigins: appUrl ? [appUrl] : ["http://localhost:3000"],
  database: pool,
  advanced: {
    database: {
      generateId: "serial",
    },
  },
  user: {
    modelName: "users",
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  session: {
    modelName: "sessions",
    fields: {
      userId: "user_id",
      token: "token",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  account: {
    modelName: "accounts",
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    modelName: "verification",
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  plugins: [
    magicLink({
      expiresIn: 24 * 60 * 60,
      sendMagicLink: async ({ email, url }) => {
        const host = new URL(url).host;
        await transporter.sendMail({
          to: email,
          from: smtpSettings.from,
          subject: `Sign in to ${host}`,
          text: magicLinkText({ url, host }),
          html: magicLinkHtml({ url, host }),
        });
      },
    }),
  ],
});

export const getSession = async () => auth.api.getSession({ headers: await headers() });
