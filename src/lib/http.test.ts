import { describe, expect, it } from "vitest";

import { parseJsonObjectBody } from "@/lib/http";

const jsonRequest = (body: string) =>
  new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

describe("parseJsonObjectBody", () => {
  it("returns parsed object payloads", async () => {
    const payload = await parseJsonObjectBody(jsonRequest('{"name":"Home"}'));

    expect(payload).toEqual({ name: "Home" });
  });

  it("returns null for valid non-object json", async () => {
    await expect(parseJsonObjectBody(jsonRequest("[]"))).resolves.toBeNull();
    await expect(parseJsonObjectBody(jsonRequest('"value"'))).resolves.toBeNull();
    await expect(parseJsonObjectBody(jsonRequest("42"))).resolves.toBeNull();
  });

  it("returns null for malformed json", async () => {
    const payload = await parseJsonObjectBody(jsonRequest("{"));

    expect(payload).toBeNull();
  });
});
