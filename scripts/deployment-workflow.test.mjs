import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

test("Supabase deployment commands explicitly confirm unattended operations", async () => {
  const workflow = await readFile(new URL("../.github/workflows/site.yml", import.meta.url), "utf8");
  const commands = [...workflow.matchAll(/^\s+supabase (?:secrets set|functions deploy|link|db push)\b[^\n]*(?:\n\s+--[^\n]*)*/gm)];
  assert.equal(commands.length, 15);
  for (const [command] of commands) {
    assert.match(command, /--yes\b/, command);
  }
});

test("missing release credentials fail explicitly and frontend deployment requires successful migrations", async () => {
  const workflow = (await readFile(new URL("../.github/workflows/site.yml", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  const block = workflow.match(/- name: Check Supabase credentials[\s\S]*?run: \|\n([\s\S]*?)(?=\n      - name:)/);
  assert.ok(block, "Release credential check must exist");
  const script = block[1].replace(/^ {10}/gm, "");
  const shell = process.platform === "win32" ? join(process.env.ProgramFiles, "Git", "bin", "bash.exe") : "sh";
  for (const [token, password] of [["", ""], ["fixture", ""], ["", "fixture"], ["fixture", "fixture"]]) {
    const result = spawnSync(shell, ["-c", script], {
      encoding: "utf8",
      env: {
        ...process.env,
        SUPABASE_ACCESS_TOKEN: token,
        SUPABASE_DB_PASSWORD: password,
        GITHUB_OUTPUT: "/dev/null",
      },
    });

    assert.ifError(result.error);
    assert.equal(result.status, token && password ? 0 : 1, result.stderr);
    if (!token || !password) assert.match(result.stdout, /::error::.*credentials are missing/);
  }
  const deploy = workflow.split("\n  deploy:\n")[1]?.split("\n    steps:")[0];
  assert.ok(deploy, "Frontend deployment gate must exist");
  assert.match(deploy, /&& needs\.supabase\.result == 'success'/);
  assert.match(deploy, /needs: \[validate, supabase\]/);
});

test("optional publisher authentication rejects missing hashes before migration and never receives the caller token", async () => {
  const workflow = (await readFile(new URL("../.github/workflows/site.yml", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  const block = workflow.match(/- name: Configure optional changelog publisher authentication[\s\S]*?run: \|\n([\s\S]*?)(?=\n      - name:)/);
  assert.ok(block);
  const script = block[1].replace(/^ {10}/gm, "");
  const shell = process.platform === "win32" ? join(process.env.ProgramFiles, "Git", "bin", "bash.exe") : "bash";
  for (const hash of ["", "invalid", "A".repeat(64), "a".repeat(64)]) {
    const result = spawnSync(shell, ["-c", `supabase() { printf '%s\\n' "$@"; }\n${script}`], {
      encoding: "utf8", env: { ...process.env, CHANGELOG_PUBLISH_TOKEN_SHA256: hash, SUPABASE_PROJECT_REF: "fixture" },
    });
    assert.ifError(result.error);
    assert.equal(result.status, hash === "a".repeat(64) ? 0 : 1, result.stderr);
    if (result.status === 0) assert.match(result.stdout, /--yes/);
    else assert.match(result.stdout, /::error::.*token hash/);
  }
  assert.ok(workflow.indexOf("Configure optional changelog publisher authentication") < workflow.indexOf("Apply database migrations"));
  assert.doesNotMatch(script, /CHANGELOG_PUBLISH_TOKEN(?!_SHA256)/);
});
