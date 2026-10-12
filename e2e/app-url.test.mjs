import { describe, expect, it } from "vitest";
import { parseE2EAppURL } from "./app-url.mjs";

describe("managed E2E app URL", () => {
  it.each(["http://localhost:3100", "http://localhost:3100/"])(
    "normalizes %s without introducing double-slash API paths",
    (value) => {
      const url = parseE2EAppURL(value);
      expect(url.origin).toBe("http://localhost:3100");
      expect(`${url.origin}/api/health`).toBe("http://localhost:3100/api/health");
    },
  );

  it("preserves the managed loopback port", () => {
    const url = parseE2EAppURL("http://127.0.0.1:3200/");
    expect(url.origin).toBe("http://127.0.0.1:3200");
    expect(url.port).toBe("3200");
  });

  it.each([
    "not a URL",
    "https://localhost:3100",
    "http://example.com:3100",
    "http://localhost:3100/household",
    "http://localhost:3100?weekOffset=1",
    "http://localhost:3100#board",
    "http://fixture:password@localhost:3100",
  ])("rejects unsupported origin configuration %s", (value) => {
    expect(() => parseE2EAppURL(value)).toThrow("E2E_BASE_URL must be a local HTTP origin");
  });
});
