import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectSignedInUserToAppMock } = vi.hoisted(() => ({
  redirectSignedInUserToAppMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/page-access", () => ({
  redirectSignedInUserToApp: redirectSignedInUserToAppMock,
}));

vi.mock("@/app/auth/AuthForm", () => ({
  default: () => <div data-testid="auth-form" />,
}));

import AuthPage from "@/app/auth/page";

describe("AuthPage", () => {
  beforeEach(() => {
    redirectSignedInUserToAppMock.mockReset();
    redirectSignedInUserToAppMock.mockResolvedValue(undefined);
  });

  it("renders the updated sign-in framing and next-step copy", async () => {
    const markup = renderToStaticMarkup(await AuthPage());

    expect(redirectSignedInUserToAppMock).toHaveBeenCalledOnce();
    expect(markup).toContain('data-testid="auth-form"');
    expect(markup).toContain("Sign in and we will route you to the right next step.");
    expect(markup).toContain("Open your existing board");
    expect(markup).toContain('href="/"');
  });
});
