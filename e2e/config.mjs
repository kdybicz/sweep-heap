import * as nextEnv from "@next/env";
import { parseE2EAppURL } from "./app-url.mjs";

const { loadEnvConfig } = nextEnv.default ?? nextEnv;
loadEnvConfig(process.cwd());

const appURL = parseE2EAppURL(process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100");
export const baseURL = appURL.origin;
export const port = Number(appURL.port || "80");
export const databaseURL = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
export const mailpitURL = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";
if (!databaseURL)
  throw new Error("DATABASE_URL or E2E_DATABASE_URL is required for live E2E tests");
