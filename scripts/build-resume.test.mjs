import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { parseHTML } from "linkedom";
import { buildResume, fetchResume, resumeContext } from "./build-resume.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = new URL("./fixtures/resume-data.json", import.meta.url);
const data = JSON.parse(await readFile(fixture, "utf8"));
const template = await readFile(join(root, "professional", "resume", "index.html"), "utf8");

test("shared renderer escapes content and preserves formatting, safe links, and authored empty-list fallback", async () => {
  const { document } = parseHTML(template);
  const { ResumeContent } = await resumeContext(root, document);
  const input = structuredClone(data);
  input.profile.summary = '<img src=x onerror="alert(1)">';
  input.entries[0].summary = "- First task\n- Second task";
  input.entries[0].technologies = "Windows, windows, PowerShell";
  input.skills = [{ category: "<Skills>", skills: "Windows, windows, PowerShell" }];
  input.certifications = [
    { name: "<Certification>", credential_url: "javascript:alert(1)" },
    { name: "Safe", credential_url: "https://example.com/verify" },
  ];
  const education = document.querySelector("#resume-education").innerHTML;
  assert.equal(ResumeContent.render(input), true);
  assert.equal(document.querySelector("#resume-summary").textContent, input.profile.summary);
  assert.equal(document.querySelector("#resume-summary img"), null);
  assert.equal(document.querySelector("#resume-experience [data-career-period]").dataset.careerPeriod, input.entries[0].period);
  assert.equal(document.querySelector("#resume-education [data-career-period]"), null);
  assert.equal(document.querySelectorAll("#resume-experience .resume-bullets li").length, 2);
  assert.equal(document.querySelector("#resume-experience .resume-tech"), null);
  assert.equal(document.querySelector("#resume-skills dt").textContent, "<Skills>");
  assert.equal(document.querySelector("#resume-skills dd").textContent, "Windows, PowerShell");
  assert.equal(document.querySelector("#resume-skills dt skills"), null);
  assert.equal(document.querySelector("#resume-education").innerHTML, education);
  assert.equal(document.querySelectorAll("#resume-certifications a").length, 1);
  assert.equal(document.querySelector("#resume-certifications a").getAttribute("href"), "https://example.com/verify");
  assert.match(document.querySelector("#resume-updated").textContent, /October 2026/);
  assert.equal(ResumeContent.render({ ...data, profile: null }), false);
});

test("snapshot serialization includes only rendered public fields and rejects malformed data", async () => {
  const { ResumeContent } = await resumeContext(root, parseHTML(template).document);
  const serialized = ResumeContent.serialize(data);
  assert.equal(ResumeContent.serialize({
    ...data, secret: "private", profile: { ...data.profile, availability: "Changed", resume_url: "https://example.com", email: "private" },
    entries: data.entries.map((entry) => ({ ...entry, position: 123, technologies: "No longer rendered" })),
  }), serialized);
  assert.notEqual(ResumeContent.serialize({ ...data, profile: { ...data.profile, headline: "Changed" } }), serialized);
  assert.notEqual(ResumeContent.serialize({ ...data, skills: [] }), serialized);
  for (const patch of [{ profile: false }, { entries: {} }, { education: [null] }, { skills: null }, { skills: [{ category: 42 }] }, { profile: { headline: 42 } }]) {
    assert.throws(() => ResumeContent.serialize({ ...data, ...patch }), /Invalid public/);
  }
});

test("resume build persists deterministic visible HTML without contact details or duplicated snapshot payloads", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shortbits-resume-"));
  try {
    for (const file of ["shared/scripts/career-format.js", "shared/scripts/career-data.js", "professional/resume/scripts/resume-content.js", "professional"]) {
      await cp(join(root, file), join(directory, file), { recursive: true });
    }
    await buildResume({ root: directory, input: fileURLToPath(fixture) });
    const first = await readFile(join(directory, "professional", "resume", "index.html"), "utf8");
    const { document } = parseHTML(first);
    const sheet = document.querySelector(".resume-sheet");
    const { ResumeContent } = await resumeContext(root, document);
    assert.equal(sheet.classList.contains("is-loading"), false);
    assert.equal(sheet.hasAttribute("aria-busy"), false);
    assert.equal(sheet.dataset.resumeSnapshot, createHash("sha256").update(ResumeContent.serialize(data)).digest("hex"));
    assert.equal(document.querySelector("#resume-summary").textContent, data.profile.summary);
    assert.equal(document.querySelectorAll('a[href^="mailto:"], a[href^="tel:"]').length, 0);
    assert.equal(document.querySelector('script[type="application/json"]'), null);
    assert.ok(document.querySelector('link[href^="/professional/resume/styles/resume.css"]'));
    await buildResume({ root: directory, input: fileURLToPath(fixture) });
    assert.equal(await readFile(join(directory, "professional", "resume", "index.html"), "utf8"), first);
    const invalid = join(directory, "invalid.json");
    await writeFile(invalid, JSON.stringify({ ...data, entries: null }));
    await assert.rejects(buildResume({ root: directory, input: invalid }), /Invalid public/);
    assert.equal(await readFile(join(directory, "professional", "resume", "index.html"), "utf8"), first);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("career fetches use enabled public queries, pagination, credentials, and explicit failures", async () => {
  const { CareerData } = await resumeContext(root);
  const requests = [];
  const config = { url: "https://example.supabase.co", anonKey: "public-test-key" };
  const response = await fetchResume(config, CareerData.queries, async (url, options) => {
    const parsed = new URL(url);
    requests.push(parsed);
    assert.equal(options.headers.apikey, config.anonKey);
    assert.equal(parsed.searchParams.get("enabled"), "eq.true");
    assert.ok(options.signal instanceof AbortSignal);
    const table = parsed.pathname.split("/").pop();
    const page = table === "site_resume_entries" && parsed.searchParams.get("offset") === "0"
      ? Array(500).fill(data.entries[0]) : table === "site_resume_profile" ? [data.profile] : [];
    return { ok: true, json: async () => page };
  });
  assert.equal(response.entries.length, 500);
  assert.equal(requests.length, 6);
  assert.ok(requests.some((url) => url.searchParams.get("offset") === "500"));
  await assert.rejects(fetchResume(config, CareerData.queries, async () => ({ ok: false, status: 503 })), /HTTP 503/);
  await assert.rejects(fetchResume(config, CareerData.queries, async () => ({ ok: true, json: async () => ({}) })), /not an array/);
});

test("fresh career reads bypass shared cache and mark incomplete optional data", async () => {
  const source = await readFile(join(root, "shared/scripts/career-data.js"), "utf8");
  let calls = 0;
  const warnings = [];
  const window = { SUPABASE_CONFIG: { url: "https://example.supabase.co", anonKey: "public" } };
  vm.runInNewContext(source, {
    window, AbortSignal,
    localStorage: { getItem: () => JSON.stringify({ cachedAt: Date.now(), payload: { resumeProfile: { headline: "Stale" }, resumeSkills: [] } }) },
    console: { warn: (...args) => warnings.push(args) },
    fetch: async (url) => {
      calls++;
      if (url.includes("site_resume_education")) throw new Error("Offline");
      return { ok: true, json: async () => url.includes("site_resume_profile") ? [data.profile] : [] };
    },
  });
  assert.equal((await window.CareerData.load()).profile.headline, "Stale");
  assert.equal(calls, 0);
  const fresh = await window.CareerData.load({ fresh: true });
  assert.equal(fresh.profile.headline, data.profile.headline);
  assert.equal(calls, 5);
  assert.deepEqual([...fresh.unavailable], ["education"]);
  assert.equal(warnings.length, 1);
});
