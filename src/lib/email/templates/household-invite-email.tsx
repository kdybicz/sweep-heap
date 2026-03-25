import { Section, Text } from "@react-email/components";

import EmailLayout from "@/lib/email/EmailLayout";
import { emailColors } from "@/lib/email/email-theme";
import { renderEmailTemplate } from "@/lib/email/render-email-template";

export type HouseholdInviteEmailProps = {
  host: string;
  householdName: string;
  inviteUrl: string;
  inviterName: string;
};

const householdInvitePreviewProps = {
  host: "example.com",
  householdName: "Sunday House",
  inviteUrl: "https://example.com/invite?token=preview",
  inviterName: "Alex",
} satisfies HouseholdInviteEmailProps;

function HouseholdInviteEmail({
  host,
  householdName,
  inviteUrl,
  inviterName,
}: HouseholdInviteEmailProps) {
  return (
    <EmailLayout
      accentColor={emailColors.coral}
      actionHint="If you need to sign in first, use the same email address that received this invite."
      actionLabel="Accept household invite"
      actionUrl={inviteUrl}
      closingNote="If this invite was not meant for you, you can ignore this email."
      eyebrow="Household invite"
      intro={`${inviterName} invited you into ${householdName} on The Sweep Heap at ${host}.`}
      preview={`Join ${householdName} on The Sweep Heap`}
      summaryCards={[
        {
          label: "Household",
          tone: "coral",
          value: householdName,
        },
        {
          label: "Invited by",
          tone: "blue",
          value: inviterName,
        },
        {
          label: "After you join",
          tone: "teal",
          value: "Household board opens",
        },
      ]}
      title={`Join ${householdName}.`}
    >
      <Section>
        <Text
          style={{ color: emailColors.muted, fontSize: "14px", lineHeight: "1.75", margin: "0" }}
        >
          Accept the invite when you are ready to join this household.
        </Text>
      </Section>
    </EmailLayout>
  );
}

const HouseholdInviteEmailPreview = Object.assign(HouseholdInviteEmail, {
  PreviewProps: householdInvitePreviewProps,
});

export default HouseholdInviteEmailPreview;

export const renderHouseholdInviteEmail = async (props: HouseholdInviteEmailProps) =>
  renderEmailTemplate(<HouseholdInviteEmail {...props} />);
