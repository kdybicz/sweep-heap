import { beforeEach, describe, expect, it, vi } from "vitest";

const { headersMock, signOutMock } = vi.hoisted(() => ({
  headersMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("@/auth", () => ({
  auth: {
    api: {
      signOut: signOutMock,
    },
  },
}));

import { GET } from "@/app/signout/route";

describe("/signout route", () => {
  beforeEach(() => {
    headersMock.mockReset();
    signOutMock.mockReset();

    headersMock.mockResolvedValue(new Headers({ cookie: "better-auth.session=abc" }));
    signOutMock.mockResolvedValue(
      new Response(null, {
        headers: {
          "set-cookie": "better-auth.session=; Path=/; Max-Age=0",
        },
      }),
    );
  });

  it("redirects to the safe local target after signing out", async () => {
    const response = await GET(
      new Request(
        "http://localhost/signout?redirectTo=%2Fauth%3Femail%3Dinvite%2540example.com%26callbackURL%3D%252Fapi%252Fhouseholds%252Finvites%252Fcomplete%253FinvitationId%253D12%2526secret%253Ds3cr3t",
      ),
    );

    expect(signOutMock).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      asResponse: true,
    });
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "", "http://localhost");
    expect(location.pathname).toBe("/auth");
    expect(location.searchParams.get("email")).toBe("invite@example.com");
    expect(location.searchParams.get("callbackURL")).toBe(
      "/api/households/invites/complete?invitationId=12&secret=s3cr3t",
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("falls back to landing for unsafe redirect targets", async () => {
    const response = await GET(
      new Request("http://localhost/signout?redirectTo=https://example.com/evil"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("falls back to landing for backslash network-path redirects", async () => {
    const response = await GET(new Request("http://localhost/signout?redirectTo=%2F%5Cevil.com"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("returns 500 when sign out responds non-ok", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      signOutMock.mockResolvedValue(new Response(null, { status: 500 }));

      const response = await GET(new Request("http://localhost/signout"));

      expect(response.status).toBe(500);
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
