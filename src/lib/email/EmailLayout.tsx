import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

import {
  type EmailTone,
  emailColors,
  emailFontFamily,
  emailToneStyles,
} from "@/lib/email/email-theme";

type EmailSummaryCard = {
  label: string;
  value: string;
  tone?: EmailTone;
};

type EmailLayoutProps = {
  preview: string;
  eyebrow: string;
  title: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  actionHint?: string;
  closingNote?: string;
  summaryCards?: EmailSummaryCard[];
  accentColor?: string;
  children?: ReactNode;
};

const styles = {
  body: {
    backgroundColor: emailColors.background,
    color: emailColors.ink,
    fontFamily: emailFontFamily,
    margin: "0",
    padding: "32px 16px",
  },
  container: {
    margin: "0 auto",
    maxWidth: "620px",
    width: "100%",
  },
  card: {
    backgroundColor: emailColors.surface,
    border: `1px solid ${emailColors.border}`,
    borderRadius: "18px",
    boxShadow: "0 18px 40px rgba(58, 45, 34, 0.08)",
    overflow: "hidden",
  },
  heroBand: {
    backgroundColor: emailColors.surfaceStrong,
    borderBottom: `1px solid ${emailColors.border}`,
    padding: "28px 32px 22px",
  },
  bodySection: {
    padding: "28px 32px 32px",
  },
  brand: {
    color: emailColors.blue,
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.28em",
    margin: "0 0 14px",
    textTransform: "uppercase",
  },
  eyebrow: {
    color: emailColors.coral,
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.28em",
    margin: "0 0 10px",
    textTransform: "uppercase",
  },
  title: {
    color: emailColors.ink,
    fontFamily: emailFontFamily,
    fontSize: "34px",
    fontWeight: "700",
    letterSpacing: "-0.04em",
    lineHeight: "1.05",
    margin: "0 0 14px",
  },
  intro: {
    color: emailColors.muted,
    fontSize: "16px",
    lineHeight: "1.75",
    margin: "0",
  },
  buttonWrap: {
    padding: "4px 0 0",
  },
  button: {
    borderRadius: "12px",
    color: emailColors.white,
    display: "inline-block",
    fontFamily: emailFontFamily,
    fontSize: "14px",
    fontWeight: "700",
    letterSpacing: "0.18em",
    padding: "14px 24px",
    textDecoration: "none",
    textTransform: "uppercase",
  },
  actionHint: {
    color: emailColors.muted,
    fontSize: "13px",
    lineHeight: "1.7",
    margin: "14px 0 0",
  },
  summaryCard: {
    border: `1px solid ${emailColors.border}`,
    borderRadius: "14px",
    marginTop: "12px",
    padding: "14px 16px",
  },
  summaryLabel: {
    color: emailColors.muted,
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.22em",
    margin: "0 0 8px",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: emailColors.ink,
    fontSize: "20px",
    fontWeight: "700",
    letterSpacing: "-0.03em",
    lineHeight: "1.3",
    margin: "0",
  },
  divider: {
    borderColor: emailColors.border,
    margin: "24px 0",
  },
  note: {
    color: emailColors.muted,
    fontSize: "14px",
    lineHeight: "1.75",
    margin: "0 0 14px",
  },
  fallbackLabel: {
    color: emailColors.muted,
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.18em",
    margin: "0 0 8px",
    textTransform: "uppercase",
  },
  fallbackLink: {
    color: emailColors.blue,
    display: "block",
    fontSize: "13px",
    lineHeight: "1.7",
    textDecoration: "underline",
    wordBreak: "break-all",
  },
} satisfies Record<string, CSSProperties>;

export default function EmailLayout({
  preview,
  eyebrow,
  title,
  intro,
  actionLabel,
  actionUrl,
  actionHint,
  closingNote,
  summaryCards = [],
  accentColor = emailColors.coral,
  children,
}: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.card}>
            <Section style={styles.heroBand}>
              <Text style={styles.brand}>The Sweep Heap</Text>
              <Text style={styles.eyebrow}>{eyebrow}</Text>
              <Heading as="h1" style={styles.title}>
                {title}
              </Heading>
              <Text style={styles.intro}>{intro}</Text>
            </Section>

            <Section style={styles.bodySection}>
              <Section style={styles.buttonWrap}>
                <Button href={actionUrl} style={{ ...styles.button, backgroundColor: accentColor }}>
                  {actionLabel}
                </Button>
              </Section>

              {actionHint ? <Text style={styles.actionHint}>{actionHint}</Text> : null}

              {summaryCards.length ? (
                <Section>
                  {summaryCards.map((card) => (
                    <Section
                      key={`${card.label}-${card.value}`}
                      style={{
                        ...styles.summaryCard,
                        ...(card.tone ? emailToneStyles[card.tone] : emailToneStyles.blue),
                      }}
                    >
                      <Text style={styles.summaryLabel}>{card.label}</Text>
                      <Text style={styles.summaryValue}>{card.value}</Text>
                    </Section>
                  ))}
                </Section>
              ) : null}

              {children ? (
                <>
                  <Hr style={styles.divider} />
                  {children}
                </>
              ) : null}

              <Hr style={styles.divider} />

              {closingNote ? <Text style={styles.note}>{closingNote}</Text> : null}

              <Text style={styles.fallbackLabel}>If the button does not work</Text>
              <Link href={actionUrl} style={styles.fallbackLink}>
                {actionUrl}
              </Link>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
