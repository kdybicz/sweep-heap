import { sendTransactionalEmail } from "@/lib/email/send-transactional-email";
import { renderHouseholdInviteEmail } from "@/lib/email/templates/household-invite-email";

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
  const host = new URL(inviteUrl).host;
  const { html, text } = await renderHouseholdInviteEmail({
    host,
    householdName,
    inviteUrl,
    inviterName,
  });

  await sendTransactionalEmail({
    html,
    subject: `Invitation to join ${householdName} on ${host}`,
    text,
    to,
  });
};
