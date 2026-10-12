const loginView = document.querySelector("#login-view");
const inboxView = document.querySelector("#inbox-view");
const loginForm = document.querySelector("#login-form");
const loginSubmit = document.querySelector("#login-submit");
const loginStatus = document.querySelector("#login-status");
const inboxStatus = document.querySelector("#inbox-status");
const messageList = document.querySelector("#message-list");
const refreshButton = document.querySelector("#refresh-messages");
const logoutButton = document.querySelector("#logout-button");

function setAdminStatus(element, message, state = "") {
  element.textContent = message;
  element.dataset.state = state;
}

function createMessageElement(message) {
  const article = document.createElement("article");
  article.className = `message-card${message.read ? "" : " is-unread"}`;

  const header = document.createElement("header");
  const identity = document.createElement("div");
  const name = document.createElement("h3");
  const timestamp = document.createElement("time");
  const body = document.createElement("p");
  const actions = document.createElement("div");

  name.textContent = message.name;
  timestamp.dateTime = message.created_at;
  timestamp.textContent = new Date(message.created_at).toLocaleString();
  body.textContent = message.message;
  identity.append(name, timestamp);

  if (message.email) {
    const email = document.createElement("a");
    email.href = `mailto:${message.email}`;
    email.textContent = message.email;
    identity.append(email);
  }

  const readButton = document.createElement("button");
  readButton.type = "button";
  readButton.textContent = message.read ? "MARK_UNREAD" : "MARK_READ";
  readButton.addEventListener("click", async () => {
    const { error } = await adminClient
      .from("messages")
      .update({ read: !message.read })
      .eq("id", message.id);

    if (error) {
      console.error("Unable to update message:", error);
      setAdminStatus(inboxStatus, `Update failed: ${error.message}`, "error");
      return;
    }

    await loadMessages();
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "DELETE";
  deleteButton.addEventListener("click", async () => {
    if (!window.confirm(`Delete the message from ${message.name}?`)) {
      return;
    }

    const { error } = await adminClient
      .from("messages")
      .delete()
      .eq("id", message.id);

    if (error) {
      console.error("Unable to delete message:", error);
      setAdminStatus(inboxStatus, `Delete failed: ${error.message}`, "error");
      return;
    }

    await loadMessages();
  });

  actions.className = "message-actions";
  actions.append(readButton, deleteButton);
  header.append(identity, actions);
  article.append(header, body);
  return article;
}

async function loadMessages() {
  setAdminStatus(inboxStatus, "Fetching encrypted packets...");

  const { data, error } = await adminClient
    .from("messages")
    .select("id, name, email, message, created_at, read")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Unable to load messages:", error);
    setAdminStatus(inboxStatus, `Inbox failed to load: ${error.message}`, "error");
    return;
  }

  messageList.replaceChildren();

  if (data.length === 0) {
    setAdminStatus(inboxStatus, "No packets received yet.");
    return;
  }

  data.forEach((message) => {
    messageList.append(createMessageElement(message));
  });
  setAdminStatus(inboxStatus, `${data.length} packet${data.length === 1 ? "" : "s"} loaded.`, "success");
}

async function showInbox() {
  loginView.hidden = true;
  inboxView.hidden = false;
  await loadMessages();
}

function showLogin() {
  inboxView.hidden = true;
  loginView.hidden = false;
  loginForm.reset();
}

let adminClient;

try {
  adminClient = window.createSiteSupabaseClient();
} catch (error) {
  console.error(error);
  loginSubmit.disabled = true;
  setAdminStatus(
    loginStatus,
    "Supabase is not configured. Update supabase-config.js first.",
    "error",
  );
}

if (adminClient) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    loginSubmit.disabled = true;
    setAdminStatus(loginStatus, "Verifying credentials...");

    const { error } = await adminClient.auth.signInWithPassword({
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    });

    loginSubmit.disabled = false;

    if (error) {
      console.error("Authentication failed:", error);
      setAdminStatus(loginStatus, `Authentication failed: ${error.message}`, "error");
      return;
    }

    await showInbox();
  });

  refreshButton.addEventListener("click", loadMessages);
  logoutButton.addEventListener("click", async () => {
    const { error } = await adminClient.auth.signOut();

    if (error) {
      console.error("Unable to log out:", error);
      setAdminStatus(inboxStatus, `Logout failed: ${error.message}`, "error");
      return;
    }

    showLogin();
  });

  adminClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("Unable to restore session:", error);
      setAdminStatus(loginStatus, `Session check failed: ${error.message}`, "error");
      return;
    }

    if (data.session) {
      showInbox();
    }
  });
}
