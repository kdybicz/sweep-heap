import nodemailer from "nodemailer";

export const sendDeleteAccountConfirmationEmail = async ({
  confirmationUrl,
  expiresInMinutes,
  to,
}: {
  confirmationUrl: string;
  expiresInMinutes: number;
  to: string;
}) => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpFrom = process.env.SMTP_FROM;
  if (!smtpHost || !smtpFrom) {
    throw new Error("Email is not configured");
  }

  const parsedSmtpPort = Number(process.env.SMTP_PORT ?? 587);
  const smtpPort = Number.isFinite(parsedSmtpPort) ? parsedSmtpPort : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  });

  await transporter.sendMail({
    to,
    from: smtpFrom,
    subject: "Confirm account deletion",
    text: [
      "You requested to delete your account.",
      "",
      `Use this link within ${expiresInMinutes} minutes to continue:`,
      confirmationUrl,
      "",
      "This action cannot be undone.",
      "If you are the last member of your household, the household will be deleted too.",
      "",
      "If you did not request this, you can safely ignore this email.",
    ].join("\n"),
    html: [
      "<p>You requested to delete your account.</p>",
      `<p>Use this link within ${expiresInMinutes} minutes to continue:</p>`,
      `<p><a href="${confirmationUrl}">Confirm account deletion</a></p>`,
      "<p><strong>This action cannot be undone.</strong></p>",
      "<p>If you are the last member of your household, the household will be deleted too.</p>",
      "<p>If you did not request this, you can safely ignore this email.</p>",
    ].join(""),
  });
};
