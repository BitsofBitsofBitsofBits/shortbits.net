const contactForm = document.querySelector("#contact-form");
const contactStatus = document.querySelector("#contact-status");
const contactSubmit = document.querySelector("#contact-submit");
const professionalContact = contactForm.dataset.tone === "professional";
const contactCopy = professionalContact
  ? {
      sending: "Sending...",
      connecting: "Sending your message...",
      submit: "Send message",
      failed: "Message could not be sent",
      success: "Message sent. Thank you for getting in touch.",
      verify: "Please complete the verification check first.",
    }
  : {
      sending: "> TRANSMITTING...",
      connecting: "Opening secure channel...",
      submit: "> SEND_PACKET",
      failed: "Transmission failed",
      success: "Packet delivered. Thanks for saying hello.",
      verify: "Human verification required before transmitting.",
    };
// Read lazily: site-config.js may load after this deferred script.
function getTurnstileSiteKey() {
  return window.SITE_CONFIG?.turnstileSiteKey ?? "";
}
let turnstileWidgetId = null;
let turnstileScheme = "";
let turnstileFrame = null;

function setContactStatus(message, state = "") {
  contactStatus.textContent = message;
  contactStatus.dataset.state = state;
}

function getContactConnection() {
  const { url, anonKey } = window.SUPABASE_CONFIG || {};
  if (!url || !anonKey) {
    throw new Error("Supabase contact configuration is missing.");
  }
  const base = url.replace(/\/$/, "");
  return {
    functionUrl: `${base}/functions/v1/contact-message`,
    tableUrl: `${base}/rest/v1/messages`,
    anonKey,
  };
}

// Turnstile renders in a Cloudflare iframe that only offers light or dark, so
// pick whichever matches the themed field background instead of the OS setting.
function getTurnstileScheme() {
  const field = contactForm.querySelector("input:not([type='hidden']), textarea");
  const color = getComputedStyle(field ?? document.body).backgroundColor;
  const [r = 0, g = 0, b = 0] = (color.match(/[\d.]+/g) ?? []).map(Number);
  const scale = /^color\(/.test(color) ? 255 : 1;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) * scale / 255;
  return luminance > 0.5 ? "light" : "dark";
}

const turnstileStatusCopy = professionalContact
  ? {
      pending: "Verifying you're human...",
      interactive: "Please confirm you're human below.",
      verified: "Verified",
      expired: "Verification expired. Checking again...",
      error: "Verification couldn't load. Refresh the page to try again.",
    }
  : {
      pending: "SCANNING_FOR_HUMANS...",
      interactive: "MANUAL CHECK REQUIRED // CONFIRM BELOW",
      verified: "HUMAN CONFIRMED // CHANNEL OPEN",
      expired: "TOKEN EXPIRED // RESCANNING...",
      error: "VERIFICATION OFFLINE // REFRESH TO RETRY",
    };

// The Cloudflare box stays collapsed unless it needs a click or has an error.
function setTurnstileState(state) {
  turnstileFrame.dataset.state = state;
  turnstileFrame.querySelector(".contact-turnstile-widget").classList.toggle(
    "is-collapsed",
    state !== "interactive" && state !== "error",
  );
  turnstileFrame.querySelector(".contact-turnstile-status").textContent = turnstileStatusCopy[state];
}

function renderTurnstile() {
  const slot = turnstileFrame.querySelector(".contact-turnstile-widget");
  if (turnstileWidgetId !== null) {
    window.turnstile.remove(turnstileWidgetId);
  }
  turnstileScheme = getTurnstileScheme();
  turnstileFrame.dataset.scheme = turnstileScheme;
  setTurnstileState("pending");
  turnstileWidgetId = window.turnstile.render(slot, {
    sitekey: getTurnstileSiteKey(),
    theme: turnstileScheme,
    size: "flexible",
    appearance: "interaction-only",
    action: "contact",
    callback: () => setTurnstileState("verified"),
    "before-interactive-callback": () => setTurnstileState("interactive"),
    "expired-callback": () => setTurnstileState("expired"),
    "error-callback": () => setTurnstileState("error"),
  });
}

