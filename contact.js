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

function loadTurnstile() {
  const turnstileSiteKey = getTurnstileSiteKey();
  if (!turnstileSiteKey) {
    return;
  }
  const container = document.createElement("div");
  container.className = "contact-turnstile";
  contactForm.querySelector(".contact-actions")?.before(container);

  window.bitsTurnstileReady = () => {
    turnstileWidgetId = window.turnstile.render(container, {
      sitekey: turnstileSiteKey,
      theme: "auto",
      action: "contact",
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
    return { ok: response.ok, status: response.status, error: result.error };
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
  return { ok: legacy.ok, status: legacy.status, error: null };
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
  setContactStatus(contactCopy.success, "success");
});

document.addEventListener("DOMContentLoaded", loadTurnstile);
contactSubmit.disabled = false;
