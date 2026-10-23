import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../contact.js", import.meta.url), "utf8");

function setup() {
  const listeners = new Map();
  const scripts = [];
  let intersection;
  let requests = 0;
  let renderOptions;
  let renders = 0;
  let token = "";
  const timers = new Map();
  function element() {
    return {
      dataset: {}, children: [], className: "", hidden: false,
      classList: { toggle() {} },
      addEventListener(type, callback) { this[type] = callback; },
      setAttribute() {},
      append(...children) { this.children.push(...children); },
      before(child) { form.frame = child; },
      remove() {},
      querySelector(selector) {
        return this.children.find((child) => child.className.split(" ").includes(selector.slice(1)));
      },
    };
  }
  const form = element();
  const actions = element();
  const status = element();
  const submit = element();
  form.contains = () => false;
  form.reset = () => {};
  form.querySelector = (selector) => selector === ".contact-actions" ? actions : element();
  form.addEventListener = (type, callback) => listeners.set(type, callback);
  const window = {
    SITE_CONFIG: { turnstileSiteKey: "test-site-key" },
    SUPABASE_CONFIG: { url: "https://example.test", anonKey: "public" },
    setTimeout(callback) { const id = timers.size + 1; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    IntersectionObserver: class {
      constructor(callback) { intersection = callback; }
      observe() {}
      disconnect() {}
    },
  };
  const context = {
    window, console: { error() {}, warn() {} },
    document: {
      readyState: "complete", activeElement: null, documentElement: {},
      head: { append(script) { scripts.push(script); } },
      createElement: element,
      querySelector: (selector) => ({
        "#contact-form": form, "#contact-status": status, "#contact-submit": submit,
      })[selector],
    },
    getComputedStyle: () => ({ backgroundColor: "rgb(0, 0, 0)" }),
    FormData: class { get(key) { return { name: "Visitor", message: "Hello" }[key]; } },
    MutationObserver: class { observe() {} },
    fetch: async () => { requests++; return { status: 404, ok: false, json: async () => ({}) }; },
  };
  context.IntersectionObserver = window.IntersectionObserver;
  vm.runInNewContext(source, context);
  return {
    window, form, status, scripts, timers,
    focus: () => listeners.get("focusin")(),
    intersect: () => intersection([{ isIntersecting: true }]),
    submit: () => listeners.get("submit")({ preventDefault() {} }),
    requests: () => requests,
    renders: () => renders,
    verify: () => { token = "verified-token"; renderOptions.callback(); },
    ready() {
      window.turnstile = {
        render(_slot, options) { renders++; renderOptions = options; return "widget"; },
        remove() {}, reset() { token = ""; }, getResponse: () => token,
      };
      window.bitsTurnstileReady();
    },
  };
}

test("verification loads only near the form or on focus", () => {
  const page = setup();
  assert.equal(page.scripts.length, 0);
  page.intersect();
  page.focus();
  assert.equal(page.scripts.length, 1);
  page.ready();
  assert.equal(page.renders(), 1);
});

test("script failure offers a retry without a page refresh", () => {
  const page = setup();
  page.focus();
  page.scripts[0].error();
  assert.equal(page.form.frame.dataset.state, "error");
  const retry = page.form.frame.querySelector(".contact-turnstile-retry");
  assert.equal(retry.hidden, false);
  retry.click();
  assert.equal(page.scripts.length, 2);
  page.ready();
  assert.equal(page.form.frame.dataset.state, "pending");
  page.verify();
  assert.equal(page.form.frame.dataset.state, "verified");
  assert.equal(retry.hidden, true);
});

test("verification timeout exposes retry", () => {
  const page = setup();
  page.focus();
  [...page.timers.values()][0]();
  assert.equal(page.form.frame.dataset.state, "error");
});

test("submission requires verification and never bypasses it via legacy insert", async () => {
  const page = setup();
  await page.submit();
  assert.equal(page.requests(), 0);
  assert.equal(page.status.dataset.state, "error");
  page.ready();
  page.verify();
  await page.submit();
  assert.equal(page.requests(), 1, "404 must not fall back to an unverified table insert");
  assert.equal(page.status.dataset.state, "error");
});
