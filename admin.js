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
const trackForm = document.querySelector("#track-form");
const trackSubmit = document.querySelector("#track-submit");
const trackAdminStatus = document.querySelector("#track-admin-status");
const resumeForm = document.querySelector("#resume-form");
const resumeSubmit = document.querySelector("#resume-submit");
const resumeAdminStatus = document.querySelector("#resume-admin-status");
const resumeEntrySlots = document.querySelector("#resume-entry-slots");
const nowForm = document.querySelector("#now-form");
const nowSubmit = document.querySelector("#now-submit");
const nowAdminStatus = document.querySelector("#now-admin-status");
const changelogForm = document.querySelector("#changelog-form");
const changelogSubmit = document.querySelector("#changelog-submit");
const changelogAdminStatus = document.querySelector("#changelog-admin-status");
const changelogSlots = document.querySelector("#changelog-slots");
const spotifyPlaylistUrlPattern =
  /^https:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]+(?:\?.*)?$/;
const spotifyTrackUrlPattern =
  /^https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]+(?:\?.*)?$/;
const httpsUrlPattern = /^https:\/\/\S+$/;
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
const resumeProfileFields = [
  "headline",
  "summary",
  "availability",
  "location",
  "resume_url",
];
const nowFields = [
  "headline",
  "summary",
  "building",
  "learning",
  "playing",
  "reading",
];

function createAdminField(labelText, name, options = {}) {
  const label = document.createElement("label");
  const labelCopy = document.createElement("span");
  const field = options.multiline
    ? document.createElement("textarea")
    : document.createElement("input");
  labelCopy.textContent = labelText;
  field.name = name;
  if (options.type) {
    field.type = options.type;
  }
  if (options.maxLength) {
    field.maxLength = options.maxLength;
  }
  label.append(labelCopy, field);
  return label;
}

function createAdminCheckbox(labelText, name) {
  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  const copy = document.createElement("span");
  label.className = "admin-checkbox";
  checkbox.type = "checkbox";
  checkbox.name = name;
  copy.textContent = labelText;
  label.append(checkbox, copy);
  return label;
}

function createContentSlot(position, fields, enabledName) {
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = `SLOT ${position}`;
  fieldset.append(legend);
  fields.forEach((field) => {
    fieldset.append(createAdminField(
      field.label,
      field.name(position),
      field,
    ));
  });
  fieldset.append(createAdminCheckbox("ENABLED", enabledName(position)));
  return fieldset;
}

for (let position = 1; position <= 6; position += 1) {
  resumeEntrySlots.append(createContentSlot(
    position,
    [
      { label: "ROLE", name: (slot) => `resume_${slot}_role`, maxLength: 120 },
      { label: "ORGANIZATION", name: (slot) => `resume_${slot}_organization`, maxLength: 120 },
      { label: "PERIOD", name: (slot) => `resume_${slot}_period`, maxLength: 100 },
      { label: "SUMMARY", name: (slot) => `resume_${slot}_summary`, maxLength: 1000, multiline: true },
      { label: "TECHNOLOGIES", name: (slot) => `resume_${slot}_technologies`, maxLength: 300 },
    ],
    (slot) => `resume_${slot}_enabled`,
  ));
}

for (let position = 1; position <= 10; position += 1) {
  changelogSlots.append(createContentSlot(
    position,
    [
      { label: "DATE", name: (slot) => `changelog_${slot}_date`, type: "date" },
      { label: "TITLE", name: (slot) => `changelog_${slot}_title`, maxLength: 120 },
      { label: "SUMMARY", name: (slot) => `changelog_${slot}_summary`, maxLength: 800, multiline: true },
    ],
    (slot) => `changelog_${slot}_enabled`,
  ));
}

function setAdminStatus(element, message, state = "") {
  element.textContent = message;
  element.dataset.state = state;
}

