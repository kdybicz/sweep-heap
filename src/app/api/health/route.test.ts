import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_ERROR_CODE } from "@/lib/api-error";

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  pool: {
    query: queryMock,
  },
}));

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("returns database time when query succeeds", async () => {
    const now = new Date("2026-03-06T14:20:00.000Z");
    queryMock.mockResolvedValue({ rows: [{ now }] });

    const response = await GET();
    const body = await response.json();

    expect(queryMock).toHaveBeenCalledWith("select now() as now");
    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      now: now.toISOString(),
    });
  });

  it("returns null now when query has no rows", async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      now: null,
    });
  });

  it("returns consistent 500 envelope on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      queryMock.mockRejectedValue(new Error("db unavailable"));

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Health check failed",
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
