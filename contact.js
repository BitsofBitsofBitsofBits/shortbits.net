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
    }
  : {
      sending: "> TRANSMITTING...",
      connecting: "Opening secure channel...",
      submit: "> SEND_PACKET",
      failed: "Transmission failed",
      success: "Packet delivered. Thanks for saying hello.",
    };

function setContactStatus(message, state = "") {
  contactStatus.textContent = message;
  contactStatus.dataset.state = state;
}

function getContactEndpoint() {
  const { url, anonKey } = window.SUPABASE_CONFIG || {};
  if (!url || !anonKey) {
    throw new Error("Supabase contact configuration is missing.");
  }
  return {
    endpoint: `${url.replace(/\/$/, "")}/rest/v1/messages`,
    anonKey,
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

  contactSubmit.disabled = true;
  contactSubmit.textContent = contactCopy.sending;
  setContactStatus(contactCopy.connecting);

  let response;
  try {
    const { endpoint, anonKey } = getContactEndpoint();
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ name, email: email || null, message }),
    });
  } catch (error) {
    console.error("Unable to initialize message service:", error);
    setContactStatus("Message service is currently unavailable.", "error");
    contactSubmit.disabled = false;
    contactSubmit.textContent = contactCopy.submit;
    return;
  }

  contactSubmit.disabled = false;
  contactSubmit.textContent = contactCopy.submit;

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Unable to send message:", response.status, errorBody);
    setContactStatus(`${contactCopy.failed} with status ${response.status}.`, "error");
    return;
  }

  contactForm.reset();
  setContactStatus(contactCopy.success, "success");
});

contactSubmit.disabled = false;
