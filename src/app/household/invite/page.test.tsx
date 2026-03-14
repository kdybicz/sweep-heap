import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { getSessionMock, getPendingHouseholdInviteByIdAndSecretMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getPendingHouseholdInviteByIdAndSecretMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/repositories", () => ({
  getPendingHouseholdInviteByIdAndSecret: getPendingHouseholdInviteByIdAndSecretMock,
}));

vi.mock("@/app/household/invite/HouseholdInviteAcceptanceForm", () => ({
  default: ({ householdName }: { householdName: string }) => (
    <div data-testid="accept-form">Accept {householdName}</div>
  ),
}));

import HouseholdInvitePage from "@/app/household/invite/page";

describe("HouseholdInvitePage", () => {
  const invite = {
    id: 12,
    householdId: 11,
    householdName: "Home",
    email: "invited@example.com",
    role: "member",
    expiresAt: new Date("2026-01-02T00:00:00.000Z"),
  };

  it("renders switch-account form when a different account is signed in", async () => {
    getPendingHouseholdInviteByIdAndSecretMock.mockResolvedValue(invite);
    getSessionMock.mockResolvedValue({ user: { email: "other@example.com" } });

    const markup = renderToStaticMarkup(
      await HouseholdInvitePage({
        searchParams: Promise.resolve({ invitationId: "12", secret: "invite-secret" }),
      }),
    );

    expect(markup).toContain("Sign out and continue");
    expect(markup).toContain("currently signed in as");
    expect(markup).toContain('action="/signout"');
    expect(markup).toContain('name="redirectTo"');
    expect(markup).toContain("invited@example.com");
    expect(markup).not.toContain('data-testid="accept-form"');
  });

  it("keeps switch-account recovery available for sign-in callback errors", async () => {
    getPendingHouseholdInviteByIdAndSecretMock.mockResolvedValue(invite);
    getSessionMock.mockResolvedValue({ user: { email: "invited@example.com" } });

    const markup = renderToStaticMarkup(
      await HouseholdInvitePage({
        searchParams: Promise.resolve({
          error: "sign-in",
          invitationId: "12",
          secret: "invite-secret",
        }),
      }),
    );

    expect(markup).toContain("Sign-out recovery is available if this session is no longer valid");
    expect(markup).toContain("Sign in with the invited email address to continue.");
    expect(markup).toContain('name="failureRedirectTo"');
    expect(markup).not.toContain('data-testid="accept-form"');
  });

  it("renders the acceptance form for a matching session without recovery errors", async () => {
    getPendingHouseholdInviteByIdAndSecretMock.mockResolvedValue(invite);
    getSessionMock.mockResolvedValue({ user: { email: "invited@example.com" } });

    const markup = renderToStaticMarkup(
      await HouseholdInvitePage({
        searchParams: Promise.resolve({ invitationId: "12", secret: "invite-secret" }),
      }),
    );

    expect(markup).toContain('data-testid="accept-form"');
    expect(markup).not.toContain("Sign out and continue");
  });
});
