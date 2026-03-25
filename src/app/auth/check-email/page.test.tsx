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

import CheckEmailPage from "@/app/auth/check-email/page";

describe("CheckEmailPage", () => {
  beforeEach(() => {
    redirectSignedInUserToAppMock.mockReset();
    redirectSignedInUserToAppMock.mockResolvedValue(undefined);
  });

  it("renders the updated inbox guidance and recovery links", async () => {
    const markup = renderToStaticMarkup(await CheckEmailPage());

    expect(redirectSignedInUserToAppMock).toHaveBeenCalledOnce();
    expect(markup).toContain("Check your inbox to finish signing in.");
    expect(markup).toContain("Use a different email");
    expect(markup).toContain('href="/auth"');
    expect(markup).toContain('href="/"');
  });
});