function clearPublicContentCache() {
  localStorage.removeItem("bits-public-content-v1");
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

async function loadFeaturedTracks() {
  setAdminStatus(trackAdminStatus, "Loading curated song slots...");
  const { data, error } = await adminClient
    .from("spotify_featured_tracks")
    .select("position, title, artist, spotify_url, enabled")
    .order("position", { ascending: true });

  if (error) {
    console.error("Unable to load featured songs:", error);
    setAdminStatus(
      trackAdminStatus,
      `Featured songs failed to load: ${error.message}`,
      "error",
    );
    return;
  }

  for (let position = 1; position <= 5; position += 1) {
    const track = data.find((entry) => entry.position === position);
    trackForm.elements[`track_${position}_title`].value = track?.title ?? "";
    trackForm.elements[`track_${position}_artist`].value = track?.artist ?? "";
    trackForm.elements[`track_${position}_url`].value =
      track?.spotify_url ?? "";
    trackForm.elements[`track_${position}_enabled`].checked =
      track?.enabled === true;
  }
  setAdminStatus(trackAdminStatus, "Curated song slots loaded.", "success");
}

async function loadResumeContent() {
  setAdminStatus(resumeAdminStatus, "Loading résumé data...");
  const [profileResult, entriesResult] = await Promise.all([
    adminClient
      .from("site_resume_profile")
      .select(`${resumeProfileFields.join(", ")}, enabled`)
      .eq("id", "primary")
      .single(),
    adminClient
      .from("site_resume_entries")
      .select("position, role, organization, period, summary, technologies, enabled")
      .order("position", { ascending: true }),
  ]);

  if (profileResult.error || entriesResult.error) {
    const error = profileResult.error || entriesResult.error;
    console.error("Unable to load résumé content:", error);
    setAdminStatus(
      resumeAdminStatus,
      `Résumé data failed to load: ${error.message}`,
      "error",
    );
    return;
  }

  resumeProfileFields.forEach((field) => {
    resumeForm.elements[field].value = profileResult.data[field] ?? "";
  });
  resumeForm.elements.enabled.checked = profileResult.data.enabled === true;

  for (let position = 1; position <= 6; position += 1) {
    const entry = entriesResult.data.find((item) => item.position === position);
    ["role", "organization", "period", "summary", "technologies"].forEach((field) => {
      resumeForm.elements[`resume_${position}_${field}`].value =
        entry?.[field] ?? "";
    });
    resumeForm.elements[`resume_${position}_enabled`].checked =
      entry?.enabled === true;
  }
  setAdminStatus(resumeAdminStatus, "Résumé data loaded.", "success");
}

async function loadNowContent() {
  setAdminStatus(nowAdminStatus, "Loading NOW.TXT...");
  const { data, error } = await adminClient
    .from("site_now")
    .select(`${nowFields.join(", ")}, enabled`)
    .eq("id", "primary")
    .single();

  if (error) {
    console.error("Unable to load NOW.TXT:", error);
    setAdminStatus(nowAdminStatus, `NOW.TXT failed to load: ${error.message}`, "error");
    return;
  }

  nowFields.forEach((field) => {
    nowForm.elements[field].value = data[field] ?? "";
  });
  nowForm.elements.enabled.checked = data.enabled === true;
  setAdminStatus(nowAdminStatus, "NOW.TXT loaded.", "success");
}

async function loadChangelogContent() {
  setAdminStatus(changelogAdminStatus, "Loading changelog slots...");
  const { data, error } = await adminClient
    .from("site_changelog")
    .select("position, entry_date, title, summary, enabled")
    .order("position", { ascending: true });

  if (error) {
    console.error("Unable to load changelog:", error);
    setAdminStatus(
      changelogAdminStatus,
      `Changelog failed to load: ${error.message}`,
      "error",
    );
    return;
  }

  for (let position = 1; position <= 10; position += 1) {
    const entry = data.find((item) => item.position === position);
    changelogForm.elements[`changelog_${position}_date`].value =
      entry?.entry_date ?? "";
    changelogForm.elements[`changelog_${position}_title`].value =
      entry?.title ?? "";
    changelogForm.elements[`changelog_${position}_summary`].value =
      entry?.summary ?? "";
    changelogForm.elements[`changelog_${position}_enabled`].checked =
      entry?.enabled === true;
  }
  setAdminStatus(changelogAdminStatus, "Changelog slots loaded.", "success");
}

async function showInbox() {
  loginView.hidden = true;
  inboxView.hidden = false;
  await Promise.all([
    loadMessages(),
    loadPronounProfile(),
    loadFeaturedPlaylists(),
    loadFeaturedTracks(),
    loadResumeContent(),
    loadNowContent(),
    loadChangelogContent(),
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

  trackForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(trackForm);
    const tracks = Array.from({ length: 5 }, (_, index) => {
      const position = index + 1;
      return {
        position,
        title: String(formData.get(`track_${position}_title`) ?? "").trim(),
        artist: String(formData.get(`track_${position}_artist`) ?? "").trim(),
        spotify_url: String(formData.get(`track_${position}_url`) ?? "").trim(),
        enabled: formData.has(`track_${position}_enabled`),
      };
    });
    const invalidTrack = tracks.find((track) => (
      (
        track.enabled
        && (!track.title || !track.artist || !track.spotify_url)
      )
      || (
        track.spotify_url
        && !spotifyTrackUrlPattern.test(track.spotify_url)
      )
    ));
    if (invalidTrack) {
      setAdminStatus(
        trackAdminStatus,
        `Slot ${invalidTrack.position} needs a title, artist, and valid Spotify track URL.`,
        "error",
      );
      return;
    }

    trackSubmit.disabled = true;
    trackSubmit.textContent = "> SAVING...";
    setAdminStatus(trackAdminStatus, "Writing curated song slots...");

    const updatedAt = new Date().toISOString();
    const results = await Promise.all(tracks.map((track) => (
      adminClient
        .from("spotify_featured_tracks")
        .update({
          title: track.title || null,
          artist: track.artist || null,
          spotify_url: track.spotify_url || null,
          enabled: track.enabled,
          updated_at: updatedAt,
        })
        .eq("position", track.position)
    )));
    const failedUpdate = results.find((result) => result.error);

    trackSubmit.disabled = false;
    trackSubmit.textContent = "> SAVE_SONGS";

    if (failedUpdate) {
      console.error("Unable to save featured songs:", failedUpdate.error);
      setAdminStatus(
        trackAdminStatus,
        `Featured song update failed: ${failedUpdate.error.message}`,
        "error",
      );
      return;
    }

    setAdminStatus(trackAdminStatus, "Curated songs updated.", "success");
  });

  resumeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(resumeForm);
    const profile = Object.fromEntries(
      resumeProfileFields.map((field) => [
        field,
        String(formData.get(field) ?? "").trim(),
      ]),
    );
    profile.enabled = formData.has("enabled");
    const entries = Array.from({ length: 6 }, (_, index) => {
      const position = index + 1;
      return {
        position,
        role: String(formData.get(`resume_${position}_role`) ?? "").trim(),
        organization: String(
          formData.get(`resume_${position}_organization`) ?? "",
        ).trim(),
        period: String(formData.get(`resume_${position}_period`) ?? "").trim(),
        summary: String(formData.get(`resume_${position}_summary`) ?? "").trim(),
        technologies: String(
          formData.get(`resume_${position}_technologies`) ?? "",
        ).trim(),
        enabled: formData.has(`resume_${position}_enabled`),
      };
    });
    const invalidEntry = entries.find((entry) => (
      entry.enabled
      && (!entry.role || !entry.organization || !entry.period || !entry.summary)
    ));

    if (profile.enabled && (!profile.headline || !profile.summary)) {
      setAdminStatus(
        resumeAdminStatus,
        "A published résumé needs a headline and summary.",
        "error",
      );
      return;
    }
    if (profile.resume_url && !httpsUrlPattern.test(profile.resume_url)) {
      setAdminStatus(resumeAdminStatus, "Résumé URL must use HTTPS.", "error");
      return;
    }
    if (invalidEntry) {
      setAdminStatus(
        resumeAdminStatus,
        `Résumé slot ${invalidEntry.position} needs a role, organization, period, and summary.`,
        "error",
      );
      return;
    }

    resumeSubmit.disabled = true;
    resumeSubmit.textContent = "> SAVING...";
    setAdminStatus(resumeAdminStatus, "Writing résumé data...");
    const updatedAt = new Date().toISOString();
    const results = await Promise.all([
      adminClient
        .from("site_resume_profile")
        .update({
          headline: profile.headline || null,
          summary: profile.summary || null,
          availability: profile.availability || null,
          location: profile.location || null,
          resume_url: profile.resume_url || null,
          enabled: profile.enabled,
          updated_at: updatedAt,
        })
        .eq("id", "primary"),
      ...entries.map((entry) => (
        adminClient
          .from("site_resume_entries")
          .update({
            role: entry.role || null,
            organization: entry.organization || null,
            period: entry.period || null,
            summary: entry.summary || null,
            technologies: entry.technologies || null,
            enabled: entry.enabled,
            updated_at: updatedAt,
          })
          .eq("position", entry.position)
      )),
    ]);
    const failedUpdate = results.find((result) => result.error);
    resumeSubmit.disabled = false;
    resumeSubmit.textContent = "> SAVE_RESUME";

    if (failedUpdate) {
      console.error("Unable to save résumé data:", failedUpdate.error);
      setAdminStatus(
        resumeAdminStatus,
        `Résumé update failed: ${failedUpdate.error.message}`,
        "error",
      );
      return;
    }
    clearPublicContentCache();
    setAdminStatus(resumeAdminStatus, "Résumé data updated.", "success");
  });

  nowForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(nowForm);
    const nowContent = Object.fromEntries(
      nowFields.map((field) => [
        field,
        String(formData.get(field) ?? "").trim(),
      ]),
    );
    nowContent.enabled = formData.has("enabled");

    if (nowContent.enabled && (!nowContent.headline || !nowContent.summary)) {
      setAdminStatus(
        nowAdminStatus,
        "A published NOW.TXT needs a headline and summary.",
        "error",
      );
      return;
    }

    nowSubmit.disabled = true;
    nowSubmit.textContent = "> SAVING...";
    setAdminStatus(nowAdminStatus, "Writing NOW.TXT...");
    const { error } = await adminClient
      .from("site_now")
      .update({
        ...Object.fromEntries(
          nowFields.map((field) => [field, nowContent[field] || null]),
        ),
        enabled: nowContent.enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "primary");
    nowSubmit.disabled = false;
    nowSubmit.textContent = "> SAVE_NOW";

    if (error) {
      console.error("Unable to save NOW.TXT:", error);
      setAdminStatus(nowAdminStatus, `NOW.TXT update failed: ${error.message}`, "error");
      return;
    }
    clearPublicContentCache();
    setAdminStatus(nowAdminStatus, "NOW.TXT updated.", "success");
  });

  changelogForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(changelogForm);
    const entries = Array.from({ length: 10 }, (_, index) => {
      const position = index + 1;
      return {
        position,
        entry_date: String(
          formData.get(`changelog_${position}_date`) ?? "",
        ).trim(),
        title: String(
          formData.get(`changelog_${position}_title`) ?? "",
        ).trim(),
        summary: String(
          formData.get(`changelog_${position}_summary`) ?? "",
        ).trim(),
        enabled: formData.has(`changelog_${position}_enabled`),
      };
    });
    const invalidEntry = entries.find((entry) => (
      entry.enabled && (!entry.entry_date || !entry.title || !entry.summary)
    ));
    if (invalidEntry) {
      setAdminStatus(
        changelogAdminStatus,
        `Changelog slot ${invalidEntry.position} needs a date, title, and summary.`,
        "error",
      );
      return;
    }

    changelogSubmit.disabled = true;
    changelogSubmit.textContent = "> SAVING...";
    setAdminStatus(changelogAdminStatus, "Writing changelog slots...");
    const updatedAt = new Date().toISOString();
    const results = await Promise.all(entries.map((entry) => (
      adminClient
        .from("site_changelog")
        .update({
          entry_date: entry.entry_date || null,
          title: entry.title || null,
          summary: entry.summary || null,
          enabled: entry.enabled,
          updated_at: updatedAt,
        })
        .eq("position", entry.position)
    )));
    const failedUpdate = results.find((result) => result.error);
    changelogSubmit.disabled = false;
    changelogSubmit.textContent = "> SAVE_CHANGELOG";

    if (failedUpdate) {
      console.error("Unable to save changelog:", failedUpdate.error);
      setAdminStatus(
        changelogAdminStatus,
        `Changelog update failed: ${failedUpdate.error.message}`,
        "error",
      );
      return;
    }
    clearPublicContentCache();
    setAdminStatus(changelogAdminStatus, "Changelog updated.", "success");
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
