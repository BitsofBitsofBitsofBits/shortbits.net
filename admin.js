const loginView = document.querySelector("#login-view");
const inboxView = document.querySelector("#inbox-view");
const loginForm = document.querySelector("#login-form");
const loginSubmit = document.querySelector("#login-submit");
const loginStatus = document.querySelector("#login-status");
const inboxStatus = document.querySelector("#inbox-status");
const messageList = document.querySelector("#message-list");
const refreshButton = document.querySelector("#refresh-messages");
const guestbookAdminStatus = document.querySelector("#guestbook-admin-status");
const guestbookAdminList = document.querySelector("#guestbook-admin-list");
const refreshGuestbook = document.querySelector("#refresh-guestbook");
const logoutButton = document.querySelector("#logout-button");
const pronounProfileForm = document.querySelector("#pronoun-profile-form");
const pronounProfileSubmit = document.querySelector("#pronoun-profile-submit");
const pronounAdminStatus = document.querySelector("#pronoun-admin-status");
const playlistForm = document.querySelector("#playlist-form");
const playlistSubmit = document.querySelector("#playlist-submit");
const playlistAdminStatus = document.querySelector("#playlist-admin-status");
const playlistSlots = document.querySelector("#playlist-slots");
const playlistAdd = document.querySelector("#playlist-add");
const trackForm = document.querySelector("#track-form");
const trackSubmit = document.querySelector("#track-submit");
const trackAdminStatus = document.querySelector("#track-admin-status");
const trackSlots = document.querySelector("#track-slots");
const trackAdd = document.querySelector("#track-add");
const resumeForm = document.querySelector("#resume-form");
const resumeSubmit = document.querySelector("#resume-submit");
const resumeAdminStatus = document.querySelector("#resume-admin-status");
const resumeEntrySlots = document.querySelector("#resume-entry-slots");
const resumeEntryAdd = document.querySelector("#resume-entry-add");
const nowForm = document.querySelector("#now-form");
const nowSubmit = document.querySelector("#now-submit");
const nowAdminStatus = document.querySelector("#now-admin-status");
const changelogForm = document.querySelector("#changelog-form");
const changelogSubmit = document.querySelector("#changelog-submit");
const changelogAdminStatus = document.querySelector("#changelog-admin-status");
const changelogSlots = document.querySelector("#changelog-slots");
const changelogEntryAdd = document.querySelector("#changelog-entry-add");
const gamesForm = document.querySelector("#games-form");
const gamesSubmit = document.querySelector("#games-submit");
const gamesAdminStatus = document.querySelector("#games-admin-status");
const gamesSlots = document.querySelector("#games-slots");
const gamesEntryAdd = document.querySelector("#games-entry-add");
const shortLinkCreateForm = document.querySelector("#short-link-create-form");
const shortLinkCreate = document.querySelector("#short-link-create");
const shortLinkGenerate = document.querySelector("#short-link-generate");
const shortLinksRefresh = document.querySelector("#short-links-refresh");
const shortLinksAdminStatus = document.querySelector("#short-links-admin-status");
const shortLinksList = document.querySelector("#short-links-list");
const spotifyPlaylistUrlPattern =
  /^https:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]+(?:\?.*)?$/;
const spotifyTrackUrlPattern =
  /^https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]+(?:\?.*)?$/;
