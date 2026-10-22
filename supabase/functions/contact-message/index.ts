const allowedOrigins = new Set([
  "https://www.shortbits.net",
  "https://shortbits.net",
]);
const perVisitorLimit = { count: 3, windowMs: 10 * 60_000 };
const globalLimit = { count: 40, windowMs: 60 * 60_000 };
const maxLinks = 3;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : "https://www.shortbits.net",
    "Access-Control-Allow-Headers": "apikey, authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function getServiceKey(): string | null {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) {
    return legacy;
  }
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    return typeof keys.default === "string" ? keys.default : null;
  } catch {
    return null;
  }
}

function getServiceConnection() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = getServiceKey();
  if (!url || !key) {
    throw new Error("Supabase service credentials are unavailable.");
  }
  // New-style sb_secret_ keys are not JWTs and must only be sent as the apikey header.
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_")) {
    headers.Authorization = `Bearer ${key}`;
  }
  return {
    restUrl: `${url.replace(/\/$/, "")}/rest/v1`,
    headers,
  };
}

function getClientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

async function hashVisitor(ip: string): Promise<string> {
  // Daily salt: visitors can be rate limited without storing raw IP addresses.
  const salt = `${getServiceKey() ?? ""}:${new Date().toISOString().slice(0, 10)}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${ip}`),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function countAttempts(filter: string, windowMs: number): Promise<number> {
  const { restUrl, headers } = getServiceConnection();
  const since = new Date(Date.now() - windowMs).toISOString();
  const response = await fetch(
    `${restUrl}/contact_rate_limits?select=id&created_at=gte.${encodeURIComponent(since)}${filter}`,
    { headers: { ...headers, Prefer: "count=exact", Range: "0-0" } },
  );
  if (!response.ok) {
    throw new Error(`Rate limit lookup failed with HTTP ${response.status}.`);
  }
  const total = response.headers.get("content-range")?.split("/")[1];
  return Number(total ?? 0);
}

async function recordAttempt(visitorHash: string): Promise<void> {
  const { restUrl, headers } = getServiceConnection();
  await fetch(`${restUrl}/contact_rate_limits`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ visitor_hash: visitorHash }),
  });
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  await fetch(`${restUrl}/contact_rate_limits?created_at=lt.${encodeURIComponent(cutoff)}`, {
    method: "DELETE",
    headers,
  });
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    return true;
  }
  if (!token) {
    return false;
  }
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip !== "unknown") {
    form.append("remoteip", ip);
  }
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form },
  );
  const result = await response.json().catch(() => null);
  return result?.success === true;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

type EmailStatus = "accepted" | "failed" | "not_configured" | "not_requested";

async function sendContactEmails(name: string, email: string, message: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("CONTACT_EMAIL_FROM");
  const to = Deno.env.get("CONTACT_EMAIL_TO");
  if (!apiKey || !from || !to) {
    console.error("Contact email is not configured: RESEND_API_KEY, CONTACT_EMAIL_FROM, and CONTACT_EMAIL_TO are required.");
    return {
      notification: "not_configured",
      confirmation: email ? "not_configured" : "not_requested",
    };
  }

  async function send(kind: string, payload: Record<string, unknown>): Promise<EmailStatus> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, ...payload }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        console.error(`Contact ${kind} email rejected by Resend: HTTP ${response.status}.`);
        return "failed";
      }
      const result = await response.json();
      if (typeof result?.id !== "string" || !result.id) {
        console.error(`Contact ${kind} email response did not include a Resend message ID.`);
        return "failed";
      }
      console.info(`Contact ${kind} email accepted by Resend: ${result.id}`);
      return "accepted";
    } catch (error) {
      console.error(`Contact ${kind} email request failed:`, error);
      return "failed";
    }
  }

  const [notification, confirmation] = await Promise.all([
    send("notification", {
      to: [to],
      ...(email ? { reply_to: email } : {}),
      subject: "New shortbits.net contact message",
      text: `Name: ${name}\nEmail: ${email || "Not provided"}\n\n${message}`,
    }),
    // Do not forward visitor-controlled content to an unverified recipient.
    email ? send("confirmation", {
      to: [email],
      reply_to: to,
      subject: "Your message to shortbits.net was received",
      text: "Thanks for getting in touch! Your message has been saved and is available for Caleb to review.\n\nIf you need to follow up, reply to this email.\n\nIf you did not submit a message at shortbits.net, you can ignore this email.",
    }) : Promise.resolve<EmailStatus>("not_requested"),
  ]);
  return { notification, confirmation };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Method not allowed." }, 405);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonResponse(request, { error: "Invalid request." }, 400);
  }

  const name = readString(body.name);
  const email = readString(body.email);
  const message = readString(body.message);
  const website = readString(body.website);
  const turnstileToken = readString(body.turnstileToken);

  // Bots that fill the hidden field get a normal-looking success and nothing is stored.
  if (website) {
    return jsonResponse(request, { ok: true });
  }
  if (!name || name.length > 100 || !message || message.length > 2000) {
    return jsonResponse(request, { error: "Name and a message of up to 2000 characters are required." }, 400);
  }
  if (email && (email.length > 320 || !emailPattern.test(email))) {
    return jsonResponse(request, { error: "That email address does not look valid." }, 400);
  }
  if ((message.match(/https?:\/\/|www\./gi) ?? []).length > maxLinks) {
    return jsonResponse(request, { error: `Messages can include at most ${maxLinks} links.` }, 400);
  }

  const ip = getClientIp(request);
  try {
    if (!await verifyTurnstile(turnstileToken, ip)) {
      return jsonResponse(request, { error: "Verification failed. Please complete the check and try again." }, 403);
    }

    const visitorHash = await hashVisitor(ip);
    const [visitorAttempts, totalAttempts] = await Promise.all([
      countAttempts(`&visitor_hash=eq.${visitorHash}`, perVisitorLimit.windowMs),
      countAttempts("", globalLimit.windowMs),
    ]);
    if (visitorAttempts >= perVisitorLimit.count || totalAttempts >= globalLimit.count) {
      return jsonResponse(request, { error: "Too many messages right now. Please try again later." }, 429);
    }
    await recordAttempt(visitorHash);

    const { restUrl, headers } = getServiceConnection();
    const insert = await fetch(`${restUrl}/messages`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ name, email: email || null, message }),
    });
    if (!insert.ok) {
      console.error("Message insert failed:", insert.status, await insert.text());
      return jsonResponse(request, { error: "Message service is unavailable." }, 502);
    }
    const emailDelivery = await sendContactEmails(name, email, message);
    return jsonResponse(request, { ok: true, emailDelivery });
  } catch (error) {
    console.error("Contact submission failed:", error);
    return jsonResponse(request, { error: "Message service is unavailable." }, 502);
  }
});
