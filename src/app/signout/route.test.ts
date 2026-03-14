import { beforeEach, describe, expect, it, vi } from "vitest";

const { signOutMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: {
    api: {
      signOut: signOutMock,
    },
  },
}));

import { GET, POST } from "@/app/signout/route";

const requestWithFormData = (entries: Record<string, string>, origin = "http://localhost") => {
  const formData = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }

  return new Request("http://localhost/signout", {
    method: "POST",
    body: formData,
    headers: {
      cookie: "better-auth.session=abc",
      "content-type": "application/x-www-form-urlencoded",
      origin,
    },
  });
};

describe("/signout route", () => {
  beforeEach(() => {
    signOutMock.mockReset();
    signOutMock.mockResolvedValue(
      new Response(null, {
        headers: {
          "set-cookie": "better-auth.session=; Path=/; Max-Age=0",
        },
      }),
    );
  });

  it("rejects GET requests", async () => {
    const response = await GET();

    expect(response.status).toBe(405);
  });

  it("redirects to the safe local target after signing out", async () => {
    const response = await POST(
      requestWithFormData({
        redirectTo:
          "/auth?email=invite@example.com&callbackURL=%2Fapi%2Fhouseholds%2Finvites%2Fcomplete%3FinvitationId%3D12%26secret%3Ds3cr3t",
      }),
    );

    expect(signOutMock).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      asResponse: true,
    });
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location") ?? "", "http://localhost");
    expect(location.pathname).toBe("/auth");
    expect(location.searchParams.get("email")).toBe("invite@example.com");
    expect(location.searchParams.get("callbackURL")).toBe(
      "/api/households/invites/complete?invitationId=12&secret=s3cr3t",
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("falls back to landing for unsafe redirect targets", async () => {
    const response = await POST(
      requestWithFormData({
        redirectTo: "https://example.com/evil",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("falls back to landing for backslash network-path redirects", async () => {
    const response = await POST(
      requestWithFormData({
        redirectTo: "/\\evil.com",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("rejects cross-origin sign-out submissions", async () => {
    const response = await POST(requestWithFormData({}, "https://evil.example"));

    expect(response.status).toBe(403);
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("redirects to failure recovery when sign out responds non-ok", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      signOutMock.mockResolvedValue(new Response(null, { status: 500 }));

      const response = await POST(
        requestWithFormData({
          redirectTo: "/auth",
          failureRedirectTo: "/household/invite?invitationId=12&secret=s3cr3t&error=signout-failed",
        }),
      );

      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(
        "http://localhost/household/invite?invitationId=12&secret=s3cr3t&error=signout-failed",
      );
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("returns 500 when sign out fails without an explicit failure redirect", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      signOutMock.mockResolvedValue(new Response(null, { status: 500 }));

      const response = await POST(
        requestWithFormData({
          redirectTo: "/",
        }),
      );

      expect(response.status).toBe(500);
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