const httpsUrlPattern = /^https:\/\/\S+$/;
const shortLinkSlugPattern = /^[a-z0-9][a-z0-9_-]{2,63}$/;
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
const repeatableEditors = {
  playlists: {
    table: "spotify_featured_playlists",
    container: playlistSlots,
    addButton: playlistAdd,
    status: playlistAdminStatus,
    itemName: "playlist",
    fields: [
      { key: "title", label: "TITLE", maxLength: 100 },
      { key: "spotify_url", label: "SPOTIFY URL", type: "url" },
    ],
  },
  tracks: {
    table: "spotify_featured_tracks",
    container: trackSlots,
    addButton: trackAdd,
    status: trackAdminStatus,
    itemName: "song",
    fields: [
      { key: "title", label: "TITLE", maxLength: 100 },
      { key: "artist", label: "ARTIST", maxLength: 100 },
      { key: "spotify_url", label: "SPOTIFY URL", type: "url" },
    ],
  },
  resume: {
    table: "site_resume_entries",
    container: resumeEntrySlots,
    addButton: resumeEntryAdd,
    status: resumeAdminStatus,
    itemName: "experience",
    fields: [
      { key: "role", label: "ROLE", maxLength: 120 },
      { key: "organization", label: "ORGANIZATION", maxLength: 120 },
      { key: "period", label: "PERIOD", maxLength: 100 },
      { key: "summary", label: "SUMMARY", maxLength: 1000, multiline: true },
      { key: "technologies", label: "TECHNOLOGIES", maxLength: 300 },
    ],
  },
  changelog: {
    table: "site_changelog",
    container: changelogSlots,
    addButton: changelogEntryAdd,
    status: changelogAdminStatus,
    itemName: "change",
    fields: [
      { key: "entry_date", label: "DATE", type: "date" },
      { key: "title", label: "TITLE", maxLength: 120 },
      { key: "summary", label: "SUMMARY", maxLength: 800, multiline: true },
    ],
  },
  games: {
    table: "site_favorite_games",
    container: gamesSlots,
    addButton: gamesEntryAdd,
    status: gamesAdminStatus,
    itemName: "game",
    fields: [
      { key: "title", label: "TITLE", maxLength: 120 },
      { key: "platform", label: "PAGE LABEL", maxLength: 80 },
      { key: "store_url", label: "STORE / OFFICIAL URL", type: "url", maxLength: 500 },
      { key: "note", label: "NOTE", maxLength: 500, multiline: true },
    ],
  },
};

Object.values(repeatableEditors).forEach((editor) => {
  editor.deletedPositions = new Set();
  editor.maxPosition = 0;
});

let temporaryEntryId = 0;

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
  if (options.fieldKey) {
    field.dataset.entryField = options.fieldKey;
  }
  field.value = options.value ?? "";
  label.append(labelCopy, field);
  return label;
}

function createAdminCheckbox(labelText, name, options = {}) {
  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  const copy = document.createElement("span");
  label.className = "admin-checkbox";
  checkbox.type = "checkbox";
  checkbox.name = name;
  checkbox.checked = options.checked === true;
  if (options.fieldKey) {
    checkbox.dataset.entryField = options.fieldKey;
  }
  copy.textContent = labelText;
  label.append(checkbox, copy);
  return label;
}

function createRepeatableEntry(editor, entry = {}) {
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  const entryKey = entry.position
    ? `position-${entry.position}`
    : `new-${temporaryEntryId += 1}`;
  fieldset.dataset.entryKey = entryKey;
  if (entry.position) {
    fieldset.dataset.position = String(entry.position);
  }
  legend.textContent = entry.position ? `ENTRY ${entry.position}` : "NEW ENTRY";
  fieldset.append(legend);
  editor.fields.forEach((field) => {
    fieldset.append(createAdminField(
      field.label,
      `${editor.itemName}_${entryKey}_${field.key}`,
      {
        ...field,
        fieldKey: field.key,
        value: entry[field.key],
      },
    ));
  });
  fieldset.append(createAdminCheckbox(
    "ENABLED",
    `${editor.itemName}_${entryKey}_enabled`,
    { checked: entry.enabled, fieldKey: "enabled" },
  ));

  const actions = document.createElement("div");
  const removeButton = document.createElement("button");
  actions.className = "repeatable-entry-actions";
  removeButton.type = "button";
  removeButton.className = "repeatable-entry-remove";
  removeButton.textContent = "REMOVE";
  removeButton.setAttribute(
    "aria-label",
    `Remove ${editor.itemName} ${entry.position ?? "entry"}`,
  );
  removeButton.addEventListener("click", () => {
    if (entry.position) {
      editor.deletedPositions.add(entry.position);
    }
    fieldset.remove();
    setAdminStatus(
      editor.status,
      `${editor.itemName[0].toUpperCase()}${editor.itemName.slice(1)} removed. Save to persist this change.`,
    );
  });
  actions.append(removeButton);
  fieldset.append(actions);
  return fieldset;
}

function renderRepeatableEntries(editor, entries) {
  editor.container.replaceChildren();
  editor.deletedPositions.clear();
  editor.maxPosition = entries.reduce(
    (maximum, entry) => Math.max(maximum, entry.position),
    0,
  );
  entries.forEach((entry) => {
    editor.container.append(createRepeatableEntry(editor, entry));
  });
}

