import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { describe, expect, it } from "vitest";
import { getPluginHttpPaths } from "@/lib/auth-endpoint-policy";

describe("server-only organization HTTP policy", () => {
  it("blocks real plugin routes before authentication or database access", async () => {
    const plugin = organization();
    const disabledPaths = getPluginHttpPaths(plugin);
    const auth = betterAuth({
      baseURL: "http://localhost:3000",
      secret: "endpoint-policy-test-secret-at-least-32-characters",
      disabledPaths,
      plugins: [plugin],
    });
    expect(disabledPaths).toEqual(
      expect.arrayContaining([
        "/organization/create",
        "/organization/update",
        "/organization/delete",
        "/organization/invite-member",
        "/organization/accept-invitation",
        "/organization/update-member-role",
        "/organization/remove-member",
        "/organization/leave",
        "/organization/set-active",
        "/organization/list",
      ]),
    );
    for (const path of disabledPaths.flatMap((value) => [value, `${value}/`])) {
      for (const method of ["GET", "POST"]) {
        const response = await auth.handler(
          new Request(`http://localhost:3000/api/auth${path}`, {
            method,
            headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
            ...(method === "POST" ? { body: "{}" } : {}),
          }),
        );
        expect(response.status, `${method} ${path}`).toBe(404);
      }
    }
    expect(auth.api.acceptInvitation).toBeTypeOf("function");
    expect(auth.api.deleteOrganization).toBeTypeOf("function");
  });

  it("covers optional team and access-control endpoints when enabled", () => {
    const paths = getPluginHttpPaths(
      organization({
        teams: { enabled: true },
        dynamicAccessControl: { enabled: true },
      }),
    );
    expect(paths).toContain("/organization/create-team");
    expect(paths).toContain("/organization/create-role");
  });
});
