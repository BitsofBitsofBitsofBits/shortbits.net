import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";

const source = stripTypeScriptTypes(readFileSync(new URL("./index.ts", import.meta.url), "utf8"));
const message = { name: "<Visitor>", email: "visitor@example.com", message: "Hello <script>test</script>" };

function setup(options = {}) {
  const env = {
    SUPABASE_URL: "https://database.example",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    RESEND_API_KEY: "test-resend-key",
    CONTACT_EMAIL_FROM: "shortbits.net <contact@shortbits.net>",
    CONTACT_EMAIL_TO: "owner@example.com",
    ...options.env,
  };
  const calls = [];
  const logs = [];
  let handler;
  const context = {
    Request, Response, FormData, TextEncoder, crypto, AbortSignal,
    Deno: { env: { get: (key) => env[key] }, serve: (callback) => { handler = callback; } },
    console: {
      error: (...args) => logs.push(args.join(" ")),
      info: (...args) => logs.push(args.join(" ")),
    },
    fetch: async (url, init = {}) => {
      const body = init.body && typeof init.body === "string" ? JSON.parse(init.body) : null;
      calls.push({ url, init, body });
      if (url.includes("siteverify")) return Response.json({ success: options.verified !== false });
      if (url.includes("contact_rate_limits?select")) {
        return new Response("[]", { headers: { "content-range": `0-0/${options.rateCount ?? 0}` } });
      }
      if (url.endsWith("/messages")) {
        return new Response(null, { status: options.insertStatus ?? 201 });
      }
      if (url === "https://api.resend.com/emails") {
        assert.ok(calls.some((call) => call.url.endsWith("/messages")), "store before sending");
        assert.equal(init.headers.Authorization, "Bearer test-resend-key");
        assert.ok(init.signal instanceof AbortSignal);
        if (options.resendError) throw options.resendError;
        if (options.resendResponse) return options.resendResponse(body);
        return Response.json({ id: `email-${calls.length}` });
      }
      return new Response(null, { status: 204 });
    },
  };
  vm.runInNewContext(source, context);
  return {
    calls, logs,
    emails: () => calls.filter((call) => call.url === "https://api.resend.com/emails"),
    submit: (body = message, method = "POST") => handler(new Request("https://function.example", {
      method,
      headers: { "Content-Type": "application/json", origin: "https://www.shortbits.net" },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    })),
  };
}

test("stores before sending notification and a safe confirmation with correct reply addresses", async () => {
  const app = setup();
  const response = await app.submit();
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).emailDelivery, { notification: "accepted", confirmation: "accepted" });
  const [notification, confirmation] = app.emails().map((call) => call.body);
  assert.equal(notification.from, "shortbits.net <contact@shortbits.net>");
  assert.deepEqual(notification.to, ["owner@example.com"]);
  assert.equal(notification.reply_to, message.email);
  assert.ok(notification.text.includes(message.message));
  assert.equal(notification.html, undefined);
  assert.deepEqual(confirmation.to, [message.email]);
  assert.equal(confirmation.reply_to, "owner@example.com");
  assert.ok(!confirmation.text.includes(message.name));
  assert.ok(!confirmation.text.includes(message.message));
});

test("email is optional: notify owner without sending a confirmation or setting reply-to", async () => {
  const app = setup();
  const result = await (await app.submit({ ...message, email: "" })).json();
  assert.equal(result.emailDelivery.confirmation, "not_requested");
  assert.equal(app.emails().length, 1);
  assert.equal(app.emails()[0].body.reply_to, undefined);
});

for (const key of ["RESEND_API_KEY", "CONTACT_EMAIL_FROM", "CONTACT_EMAIL_TO"]) {
  test(`missing ${key} does not lose the saved message and is reported explicitly`, async () => {
    const app = setup({ env: { [key]: undefined } });
    const response = await app.submit();
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).emailDelivery, {
      notification: "not_configured", confirmation: "not_configured",
    });
    assert.equal(app.emails().length, 0);
    assert.ok(app.logs.some((entry) => entry.includes("not configured")));
  });
}

test("Resend rejection preserves stored message and reports both email failures", async () => {
  const app = setup({ resendResponse: () => new Response(null, { status: 429 }) });
  const response = await app.submit();
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).emailDelivery, { notification: "failed", confirmation: "failed" });
  assert.ok(app.logs.some((entry) => entry.includes("HTTP 429")));
});

test("confirmation failure does not mask successful owner notification", async () => {
  const app = setup({
    resendResponse: (body) => body.to[0] === message.email
      ? new Response(null, { status: 422 })
      : Response.json({ id: "owner-email" }),
  });
  assert.deepEqual((await (await app.submit()).json()).emailDelivery, {
    notification: "accepted", confirmation: "failed",
  });
});

for (const resendError of [new Error("Network unavailable"), new DOMException("Timed out", "TimeoutError")]) {
  test(`email request failure is explicit without rejecting saved contact: ${resendError.name}`, async () => {
    const app = setup({ resendError });
    const response = await app.submit();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).emailDelivery.notification, "failed");
    assert.ok(app.logs.some((entry) => entry.includes("request failed")));
  });
}

test("an invalid provider success response is not treated as accepted", async () => {
  const app = setup({ resendResponse: () => Response.json({}) });
  assert.equal((await (await app.submit()).json()).emailDelivery.notification, "failed");
});

test("failed storage never sends either email", async () => {
  const app = setup({ insertStatus: 503 });
  assert.equal((await app.submit()).status, 502);
  assert.equal(app.emails().length, 0);
});

for (const body of [
  { ...message, website: "spam.example" },
  { ...message, email: "invalid\r\nBcc: victim@example.com" },
  { ...message, name: "" },
  { ...message, message: "x".repeat(2001) },
  { ...message, message: "https://one.example https://two.example https://three.example https://four.example" },
]) {
  test(`spam/invalid submissions never store or email: ${JSON.stringify(body).slice(0, 90)}`, async () => {
    const app = setup();
    const response = await app.submit(body);
    assert.equal(response.status, body.website ? 200 : 400);
    assert.equal(app.calls.length, 0);
  });
}

test("rate-limited requests do not store or email", async () => {
  const app = setup({ rateCount: 40 });
  assert.equal((await app.submit()).status, 429);
  assert.ok(!app.calls.some((call) => call.url.endsWith("/messages")));
  assert.equal(app.emails().length, 0);
});

test("failed Turnstile prevents storage and email", async () => {
  const app = setup({ env: { TURNSTILE_SECRET_KEY: "test-turnstile" }, verified: false });
  assert.equal((await app.submit({ ...message, turnstileToken: "test-token" })).status, 403);
  assert.equal(app.emails().length, 0);
  assert.ok(!app.calls.some((call) => call.url.endsWith("/messages")));
});

test("preflight and unsupported methods never send email", async () => {
  const app = setup();
  const preflight = await app.submit(null, "OPTIONS");
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "https://www.shortbits.net");
  assert.equal((await app.submit(null, "GET")).status, 405);
  assert.equal(app.calls.length, 0);
});
