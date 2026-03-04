import nodemailer from "nodemailer";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const inviteHtml = ({
  host,
  householdName,
  inviteUrl,
  inviterName,
}: {
  host: string;
  householdName: string;
  inviteUrl: string;
  inviterName: string;
}) => {
  const escapedHost = host.replace(/\./g, "&#8203;.");
  const escapedHouseholdName = escapeHtml(householdName);
  const escapedInviterName = escapeHtml(inviterName);
  const escapedInviteUrl = escapeHtml(inviteUrl);
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
        You are invited to join <strong>${escapedHouseholdName}</strong>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 10px 0; font-size: 14px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        ${escapedInviterName} invited you to a household on <strong>${escapedHost}</strong>.
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 10px 0;">
        <table border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="border-radius: 5px;" bgcolor="${color.buttonBackground}">
              <a href="${escapedInviteUrl}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${color.buttonText}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${color.buttonBorder}; display: inline-block; font-weight: bold;">
                Accept invite
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 10px 0; font-size: 14px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        Open the link to accept this invite. If needed, sign in with this email address first.
      </td>
    </tr>
  </table>
</body>`;
};

const inviteText = ({
  host,
  householdName,
  inviteUrl,
  inviterName,
}: {
  host: string;
  householdName: string;
  inviteUrl: string;
  inviterName: string;
}) =>
  [
    `You are invited to join ${householdName}`,
    "",
    `${inviterName} invited you to a household on ${host}.`,
    "",
    "Open this link to accept the invite:",
    inviteUrl,
    "",
    "If prompted, sign in with this email address first.",
  ].join("\n");

export const sendHouseholdInviteEmail = async ({
  householdName,
  inviteUrl,
  inviterName,
  to,
}: {
  householdName: string;
  inviteUrl: string;
  inviterName: string;
  to: string;
}) => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpFrom = process.env.SMTP_FROM;
  if (!smtpHost || !smtpFrom) {
    throw new Error("Email is not configured");
  }

  const parsedSmtpPort = Number(process.env.SMTP_PORT ?? 587);
  const smtpPort = Number.isFinite(parsedSmtpPort) ? parsedSmtpPort : 587;
  const smtpSecure = process.env.SMTP_SECURE
    ? ["1", "true", "yes", "on"].includes(process.env.SMTP_SECURE.toLowerCase())
    : smtpPort === 465;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const host = new URL(inviteUrl).host;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  });

  await transporter.sendMail({
    to,
    from: smtpFrom,
    subject: `Invitation to join ${householdName} on ${host}`,
    text: inviteText({ host, householdName, inviteUrl, inviterName }),
    html: inviteHtml({ host, householdName, inviteUrl, inviterName }),
  });
};
