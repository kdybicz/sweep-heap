import type { BetterAuthPlugin } from "better-auth";

/** Disable a plugin's HTTP routes while retaining its server-side auth.api methods. */
export const getPluginHttpPaths = (plugin: Pick<BetterAuthPlugin, "endpoints">): string[] =>
  Object.values(plugin.endpoints ?? {}).flatMap((endpoint) =>
    "path" in endpoint && typeof endpoint.path === "string" ? [endpoint.path] : [],
  );
