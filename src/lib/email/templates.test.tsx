import { describe, expect, it } from "vitest";

import { renderDeleteAccountEmail } from "@/lib/email/templates/delete-account-email";
import { renderHouseholdInviteEmail } from "@/lib/email/templates/household-invite-email";
import { renderMagicLinkEmail } from "@/lib/email/templates/magic-link-email";

describe("email templates", () => {
  it.each(["magic-link", "invite", "delete"] as const)(
    "preserves escaped content and multi-parameter action links in both %s MIME parts",
    async (kind) => {
      const url =
        "https://example.com/action?identifier=fixture%2Btest&token=a-b_c&return=%2Fhousehold";
      const host = "House <script>alert(1)</script> & Łódź";
      const result =
        kind === "magic-link"
          ? await renderMagicLinkEmail({ email: "alex@example.com", host, url })
          : kind === "invite"
            ? await renderHouseholdInviteEmail({
                host,
                householdName: "Sunday House",
                inviterName: "Alex",
                inviteUrl: url,
              })
            : await renderDeleteAccountEmail({ host, expiresInMinutes: 30, confirmationUrl: url });
      expect(result.html).toContain("&lt;script&gt;");
      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain(`href="${url.replaceAll("&", "&amp;")}"`);
      expect(result.text).toContain(host);
      expect(result.text).toContain(url);
      expect(result.text).not.toContain("<html");
      expect(result.text).not.toContain("<table");
      if (kind === "magic-link")
        expect(result.text).not.toContain("Your sign-in link for The Sweep Heap");
    },
  );
  it("renders the magic-link email with shared framing and text fallback", async () => {
    const url = "https://example.com/auth/callback?token=abc";
    const { html, text } = await renderMagicLinkEmail({
      email: "alex@example.com",
      host: "example.com",
      url,
    });

    expect(html).toContain("The Sweep Heap");
    expect(html).toContain("Your sign-in link is ready.");
    expect(html).toContain("alex@example.com");
    expect(html).toContain(`href="${url}"`);
    expect(text).toMatch(/open sign-in link/i);
    expect(text).toContain("Board, setup, or selector");
    expect(text).toContain(url);
  });

  it("renders the household invite email with inviter and household context", async () => {
    const inviteUrl = "https://example.com/invite?token=abc";
    const { html, text } = await renderHouseholdInviteEmail({
      host: "example.com",
      householdName: "Sunday House",
      inviteUrl,
      inviterName: "Alex",
    });

    expect(html).toContain("Join Sunday House.");
    expect(html).toContain("Household board opens");
    expect(html).toContain("Alex");
    expect(html).toContain(`href="${inviteUrl}"`);
    expect(text).toContain("Sunday House");
    expect(text).toContain(inviteUrl);
  });

  it("renders the delete-account email with expiry and warning copy", async () => {
    const confirmationUrl = "https://example.com/delete?token=abc";
    const { html, text } = await renderDeleteAccountEmail({
      confirmationUrl,
      expiresInMinutes: 30,
      host: "example.com",
    });

    expect(html).toContain("Confirm account deletion.");
    expect(html).toContain("30 minutes");
    expect(html).toContain("This action cannot be undone.");
    expect(html).toContain(`href="${confirmationUrl}"`);
    expect(text).toMatch(/account removed/i);
    expect(text).toContain(confirmationUrl);
  });
});
