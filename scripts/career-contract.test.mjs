import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const careerSource = await readFile(new URL("../shared/scripts/career-data.js", import.meta.url), "utf8");
const contentSource = await readFile(new URL("../online/scripts/content.js", import.meta.url), "utf8");
const requestSource = contentSource.slice(
  contentSource.indexOf("async function requestPublicContent()"),
  contentSource.indexOf("function createResumeEntry"),
);

test("online public content uses the shared career query contract", async () => {
  const requests = [];
  const saved = [];
  const warnings = [];
  const window = { SUPABASE_CONFIG: { url: "https://example.test/", anonKey: "public" } };
  const context = vm.createContext({
    window, Date,
    console: { warn: (...args) => warnings.push(args) },
    getCachedPublicContent: () => null,
    localStorage: { setItem: (key, value) => saved.push([key, JSON.parse(value)]) },
    publicContentCacheKey: "cache",
    fetch: async (url, options) => {
      const request = new URL(url);
      requests.push(request);
      assert.equal(options.headers.apikey, "public");
      if (request.pathname.endsWith("/site_resume_education")) throw new Error("Offline");
      return { ok: true, json: async () => request.pathname.endsWith("/site_resume_profile") ? [{ headline: "Profile" }] : [] };
    },
  });
  vm.runInContext(careerSource, context);
  vm.runInContext(`${contentSource.slice(contentSource.indexOf("async function fetchPublicContentTable"), contentSource.indexOf("async function loadFeaturedProject"))}\n${requestSource}`, context);
  const result = await vm.runInContext("requestPublicContent()", context);

  for (const query of Object.values(window.CareerData.queries)) {
    assert.ok(requests.some((url) => `${url.pathname.slice("/rest/v1/".length)}${url.search}` === query), query);
  }
  assert.equal(requests.length, 10);
  assert.equal(result.resumeProfile.headline, "Profile");
  assert.equal(result.resumeEducation.length, 0);
  assert.equal(result.resumeSkills.length, 0);
  assert.equal(warnings.length, 1);
  assert.equal(saved[0][0], "cache");
  assert.equal(saved[0][1].payload.resumeProfile.headline, "Profile");
});

test("online runtime loads the shared career contract before public content", async () => {
  const html = await readFile(new URL("../online/index.html", import.meta.url), "utf8");
  const career = html.indexOf('src="/shared/scripts/career-data.js');
  const content = html.indexOf('src="/online/scripts/content.js');
  assert.ok(career >= 0 && career < content);
});
