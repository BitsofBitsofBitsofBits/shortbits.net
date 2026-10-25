import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Use the existing Playwright installation; this check never installs tools.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const fullCss = await readFile(path.join(root, "styles.css"), "utf8");
const compactCss = await readFile(path.join(root, "theme-base.css"), "utf8");
const themes = [...new Set([...fullCss.matchAll(/data-interface-theme="([^"]+)"/g)].map((match) => match[1]))];
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const filename = path.resolve(root, `.${pathname.replaceAll("/", path.sep)}`, pathname.endsWith("/") ? "index.html" : "");
    if (!filename.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    const contents = await readFile(filename);
    const type = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" }[path.extname(filename)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": type }).end(contents);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
});

async function preparePage(compact, width = 1280, allowProfile = true) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      return route.abort();
    }
    if (["/styles.css", "/theme-base.css"].includes(url.pathname)) {
      return route.fulfill({ contentType: "text/css", body: compact ? compactCss : fullCss });
    }
    if (url.pathname.endsWith(".js") && ![
      "/seasonal-calendar.js", "/theme-init.js",
      ...(allowProfile ? ["/professional/profile.js"] : []),
    ].includes(url.pathname)) {
      return route.fulfill({ contentType: "text/javascript", body: "" });
    }
    return route.continue();
  });
  return page;
}

async function snapshot(page, theme, scheme) {
  return page.evaluate(({ theme, scheme }) => {
    const root = document.documentElement;
    root.dataset.interfaceTheme = theme;
    root.dataset.colorScheme = scheme;
    root.classList.toggle("is-rgb-mode", theme === "rgb");
    const properties = [
      "display", "position", "color", "background-color", "background-image",
      "font-family", "font-size", "font-weight", "line-height", "border-top-color",
      "border-top-width", "border-radius", "padding-top", "padding-right",
      "padding-bottom", "padding-left", "margin-top", "margin-bottom", "box-shadow",
      "opacity", "visibility", "width", "height", "outline-color",
    ];
    return [...document.querySelectorAll("html, body, body *:not(script):not(option):not(noscript)")].map((element) => {
      const style = getComputedStyle(element);
      return [element.tagName, element.id, element.className, ...properties.map((name) => style.getPropertyValue(name))];
    });
  }, { theme, scheme });
}

try {
  for (const route of ["/?choose=1", "/professional/"]) {
    const original = await preparePage(false);
    const compact = await preparePage(true);
    await Promise.all([original.goto(`${origin}${route}`), compact.goto(`${origin}${route}`)]);
    for (const page of [original, compact]) {
      await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
    }
    for (const theme of themes) {
      for (const scheme of ["dark", "light"]) {
        const actual = await snapshot(compact, theme, scheme);
        const expected = await snapshot(original, theme, scheme);
        const differences = actual.flatMap((entry, index) => (
          JSON.stringify(entry) === JSON.stringify(expected[index]) ? [] : [
            { element: entry.slice(0, 3), actual: entry.slice(3), expected: expected[index]?.slice(3) },
          ]
        ));
        assert.equal(differences.length, 0,
          `${route} ${theme} ${scheme}: ${JSON.stringify(differences.slice(0, 3))}`);
      }
    }
    await Promise.all([original.close(), compact.close()]);
    console.log(`${route}: shared CSS parity for ${themes.length} themes in both schemes`);
  }

  const profileSource = await readFile(path.join(root, "professional", "profile.js"), "utf8");
  for (const width of [390, 768, 1280]) {
    const page = await preparePage(true, width, false);
    await page.goto(`${origin}/professional/`);
    const before = await page.locator("#main").boundingBox();
    await page.addScriptTag({ content: profileSource });
    const after = await page.locator("#main").boundingBox();
    assert.equal(after.y, before.y, `${width}px: theme picker hydration moved main content`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator(".profile-theme-picker").evaluateAll((elements) => (
      elements.every((element) => getComputedStyle(element).display === "none")
    )), true, "reserved controls must not consume print space");
    await page.close();
    console.log(`${width}px: theme control hydration has zero main-content shift`);
  }

  for (const linked of [false, true]) {
    const page = await browser.newPage({ viewport: { width: linked ? 1280 : 390, height: 844 }, hasTouch: true });
    const errors = [];
    let arcadeRequests = 0;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) {
        return route.abort();
      }
      if (url.pathname === "/online/") {
        let html = await readFile(path.join(root, "online", "index.html"), "utf8");
        if (!html.includes('type="application/x-bits-runtime"')) {
          html = html.replace(/<script src="([^"]+)" defer><\/script>/g,
            '<script type="application/x-bits-runtime" src="$1"></script>');
          html = html.replace("</head>", '<script src="/online-runtime.js" defer></script></head>');
        }
        return route.fulfill({
          contentType: "text/html",
          body: html.replace(/src="\/arcade\.js([?"][^>]*)/g, 'src="/arcade-loader.js$1'),
        });
      }
      if (url.pathname === "/arcade.js") {
        arcadeRequests += 1;
      }
      if (url.pathname.endsWith(".js") && ![
        "/seasonal-calendar.js", "/theme-init.js", "/boot.js",
        "/windows.js", "/arcade-loader.js", "/arcade.js", "/online-runtime.js",
      ].includes(url.pathname)) {
        return route.fulfill({ contentType: "text/javascript", body: "" });
      }
      return route.continue();
    });
    await page.goto(`${origin}/online/${linked ? "?window=arcade" : ""}`);
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.boot), "complete");
    assert.equal(await page.locator("#boot-screen").isHidden(), true);
    if (!linked) {
      assert.equal(arcadeRequests, 0, "closed arcade must not fetch its implementation");
      // Arcade is intentionally desktop-only; resizing must preserve its opener API.
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.open("arcade"));
    }
    await page.evaluate(() => window.BITS_ARCADE.load());
    assert.equal(arcadeRequests, 1);
    assert.deepEqual(errors, []);
    assert.equal(await page.locator('[data-arcade-game="solitaire"]').count(), 0, "BITITAIRE must not be offered while being reworked");
    await page.evaluate(() => selectGame("solitaire"));
    assert.equal(await page.locator('[data-arcade-panel="solitaire"]').isHidden(), true, "BITITAIRE must not be selectable programmatically");
    assert.equal(await page.locator("#solitaire-tableau").locator("button").count(), 0, "BITITAIRE must not initialize while unavailable");
    for (const game of ["snake", "minesweeper", "bitsweeper", "tetris", "pong", "dodge", "cursor", "null-tac-toe", "breaker", "flappy"]) {
      await page.locator(`[data-arcade-game="${game}"]`).evaluate((element) => element.click());
      const panel = page.locator(`[data-arcade-panel="${game}"]`);
      const ancestry = await panel.evaluate((element) => {
        const entries = [];
        for (let current = element; current; current = current.parentElement) {
          entries.push([current.id, current.className, current.hidden, getComputedStyle(current).display]);
        }
        return entries;
      });
      assert.equal(await panel.isVisible(), true, `${game}: selected arcade panel is hidden; ${errors.join("; ")}; ${JSON.stringify(ancestry)}`);
    }
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`${linked ? "Deep-linked" : "Initially closed"} arcade: lazy load once, all 10 available game tabs work, BITITAIRE unavailable, mobile boot nonblocking`);
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
