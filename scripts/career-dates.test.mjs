import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { parseHTML } from "linkedom";

const source = await readFile(new URL("../shared/scripts/career-format.js", import.meta.url), "utf8");

function setup(initialDate = "2026-10-28T08:00:00Z", html = "<html><body></body></html>") {
  const { document } = parseHTML(html);
  let date = initialDate;
  const events = {};
  let tick;
  const window = {
    addEventListener(name, callback) { events[name] = callback; },
    setInterval(callback, delay) { assert.equal(delay, 60_000); tick = callback; },
  };
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [date])); }
  }
  vm.runInNewContext(source, { window, document, Date: Clock });
  return {
    document, api: window.CareerFormat, events,
    advance(value) { date = value; },
    tick: () => tick(),
    period(value, options = { live: true }) {
      return window.CareerFormat.buildPeriod(document.createElement("p"), value, options);
    },
  };
}

test("role ranges replace stale durations using inclusive UTC calendar months", () => {
  const state = setup();
  for (const [range, expected] of [
    ["Mar 2025 - Present · 1 yr 8 mos", "1 yr 8 mos"],
    ["Jan 2024 - Current 1 mo", "2 yrs 10 mos"],
    ["October 2026 — now", "1 mo"],
    ["Jan 2024 – Dec 2024", "1 yr"],
    ["Jan 2024 - Jan 2025", "1 yr 1 mo"],
    ["Feb 2024 - Feb 2024", "1 mo"],
    ["Sept 2023 - September 2024", "1 yr 1 mo"],
  ]) {
    const element = state.period(range);
    assert.equal(element.querySelector(".career-period-duration").textContent, expected, range);
    assert.equal(element.dataset.careerPeriod, range);
  }
});

test("unknown/custom dates and education labels are preserved without inventing start dates", () => {
  const state = setup();
  for (const value of ["Current", "Ongoing", "2024 - Present", "Invalid 2024 - Present", "Mar 2026 - Jan 2026"]) {
    assert.equal(state.api.parseRolePeriod(value), null);
    assert.equal(state.period(value).textContent, value);
  }
  const education = state.period("May 2026 - Apr 2029 · Expected", {});
  assert.equal(education.querySelector(".career-period-duration").textContent, "Expected");
  assert.equal(education.hasAttribute("data-career-period"), false);
  assert.equal(state.period("Jan 2027 - Present · 10 yrs").querySelector(".career-period-duration"), null);
  assert.equal(state.period("Jan 2026 - Dec 2027 · 10 yrs").querySelector(".career-period-duration"), null);
});

test("Admin month values round-trip without saving a computed duration and reject invalid ranges", () => {
  const state = setup();
  for (const [start, end, current, expected] of [
    ["2024-01", "2025-03", false, "Jan 2024 - Mar 2025"],
    ["2024-09", "", true, "Sep 2024 - Present"],
    ["2024-12", "2024-12", false, "Dec 2024 - Dec 2024"],
  ]) {
    assert.equal(state.api.formatRolePeriod(start, end, current), expected);
    const parsed = state.api.parseRolePeriod(expected);
    assert.equal(parsed.start, start);
    assert.equal(parsed.end, end);
    assert.equal(parsed.current, current);
  }
  for (const args of [["", "", true], ["2024-13", "", true], ["2024-01", "", false],
    ["2025-01", "2024-12", false], ["2024-1", "", true]]) {
    assert.throws(() => state.api.formatRolePeriod(...args), /valid start month/);
  }
});

test("saved HTML refreshes on load, month rollover, tab return, and immediately before printing", () => {
  const state = setup("2025-12-31T23:59:59Z", `<html><body>
    <p id="active" data-career-period="Dec 2025 - Present · 99 yrs">Old snapshot</p>
    <p id="ended" data-career-period="Jan 2024 - Dec 2024">Old snapshot</p>
    </body></html>`);
  const active = state.document.querySelector("#active");
  const duration = () => active.querySelector(".career-period-duration").textContent;
  assert.equal(duration(), "1 mo");
  state.advance("2026-01-01T00:00:00Z");
  state.tick();
  assert.equal(duration(), "2 mos");
  state.advance("2026-02-01T00:00:00Z");
  state.events.beforeprint();
  assert.equal(duration(), "3 mos");
  state.advance("2026-03-01T00:00:00Z");
  state.document.dispatchEvent(new state.document.defaultView.Event("visibilitychange"));
  assert.equal(duration(), "4 mos");
  state.advance("2026-04-01T00:00:00Z");
  state.events.pageshow();
  assert.equal(duration(), "5 mos");
  assert.equal(state.document.querySelector("#ended .career-period-duration").textContent, "1 yr");
});
