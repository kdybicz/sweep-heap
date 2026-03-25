import { Section, Text } from "@react-email/components";

import EmailLayout from "@/lib/email/EmailLayout";
import { emailColors } from "@/lib/email/email-theme";
import { renderEmailTemplate } from "@/lib/email/render-email-template";

export const renderDeleteAccountEmail = async ({
  confirmationUrl,
  expiresInMinutes,
  host,
}: {
  confirmationUrl: string;
  expiresInMinutes: number;
  host: string;
}) =>
  renderEmailTemplate(
    <EmailLayout
      accentColor={emailColors.danger}
      actionHint="Only continue if you want to permanently remove your account from The Sweep Heap."
      actionLabel="Confirm deletion"
      actionUrl={confirmationUrl}
      closingNote="If you did not request account deletion, you can ignore this email."
      eyebrow="Account deletion"
      intro={`Use the secure link below to finish deleting your account on ${host}.`}
      preview="Confirm account deletion"
      summaryCards={[
        {
          label: "Expires",
          tone: "gold",
          value: `${expiresInMinutes} minutes`,
        },
        {
          label: "Impact",
          tone: "danger",
          value: "Account removed",
        },
        {
          label: "Household",
          tone: "coral",
          value: "Last member removes it too",
        },
      ]}
      title="Confirm account deletion."
    >
      <Section>
        <Text
          style={{
            color: emailColors.ink,
            fontSize: "14px",
            fontWeight: "700",
            lineHeight: "1.75",
            margin: "0 0 10px",
          }}
        >
          This action cannot be undone.
        </Text>
        <Text
          style={{ color: emailColors.muted, fontSize: "14px", lineHeight: "1.75", margin: "0" }}
        >
          If you are the last member of a household, deleting your account removes that household
          too.
        </Text>
      </Section>
    </EmailLayout>,
  );
