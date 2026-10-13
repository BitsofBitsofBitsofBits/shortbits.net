const guestbookWindow = document.querySelector("#guestbook-window");
const guestbookForm = document.querySelector("#guestbook-form");
const guestbookSubmit = document.querySelector("#guestbook-submit");
const guestbookFormStatus = document.querySelector("#guestbook-form-status");
const guestbookListStatus = document.querySelector("#guestbook-list-status");
const guestbookList = document.querySelector("#guestbook-list");
const guestbookRefresh = document.querySelector("#guestbook-refresh");

let guestbookRequestInFlight = null;

function getGuestbookConnection() {
  const { url, anonKey } = window.SUPABASE_CONFIG || {};
  if (!url || !anonKey) {
    throw new Error("Supabase Guestbook configuration is missing.");
  }
  return {
    endpoint: `${url.replace(/\/$/, "")}/rest/v1/site_guestbook`,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  };
}

function setGuestbookStatus(element, message, state = "") {
  element.textContent = message;
  element.dataset.state = state;
}

function createGuestbookEntry(entry) {
  const item = document.createElement("li");
  const header = document.createElement("header");
  const name = document.createElement("strong");
  const timestamp = document.createElement("time");
  const message = document.createElement("p");
  const parsedDate = Date.parse(entry.created_at);

  name.textContent = entry.name;
  timestamp.dateTime = entry.created_at;
  timestamp.textContent = Number.isFinite(parsedDate)
    ? new Date(parsedDate).toLocaleString()
    : "UNKNOWN TIME";
  message.textContent = entry.message;
  header.append(name, timestamp);
  item.append(header, message);
  return item;
}

async function loadGuestbook({ force = false } = {}) {
  if (guestbookRequestInFlight && !force) {
    return guestbookRequestInFlight;
  }

  setGuestbookStatus(guestbookListStatus, "Reading visitor log...");
  guestbookRequestInFlight = (async () => {
    try {
      const { endpoint, headers } = getGuestbookConnection();
      const response = await fetch(
        `${endpoint}?select=id,name,message,created_at&order=created_at.desc&limit=50`,
        { headers },
      );
      const entries = await response.json();
      if (!response.ok) {
        throw new Error(
          entries.message || `Guestbook returned status ${response.status}.`,
        );
      }
      if (
        !Array.isArray(entries)
        || entries.some((entry) => (
          typeof entry.id !== "string"
          || typeof entry.name !== "string"
          || entry.name.length === 0
          || entry.name.length > 80
          || typeof entry.message !== "string"
          || entry.message.length === 0
          || entry.message.length > 500
          || !Number.isFinite(Date.parse(entry.created_at))
        ))
      ) {
        throw new Error("Guestbook response is malformed.");
      }

      guestbookList.replaceChildren(...entries.map(createGuestbookEntry));
      setGuestbookStatus(
        guestbookListStatus,
        entries.length
          ? `${entries.length} recent signature${entries.length === 1 ? "" : "s"} loaded.`
          : "No signatures yet. You could be the first suspicious packet.",
        "success",
      );
      return true;
    } catch (error) {
      console.error("Unable to load Guestbook:", error);
      guestbookList.replaceChildren();
      setGuestbookStatus(
        guestbookListStatus,
        "Guestbook signal is currently unavailable.",
        "error",
      );
      return false;
    } finally {
      guestbookRequestInFlight = null;
    }
  })();

  return guestbookRequestInFlight;
}

guestbookForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(guestbookForm);
  const name = String(formData.get("name") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();

  if (website) {
    setGuestbookStatus(
      guestbookFormStatus,
      "Signature rejected by spam protection.",
      "error",
    );
    return;
  }
  if (!name || !message) {
    setGuestbookStatus(
      guestbookFormStatus,
      "Name and message are required.",
      "error",
    );
    return;
  }

  guestbookSubmit.disabled = true;
  guestbookSubmit.textContent = "> PUBLISHING...";
  setGuestbookStatus(guestbookFormStatus, "Appending signature to public log...");

  try {
    const { endpoint, headers } = getGuestbookConnection();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ name, message }),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Guestbook publish failed with status ${response.status}: ${errorBody}`,
      );
    }

    guestbookForm.reset();
    setGuestbookStatus(
      guestbookFormStatus,
      "Signature published to the internet.",
      "success",
    );
    await loadGuestbook({ force: true });
  } catch (error) {
    console.error("Unable to publish Guestbook entry:", error);
    setGuestbookStatus(
      guestbookFormStatus,
      "Guestbook publish failed. Please try again.",
      "error",
    );
  } finally {
    guestbookSubmit.disabled = false;
    guestbookSubmit.textContent = "> SIGN_GUESTBOOK";
  }
});

guestbookRefresh.addEventListener("click", () => loadGuestbook({ force: true }));
window.addEventListener("desktop-window:opened", (event) => {
  if (event.detail?.windowId === "guestbook-window") {
    loadGuestbook();
  }
});
if (!guestbookWindow.hidden) {
  loadGuestbook();
}
