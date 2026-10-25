import assert from "node:assert/strict";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const root = resolve(rootIndex < 0 ? "." : args[rootIndex + 1]);
const hardware = [2, 22, 4, 3].flatMap((count, machine) => (
  Array.from({ length: count }, (_, index) => ({
    position: machine * 30 + index,
    machine: `Machine ${machine + 1}`,
    component: index ? "STORAGE" : "CPU",
    name: `Test component ${index + 1}`,
    detail: "Hardware layout regression fixture",
    updated_at: "2026-10-25T00:00:00Z",
  }))
));
const server = await startSiteServer(root);
let browser;
try {
  assert.equal((await fetch(`${server.origin}/online/`)).status, 200);
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}),
    headless: true,
  });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const errors = [];
    await context.addInitScript(() => {
      sessionStorage.setItem("bits-boot-seen-v1", "true");
    });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.includes("/rest/v1/")) {
        const table = url.pathname.split("/").pop();
        return route.fulfill({
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify(table === "site_hardware" ? hardware : []),
        });
      }
      return url.origin === server.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${server.origin}/online/?window=hardware`, { waitUntil: "networkidle" });
    await page.locator(".hardware-machine").last().waitFor({ state: "visible" });

    async function checkLayout(singleColumn = width < 900) {
      await page.waitForFunction((single) => {
        const cards = [...document.querySelectorAll(".hardware-machine")];
        const boxes = cards.map((card) => card.getBoundingClientRect());
        if (boxes.length !== 4 || boxes.some((box) => !box.height)) return false;
        if (cards.some((card) => {
          const reserved = Number(card.style.gridRowEnd.replace("span ", ""));
          return reserved !== Math.ceil(card.getBoundingClientRect().height + 12);
        })) return false;
        return boxes.every((box, index) => {
          const previous = boxes.slice(0, index).filter((other) => Math.abs(other.left - box.left) < 1);
          if (single && Math.abs(box.left - boxes[0].left) > 1) return false;
          if (!previous.length) return Math.abs(box.top - boxes[0].top) < 1;
          const gap = box.top - Math.max(...previous.map((other) => other.bottom));
          return gap >= 11.9 && gap < 13.1;
        });
      }, singleColumn);
      const boxes = await page.locator(".hardware-machine").evaluateAll((cards) => cards.map((card) => {
        const { left, right, top, bottom } = card.getBoundingClientRect();
        return { left, right, top, bottom };
      }));
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top,
            `${width}px: cards ${i + 1} and ${j + 1} overlap`);
        }
      }
      if (!singleColumn) {
        assert.ok(boxes[2].top < boxes[1].bottom, "Third card must fill the gap beside the longer list");
      }
    }

    await checkLayout();
    await page.locator(".hardware-machine > summary").first().click();
    await checkLayout();
    await page.locator(".hardware-machine > summary").first().click();
    await checkLayout();
    await page.evaluate(() => {
      const live = document.querySelector(".hardware-live");
      live.hidden = false;
      const reading = document.createElement("p");
      reading.style.height = "170px";
      reading.textContent = "Live readings changed the card height";
      live.append(reading);
    });
    await checkLayout();
    if (width > 900) {
      await page.locator("#hardware-machines").evaluate((element) => { element.style.width = "310px"; });
      await checkLayout(true);
      await page.locator("#hardware-machines").evaluate((element) => { element.style.width = ""; });
      await checkLayout();
    }
    await page.evaluate(() => {
      renderHardware(hardwareState.items.slice(0, 3), hardwareState.order);
    });
    await page.waitForFunction(() => [...document.querySelectorAll(".hardware-machine")]
      .every((card) => card.style.gridRowEnd.startsWith("span ")));
    assert.equal(await page.locator(".hardware-machine").count(), 2, "Changed inventory must rebuild observed cards");
    assert.deepEqual(errors, [], `${width}px: browser errors`);
    console.log(`PASS ${width}px: unequal lists, collapse/expand, live updates, resizing, and inventory replacement`);
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
