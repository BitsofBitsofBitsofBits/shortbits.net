import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { parseHTML } from "linkedom";
import { resumeContext } from "./build-resume.mjs";
import { startSiteServer } from "./site-server.mjs";

const rootIndex = process.argv.indexOf("--root");
const root = resolve(rootIndex < 0 ? ".site-build" : process.argv[rootIndex + 1]);
const source = resolve(import.meta.dirname, "..");
const data = JSON.parse(await readFile(new URL("./fixtures/resume-data.json", import.meta.url), "utf8"));
data.entries = [
  { ...data.entries[0], period: "Mar 2025 - Present · 99 yrs" },
  { ...data.entries[0], role: "Previous role", period: "Jan 2020 - Dec 2021 · 99 yrs" },
  { ...data.entries[0], role: "Undated role", period: "Current" },
];
data.entries[0].technologies = "LEGACY_TECH_MARKER";
const { document } = parseHTML(await readFile(resolve(root, "professional", "resume", "index.html"), "utf8"));
const { ResumeContent } = await resumeContext(source, document);
ResumeContent.render(data);
document.querySelector(".resume-sheet").dataset.resumeSnapshot = createHash("sha256").update(ResumeContent.serialize(data)).digest("hex");
document.querySelector(".resume-sheet").classList.remove("is-loading");
const resumeHTML = document.toString();
const adminSource = await readFile(resolve(source, "admin", "scripts", "admin.js"), "utf8");
const adminHelpers = adminSource.slice(adminSource.indexOf("function createAdminField"), adminSource.indexOf("async function creatorLookupErrorMessage"));
const adminEntry = adminSource.slice(adminSource.indexOf("function createRepeatableEntry"), adminSource.indexOf("function renderRepeatableEntries"));
const adminCollect = adminSource.slice(adminSource.indexOf("function collectRepeatableEntries"), adminSource.indexOf("async function syncRepeatableEntries"));
const adminConfig = adminSource.slice(adminSource.indexOf("  resume: {") + "  resume: ".length,
  adminSource.indexOf("  education: {")).trim().replace(/,$/, "");
const adminSkillsConfig = adminSource.slice(adminSource.indexOf("  skills: {") + "  skills: ".length,
  adminSource.indexOf("  certifications: {")).trim().replace(/,$/, "");
