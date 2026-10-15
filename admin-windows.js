const adminWindowLaunchers = document.querySelector("#admin-window-launchers");
const adminWindowModules = [
  {
    sourceId: "message-editor",
    windowId: "admin-inbox-window",
    title: "INBOX.EXE",
    label: "INBOX",
    description: "Read and manage incoming packets",
    x: 70,
    y: 90,
  },
  {
    sourceId: "pronoun-editor",
    windowId: "admin-pronouns-window",
    title: "PRONOUN_PROFILE.SYS",
    label: "PRONOUNS",
    description: "Edit the public identity reference",
    x: 120,
    y: 110,
  },
  {
    sourceId: "guestbook-editor",
    windowId: "admin-guestbook-window",
    title: "GUESTBOOK_MODERATION.EXE",
    label: "GUESTBOOK",
    description: "Review and delete public signatures",
    x: 95,
    y: 105,
  },
  {
    sourceId: "arcade-editor",
    windowId: "admin-arcade-window",
    title: "ARCADE_MODERATION.EXE",
    label: "ARCADE",
    description: "Review and delete public leaderboard scores",
    x: 145,
    y: 115,
  },
  {
    sourceId: "playlist-editor",
    windowId: "admin-playlists-window",
    title: "PLAYLIST_EDITOR.EXE",
    label: "PLAYLISTS",
    description: "Manage featured Spotify playlists",
    x: 170,
    y: 130,
  },
  {
    sourceId: "track-editor",
    windowId: "admin-songs-window",
    title: "SONG_EDITOR.EXE",
    label: "SONGS",
    description: "Manage featured Spotify songs",
    x: 220,
    y: 150,
  },
  {
    sourceId: "resume-editor",
    windowId: "admin-resume-window",
    title: "RESUME_EDITOR.EXE",
    label: "RÉSUMÉ",
    description: "Edit CAREER.SYS and work history",
    x: 100,
    y: 70,
  },
  {
    sourceId: "now-editor",
    windowId: "admin-now-window",
    title: "NOW_EDITOR.EXE",
    label: "NOW.TXT",
    description: "Update current projects and interests",
    x: 150,
    y: 100,
  },
  {
    sourceId: "changelog-editor",
    windowId: "admin-changelog-window",
    title: "CHANGELOG_EDITOR.EXE",
    label: "CHANGELOG",
    description: "Manage public deployment history",
    x: 200,
    y: 120,
  },
  {
    sourceId: "games-editor",
    windowId: "admin-games-window",
    title: "GAMES_EDITOR.EXE",
    label: "GAMES",
    description: "Manage the public favorite-games library",
    x: 245,
    y: 135,
  },
  {
    sourceId: "short-links-editor",
    windowId: "admin-short-links-window",
    title: "SHORTBITS.EXE",
    label: "SHORTBITS",
    description: "Create and manage tiny Bits of the internet",
    x: 280,
    y: 95,
  },
];

function createAdminWindow(module) {
  const source = document.getElementById(module.sourceId);
  if (!source) {
    throw new Error(`Admin module source not found: ${module.sourceId}`);
  }

  const windowElement = document.createElement("section");
  const titleId = `${module.windowId}-title`;
  const header = document.createElement("header");
  const title = document.createElement("p");
  const controls = document.createElement("div");
  const minimize = document.createElement("button");
  const close = document.createElement("button");
  const content = document.createElement("div");
  const resize = document.createElement("button");

  windowElement.id = module.windowId;
  windowElement.className = "desktop-window admin-desktop-window";
  windowElement.role = "dialog";
  windowElement.setAttribute("aria-labelledby", titleId);
  windowElement.dataset.window = "";
  windowElement.dataset.windowX = String(module.x);
  windowElement.dataset.windowY = String(module.y);
  windowElement.hidden = true;

  header.className = "desktop-window-bar";
  header.dataset.windowDragHandle = "";
  title.id = titleId;
  title.textContent = module.title;
  controls.className = "desktop-window-controls";

  minimize.type = "button";
  minimize.dataset.windowMinimize = "";
  minimize.setAttribute("aria-label", `Minimize ${module.label} editor`);
  minimize.textContent = "_";
  close.type = "button";
  close.dataset.windowClose = "";
  close.setAttribute("aria-label", `Close ${module.label} editor`);
  close.textContent = "×";
  controls.append(minimize, close);
  header.append(title, controls);

  content.className = "desktop-window-content admin-window-content";
  source.classList.add("admin-window-module");
  source.replaceWith(windowElement);
  content.append(source);

  resize.className = "desktop-window-resize-handle";
  resize.type = "button";
  resize.dataset.windowResize = "";
  resize.setAttribute("aria-label", `Resize ${module.label} editor`);
  windowElement.append(header, content, resize);
  return windowElement;
}

function createAdminLauncher(module) {
  const launcher = document.createElement("button");
  const label = document.createElement("strong");
  const description = document.createElement("span");
  launcher.type = "button";
  launcher.dataset.windowTarget = module.windowId;
  label.textContent = module.label;
  description.textContent = module.description;
  launcher.append(label, description);
  return launcher;
}

adminWindowModules.forEach((module) => {
  createAdminWindow(module);
  adminWindowLaunchers.append(createAdminLauncher(module));
});

window.addEventListener("admin:authenticated", () => {
  const openAdminWindow = document.querySelector(
    ".admin-desktop-window:not([hidden])",
  );
  if (!openAdminWindow) {
    window.BITS_DESKTOP_WINDOWS.open("admin-inbox");
  }
});

window.addEventListener("admin:logged-out", () => {
  window.BITS_DESKTOP_WINDOWS.resetLayout();
});
