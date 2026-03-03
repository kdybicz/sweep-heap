import nodemailer from "nodemailer";

const deleteAccountHtml = ({
  confirmationUrl,
  expiresInMinutes,
  host,
}: {
  confirmationUrl: string;
  expiresInMinutes: number;
  host: string;
}) => {
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
        Confirm account deletion on <strong>${escapedHost}</strong>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 10px 0; font-size: 14px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        This link expires in ${expiresInMinutes} minutes.
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 10px 0;">
        <table border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="border-radius: 5px;" bgcolor="${color.buttonBackground}">
              <a href="${confirmationUrl}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${color.buttonText}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${color.buttonBorder}; display: inline-block; font-weight: bold;">
                Confirm deletion
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 10px 0; font-size: 14px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        <strong>This action cannot be undone.</strong><br />
        If you are the last member of your household, the household will be deleted too.
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

const deleteAccountText = ({
  confirmationUrl,
  expiresInMinutes,
  host,
}: {
  confirmationUrl: string;
  expiresInMinutes: number;
  host: string;
}) =>
  [
    `Confirm account deletion on ${host}`,
    "",
    `This link expires in ${expiresInMinutes} minutes:`,
    confirmationUrl,
    "",
    "This action cannot be undone.",
    "If you are the last member of your household, the household will be deleted too.",
    "",
    "If you did not request this email, you can safely ignore it.",
  ].join("\n");

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
  const host = new URL(confirmationUrl).host;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  });

  await transporter.sendMail({
    to,
    from: smtpFrom,
    subject: `Confirm account deletion on ${host}`,
    text: deleteAccountText({ confirmationUrl, expiresInMinutes, host }),
    html: deleteAccountHtml({ confirmationUrl, expiresInMinutes, host }),
  });
};
