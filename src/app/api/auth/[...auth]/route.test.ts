import { describe, expect, it, vi } from "vitest";

const { authMock, getHandlerMock, postHandlerMock, toNextJsHandlerMock } = vi.hoisted(() => ({
  authMock: { mocked: true },
  getHandlerMock: vi.fn(),
  postHandlerMock: vi.fn(),
  toNextJsHandlerMock: vi.fn(() => ({
    GET: getHandlerMock,
    POST: postHandlerMock,
  })),
}));

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: toNextJsHandlerMock,
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

import { GET, POST, runtime } from "@/app/api/auth/[...auth]/route";

describe("/api/auth/[...auth] route", () => {
  it("exports node runtime and delegates handlers to better-auth", () => {
    expect(runtime).toBe("nodejs");
    expect(toNextJsHandlerMock).toHaveBeenCalledWith(authMock);
    expect(GET).toBe(getHandlerMock);
    expect(POST).toBe(postHandlerMock);
  });
});
