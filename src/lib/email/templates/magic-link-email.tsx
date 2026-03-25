import { Section, Text } from "@react-email/components";

import EmailLayout from "@/lib/email/EmailLayout";
import { emailColors } from "@/lib/email/email-theme";
import { renderEmailTemplate } from "@/lib/email/render-email-template";

export type MagicLinkEmailProps = {
  email: string;
  host: string;
  url: string;
};

const magicLinkPreviewProps = {
  email: "alex@example.com",
  host: "example.com",
  url: "https://example.com/auth/callback?token=preview",
} satisfies MagicLinkEmailProps;

function MagicLinkEmail({ email, host, url }: MagicLinkEmailProps) {
  return (
    <EmailLayout
      accentColor={emailColors.blue}
      actionHint="For the smoothest handoff, open it on the same device where you requested it."
      actionLabel="Open sign-in link"
      actionUrl={url}
      closingNote="If you did not request this sign-in link, you can ignore this email."
      eyebrow="Continue with email"
      intro={`Use the secure link below to continue into The Sweep Heap on ${host}. No password is required.`}
      preview="Your sign-in link for The Sweep Heap"
      summaryCards={[
        {
          label: "Sent to",
          tone: "blue",
          value: email,
        },
        {
          label: "Next screen",
          tone: "teal",
          value: "Board, setup, or selector",
        },
        {
          label: "Site",
          tone: "gold",
          value: host,
        },
      ]}
      title="Your sign-in link is ready."
    >
      <Section>
        <Text
          style={{ color: emailColors.muted, fontSize: "14px", lineHeight: "1.75", margin: "0" }}
        >
          This link is meant for the email address that received it.
        </Text>
      </Section>
    </EmailLayout>
  );
}

const MagicLinkEmailPreview = Object.assign(MagicLinkEmail, {
  PreviewProps: magicLinkPreviewProps,
});

export default MagicLinkEmailPreview;

export const renderMagicLinkEmail = async (props: MagicLinkEmailProps) =>
  renderEmailTemplate(<MagicLinkEmail {...props} />);
