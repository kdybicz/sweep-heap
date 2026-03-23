import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPendingHouseholdInviteMock, getSessionMock, resolveActiveHouseholdMock } = vi.hoisted(
  () => ({
    getPendingHouseholdInviteMock: vi.fn(),
    getSessionMock: vi.fn(),
    resolveActiveHouseholdMock: vi.fn(),
  }),
);

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

vi.mock("@/lib/services/active-household-service", () => ({
  resolveActiveHousehold: resolveActiveHouseholdMock,
}));

vi.mock("@/lib/services/household-invite-service", () => ({
  getPendingHouseholdInvite: getPendingHouseholdInviteMock,
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

  beforeEach(() => {
    getPendingHouseholdInviteMock.mockReset();
    getSessionMock.mockReset();
    resolveActiveHouseholdMock.mockReset();
  });

  it("renders switch-account form when a different account is signed in", async () => {
    getPendingHouseholdInviteMock.mockResolvedValue(invite);
    getSessionMock.mockResolvedValue({
      user: { id: "42", email: "other@example.com" },
      session: { activeOrganizationId: "7" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: { id: 7, name: "Home", role: "owner", timeZone: "UTC" },
    });

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
    expect(markup).toContain('href="/household"');
    expect(markup).toContain("Back to board");
    expect(markup).not.toContain('data-testid="accept-form"');
  });

  it("keeps switch-account recovery available for sign-in callback errors", async () => {
    getPendingHouseholdInviteMock.mockResolvedValue(invite);
    getSessionMock.mockResolvedValue({
      user: { id: "42", email: "invited@example.com" },
      session: { activeOrganizationId: null },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "selection-required",
      households: [
        { id: 7, name: "Home", role: "owner", timeZone: "UTC" },
        { id: 8, name: "Cabin", role: "member", timeZone: "UTC" },
      ],
    });

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
    expect(markup).toContain('href="/household/select"');
    expect(markup).toContain("Back to household selection");
    expect(markup).not.toContain('data-testid="accept-form"');
  });

  it("renders the acceptance form for a matching session without recovery errors", async () => {
    getPendingHouseholdInviteMock.mockResolvedValue(invite);
    getSessionMock.mockResolvedValue({
      user: { id: "42", email: "invited@example.com" },
      session: { activeOrganizationId: null },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "none",
    });

    const markup = renderToStaticMarkup(
      await HouseholdInvitePage({
        searchParams: Promise.resolve({ invitationId: "12", secret: "invite-secret" }),
      }),
    );

    expect(markup).toContain('data-testid="accept-form"');
    expect(markup).toContain('href="/household/setup"');
    expect(markup).toContain("Back to household setup");
    expect(markup).not.toContain("Sign out and continue");
  });

  it("keeps sign-in as the escape path when no session is active", async () => {
    getPendingHouseholdInviteMock.mockResolvedValue(invite);
    getSessionMock.mockResolvedValue(null);

    const markup = renderToStaticMarkup(
      await HouseholdInvitePage({
        searchParams: Promise.resolve({ invitationId: "12", secret: "invite-secret" }),
      }),
    );

    expect(resolveActiveHouseholdMock).not.toHaveBeenCalled();
    expect(markup).toContain('href="/auth"');
    expect(markup).toContain("Back to sign in");
  });
});