function collectRepeatableEntries(editor) {
  return Array.from(editor.container.querySelectorAll("fieldset")).map(
    (fieldset) => {
      const entry = {
        position: fieldset.dataset.position
          ? Number(fieldset.dataset.position)
          : null,
      };
      editor.fields.forEach((field) => {
        entry[field.key] = fieldset
          .querySelector(`[data-entry-field="${field.key}"]`)
          .value
          .trim();
      });
      entry.enabled = fieldset
        .querySelector('[data-entry-field="enabled"]')
        .checked;
      return entry;
    },
  );
}

async function syncRepeatableEntries(editor, entries, updatedAt) {
  let nextPosition = editor.maxPosition;
  const changes = entries.map((entry) => {
    const values = Object.fromEntries(
      editor.fields.map((field) => [field.key, entry[field.key] || null]),
    );
    const payload = {
      ...values,
      enabled: entry.enabled,
      updated_at: updatedAt,
    };
    if (entry.position) {
      return adminClient
        .from(editor.table)
        .update(payload)
        .eq("position", entry.position);
    }
    nextPosition += 1;
    return adminClient
      .from(editor.table)
      .insert({ position: nextPosition, ...payload });
  });
  editor.deletedPositions.forEach((position) => {
    changes.push(
      adminClient
        .from(editor.table)
        .delete()
        .eq("position", position),
    );
  });
  const results = await Promise.all(changes);
  return results.find((result) => result.error) ?? null;
}

Object.values(repeatableEditors).forEach((editor) => {
  editor.addButton.addEventListener("click", () => {
    const entry = createRepeatableEntry(editor);
    editor.container.append(entry);
    entry.querySelector("input, textarea")?.focus();
    setAdminStatus(
      editor.status,
      `New ${editor.itemName} added. Complete it, then save.`,
    );
  });
});

function setAdminStatus(element, message, state = "") {
  element.textContent = message;
  element.dataset.state = state;
}

function clearPublicContentCache() {
  localStorage.removeItem("bits-public-content-v1");
  localStorage.removeItem("bits-public-content-v2");
  localStorage.removeItem("bits-public-content-v3");
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

function createGuestbookAdminEntry(entry) {
  const article = document.createElement("article");
  const header = document.createElement("header");
  const identity = document.createElement("div");
  const name = document.createElement("h3");
  const timestamp = document.createElement("time");
  const message = document.createElement("p");
  const actions = document.createElement("div");
  const deleteButton = document.createElement("button");

  article.className = "message-card";
  name.textContent = entry.name;
  timestamp.dateTime = entry.created_at;
  timestamp.textContent = new Date(entry.created_at).toLocaleString();
  message.textContent = entry.message;
  deleteButton.type = "button";
  deleteButton.textContent = "DELETE";
  deleteButton.addEventListener("click", async () => {
    if (!window.confirm(`Delete the public Guestbook entry from ${entry.name}?`)) {
      return;
    }
    const { error } = await adminClient
      .from("site_guestbook")
      .delete()
      .eq("id", entry.id);
    if (error) {
      console.error("Unable to delete Guestbook entry:", error);
      setAdminStatus(
        guestbookAdminStatus,
        `Guestbook deletion failed: ${error.message}`,
        "error",
      );
      return;
    }
    await loadAdminGuestbook();
  });

  identity.append(name, timestamp);
  actions.className = "message-actions";
  actions.append(deleteButton);
  header.append(identity, actions);
  article.append(header, message);
  return article;
}

async function loadAdminGuestbook() {
  setAdminStatus(guestbookAdminStatus, "Loading public signatures...");
  const { data, error } = await adminClient
    .from("site_guestbook")
    .select("id, name, message, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Unable to load Guestbook entries:", error);
    setAdminStatus(
      guestbookAdminStatus,
      `Guestbook failed to load: ${error.message}`,
      "error",
    );
    return;
  }

  guestbookAdminList.replaceChildren(...data.map(createGuestbookAdminEntry));
  setAdminStatus(
    guestbookAdminStatus,
    data.length
      ? `${data.length} public signature${data.length === 1 ? "" : "s"} loaded.`
      : "No public Guestbook signatures.",
    "success",
  );
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
    return false;
  }

  renderRepeatableEntries(repeatableEditors.playlists, data);
  setAdminStatus(
    playlistAdminStatus,
    `${data.length} curated playlist entr${data.length === 1 ? "y" : "ies"} loaded.`,
    "success",
  );
  return true;
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
    return false;
  }

  renderRepeatableEntries(repeatableEditors.tracks, data);
  setAdminStatus(
    trackAdminStatus,
    `${data.length} curated song entr${data.length === 1 ? "y" : "ies"} loaded.`,
    "success",
  );
  return true;
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
    return false;
  }

  resumeProfileFields.forEach((field) => {
    resumeForm.elements[field].value = profileResult.data[field] ?? "";
  });
  resumeForm.elements.enabled.checked = profileResult.data.enabled === true;

  renderRepeatableEntries(repeatableEditors.resume, entriesResult.data);
  setAdminStatus(resumeAdminStatus, "Résumé data loaded.", "success");
  return true;
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
    return false;
  }

  renderRepeatableEntries(repeatableEditors.changelog, data);
  setAdminStatus(
    changelogAdminStatus,
    `${data.length} changelog entr${data.length === 1 ? "y" : "ies"} loaded.`,
    "success",
  );
  return true;
}

