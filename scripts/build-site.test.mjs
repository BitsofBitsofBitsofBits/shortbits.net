import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { versionAssets, compressAssets, optimizeStyles } from "./build-site.mjs";

test("versions local static and dynamic asset URLs without modifying external resources", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shortbits-assets-"));
  try {
    await writeFile(join(directory, "app.js"), 'const css = "/layouts/${theme}.css?v=old"; const external = "https://example.com/app.js?v=keep"; const metadata = "/build-info.json";');
    await writeFile(join(directory, "app.css"), "body { color: green; }");
    await writeFile(join(directory, "index.html"), '<script src="/app.js?v=old"></script><link href="/app.css"><link href="/app.css?variant=compact&v=old#theme"><a href="/blog/">Blog</a>');
    const version = await versionAssets(directory);
    assert.match(version, /^[a-f0-9]{16}$/);
    assert.match(await readFile(join(directory, "index.html"), "utf8"), new RegExp(`/app.js\\?v=${version}`));
    assert.ok((await readFile(join(directory, "index.html"), "utf8")).includes(`/app.css?variant=compact&v=${version}#theme`));
    const script = await readFile(join(directory, "app.js"), "utf8");
    assert.ok(script.includes(`/layouts/\${theme}.css?v=${version}`));
    assert.ok(script.includes("https://example.com/app.js?v=keep"));
    assert.ok(script.includes('"/build-info.json"'));
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

test("consolidates online styles in cascade order and inlines small résumé styles", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shortbits-styles-"));
  try {
    await mkdir(join(directory, "online"));
    await mkdir(join(directory, "professional", "resume"), { recursive: true });
    await writeFile(join(directory, "base.css"), "body { color: red; }");
    await writeFile(join(directory, "override.css"), "body { color: blue; } @media print { body { color: black; } }");
    await writeFile(join(directory, "online", "index.html"), '<link rel="stylesheet" href="/base.css?v=1"><link rel="stylesheet" href="/override.css?v=2"><h1>Bits</h1>');
    await writeFile(join(directory, "professional", "resume.css"), "body { color: green; } @media print { body { color: black; } }");
    await writeFile(join(directory, "professional", "resume", "index.html"), '<link rel="stylesheet" href="/professional/resume.css?v=1"><h1>Résumé</h1>');
    await optimizeStyles(directory);
    const online = await readFile(join(directory, "online", "index.html"), "utf8");
    assert.equal((online.match(/rel="stylesheet"/g) || []).length, 1);
    assert.ok(online.includes('href="/online/site.css"'));
    const css = await readFile(join(directory, "online", "site.css"), "utf8");
    assert.match(css, /color:#00f|color:blue/);
    assert.match(css, /@media print/);
    const resume = await readFile(join(directory, "professional", "resume", "index.html"), "utf8");
    assert.ok(resume.includes("<style data-resume-styles>"));
    assert.ok(resume.includes("@media print"));
    assert.ok(!resume.includes('rel="stylesheet"'));
    assert.ok(resume.includes("<h1>Résumé</h1>"));
    await writeFile(join(directory, "professional", "resume.css"), "body{--long:" + "x".repeat(9000) + "}");
    await assert.rejects(optimizeStyles(directory), /8 KiB inline budget/);
  } finally {
    await rm(directory, { recursive: true });
  }
});
