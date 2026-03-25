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

import LandingPage from "@/app/page";

describe("LandingPage", () => {
  beforeEach(() => {
    redirectSignedInUserToAppMock.mockReset();
    redirectSignedInUserToAppMock.mockResolvedValue(undefined);
  });

  it("renders the redesigned hero and primary sign-in paths", async () => {
    const markup = renderToStaticMarkup(await LandingPage());

    expect(redirectSignedInUserToAppMock).toHaveBeenCalledOnce();
    expect(markup).toContain("A brighter weekly board for every household.");
    expect(markup).toContain('href="/auth"');
    expect(markup).toContain('href="#workflow"');
    expect(markup).toContain("Continue with email");
    expect(markup).not.toContain("Request a tour");
  });
});
