import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { versionAssets, compressAssets } from "./build-site.mjs";

test("versions local static and dynamic asset URLs without modifying external resources", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shortbits-assets-"));
  try {
    await writeFile(join(directory, "app.js"), 'const css = "/layouts/${theme}.css?v=old"; const external = "https://example.com/app.js?v=keep";');
    await writeFile(join(directory, "app.css"), "body { color: green; }");
    await writeFile(join(directory, "index.html"), '<script src="/app.js?v=old"></script><link href="/app.css"><link href="/app.css?variant=compact&v=old#theme"><a href="/blog/">Blog</a>');
    const version = await versionAssets(directory);
    assert.match(version, /^[a-f0-9]{16}$/);
    assert.match(await readFile(join(directory, "index.html"), "utf8"), new RegExp(`/app.js\\?v=${version}`));
    assert.ok((await readFile(join(directory, "index.html"), "utf8")).includes(`/app.css?variant=compact&v=${version}#theme`));
    const script = await readFile(join(directory, "app.js"), "utf8");
    assert.ok(script.includes(`/layouts/\${theme}.css?v=${version}`));
    assert.ok(script.includes("https://example.com/app.js?v=keep"));
    assert.ok((await readFile(join(directory, "index.html"), "utf8")).includes('href="/blog/"'));
    await writeFile(join(directory, "app.css"), "body { color: blue; }");
    assert.notEqual(await versionAssets(directory), version);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("creates valid gzip and Brotli representations", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shortbits-compress-"));
  try {
    const content = "/* compressible theme styles */\n".repeat(100);
    const file = join(directory, "app.css");
    await writeFile(file, content);
    await compressAssets(directory);
    assert.equal(gunzipSync(await readFile(`${file}.gz`)).toString(), content);
    assert.equal(brotliDecompressSync(await readFile(`${file}.br`)).toString(), content);
  } finally {
    await rm(directory, { recursive: true });
  }
});
