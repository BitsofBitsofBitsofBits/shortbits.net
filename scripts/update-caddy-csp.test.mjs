import test from "node:test";
import assert from "node:assert/strict";
import { updateCaddyCsp, updateCaddyConfig } from "./update-caddy-csp.mjs";

test("adds only the Lanyard socket endpoint and preserves existing sources", () => {
  const input = `example.test {
  header Content-Security-Policy "default-src 'self'; script-src 'self' 'sha256-existing'; connect-src 'self' https://example.supabase.co;"
}`;
  const output = updateCaddyCsp(input);
  assert.match(output, /connect-src 'self' https:\/\/example\.supabase\.co https:\/\/cloudflareinsights\.com wss:\/\/api\.lanyard\.rest\/socket;/);
  assert.match(output, /'sha256-existing'/);
  assert.doesNotMatch(output, /unsafe-inline|wss:;|wss:\/\/\*/);
  assert.equal(updateCaddyCsp(output), output);
});

test("creates missing directives without widening script permission", () => {
  const output = updateCaddyCsp(`header Content-Security-Policy "default-src 'self'"`);
  assert.match(output, /connect-src 'self' https:\/\/cloudflareinsights\.com wss:\/\/api\.lanyard\.rest\/socket;/);
  assert.match(output, /script-src 'self' https:\/\/static\.cloudflareinsights\.com https:\/\/challenges\.cloudflare\.com;/);
  assert.doesNotMatch(output, /unsafe-inline/);
});

test("rejects Caddyfiles without a quoted CSP instead of silently changing nothing", () => {
  assert.throws(() => updateCaddyCsp("example.test { file_server }"), /does not contain/);
});

const site = `www.shortbits.net, shortbits.net {
  root * /srv/shortbits
  header {
    Content-Security-Policy "default-src 'self'; script-src 'self'; connect-src 'self';"
    X-Content-Type-Options nosniff
  }
  encode gzip
  file_server
}
`;

test("scopes precompression, caching, and CSP changes to the identified shortbits site", () => {
  const unrelated = `other.example {
  root * /srv/other
  header Content-Security-Policy "default-src 'none';"
  file_server
}
`;
  const output = updateCaddyConfig(unrelated + site);
  assert.ok(output.startsWith(unrelated));
  assert.match(output, /file_server \{\n    precompressed br gzip\n  \}/);
  assert.match(output, /path_regexp \\\.\(js\|css\)\$/);
  assert.match(output, /file \{path\}/);
  assert.ok(output.includes("expression `{http.request.uri.query.v}.matches('^[a-f0-9]{16}$')`"));
  assert.match(output, /header @bits_versioned_static >Cache-Control "public, max-age=31536000, immutable"/);
  assert.match(output, /wss:\/\/api\.lanyard\.rest\/socket/);
  assert.match(output, /encode gzip/);
  assert.doesNotMatch(output, /unsafe-inline/);
  assert.equal(updateCaddyConfig(output), output);
});

test("preserves existing simple file_server options and enables both sidecar formats", () => {
  const input = site.replace("  file_server", "  file_server {\n    hide .git\n    precompressed gzip\n  }");
  const output = updateCaddyConfig(input);
  assert.match(output, /hide \.git/);
  assert.match(output, /precompressed br gzip/);
  assert.equal(updateCaddyConfig(output), output);
});

test("accepts a single-line header directive with an absolute quoted site root", () => {
  const input = `https://shortbits.net {
  root * "/srv/shortbits site"
  header Content-Security-Policy "default-src 'self';"
  file_server
}
`;
  assert.match(updateCaddyConfig(input), /precompressed br gzip/);
});

test("fails explicitly for unknown or ambiguous deployment layouts", () => {
  for (const input of [
    site.replaceAll("shortbits.net", "unrelated.test"),
    site + site,
    site.replace("  root * /srv/shortbits\n", ""),
    site.replace("  file_server\n", ""),
    site.replace("  file_server", "  file_server\n  file_server"),
    site.replace("  file_server", "  handle {\n    file_server\n  }"),
    site.replace("  encode gzip", "  reverse_proxy /api/* localhost:8000"),
    site.replace("  encode gzip", "  import shared"),
    site.replace("  file_server", "  file_server {\n    precompressed zstd\n  }"),
    site.replace("  file_server", "  @bits_versioned_static path *.js\n  file_server"),
  ]) {
    assert.throws(() => updateCaddyConfig(input), /safely|needs exactly|needs one|differ/);
  }
});

test("ignores braces inside CSP hashes, quoted values, placeholders, and comments", () => {
  const input = site.replace("  encode gzip", '  # braces { } do not create blocks\n  log {\n    output file "/srv/log {site}.log"\n  }\n  encode gzip');
  assert.match(updateCaddyConfig(input), /precompressed br gzip/);
});
