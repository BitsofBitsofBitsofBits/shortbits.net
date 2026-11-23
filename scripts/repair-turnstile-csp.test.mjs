import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const shell = process.platform === "win32" ? join(process.env.ProgramFiles, "Git", "bin", "bash.exe") : "sh";
const updater = fileURLToPath(new URL("./repair-turnstile-csp.awk", import.meta.url));
const source = `www.shortbits.net, shortbits.net {
  header Content-Security-Policy "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'sha256-existing'; frame-src https://open.spotify.com; connect-src 'self' https://example.supabase.co;"
  header X-Frame-Options DENY
  root * /srv/bitsofbits
  file_server
}
other.example {
  respond "unchanged"
}
`;
function repair(input) {
  const result = spawnSync(shell, ["-c", 'exec awk -f "$1"', "repair-test", updater], {
    input, encoding: "utf8",
  });
  assert.ifError(result.error);
  return result;
}

test("Node-free repair adds only the Turnstile script/frame origin and is idempotent", () => {
  const result = repair(source);
  assert.equal(result.status, 0, result.stderr);
  const expected = source.replace("'sha256-existing';", "'sha256-existing' https://challenges.cloudflare.com;")
    .replace("https://open.spotify.com;", "https://open.spotify.com https://challenges.cloudflare.com;");
  assert.equal(result.stdout, expected, "All unrelated directives, sites and existing sources are preserved");
  assert.equal(repair(result.stdout).stdout, expected);
});

test("preserves trailing spacing and mixed-case directive names", () => {
  const input = '  header Content-Security-Policy "Script-Src \'self\'  ; Frame-Src \'self\' ;" # keep\n';
  const result = repair(input);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '  header Content-Security-Policy "Script-Src \'self\' https://challenges.cloudflare.com  ; Frame-Src \'self\' https://challenges.cloudflare.com ;" # keep\n');
});

for (const [name, input] of [
  ["multiple headers", source + source],
  ["missing script directive", source.replace("script-src", "script-src-elem")],
  ["duplicate frame directive", source.replace("connect-src", "frame-src")],
  ["none directive", source.replace("script-src 'self'", "script-src 'none'")],
  ["explicit script element policy", source.replace("connect-src", "script-src-elem")],
  ["unquoted policy", "header Content-Security-Policy default-src 'self'\n"],
  ["multiline policy", 'header Content-Security-Policy "script-src \'self\';\nframe-src \'self\';"\n'],
  ["no policy", 'respond "hello"\n'],
]) {
  test(`rejects ${name} without emitting a partial candidate or config contents`, () => {
    const result = repair(input);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /ERROR:/);
    assert.doesNotMatch(result.stderr, /sha256-existing|example.supabase/);
  });
}
