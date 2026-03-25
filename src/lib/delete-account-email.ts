import { sendTransactionalEmail } from "@/lib/email/send-transactional-email";
import { renderDeleteAccountEmail } from "@/lib/email/templates/delete-account-email";

export const sendDeleteAccountConfirmationEmail = async ({
  confirmationUrl,
  expiresInMinutes,
  to,
}: {
  confirmationUrl: string;
  expiresInMinutes: number;
  to: string;
}) => {
  const host = new URL(confirmationUrl).host;
  const { html, text } = await renderDeleteAccountEmail({
    confirmationUrl,
    expiresInMinutes,
    host,
  });

  await sendTransactionalEmail({
    html,
    subject: `Confirm account deletion on ${host}`,
    text,
    to,
  });
};
