import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { buildSite, filesUnder, versionAssets, compressAssets, optimizeStyles, optimizeStartup } from "./build-site.mjs";

test("build preserves page routes and organized assets without shipping repository tooling", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shortbits-layout-"));
  try {
    await buildSite(directory, fileURLToPath(new URL("./fixtures/blog-posts.json", import.meta.url)));
    const entries = await readdir(directory, { withFileTypes: true });
    assert.ok(!entries.some(entry => entry.isFile() && /\.(?:js|css)$/.test(entry.name)), "Public assets stay out of the root");
    for (const path of [
      "index.html", "404.html", "admin.html", "source.html", "useless.html",
      "online/index.html", "admin/index.html", "boot/index.html", "blog/index.html",
      "professional/index.html", "professional/resume/index.html",
      "shared/scripts/supabase-config.js", "shared/styles/theme-base.css",
      "shared/styles/layouts/collection-base.css", "shared/scripts/layouts/runtime.js",
      "shared/images/favicon.png", "shared/images/profile.webp", "home/scripts/chooser.js", "home/styles/chooser.css",
      "online/scripts/startup.js", "online/styles/site.css", "online/scripts/arcade.js",
      "admin/scripts/admin.js", "admin/styles/admin.css", "boot/scripts/endless-boot.js",
      "blog/scripts/blog.js", "professional/scripts/profile.js",
      "professional/resume/scripts/resume.js", "not-found/scripts/not-found.js", "useless/scripts/useless.js",
    ]) assert.ok((await stat(join(directory, path))).isFile(), path);
    const portraitSize = (await stat(join(directory, "shared/images/profile.webp"))).size;
    const faviconSize = (await stat(join(directory, "shared/images/favicon.png"))).size;
    assert.ok(portraitSize < 30 * 1024 && portraitSize < faviconSize * 0.3,
      "The LCP profile picture stays below 30 KiB and 30% of the original favicon size");
    for (const name of ["scripts", "docs", "supabase", "agents", "extensions", "node_modules", "layouts", "images"]) {
      assert.ok(!entries.some(entry => entry.name === name), `${name} must not be published at the root`);
    }
    for (const path of (await filesUnder(directory)).filter(path => path.endsWith(".js"))) {
      const source = await readFile(path, "utf8");
      assert.doesNotThrow(() => new vm.Script(source), path);
    }
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("minifies ordered startup scripts into one request without isolating shared classic globals", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shortbits-startup-"));
  try {
    await mkdir(join(directory, "online"));
    await mkdir(join(directory, "shared", "scripts"), { recursive: true });
    await mkdir(join(directory, "online", "scripts"), { recursive: true });
    await writeFile(join(directory, "online", "index.html"),
      '<script src="/shared/scripts/seasonal-calendar.js?v=1"></script>\n<script src="/shared/scripts/theme-init.js?v=2"></script>\n<script src="/online/scripts/boot.js?v=3"></script><script src="/online/scripts/online-runtime.js" defer></script>');
    await writeFile(join(directory, "shared/scripts/seasonal-calendar.js"), "const startupCalendarValue = 7;");
    await writeFile(join(directory, "shared/scripts/theme-init.js"), "function startupThemeValue() { return startupCalendarValue + 1; }");
    await writeFile(join(directory, "online/scripts/boot.js"), "window.startupResult = startupThemeValue();");
    await optimizeStartup(directory);
    const html = await readFile(join(directory, "online", "index.html"), "utf8");
    assert.match(html, /<script src="\/online\/scripts\/startup.js"><\/script>/);
    assert.match(html, /<script src="\/online\/scripts\/online-runtime.js" defer><\/script>/);
    assert.doesNotMatch(html, /src="\/(?:seasonal-calendar|theme-init|boot)\.js/);
    const context = vm.createContext({ window: {} });
    vm.runInContext(await readFile(join(directory, "online", "scripts", "startup.js"), "utf8"), context);
    assert.equal(context.window.startupResult, 8);
    assert.equal(vm.runInContext("startupThemeValue() + startupCalendarValue", context), 15);
    await assert.rejects(optimizeStartup(directory), /Unable to locate/);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("versions local static and dynamic asset URLs without modifying external resources", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shortbits-assets-"));
  try {
    await writeFile(join(directory, "app.js"), 'const css = "/shared/styles/layouts/${theme}.css?v=old"; const external = "https://example.com/app.js?v=keep"; const metadata = "/build-info.json";');
    await writeFile(join(directory, "app.css"), "body { color: green; }");
    await writeFile(join(directory, "index.html"), '<script src="/app.js?v=old"></script><link href="/app.css"><link href="/app.css?variant=compact&v=old#theme"><a href="/blog/">Blog</a>');
    const version = await versionAssets(directory);
    assert.match(version, /^[a-f0-9]{16}$/);
    assert.match(await readFile(join(directory, "index.html"), "utf8"), new RegExp(`/app.js\\?v=${version}`));
    assert.ok((await readFile(join(directory, "index.html"), "utf8")).includes(`/app.css?variant=compact&v=${version}#theme`));
    const script = await readFile(join(directory, "app.js"), "utf8");
    assert.ok(script.includes(`/shared/styles/layouts/\${theme}.css?v=${version}`));
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
    await mkdir(join(directory, "professional", "resume", "styles"), { recursive: true });
    await writeFile(join(directory, "base.css"), "body { color: red; } .deferred-panel { padding: 10px; }");
    await writeFile(join(directory, "override.css"), "body { color: blue; } @media print { body { color: black; } }");
    await writeFile(join(directory, "online", "index.html"), '<link rel="stylesheet" href="/base.css?v=1"><link rel="stylesheet" href="/override.css?v=2"><h1>Bits</h1>');
    await writeFile(join(directory, "professional", "resume", "styles", "resume.css"), "body { color: green; } @media print { body { color: black; } }");
    await writeFile(join(directory, "professional", "resume", "index.html"), '<link rel="stylesheet" href="/professional/resume/styles/resume.css?v=1"><h1>Résumé</h1>');
    await optimizeStyles(directory);
    const online = await readFile(join(directory, "online", "index.html"), "utf8");
    assert.equal((online.match(/rel="stylesheet"/g) || []).length, 2);
    assert.match(online, /<style data-online-critical>/);
    assert.match(online, /media="print" data-online-styles/);
    assert.match(online, /<noscript><link rel="stylesheet" href="\/online\/styles\/site.css"><\/noscript>/);
    const criticalCss = online.match(/<style data-online-critical>([\s\S]*?)<\/style>/)[1];
    assert.doesNotMatch(criticalCss, /deferred-panel/);
    assert.ok(online.includes('href="/online/styles/site.css"'));
    const css = await readFile(join(directory, "online", "styles", "site.css"), "utf8");
    assert.match(css, /color:#00f|color:blue/);
    assert.match(css, /@media print/);
    assert.match(css, /deferred-panel/);
    const resume = await readFile(join(directory, "professional", "resume", "index.html"), "utf8");
    assert.ok(resume.includes("<style data-resume-styles>"));
    assert.ok(resume.includes("@media print"));
    assert.ok(!resume.includes('rel="stylesheet"'));
    assert.ok(resume.includes("<h1>Résumé</h1>"));
    await writeFile(join(directory, "professional", "resume", "styles", "resume.css"), "body{--long:" + "x".repeat(9000) + "}");
    await assert.rejects(optimizeStyles(directory), /8 KiB inline budget/);
  } finally {
    await rm(directory, { recursive: true });
  }
});