async function loadFavoriteGames() {
  setAdminStatus(gamesAdminStatus, "Loading favorite games...");
  const { data, error } = await adminClient
    .from("site_favorite_games")
    .select("position, title, platform, store_url, note, enabled")
    .order("position", { ascending: true });

  if (error) {
    console.error("Unable to load favorite games:", error);
    setAdminStatus(
      gamesAdminStatus,
      `Favorite games failed to load: ${error.message}`,
      "error",
    );
    return false;
  }

  renderRepeatableEntries(repeatableEditors.games, data);
  setAdminStatus(
    gamesAdminStatus,
    `${data.length} favorite game entr${data.length === 1 ? "y" : "ies"} loaded.`,
    "success",
  );
  return true;
}

function generateShortLinkSlug(length = 7) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return [...values]
    .map((value) => alphabet[value % alphabet.length])
    .join("");
}

function formatShortLinkDate(value) {
  if (!value) {
    return "NEVER";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "INVALID DATE"
    : date.toLocaleString();
}

function toDateTimeLocalValue(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function getShortLinkUrl(slug) {
  return `${window.location.origin}/go/${encodeURIComponent(slug)}`;
}

function createShortBitModeSelect(selectedMode) {
  const select = document.createElement("select");
  const modes = [
    ["redirect", "REDIRECT // CHANGE ADDRESS"],
    ["embed", "EMBED // KEEP SHORTBIT ADDRESS"],
    ["landing", "LANDING PAGE // KEEP SHORTBIT ADDRESS"],
  ];
  select.name = "display_mode";
  modes.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === selectedMode;
    select.append(option);
  });
  return select;
}

function getShortBitModeError(displayMode, destinationUrl) {
  if (!["redirect", "embed", "landing"].includes(displayMode)) {
    return "Select a valid ShortBit display mode.";
  }
  if (displayMode === "embed" && !window.BITS_SHORTBITS.getEmbed(destinationUrl)) {
    return "Embed mode supports YouTube, Vimeo, and Spotify URLs only.";
  }
  return null;
}

