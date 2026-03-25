import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock, searchParamsGetMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  searchParamsGetMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useSearchParams: () => ({
    get: searchParamsGetMock,
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      magicLink: vi.fn(),
    },
  },
}));

import AuthForm from "@/app/auth/AuthForm";

describe("AuthForm", () => {
  beforeEach(() => {
    pushMock.mockReset();
    searchParamsGetMock.mockReset();
    searchParamsGetMock.mockReturnValue(null);
  });

  it("renders the focused email sign-in form", () => {
    const markup = renderToStaticMarkup(<AuthForm />);

    expect(markup).toContain("Email address");
    expect(markup).toContain("Send magic link");
    expect(markup).toContain('id="auth-email"');
    expect(markup).toContain('type="email"');
  });
});
