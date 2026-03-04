import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import * as nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv.default ?? nextEnv;

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/with-agent-env.mjs <command> [args...]");
  process.exit(1);
}

loadEnvConfig(process.cwd());

const parseEnvLine = (line) => {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = line.indexOf("=");
  if (separatorIndex === -1) {
    return null;
  }

  const key = line
    .slice(0, separatorIndex)
    .trim()
    .replace(/^export\s+/, "");
  if (!key) {
    return null;
  }

  let value = line.slice(separatorIndex + 1);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
};

const loadOverrides = (filePath) => {
  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }

    process.env[parsed.key] = parsed.value;
  }
};

const agentEnvFile = process.env.AGENT_ENV_FILE;

if (agentEnvFile) {
  loadOverrides(agentEnvFile);
}

loadOverrides(".env.agent.local");

try {
  execFileSync(args[0], args.slice(1), {
    stdio: "inherit",
    env: process.env,
  });
} catch (error) {
  process.exit(error.status ?? 1);
}