function createShortLinkEditor(link) {
  const form = document.createElement("form");
  const heading = document.createElement("div");
  const title = document.createElement("strong");
  const shortUrl = document.createElement("a");
  const destinationLabel = document.createElement("label");
  const destinationCopy = document.createElement("span");
  const destination = document.createElement("input");
  const titleLabel = document.createElement("label");
  const titleCopy = document.createElement("span");
  const titleInput = document.createElement("input");
  const modeLabel = document.createElement("label");
  const modeCopy = document.createElement("span");
  const mode = createShortBitModeSelect(link.display_mode);
  const descriptionLabel = document.createElement("label");
  const descriptionCopy = document.createElement("span");
  const description = document.createElement("textarea");
  const expiresLabel = document.createElement("label");
  const expiresCopy = document.createElement("span");
  const expires = document.createElement("input");
  const enabledLabel = document.createElement("label");
  const enabled = document.createElement("input");
  const enabledCopy = document.createElement("span");
  const metrics = document.createElement("p");
  const actions = document.createElement("div");
  const copy = document.createElement("button");
  const save = document.createElement("button");
  const remove = document.createElement("button");

  form.className = "short-link-admin-entry";
  form.dataset.shortLinkSlug = link.slug;
  heading.className = "short-link-admin-heading";
  title.textContent = link.title || link.slug;
  shortUrl.href = getShortLinkUrl(link.slug);
  shortUrl.target = "_blank";
  shortUrl.rel = "noreferrer";
  shortUrl.textContent = `/go/${link.slug} ↗`;
  heading.append(title, shortUrl);

  destinationCopy.textContent = "DESTINATION URL";
  destination.name = "destination_url";
  destination.type = "url";
  destination.maxLength = 2000;
  destination.required = true;
  destination.value = link.destination_url;
  destinationLabel.append(destinationCopy, destination);

  titleCopy.textContent = "PUBLIC TITLE";
  titleInput.name = "title";
  titleInput.maxLength = 120;
  titleInput.value = link.title ?? "";
  titleLabel.append(titleCopy, titleInput);

  modeCopy.textContent = "MODE";
  modeLabel.append(modeCopy, mode);

  descriptionCopy.textContent = "PUBLIC DESCRIPTION";
  description.name = "description";
  description.maxLength = 500;
  description.value = link.description ?? "";
  descriptionLabel.append(descriptionCopy, description);

  expiresCopy.textContent = "EXPIRES AT";
  expires.name = "expires_at";
  expires.type = "datetime-local";
  expires.value = toDateTimeLocalValue(link.expires_at);
  expiresLabel.append(expiresCopy, expires);

  enabledLabel.className = "admin-checkbox";
  enabled.name = "enabled";
  enabled.type = "checkbox";
  enabled.checked = link.enabled;
  enabledCopy.textContent = "ENABLED";
  enabledLabel.append(enabled, enabledCopy);

  metrics.className = "short-link-admin-metrics";
  metrics.textContent = [
    `CLICKS: ${link.click_count}`,
    `LAST USED: ${formatShortLinkDate(link.last_clicked_at)}`,
    `CREATED: ${formatShortLinkDate(link.created_at)}`,
  ].join(" // ");

  actions.className = "repeatable-entry-actions";
  copy.type = "button";
  copy.dataset.shortLinkAction = "copy";
  copy.textContent = "COPY";
  save.type = "submit";
  save.textContent = "SAVE";
  remove.type = "button";
  remove.dataset.shortLinkAction = "delete";
  remove.textContent = "DELETE";
  actions.append(copy, save, remove);

  form.append(
    heading,
    destinationLabel,
    titleLabel,
    modeLabel,
    descriptionLabel,
    expiresLabel,
    enabledLabel,
    metrics,
    actions,
  );
  return form;
}

async function loadShortLinks() {
  setAdminStatus(shortLinksAdminStatus, "Loading ShortBits...");
  const { data, error } = await adminClient
    .from("site_short_links")
    .select(
      "slug, title, description, destination_url, display_mode, enabled, expires_at, click_count, last_clicked_at, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load ShortBits:", error);
    setAdminStatus(
      shortLinksAdminStatus,
      `ShortBits failed to load: ${error.message}`,
      "error",
    );
    return false;
  }

  shortLinksList.replaceChildren(...data.map(createShortLinkEditor));
  if (data.length === 0) {
    const empty = document.createElement("p");
    empty.className = "content-window-empty";
    empty.textContent = "No ShortBits have been generated.";
    shortLinksList.append(empty);
  }
  setAdminStatus(
    shortLinksAdminStatus,
    `${data.length} ShortBit${data.length === 1 ? "" : "s"} loaded.`,
    "success",
  );
  return true;
}

