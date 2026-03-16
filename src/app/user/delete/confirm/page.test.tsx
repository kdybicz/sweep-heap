import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getOptionalSessionContextMock, isDeleteAccountTokenValidMock } = vi.hoisted(() => ({
  getOptionalSessionContextMock: vi.fn(),
  isDeleteAccountTokenValidMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
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

vi.mock("@/lib/repositories", () => ({
  isDeleteAccountTokenValid: isDeleteAccountTokenValidMock,
}));

vi.mock("@/lib/session-context", () => ({
  getOptionalSessionContext: getOptionalSessionContextMock,
}));

vi.mock("@/app/user/delete/confirm/DeleteAccountConfirmationForm", () => ({
  default: () => <div data-testid="delete-account-confirmation-form" />,
}));

import DeleteAccountConfirmationPage from "@/app/user/delete/confirm/page";

describe("DeleteAccountConfirmationPage", () => {
  beforeEach(() => {
    getOptionalSessionContextMock.mockReset();
    isDeleteAccountTokenValidMock.mockReset();
  });

  it("renders a back-to-profile link when the user is signed in", async () => {
    isDeleteAccountTokenValidMock.mockResolvedValue(true);
    getOptionalSessionContextMock.mockResolvedValue({
      sessionActiveHouseholdId: 7,
      sessionUserEmail: "alex@example.com",
      sessionUserId: "12",
      sessionUserName: "Alex",
      userId: 12,
    });

    const markup = renderToStaticMarkup(
      await DeleteAccountConfirmationPage({
        searchParams: Promise.resolve({
          identifier: "delete-account:12:nonce",
          token: "secret-token",
        }),
      }),
    );

    expect(markup).toContain('data-testid="delete-account-confirmation-form"');
    expect(markup).toContain('href="/user/edit"');
    expect(markup).toContain("Back to profile");
  });

  it("renders a back-to-sign-in link when the user is signed out", async () => {
    isDeleteAccountTokenValidMock.mockResolvedValue(true);
    getOptionalSessionContextMock.mockResolvedValue(null);

    const markup = renderToStaticMarkup(
      await DeleteAccountConfirmationPage({
        searchParams: Promise.resolve({
          identifier: "delete-account:12:nonce",
          token: "secret-token",
        }),
      }),
    );

    expect(markup).toContain('data-testid="delete-account-confirmation-form"');
    expect(markup).toContain('href="/auth"');
    expect(markup).toContain("Back to sign in");
  });
});
