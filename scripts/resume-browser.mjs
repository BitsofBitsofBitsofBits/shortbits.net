import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { parseHTML } from "linkedom";
import { resumeContext } from "./build-resume.mjs";
import { startSiteServer } from "./site-server.mjs";

const rootIndex = process.argv.indexOf("--root");
const root = resolve(rootIndex < 0 ? ".site-build" : process.argv[rootIndex + 1]);
const source = resolve(import.meta.dirname, "..");
const fixture = JSON.parse(await readFile(new URL("./fixtures/resume-data.json", import.meta.url), "utf8"));
fixture.profile.headline = "IT Technician focused on support, systems administration, and practical automation";
fixture.profile.summary = [
  "IT technician experienced in technical support, systems administration, and automation.",
  "Helping people resolve problems through practical troubleshooting and clear communication.",
  "Maintaining an enterprise-style lab to develop dependable workflows for identity, networking, and recovery.",
].join(" ");
fixture.entries = Array.from({ length: 6 }, (_, index) => ({
  role: `Technical Support and Systems Administrator ${index + 1}`,
  organization: "Independent technology services",
  period: "Mar 2020 - Oct 2022",
  summary: index % 2 ? [
    "Managed technical equipment and provided support for staff across multiple locations.",
    "Installed network devices, developed policies, and supported cloud services.",
    "Improved system security and performance through proactive maintenance and clear documentation.",
  ].join(" ") : [
    "- Resolved customer issues through practical troubleshooting and clear communication.",
    "- Maintained technical equipment, ensuring dependable performance and security.",
    "- Developed automation scripts to streamline installation and maintenance workflows.",
    "- Led server migrations and wireless system upgrades to improve client services.",
    "- Documented solutions and contributed articles to the internal knowledge base.",
  ].join("\n"),
  technologies: "Windows Server, Active Directory, PowerShell, Microsoft 365, Intune, Linux, Networking, Group Policy, Veeam, Docker, Proxmox, Customer Support, Documentation, Troubleshooting",
}));
const { document } = parseHTML(await readFile(resolve(root, "professional", "resume", "index.html"), "utf8"));
const { ResumeContent } = await resumeContext(source, document);
ResumeContent.render(fixture);
document.querySelector(".resume-sheet").classList.remove("is-loading");
document.querySelector(".resume-sheet").removeAttribute("aria-busy");
const html = document.toString();
const server = await startSiteServer(root);
let browser;
try {
  assert.equal((await fetch(`${server.origin}/professional/resume/`)).status, 200);
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}),
    headless: true,
  });
  for (const javaScriptEnabled of [true, false]) {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ javaScriptEnabled, viewport: { width, height: 900 } });
      await context.route(`${server.origin}/professional/resume/`, route => route.fulfill({ contentType: "text/html", body: html }));
      await context.route("**/rest/v1/**", route => route.abort());
      await context.route(/cloudflareinsights|challenges\.cloudflare/, route => route.abort());
      const page = await context.newPage();
      await page.goto(`${server.origin}/professional/resume/`, { waitUntil: "networkidle" });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "Screen resume must not overflow");
      assert.equal(await page.locator(".resume-list header").first().evaluate(node => getComputedStyle(node).flexDirection),
        width < 700 ? "column" : "row", "Responsive screen layout is preserved");
      await page.emulateMedia({ media: "print" });
      assert.equal(await page.locator(".resume-toolbar").isVisible(), false);
      assert.equal(await page.locator(".resume-list").first().evaluate(node => getComputedStyle(node).display), "block");
      assert.equal(await page.locator(".resume-list header").first().evaluate(node => getComputedStyle(node).flexDirection), "row",
        "Mobile screen rules must not stack printed dates");
      assert.equal(await page.locator(".resume-contact").evaluate(node => getComputedStyle(node).textAlign), "right");
      assert.equal(await page.locator(".resume-skills").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length), 2);
      for (const heading of await page.locator(".resume-sheet h2").all()) {
        assert.equal(await heading.evaluate(node => getComputedStyle(node).breakAfter), "avoid", "Section headings stay with content");
      }
      const pdf = await page.pdf({ preferCSSPageSize: true });
      assert.equal([...pdf.toString("latin1").matchAll(/\/Type\s*\/Page\b/g)].length, 2,
        "Six representative career entries, education, and skills fit in two Letter pages at either viewport");
      await page.setViewportSize({ width: 816, height: 1056 });
      const identity = await page.locator(".resume-header > div").boundingBox();
      const contact = await page.locator(".resume-contact").boundingBox();
      assert.ok(identity.x + identity.width <= contact.x, "Long headlines must not overlap contact details");
      assert.equal(identity.y, contact.y, "Name and contact details align at the top");
      assert.ok(await page.evaluate(() => [...document.querySelectorAll(".resume-sheet *")].every(node =>
        node.getBoundingClientRect().right <= document.querySelector(".resume-sheet").getBoundingClientRect().right + 1)),
      "Print content must remain inside the paper width");
      await context.close();
      console.log(`PASS ${width}px resume screen/print layout and two-page PDF, JavaScript ${javaScriptEnabled ? "on" : "off"}`);
    }
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
