import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const shell = process.platform === "win32" ? join(process.env.ProgramFiles, "Git", "bin", "bash.exe") : "sh";
const script = fileURLToPath(new URL("./persist-caddy-config.sh", import.meta.url));

async function scenario(mode, run) {
  const directory = await mkdtemp(join(tmpdir(), "caddy-persistence-"));
  try {
    const bin = join(directory, "bin");
    await mkdir(bin);
    await writeFile(join(directory, "original"), "old startup policy\n");
    await writeFile(join(directory, "startup"), mode === "concurrent" ? "operator edit\n" : "old startup policy\n");
    await writeFile(join(directory, "candidate"), "validated current policy\n");
    await writeFile(join(bin, "caddy"), `#!/bin/sh
printf '%s\\n' "$*" >> "$TEST_LOG"
if [ "$1" = validate ] && [ "$TEST_MODE" = invalid ]; then exit 1; fi
if [ "$1" = reload ] && grep -q validated "$3"; then
  case "$TEST_MODE" in reload-failure|rollback-failure) exit 1 ;; esac
fi
`, { mode: 0o755 });
    await writeFile(join(bin, "cp"), `#!/bin/sh
case "$TEST_MODE:\${1##*/}:\${2##*/}" in
  denied:candidate:startup) exit 1 ;;
  mismatch:candidate:startup) printf 'incomplete write\\n' > "$2"; exit 0 ;;
  partial:candidate:startup) printf 'incomplete write\\n' > "$2"; exit 1 ;;
  rollback-failure:Caddyfile.pre-deploy.*:startup) exit 1 ;;
esac
cat "$1" > "$2"
`, { mode: 0o755 });
    const result = spawnSync(shell, ["-c", 'PATH="$PWD/bin:$PATH"; export PATH; exec sh "$@"',
      "persistence-test", script, "original", "candidate", "startup"], {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        TEST_MODE: mode,
        TEST_LOG: "calls",
        TMPDIR: ".",
      },
    });
    assert.ifError(result.error);
    let calls = "";
    try { calls = await readFile(join(directory, "calls"), "utf8"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    await run({ result, calls, startup: await readFile(join(directory, "startup"), "utf8") });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("reloads only the saved verified startup file", async () => {
  await scenario("success", ({ result, calls, startup }) => {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(startup, "validated current policy\n");
    assert.equal(calls, "validate --config candidate --adapter caddyfile\nreload --config startup --adapter caddyfile\n");
    assert.match(result.stdout, /recovery backup:/);
  });
});

for (const mode of ["denied", "partial", "mismatch", "invalid", "concurrent"]) {
  test(`refuses runtime-only success for ${mode} configuration`, async () => {
    await scenario(mode, ({ result, calls, startup }) => {
      assert.notEqual(result.status, 0, result.stderr);
      assert.doesNotMatch(calls, /^reload/m);
      assert.equal(startup, mode === "concurrent" ? "operator edit\n" : "old startup policy\n");
      if (mode === "denied") assert.match(result.stderr, /refusing a runtime-only reload/);
    });
  });
}

test("restores and reloads the persistent original after a failed candidate reload", async () => {
  await scenario("reload-failure", ({ result, calls, startup }) => {
    assert.notEqual(result.status, 0);
    assert.equal(startup, "old startup policy\n");
    assert.equal(calls.match(/^reload --config startup --adapter caddyfile$/gm)?.length, 2);
    assert.match(result.stderr, /restoring the saved startup configuration/);
  });
});

test("reports a failed persistent rollback without pretending the original was restored", async () => {
  await scenario("rollback-failure", ({ result, calls, startup }) => {
    assert.notEqual(result.status, 0);
    assert.equal(startup, "validated current policy\n");
    assert.equal(calls.match(/^reload/mg)?.length, 1);
    assert.match(result.stderr, /CRITICAL: Could not restore.*Recovery backup:/);
    assert.doesNotMatch(result.stdout, /reloaded from the verified/);
  });
});
