import { defineConfig } from "@playwright/test";
import { baseURL, databaseURL, port } from "./e2e/config.mjs";

const suite = ["smoke", "regressions", "contention"].includes(process.env.E2E_SUITE)
  ? process.env.E2E_SUITE
  : "all";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 10000 },
  outputDir: `.e2e/test-results/${suite}`,
  reporter: [["list"], ["json", { outputFile: `.e2e/results-${suite}.json` }]],
  use: {
    baseURL,
    browserName: "chromium",
    viewport: { width: 1440, height: 1100 },
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/api/health`,
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      AUTH_URL: baseURL,
      DATABASE_URL: databaseURL,
      E2E_SERVER: "1",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
  projects: [
    { name: "smoke", testMatch: "smoke.spec.mjs" },
    { name: "regressions", testMatch: "regressions.spec.mjs" },
    ...(suite === "contention" ? [{ name: "contention", testMatch: "contention.spec.mjs" }] : []),
  ],
});