function loadTurnstile() {
  const turnstileSiteKey = getTurnstileSiteKey();
  if (!turnstileSiteKey) {
    return;
  }
  turnstileFrame = document.createElement("div");
  turnstileFrame.className = "contact-turnstile";
  const label = document.createElement("span");
  label.className = "contact-turnstile-label";
  label.textContent = professionalContact ? "Verification" : "// HUMAN_CHECK.SYS";
  const slot = document.createElement("div");
  slot.className = "contact-turnstile-widget is-collapsed";
  const status = document.createElement("p");
  status.className = "contact-turnstile-status";
  status.setAttribute("aria-live", "polite");
  turnstileFrame.append(label, status, slot);
  contactForm.querySelector(".contact-actions")?.before(turnstileFrame);

  window.bitsTurnstileReady = () => {
    renderTurnstile();
    // Theme switches restyle the page; re-render only when light/dark flips.
    let pending = 0;
    new MutationObserver(() => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => {
        if (getTurnstileScheme() !== turnstileScheme) {
          renderTurnstile();
        }
      }, 150);
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-interface-theme", "data-color-scheme", "class", "style"],
    });
  };
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=bitsTurnstileReady";
  script.async = true;
  script.defer = true;
  document.head.append(script);
}

function getTurnstileToken() {
  if (!getTurnstileSiteKey() || !window.turnstile || turnstileWidgetId === null) {
    return "";
  }
  return window.turnstile.getResponse(turnstileWidgetId) ?? "";
}

function resetTurnstile() {
  if (window.turnstile && turnstileWidgetId !== null) {
    window.turnstile.reset(turnstileWidgetId);
    setTurnstileState("pending");
  }
}

async function sendContactMessage(payload) {
  const { functionUrl, tableUrl, anonKey } = getContactConnection();
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (response.status !== 404) {
    const result = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, error: result.error, emailDelivery: result.emailDelivery };
  }

  // The Edge Function has not been deployed yet; use the original direct insert.
  const legacy = await fetch(tableUrl, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      name: payload.name,
      email: payload.email || null,
      message: payload.message,
    }),
  });
  return {
    ok: legacy.ok,
    status: legacy.status,
    error: null,
    emailDelivery: { notification: "not_configured", confirmation: payload.email ? "not_configured" : "not_requested" },
  };
}

contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(contactForm);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();

  if (website) {
    setContactStatus("Message rejected by spam protection.", "error");
    return;
  }

  if (!name || !message) {
    setContactStatus("Name and message are required.", "error");
    return;
  }

  const turnstileToken = getTurnstileToken();
  if (getTurnstileSiteKey() && !turnstileToken) {
    setContactStatus(contactCopy.verify, "error");
    return;
  }

  contactSubmit.disabled = true;
  contactSubmit.textContent = contactCopy.sending;
  setContactStatus(contactCopy.connecting);

  let result;
  try {
    result = await sendContactMessage({ name, email, message, website, turnstileToken });
  } catch (error) {
    console.error("Unable to reach message service:", error);
    setContactStatus("Message service is currently unavailable.", "error");
    contactSubmit.disabled = false;
    contactSubmit.textContent = contactCopy.submit;
    resetTurnstile();
    return;
  }

  contactSubmit.disabled = false;
  contactSubmit.textContent = contactCopy.submit;
  resetTurnstile();

  if (!result.ok) {
    console.error("Unable to send message:", result.status, result.error);
    setContactStatus(
      result.error
        ? `${contactCopy.failed}: ${result.error}`
        : `${contactCopy.failed} with status ${result.status}.`,
      "error",
    );
    return;
  }

  contactForm.reset();
  const delivery = result.emailDelivery;
  const emailUnavailable = delivery && [delivery.notification, delivery.confirmation]
    .some((status) => status === "failed" || status === "not_configured");
  if (emailUnavailable) {
    console.warn("Contact message saved, but email delivery was unavailable:", delivery);
    setContactStatus(`${contactCopy.success} Email delivery is currently unavailable; no need to resend your message.`, "success");
  } else {
    setContactStatus(
      `${contactCopy.success}${delivery?.confirmation === "accepted" ? " A confirmation email is on its way." : ""}`,
      "success",
    );
  }
});

document.addEventListener("DOMContentLoaded", loadTurnstile);
contactSubmit.disabled = false;
