const loginView = document.querySelector("#login-view");
const inboxView = document.querySelector("#inbox-view");
const loginForm = document.querySelector("#login-form");
const loginSubmit = document.querySelector("#login-submit");
const loginStatus = document.querySelector("#login-status");
const inboxStatus = document.querySelector("#inbox-status");
const messageList = document.querySelector("#message-list");
const refreshButton = document.querySelector("#refresh-messages");
const logoutButton = document.querySelector("#logout-button");
const pronounProfileForm = document.querySelector("#pronoun-profile-form");
const pronounProfileSubmit = document.querySelector("#pronoun-profile-submit");
const pronounAdminStatus = document.querySelector("#pronoun-admin-status");
const playlistForm = document.querySelector("#playlist-form");
const playlistSubmit = document.querySelector("#playlist-submit");
const playlistAdminStatus = document.querySelector("#playlist-admin-status");
const spotifyPlaylistUrlPattern =
  /^https:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]+(?:\?.*)?$/;
const pronounProfileFields = [
  "display_name",
  "subject_pronoun",
  "object_pronoun",
  "possessive_determiner",
  "possessive_pronoun",
  "reflexive_pronoun",
  "honorifics",
  "gendered_terms",
  "compliments",
  "relationship_terms",
];

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

async function loadPronounProfile() {
  setAdminStatus(pronounAdminStatus, "Loading identity reference...");
  const { data, error } = await adminClient
    .from("pronoun_profiles")
    .select(pronounProfileFields.join(", "))
    .eq("id", "primary")
    .single();

  if (error) {
    console.error("Unable to load pronoun profile:", error);
    setAdminStatus(
      pronounAdminStatus,
      `Pronoun profile failed to load: ${error.message}`,
      "error",
    );
    return;
  }

  pronounProfileFields.forEach((field) => {
    pronounProfileForm.elements[field].value = data[field];
  });
  setAdminStatus(pronounAdminStatus, "Identity reference loaded.", "success");
}

async function loadFeaturedPlaylists() {
  setAdminStatus(playlistAdminStatus, "Loading curated playlist slots...");
  const { data, error } = await adminClient
    .from("spotify_featured_playlists")
    .select("position, title, spotify_url, enabled")
    .order("position", { ascending: true });

  if (error) {
    console.error("Unable to load featured playlists:", error);
    setAdminStatus(
      playlistAdminStatus,
      `Featured playlists failed to load: ${error.message}`,
      "error",
    );
    return;
  }

  for (let position = 1; position <= 5; position += 1) {
    const playlist = data.find((entry) => entry.position === position);
    playlistForm.elements[`playlist_${position}_title`].value =
      playlist?.title ?? "";
    playlistForm.elements[`playlist_${position}_url`].value =
      playlist?.spotify_url ?? "";
    playlistForm.elements[`playlist_${position}_enabled`].checked =
      playlist?.enabled === true;
  }
  setAdminStatus(playlistAdminStatus, "Curated playlist slots loaded.", "success");
}

async function showInbox() {
  loginView.hidden = true;
  inboxView.hidden = false;
  await Promise.all([
    loadMessages(),
    loadPronounProfile(),
    loadFeaturedPlaylists(),
  ]);
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
  pronounProfileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(pronounProfileForm);
    const profile = Object.fromEntries(
      pronounProfileFields.map((field) => [
        field,
        String(formData.get(field) ?? "").trim(),
      ]),
    );

    if (pronounProfileFields.some((field) => !profile[field])) {
      setAdminStatus(pronounAdminStatus, "Every profile field is required.", "error");
      return;
    }

    pronounProfileSubmit.disabled = true;
    pronounProfileSubmit.textContent = "> SAVING...";
    setAdminStatus(pronounAdminStatus, "Writing identity reference...");

    const { error } = await adminClient
      .from("pronoun_profiles")
      .update({ ...profile, updated_at: new Date().toISOString() })
      .eq("id", "primary");

    pronounProfileSubmit.disabled = false;
    pronounProfileSubmit.textContent = "> SAVE_PROFILE";

    if (error) {
      console.error("Unable to save pronoun profile:", error);
      setAdminStatus(
        pronounAdminStatus,
        `Pronoun profile update failed: ${error.message}`,
        "error",
      );
      return;
    }

    setAdminStatus(pronounAdminStatus, "Identity reference updated.", "success");
  });

  playlistForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(playlistForm);
    const playlists = Array.from({ length: 5 }, (_, index) => {
      const position = index + 1;
      return {
        position,
        title: String(formData.get(`playlist_${position}_title`) ?? "").trim(),
        spotify_url: String(
          formData.get(`playlist_${position}_url`) ?? "",
        ).trim(),
        enabled: formData.has(`playlist_${position}_enabled`),
      };
    });
    const invalidPlaylist = playlists.find((playlist) => (
      (
        playlist.enabled
        && (!playlist.title || !playlist.spotify_url)
      )
      || (
        playlist.spotify_url
        && !spotifyPlaylistUrlPattern.test(playlist.spotify_url)
      )
    ));
    if (invalidPlaylist) {
      setAdminStatus(
        playlistAdminStatus,
        `Slot ${invalidPlaylist.position} needs a title and valid Spotify playlist URL.`,
        "error",
      );
      return;
    }

    playlistSubmit.disabled = true;
    playlistSubmit.textContent = "> SAVING...";
    setAdminStatus(playlistAdminStatus, "Writing curated playlist slots...");

    const results = await Promise.all(playlists.map((playlist) => (
      adminClient
        .from("spotify_featured_playlists")
        .update({
          title: playlist.title || null,
          spotify_url: playlist.spotify_url || null,
          enabled: playlist.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("position", playlist.position)
    )));
    const failedUpdate = results.find((result) => result.error);

    playlistSubmit.disabled = false;
    playlistSubmit.textContent = "> SAVE_PLAYLISTS";

    if (failedUpdate) {
      console.error("Unable to save featured playlists:", failedUpdate.error);
      setAdminStatus(
        playlistAdminStatus,
        `Featured playlist update failed: ${failedUpdate.error.message}`,
        "error",
      );
      return;
    }

    setAdminStatus(playlistAdminStatus, "Curated playlists updated.", "success");
  });

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
