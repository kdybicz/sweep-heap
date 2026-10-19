import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const targets = ["test/e2e", "test/e2e/combined", "test/e2e/regressions", "test/e2e/contention"];
const filters = [
  ["--grep '#32'", ["--grep", "#32"]],
  ['--grep "#32"', ["--grep", "#32"]],
  ["--grep 'failed week refresh'", ["--grep", "failed week refresh"]],
  ['--grep "Havana\'s midnight"', ["--grep", "Havana's midnight"]],
];

describe.each(targets)("%s shell arguments", (target) => {
  it.each(filters)("preserves %s", (args, expected) => {
    const recipe = execFileSync(
      "make",
      ["--no-print-directory", "-n", target, `args=${args}`, "NVM_DIR=/dev/null"],
      { encoding: "utf8" },
    ).trim();
    const command = `corepack yarn ${target.replaceAll("/", ":")} `;
    expect(recipe).toContain(command);
    const probe = recipe.replace(
      command,
      'node -e "console.log(JSON.stringify(process.argv.slice(1)))" -- ',
    );
    const output = execFileSync("bash", ["-c", probe], {
      encoding: "utf8",
      env: { ...process.env, BASH_ENV: "/dev/null" },
    });
    expect(JSON.parse(output.trim())).toEqual(expected);
  });
});
