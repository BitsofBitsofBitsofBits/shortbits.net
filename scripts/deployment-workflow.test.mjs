import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Supabase deployment commands explicitly confirm unattended operations", async () => {
  const workflow = await readFile(new URL("../.github/workflows/site.yml", import.meta.url), "utf8");
  const commands = [...workflow.matchAll(/^\s+supabase (?:secrets set|functions deploy|link|db push)\b[^\n]*(?:\n\s+--[^\n]*)*/gm)];
  assert.equal(commands.length, 13);
  for (const [command] of commands) {
    assert.match(command, /--yes\b/, command);
  }
});