const server = await startSiteServer(root);
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}),
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: "America/Chicago",
  });
  await context.route(/cloudflareinsights|challenges\.cloudflare|lanyard\.rest/, route => route.abort());
  await context.route("**/rest/v1/**", route => {
    const table = new URL(route.request().url()).pathname.split("/").pop();
    const rows = {
      site_resume_profile: [data.profile], site_resume_entries: data.entries,
      site_resume_education: [], site_resume_certifications: [],
      site_resume_skills: data.skills,
    }[table] ?? [];
    return route.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(rows) });
  });
  await context.route("**/functions/v1/**", route => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ error: "Offline date test" }),
  }));
  await context.route(`${server.origin}/professional/resume/`, route => route.fulfill({ contentType: "text/html", body: resumeHTML }));
  await context.addInitScript(() => sessionStorage.setItem("bits-boot-seen-v1", "true"));
  for (const [path, selector, skillsSelector] of [
    ["/professional/", "#profile-timeline", "#profile-skills"],
    ["/online/?window=resume", "#resume-entries", "#resume-skills"],
    ["/professional/resume/", "#resume-experience", "#resume-skills"],
  ]) {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.install({ time: new Date("2026-10-31T23:59:30Z") });
    await page.goto(`${server.origin}${path}`, { waitUntil: "networkidle" });
    const durations = page.locator(`${selector} .career-period-duration`);
    await durations.first().waitFor();
    await page.locator(`${skillsSelector} > :first-child`).waitFor();
    if (path === "/online/?window=resume") {
      assert.equal(await page.locator(skillsSelector).evaluate(node => node.closest("[data-window]")?.id), "resume-window");
    }
    assert.equal(await page.locator(skillsSelector).evaluate(node => node.children.length), data.skills.length);
    assert.ok((await page.locator(skillsSelector).textContent()).includes("PowerShell"));
    assert.ok(!(await page.locator(selector).textContent()).includes("LEGACY_TECH_MARKER"), "Per-role technologies must not render");
    assert.deepEqual(await durations.allTextContents(), ["1 yr 8 mos", "2 yrs"]);
    assert.equal(await page.locator(`${selector} [data-career-period]`).count(), 3);
    await page.clock.fastForward(61_000);
    assert.deepEqual(await durations.allTextContents(), ["1 yr 9 mos", "2 yrs"], `${path}: active tenure rolls forward without a fetch or reload`);
    await page.clock.setSystemTime(new Date("2026-12-01T00:00:00Z"));
    await page.pdf({ preferCSSPageSize: true });
    assert.deepEqual(await durations.allTextContents(), ["1 yr 10 mos", "2 yrs"], `${path}: printing refreshes tenure immediately`);
    assert.deepEqual(errors, []);
    console.log(`PASS ${path}: current/completed/undated roles, month rollover, and print refresh`);
    const savedSkills = data.skills;
    data.skills = [];
    await page.reload({ waitUntil: "networkidle" });
    if (path === "/professional/resume/") {
      await page.waitForFunction(() => !document.querySelector("#resume-refresh").disabled);
      await page.locator("#resume-refresh").click();
    }
    assert.equal(await page.locator(skillsSelector).isVisible(), false, `${path}: unpublished Skills must not restore hard-coded Toolkit content`);
    assert.equal(await page.locator(skillsSelector).evaluate(node => node.children.length), 0);
    data.skills = savedSkills;
    console.log(`PASS ${path}: shared Skills and authoritative empty publishing state`);
    await page.close();
  }

  const page = await context.newPage();
  await page.goto(server.origin);
  await page.setContent('<html><body class="admin-center"><form class="admin-form"><div id="entries"></div></form></body></html>');
  await page.addStyleTag({ path: resolve(root, "admin", "styles", "admin.css") });
  await page.addScriptTag({ path: resolve(root, "shared", "scripts", "career-format.js") });
  await page.addScriptTag({ content: `
    const resumeEntrySlots = document.querySelector("#entries");
    const resumeEntryAdd = document.createElement("button");
    const resumeAdminStatus = document.createElement("p");
    const repeatableEditors = { resume: ${adminConfig} };
    let temporaryEntryId = 0;
    function setAdminStatus() {}
    ${adminHelpers}
    ${adminEntry}
    ${adminCollect}
    resumeEntrySlots.append(createRepeatableEntry(repeatableEditors.resume, {
      role: "Support specialist", organization: "Example", period: "Current", summary: "Technical support.", enabled: true
    }));
  ` });
  const mode = page.getByLabel("Use start/end date selectors");
  const start = page.getByLabel("START MONTH", { exact: true });
  const end = page.getByLabel("END MONTH", { exact: true });
  const current = page.getByLabel("I'm still here", { exact: true });
  const period = page.locator('[data-entry-field="period"]');
  assert.equal(await period.inputValue(), "Current");
  assert.equal(await start.isVisible(), false);
  await mode.check();
  assert.equal(await current.isChecked(), true);
  assert.equal(await end.isDisabled(), true);
  assert.equal(await page.locator("form").evaluate(form => form.checkValidity()), false);
  await start.fill("2025-03");
  assert.equal(await period.inputValue(), "Mar 2025 - Present");
  assert.equal(await period.getAttribute("readonly"), "");
  const collected = await page.evaluate(() => collectRepeatableEntries(repeatableEditors.resume));
  assert.equal(collected[0].period, "Mar 2025 - Present");
  assert.equal(Object.keys(collected[0]).some(key => /start|end|current/.test(key)), false, "Existing database/backup schema remains unchanged");
  await current.uncheck();
  assert.equal(await page.locator("form").evaluate(form => form.checkValidity()), false, "Completed roles require an end month");
  await end.fill("2025-02");
  assert.equal(await page.locator("form").evaluate(form => form.checkValidity()), false, "Reversed ranges cannot be saved");
  await end.fill("2026-10");
  assert.equal(await page.locator("form").evaluate(form => form.checkValidity()), true);
  assert.equal(await period.inputValue(), "Mar 2025 - Oct 2026");
  await start.fill("2999-01");
  assert.equal(await page.locator("form").evaluate(form => form.checkValidity()), false, "Future dates cannot be saved");
  await mode.uncheck();
  assert.equal(await period.inputValue(), "Current", "Switching back preserves the original custom label");
  assert.equal(await page.locator("form").evaluate(form => form.checkValidity()), true);
  console.log("PASS Admin role month selectors, current-role toggle, validation, custom-label preservation, and saved period payload");
  await page.addScriptTag({ content: `
    const resumeSkillsSlots = document.createElement("div");
    const resumeSkillsAdd = document.createElement("button");
    document.querySelector("form").append(resumeSkillsSlots);
    repeatableEditors.skills = ${adminSkillsConfig};
    repeatableEditors.skills.deletedPositions = new Set();
    resumeSkillsSlots.append(createRepeatableEntry(repeatableEditors.skills, {
      position: 1, category: "Support", skills: "Zendesk, Troubleshooting", enabled: true
    }));
  ` });
  assert.equal(await page.locator('[data-entry-field="technologies"]').count(), 0, "Admin experience editor no longer edits per-role technologies");
  await page.getByLabel("CATEGORY", { exact: true }).fill("Support & communication");
  await page.getByLabel("SKILLS (COMMA-SEPARATED)", { exact: true }).fill("Zendesk, Technical writing");
  const skills = await page.evaluate(() => collectRepeatableEntries(repeatableEditors.skills));
  assert.equal(skills[0].category, "Support & communication");
  assert.equal(skills[0].skills, "Zendesk, Technical writing");
  await page.locator('fieldset:has([data-entry-field="category"]) [data-entry-field="enabled"]').uncheck();
  assert.equal((await page.evaluate(() => collectRepeatableEntries(repeatableEditors.skills)))[0].enabled, false);
  await page.locator('fieldset:has([data-entry-field="category"]) .repeatable-entry-remove').click();
  assert.deepEqual(await page.evaluate(() => [...repeatableEditors.skills.deletedPositions]), [1]);
  console.log("PASS Admin shared Skills editing, draft publishing, and removal");
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