async function showInbox() {
  loginView.hidden = true;
  inboxView.hidden = false;
  await Promise.all([
    loadMessages(),
    loadAdminGuestbook(),
    loadPronounProfile(),
    loadFeaturedPlaylists(),
    loadFeaturedTracks(),
    loadResumeContent(),
    loadNowContent(),
    loadChangelogContent(),
    loadFavoriteGames(),
    loadShortLinks(),
  ]);
  window.dispatchEvent(new CustomEvent("admin:authenticated"));
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
  refreshGuestbook.addEventListener("click", loadAdminGuestbook);
  shortLinksRefresh.addEventListener("click", loadShortLinks);
  shortLinkGenerate.addEventListener("click", () => {
    shortLinkCreateForm.elements.slug.value = generateShortLinkSlug();
    shortLinkCreateForm.elements.slug.focus();
  });
  shortLinkCreateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(shortLinkCreateForm);
    const destinationUrl = String(formData.get("destination_url") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const displayMode = String(formData.get("display_mode") ?? "");
    const slugInput = String(formData.get("slug") ?? "").trim().toLowerCase();
    const slug = slugInput || generateShortLinkSlug();
    const expiresInput = String(formData.get("expires_at") ?? "").trim();

    if (!shortLinkSlugPattern.test(slug)) {
      setAdminStatus(
        shortLinksAdminStatus,
        "Alias must be 3-64 lowercase letters, numbers, hyphens, or underscores.",
        "error",
      );
      return;
    }
    if (!httpsUrlPattern.test(destinationUrl)) {
      setAdminStatus(
        shortLinksAdminStatus,
        "Destination must be a valid HTTPS URL.",
        "error",
      );
      return;
    }
    const modeError = getShortBitModeError(displayMode, destinationUrl);
    if (modeError) {
      setAdminStatus(shortLinksAdminStatus, modeError, "error");
      return;
    }

    shortLinkCreate.disabled = true;
    shortLinkCreate.textContent = "> CREATING...";
    const { error } = await adminClient.from("site_short_links").insert({
      slug,
      title: title || null,
      description: description || null,
      destination_url: destinationUrl,
      display_mode: displayMode,
      expires_at: expiresInput ? new Date(expiresInput).toISOString() : null,
      enabled: true,
    });
    shortLinkCreate.disabled = false;
    shortLinkCreate.textContent = "> CREATE_SHORTBIT";

    if (error) {
      console.error("Unable to create ShortBit:", error);
      setAdminStatus(
        shortLinksAdminStatus,
        error.code === "23505"
          ? `The alias "${slug}" is already in use.`
          : `ShortBit creation failed: ${error.message}`,
        "error",
      );
      return;
    }

    shortLinkCreateForm.reset();
    await loadShortLinks();
    setAdminStatus(
      shortLinksAdminStatus,
      `Created ${getShortLinkUrl(slug)}`,
      "success",
    );
  });
  shortLinksList.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target.closest("[data-short-link-slug]");
    if (!form) {
      return;
    }
    const formData = new FormData(form);
    const destinationUrl =
      String(formData.get("destination_url") ?? "").trim();
    const expiresInput = String(formData.get("expires_at") ?? "").trim();
    const displayMode = String(formData.get("display_mode") ?? "");
    if (!httpsUrlPattern.test(destinationUrl)) {
      setAdminStatus(
        shortLinksAdminStatus,
        "Destination must be a valid HTTPS URL.",
        "error",
      );
      return;
    }
    const modeError = getShortBitModeError(displayMode, destinationUrl);
    if (modeError) {
      setAdminStatus(shortLinksAdminStatus, modeError, "error");
      return;
    }

    const { error } = await adminClient
      .from("site_short_links")
      .update({
        title: String(formData.get("title") ?? "").trim() || null,
        description:
          String(formData.get("description") ?? "").trim() || null,
        destination_url: destinationUrl,
        display_mode: displayMode,
        expires_at: expiresInput ? new Date(expiresInput).toISOString() : null,
        enabled: formData.get("enabled") === "on",
      })
      .eq("slug", form.dataset.shortLinkSlug);

    if (error) {
      console.error("Unable to update ShortBit:", error);
      setAdminStatus(
        shortLinksAdminStatus,
        `ShortBit update failed: ${error.message}`,
        "error",
      );
      return;
    }
    await loadShortLinks();
    setAdminStatus(shortLinksAdminStatus, "ShortBit updated.", "success");
  });
  shortLinksList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-short-link-action]");
    const form = button?.closest("[data-short-link-slug]");
    if (!button || !form) {
      return;
    }
    const slug = form.dataset.shortLinkSlug;
    if (button.dataset.shortLinkAction === "copy") {
      try {
        await navigator.clipboard.writeText(getShortLinkUrl(slug));
        setAdminStatus(shortLinksAdminStatus, `Copied /go/${slug}.`, "success");
      } catch (error) {
        console.error("Unable to copy ShortBit:", error);
        setAdminStatus(
          shortLinksAdminStatus,
          `Copy failed: ${error.message}`,
          "error",
        );
      }
      return;
    }
    if (
      button.dataset.shortLinkAction === "delete"
      && window.confirm(`Permanently delete /go/${slug}?`)
    ) {
      const { error } = await adminClient
        .from("site_short_links")
        .delete()
        .eq("slug", slug);
      if (error) {
        console.error("Unable to delete ShortBit:", error);
        setAdminStatus(
          shortLinksAdminStatus,
          `ShortBit deletion failed: ${error.message}`,
          "error",
        );
        return;
      }
      await loadShortLinks();
      setAdminStatus(shortLinksAdminStatus, `Deleted /go/${slug}.`, "success");
    }
  });
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
    const playlists = collectRepeatableEntries(repeatableEditors.playlists);
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
        "Every enabled playlist needs a title and valid Spotify playlist URL.",
        "error",
      );
      return;
    }

    playlistSubmit.disabled = true;
    playlistSubmit.textContent = "> SAVING...";
    setAdminStatus(playlistAdminStatus, "Writing curated playlist entries...");

    const failedUpdate = await syncRepeatableEntries(
      repeatableEditors.playlists,
      playlists,
      new Date().toISOString(),
    );

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

    if (!await loadFeaturedPlaylists()) {
      return;
    }
    setAdminStatus(playlistAdminStatus, "Curated playlists updated.", "success");
  });

  trackForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const tracks = collectRepeatableEntries(repeatableEditors.tracks);
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
        "Every enabled song needs a title, artist, and valid Spotify track URL.",
        "error",
      );
      return;
    }

    trackSubmit.disabled = true;
    trackSubmit.textContent = "> SAVING...";
    setAdminStatus(trackAdminStatus, "Writing curated song entries...");

    const failedUpdate = await syncRepeatableEntries(
      repeatableEditors.tracks,
      tracks,
      new Date().toISOString(),
    );

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

    if (!await loadFeaturedTracks()) {
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
    const entries = collectRepeatableEntries(repeatableEditors.resume);
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
        "Every enabled résumé entry needs a role, organization, period, and summary.",
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
      syncRepeatableEntries(repeatableEditors.resume, entries, updatedAt),
    ]);
    const failedUpdate = results.find((result) => result?.error);
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
    if (!await loadResumeContent()) {
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
    const entries = collectRepeatableEntries(repeatableEditors.changelog);
    const invalidEntry = entries.find((entry) => (
      entry.enabled && (!entry.entry_date || !entry.title || !entry.summary)
    ));
    if (invalidEntry) {
      setAdminStatus(
        changelogAdminStatus,
        "Every enabled changelog entry needs a date, title, and summary.",
        "error",
      );
      return;
    }

    changelogSubmit.disabled = true;
    changelogSubmit.textContent = "> SAVING...";
    setAdminStatus(changelogAdminStatus, "Writing changelog entries...");
    const updatedAt = new Date().toISOString();
    const failedUpdate = await syncRepeatableEntries(
      repeatableEditors.changelog,
      entries,
      updatedAt,
    );
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
    if (!await loadChangelogContent()) {
      return;
    }
    clearPublicContentCache();
    setAdminStatus(changelogAdminStatus, "Changelog updated.", "success");
  });

  gamesForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const entries = collectRepeatableEntries(repeatableEditors.games);
    const invalidEntry = entries.find((entry) => (
      (
        entry.enabled
        && (!entry.title || !entry.platform || !entry.store_url)
      )
      || (
        entry.store_url
        && !httpsUrlPattern.test(entry.store_url)
      )
    ));
    if (invalidEntry) {
      setAdminStatus(
        gamesAdminStatus,
        "Every enabled game needs a title, page label, and HTTPS store or official URL.",
        "error",
      );
      return;
    }

    gamesSubmit.disabled = true;
    gamesSubmit.textContent = "> SAVING...";
    setAdminStatus(gamesAdminStatus, "Writing favorite games...");
    const failedUpdate = await syncRepeatableEntries(
      repeatableEditors.games,
      entries,
      new Date().toISOString(),
    );
    gamesSubmit.disabled = false;
    gamesSubmit.textContent = "> SAVE_GAMES";

    if (failedUpdate) {
      console.error("Unable to save favorite games:", failedUpdate.error);
      setAdminStatus(
        gamesAdminStatus,
        `Favorite games update failed: ${failedUpdate.error.message}`,
        "error",
      );
      return;
    }
    if (!await loadFavoriteGames()) {
      return;
    }
    clearPublicContentCache();
    setAdminStatus(gamesAdminStatus, "Favorite games updated.", "success");
  });

  logoutButton.addEventListener("click", async () => {
    const { error } = await adminClient.auth.signOut();

    if (error) {
      console.error("Unable to log out:", error);
      setAdminStatus(inboxStatus, `Logout failed: ${error.message}`, "error");
      return;
    }

    showLogin();
    window.dispatchEvent(new CustomEvent("admin:logged-out"));
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
