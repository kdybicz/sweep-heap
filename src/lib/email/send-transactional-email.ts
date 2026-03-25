import nodemailer from "nodemailer";

import { getSmtpSettings } from "@/lib/smtp";

export const sendTransactionalEmail = async ({
  html,
  subject,
  text,
  to,
}: {
  html: string;
  subject: string;
  text: string;
  to: string;
}) => {
  const smtpSettings = getSmtpSettings();
  const smtpHost = smtpSettings.host;
  const smtpFrom = smtpSettings.from;
  if (!smtpHost || !smtpFrom) {
    throw new Error("Email is not configured");
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpSettings.port,
    secure: smtpSettings.secure,
    auth: smtpSettings.auth,
  });

  await transporter.sendMail({
    to,
    from: smtpFrom,
    subject,
    text,
    html,
  });
};
