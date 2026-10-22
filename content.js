const resumeEmpty = document.querySelector("#resume-empty");
const resumeContent = document.querySelector("#resume-content");
const resumeHeadline = document.querySelector("#resume-headline");
const resumeSummary = document.querySelector("#resume-summary");
const resumeAvailability = document.querySelector("#resume-availability");
const resumeAvailabilityRow = document.querySelector("#resume-availability-row");
const resumeLocation = document.querySelector("#resume-location");
const resumeLocationRow = document.querySelector("#resume-location-row");
const resumeUpdated = document.querySelector("#resume-updated");
const resumeDownload = document.querySelector("#resume-download");
const resumeEntries = document.querySelector("#resume-entries");
const resumeEducationHeading = document.querySelector("#resume-education-heading");
const resumeEducation = document.querySelector("#resume-education");
const resumeCertificationsHeading = document.querySelector("#resume-certifications-heading");
const resumeCertifications = document.querySelector("#resume-certifications");
const nowEmpty = document.querySelector("#now-empty");
const nowContent = document.querySelector("#now-content");
const nowHeadline = document.querySelector("#now-headline");
const nowSummary = document.querySelector("#now-summary");
const nowFields = document.querySelector("#now-fields");
const nowUpdated = document.querySelector("#now-updated");
const changelogEmpty = document.querySelector("#changelog-empty");
const changelogEntries = document.querySelector("#changelog-entries");
const gamesEmpty = document.querySelector("#games-empty");
const gamesList = document.querySelector("#games-list");
const hardwareEmpty = document.querySelector("#hardware-empty");
const hardwareMachines = document.querySelector("#hardware-machines");
const hardwareUpdated = document.querySelector("#hardware-updated");
const publicContentWindowIds = new Set([
  "resume-window",
  "now-window",
  "changelog-window",
  "games-window",
  "hardware-window",
]);
const publicContentCacheKey = "bits-public-content-v6";
const publicContentCacheDurationMs = 300_000;

let publicContentRequest;

function formatContentDate(value, includeTime = false) {
  const parsed = includeTime
    ? new Date(value)
    : new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return includeTime
    ? parsed.toLocaleString()
    : parsed.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function getCachedPublicContent() {
  const cachedValue = localStorage.getItem(publicContentCacheKey);
  if (!cachedValue) {
    return null;
  }

  try {
    const cached = JSON.parse(cachedValue);
    if (
      typeof cached.cachedAt === "number"
      && Date.now() - cached.cachedAt < publicContentCacheDurationMs
      && cached.payload
    ) {
      return cached.payload;
    }
  } catch (error) {
    console.warn("Unable to read cached public content:", error);
  }
  localStorage.removeItem(publicContentCacheKey);
  return null;
}

async function fetchPublicContentTable(query) {
  const { url, anonKey } = window.SUPABASE_CONFIG;
  if (!url || !anonKey) {
    throw new Error("Supabase public content configuration is missing.");
  }
  const response = await fetch(
    `${url.replace(/\/$/, "")}/rest/v1/${query}`,
    { headers: { apikey: anonKey } },
  );
  if (!response.ok) {
    throw new Error(`Public content request failed with HTTP ${response.status}.`);
  }
  return response.json();
}

async function requestPublicContent() {
  const cached = getCachedPublicContent();
  if (cached) {
    return cached;
  }

  const [resumeProfiles, resumeItems, educationItems, certificationItems, nowProfiles, changelogItems, gameItems, hardwareItems] =
    await Promise.all([
      fetchPublicContentTable(
        "site_resume_profile?select=headline,summary,availability,location,resume_url,updated_at&enabled=eq.true&id=eq.primary",
      ),
      fetchPublicContentTable(
        "site_resume_entries?select=position,role,organization,period,summary,technologies&enabled=eq.true&order=position.asc",
      ),
      fetchPublicContentTable(
        "site_resume_education?select=position,school,credential,period,details&enabled=eq.true&order=position.asc",
      ).catch((error) => {
        console.warn("Unable to load education:", error);
        return [];
      }),
      fetchPublicContentTable(
        "site_resume_certifications?select=position,name,issuer,issued,credential_id,credential_url&enabled=eq.true&order=position.asc",
      ).catch((error) => {
        console.warn("Unable to load certifications:", error);
        return [];
      }),
      fetchPublicContentTable(
        "site_now?select=headline,summary,building,learning,playing,reading,updated_at&enabled=eq.true&id=eq.primary",
      ),
      fetchPublicContentTable(
        "site_changelog?select=position,entry_date,title,summary&enabled=eq.true&order=position.asc",
      ),
      fetchPublicContentTable(
        "site_favorite_games?select=position,title,platform,store_url,note&enabled=eq.true&order=position.asc",
      ),
      fetchPublicContentTable(
        "site_hardware?select=position,machine,component,name,detail,updated_at&enabled=eq.true&order=position.asc",
      ).catch((error) => {
        console.warn("Unable to load hardware:", error);
        return [];
      }),
    ]);
  const payload = {
    resumeProfile: resumeProfiles[0] ?? null,
    resumeEntries: resumeItems,
    resumeEducation: educationItems,
    resumeCertifications: certificationItems,
    nowProfile: nowProfiles[0] ?? null,
    changelogEntries: changelogItems,
    favoriteGames: gameItems,
    hardware: hardwareItems,
  };
  localStorage.setItem(publicContentCacheKey, JSON.stringify({
    cachedAt: Date.now(),
    payload,
  }));
  return payload;
}

function createResumeEntry(entry) {
  const item = document.createElement("li");
  const header = document.createElement("header");
  const titleGroup = document.createElement("div");
  const role = document.createElement("h3");
  const organization = document.createElement("p");
  const period = document.createElement("p");
  role.textContent = entry.role;
  organization.textContent = entry.organization;
  if (window.CareerFormat) {
    window.CareerFormat.buildPeriod(period, entry.period);
  } else {
    period.textContent = entry.period;
  }
  titleGroup.append(role, organization);
  header.append(titleGroup, period);
  item.append(header);

  const format = window.CareerFormat;
  if (format) {
    item.append(format.buildSummary(entry.summary, {
      list: "resume-entry-bullets",
    }));
    const technologies = format.buildTechnologyList(
      entry.technologies,
      "resume-entry-technologies",
      `${entry.role} skills`,
    );
    if (technologies) {
      item.append(technologies);
    }
    return item;
  }

  const summary = document.createElement("p");
  summary.textContent = entry.summary;
  item.append(summary);
  if (entry.technologies) {
    const technologies = document.createElement("p");
    technologies.className = "resume-entry-technologies";
    technologies.textContent = entry.technologies;
    item.append(technologies);
  }
  return item;
}

function createEducationEntry(entry) {
  const item = document.createElement("li");
  const header = document.createElement("header");
  const titleGroup = document.createElement("div");
  const credential = document.createElement("h3");
  const school = document.createElement("p");
  const period = document.createElement("p");
  credential.textContent = entry.credential;
  school.textContent = entry.school;
  if (window.CareerFormat) {
    window.CareerFormat.buildPeriod(period, entry.period);
  } else {
    period.textContent = entry.period;
  }
  titleGroup.append(credential, school);
  header.append(titleGroup, period);
  item.append(header);
  if (entry.details) {
    if (window.CareerFormat) {
      item.append(window.CareerFormat.buildSummary(entry.details, {
        list: "resume-entry-bullets",
      }));
    } else {
      const details = document.createElement("p");
      details.textContent = entry.details;
      item.append(details);
    }
  }
  return item;
}

function createCertificationEntry(entry) {
  const item = document.createElement("li");
  const header = document.createElement("header");
  const titleGroup = document.createElement("div");
  const name = document.createElement("h3");
  const issuer = document.createElement("p");
  const issued = document.createElement("p");
  name.textContent = entry.name;
  issuer.textContent = entry.issuer;
  issued.textContent = entry.issued;
  titleGroup.append(name, issuer);
  header.append(titleGroup, issued);
  item.append(header);
  if (entry.credential_id || entry.credential_url) {
    const meta = document.createElement("p");
    meta.className = "resume-certification-meta";
    if (entry.credential_id) {
      meta.append(`CREDENTIAL ID: ${entry.credential_id}`);
    }
    if (entry.credential_url && /^https:\/\//i.test(entry.credential_url)) {
      if (entry.credential_id) {
        meta.append(" // ");
      }
      const link = document.createElement("a");
      link.href = entry.credential_url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "VERIFY ↗";
      meta.append(link);
    }
    item.append(meta);
  }
  return item;
}

function renderResume(profile, entries, education = [], certifications = []) {
  if (!profile) {
    resumeEmpty.textContent = "Résumé data is awaiting operator input.";
    resumeEmpty.hidden = false;
    resumeContent.hidden = true;
    return;
  }

  resumeHeadline.textContent = profile.headline;
  resumeSummary.textContent = profile.summary;
  resumeAvailability.textContent = profile.availability ?? "";
  resumeAvailabilityRow.hidden = !profile.availability;
  resumeLocation.textContent = profile.location ?? "";
  resumeLocationRow.hidden = !profile.location;
  resumeUpdated.textContent = formatContentDate(profile.updated_at, true);
  resumeDownload.hidden = false;
  resumeDownload.href = profile.resume_url || "/professional/resume/";
  resumeEntries.replaceChildren(
    ...entries.map(createResumeEntry),
  );
  resumeEntries.hidden = entries.length === 0;
  if (resumeEducation) {
    resumeEducation.replaceChildren(...education.map(createEducationEntry));
    resumeEducation.hidden = education.length === 0;
    resumeEducationHeading.hidden = education.length === 0;
  }
  if (resumeCertifications) {
    resumeCertifications.replaceChildren(...certifications.map(createCertificationEntry));
    resumeCertifications.hidden = certifications.length === 0;
    resumeCertificationsHeading.hidden = certifications.length === 0;
  }
  resumeEmpty.hidden = true;
  resumeContent.hidden = false;
}

function renderNow(profile) {
  if (!profile) {
    nowEmpty.textContent = "NOW.TXT is awaiting operator input.";
    nowEmpty.hidden = false;
    nowContent.hidden = true;
    return;
  }

  nowHeadline.textContent = profile.headline;
  nowSummary.textContent = profile.summary;
  nowFields.replaceChildren();
  [
    ["BUILDING", profile.building],
    ["LEARNING", profile.learning],
    ["PLAYING", profile.playing],
    ["READING / WATCHING", profile.reading],
  ].forEach(([label, value]) => {
    if (!value) {
      return;
    }
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = label;
    detail.textContent = value;
    row.append(term, detail);
    nowFields.append(row);
  });
  nowUpdated.textContent = formatContentDate(profile.updated_at, true);
  nowEmpty.hidden = true;
  nowContent.hidden = false;
}

function createChangelogEntry(entry) {
  const item = document.createElement("li");
  const date = document.createElement("time");
  const copy = document.createElement("div");
  const title = document.createElement("h3");
  const summary = document.createElement("p");
  date.dateTime = entry.entry_date;
  date.textContent = formatContentDate(entry.entry_date);
  title.textContent = entry.title;
  summary.textContent = entry.summary;
  copy.append(title, summary);
  item.append(date, copy);
  return item;
}

function renderChangelog(entries) {
  changelogEntries.replaceChildren(...entries.map(createChangelogEntry));
  changelogEntries.hidden = entries.length === 0;
  changelogEmpty.hidden = entries.length > 0;
  changelogEmpty.textContent = "Changelog entries are awaiting operator input.";
}

function createFavoriteGame(game) {
  const item = document.createElement("li");
  const copy = document.createElement("div");
  const title = document.createElement("h3");
  const platform = document.createElement("p");
  const link = document.createElement("a");

  title.textContent = game.title;
  platform.textContent = game.platform;
  link.href = game.store_url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "OPEN PAGE ↗";
  copy.append(title, platform);

  if (game.note) {
    const note = document.createElement("p");
    note.className = "favorite-game-note";
    note.textContent = game.note;
    copy.append(note);
  }

  item.append(copy, link);
  return item;
}

function renderFavoriteGames(games) {
  gamesList.replaceChildren(...games.map(createFavoriteGame));
  gamesList.hidden = games.length === 0;
  gamesEmpty.hidden = games.length > 0;
  gamesEmpty.textContent = "Favorite games are awaiting operator input.";
}

const hardwareCollapsedKey = "bits-hardware-collapsed";
const hardwareStatusPollMs = 3_000;
const hardwareWatchPingMs = 20_000;
const hardwareOnlineWindowMs = 60_000;
const hardwareState = { items: [], statuses: [], cardsKey: "", timer: 0, ticker: 0, watchedAt: 0 };
const baseHardwareJokes = {
  cpu: [
    "Calculating how many Bits fit in another Bit.",
    "Briefly considering doing actual work.",
    "Compiling opinions into machine code.",
    "One core is dedicated entirely to overthinking.",
  ],
  gpu: [
    "Rendering one extremely important gradient.",
    "Adding bloom to something nobody can see.",
    "Drawing triangles as fast as legally permitted.",
    "Preparing another frame for the void.",
  ],
  network: [
    "Packets are taking the scenic route.",
    "Downloading additional download indicators.",
    "Negotiating with a router named Linksys.",
    "Uploading confidence at dial-up speed.",
  ],
  ram: [
    "Remembering several tabs you forgot existed.",
    "Holding a thought until the process responds.",
    "Caching one suspiciously large personality.",
    "Memory leak insists it is a water feature.",
  ],
  storage: [
    "Most space is reserved for screenshots named final_final.",
    "Defragmenting a folder full of untitled documents.",
    "The recycle bin is emotionally attached.",
    "Archiving side projects that are definitely almost done.",
  ],
  thermal: [
    "Warm, but not emotionally available.",
    "Fans are whispering encouraging words.",
    "Temperature classified as laptop-adjacent.",
    "Applying thermal paste conceptually.",
  ],
};
// Keep the seasonal profile's existing key so seasonal messages move with the jokes.
const seasonalHardwareJokes = window.BITS_SEASONAL_PROFILE?.monitorJokes ?? {};
const hardwareJokes = window.BITS_SEASONAL_PROFILE?.mode === "exclusive"
  ? seasonalHardwareJokes
  : Object.fromEntries(Object.entries(baseHardwareJokes).map(([metric, jokes]) => [
      metric,
      [...jokes, ...(seasonalHardwareJokes[metric] ?? [])],
    ]));
const hardwareChatter = Object.values(hardwareJokes).flat();

function readCollapsedHardware() {
  try {
    const value = JSON.parse(localStorage.getItem(hardwareCollapsedKey) ?? "[]");
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

function saveCollapsedHardware(machine, collapsed) {
  const machines = readCollapsedHardware();
  if (collapsed) {
    machines.add(machine);
  } else {
    machines.delete(machine);
  }
  localStorage.setItem(hardwareCollapsedKey, JSON.stringify([...machines]));
}

function formatHardwareUptime(bootedAt) {
  const totalSeconds = Math.max(0, Math.floor((Date.now() - new Date(bootedAt).getTime()) / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const pad = (value) => String(value).padStart(2, "0");
  const hours = pad(Math.floor((totalSeconds % 86_400) / 3600));
  const minutes = pad(Math.floor((totalSeconds % 3600) / 60));
  const seconds = pad(totalSeconds % 60);
  return `${days ? `${days}d ` : ""}${hours}h ${minutes}m ${seconds}s`;
}

function tickHardwareUptime() {
  updateHardwareStatus();
}

function createHardwareMeter(label) {
  const meter = document.createElement("div");
  const name = document.createElement("span");
  const track = document.createElement("span");
  const fill = document.createElement("span");
  const value = document.createElement("strong");
  meter.className = "hardware-meter";
  meter.dataset.meter = label;
  name.textContent = label;
  track.className = "hardware-meter-track";
  track.setAttribute("aria-hidden", "true");
  fill.className = "hardware-meter-fill";
  track.append(fill);
  meter.append(name, track, value);
  return meter;
}

function setHardwareMeter(meter, percent, text) {
  meter.hidden = percent === null || percent === undefined;
  if (meter.hidden) {
    return;
  }
  meter.querySelector(".hardware-meter-fill").style.setProperty("--meter-value", `${percent}%`);
  meter.querySelector("strong").textContent = text ?? `${percent}%`;
}

function createHardwareCard(machine, components, collapsed) {
  const card = document.createElement("details");
  const summary = document.createElement("summary");
  const heading = document.createElement("h3");
  const badge = document.createElement("span");
  const count = document.createElement("span");
  const live = document.createElement("div");
  const uptime = document.createElement("p");
  const nas = document.createElement("section");
  const chatter = document.createElement("p");
  card.className = "hardware-machine";
  card.dataset.machine = machine;
  card.open = !collapsed;
  heading.textContent = machine;
  badge.className = "hardware-live-badge";
  badge.hidden = true;
  count.className = "hardware-part-count";
  count.textContent = components.length
    ? `${components.length} PART${components.length === 1 ? "" : "S"}`
    : "";
  summary.append(heading, badge, count);
  live.className = "hardware-live";
  live.hidden = true;
  uptime.className = "hardware-live-uptime";
  nas.className = "hardware-nas";
  nas.setAttribute("aria-label", "NAS storage, network, and drive readings");
  nas.hidden = true;
  chatter.className = "hardware-live-chatter";
  chatter.hidden = true;
  live.append(
    createHardwareMeter("CPU"),
    createHardwareMeter("GPU"),
    createHardwareMeter("RAM"),
    uptime,
    nas,
    chatter,
  );
  card.append(summary, live);

  if (components.length) {
    const list = document.createElement("dl");
    list.className = "desktop-window-stats hardware-specs";
    components.forEach((component) => {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      const value = document.createElement("dd");
      const name = document.createElement("span");
      term.textContent = component.component;
      name.textContent = component.name;
      value.append(name);
      if (component.detail) {
        const detail = document.createElement("small");
        detail.textContent = component.detail;
        value.append(detail);
      }
      row.append(term, value);
      list.append(row);
    });
    card.append(list);
  }
  card.addEventListener("toggle", () => {
    saveCollapsedHardware(machine, !card.open);
  });
  return card;
}

function formatHardwareBytes(bytes) {
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(2)} TiB`;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${Math.round(bytes)} B`;
}

function updateHardwareNas(container, metrics, online) {
  container.hidden = !metrics;
  if (!metrics) {
    delete container.dataset.readingKey;
    container.replaceChildren();
    return;
  }
  const fresh = online && Date.now() - new Date(metrics.sampled_at).getTime() < hardwareOnlineWindowMs;
  const key = JSON.stringify([metrics, fresh]);
  if (container.dataset.readingKey === key) return;
  container.dataset.readingKey = key;
  const summary = document.createElement("p");
  summary.className = "hardware-nas-summary";
  if (!fresh) {
    summary.textContent = "NAS READINGS STALE / UNAVAILABLE";
    container.replaceChildren(summary);
    return;
  }
  summary.textContent = `ARRAY ${metrics.array_state}`;
  const storage = document.createElement("p");
  storage.textContent = `STORAGE ${formatHardwareBytes(metrics.storage_used_bytes)} / ${formatHardwareBytes(metrics.storage_total_bytes)} used`;
  const free = document.createElement("p");
  free.textContent = `${formatHardwareBytes(metrics.storage_free_bytes)} free`;
  const network = document.createElement("p");
  const rate = (value) => value === null ? "measuring" : `${formatHardwareBytes(value)}/s`;
  network.textContent = `NETWORK RX ${rate(metrics.network_rx_bytes_sec)} / TX ${rate(metrics.network_tx_bytes_sec)}`;
  const note = document.createElement("p");
  note.className = "hardware-nas-note";
  note.textContent = "Selected LAN interface; not Internet bandwidth. Drive status and I/O errors are not a full SMART health assessment.";
  const drives = document.createElement("ul");
  drives.className = "hardware-nas-drives";
  metrics.drives.forEach((drive, index) => {
    const row = document.createElement("li");
    row.dataset.state = drive.status === "error" || drive.errors > 0 ? "error" : drive.status;
    const name = document.createElement("strong");
    const reading = document.createElement("span");
    name.textContent = `Drive ${index + 1}`;
    const temperature = drive.temperature_c === null ? "temperature unavailable" : `${drive.temperature_c}\u00b0C`;
    const spinning = drive.spinning === false ? "sleeping" : drive.spinning === true ? "spinning" : "spin state unknown";
    const errors = drive.errors === null ? "I/O errors unavailable" : `${drive.errors} I/O errors`;
    reading.textContent = `${drive.status.toUpperCase()} / ${spinning} / ${temperature} / ${errors}`;
    row.append(name, reading);
    drives.append(row);
  });
  container.replaceChildren(summary, storage, free, network, drives, note);
}

function renderHardwareCards() {
  const machines = new Map();
  let latestUpdate = "";
  hardwareState.items.forEach((item) => {
    if (!machines.has(item.machine)) {
      machines.set(item.machine, []);
    }
    machines.get(item.machine).push(item);
    if (item.updated_at && item.updated_at > latestUpdate) {
      latestUpdate = item.updated_at;
    }
  });
  hardwareState.statuses.forEach((status) => {
    if (!machines.has(status.machine)) {
      machines.set(status.machine, []);
    }
  });

  const cardsKey = JSON.stringify([...machines]);
  if (cardsKey !== hardwareState.cardsKey) {
    hardwareState.cardsKey = cardsKey;
    const collapsed = readCollapsedHardware();
    hardwareMachines.replaceChildren(
      ...[...machines].map(([machine, components]) => (
        createHardwareCard(machine, components, collapsed.has(machine))
      )),
    );
  }
  hardwareMachines.hidden = machines.size === 0;
  hardwareEmpty.hidden = machines.size > 0;
  hardwareEmpty.textContent = "Hardware inventory is awaiting operator input.";
  hardwareUpdated.hidden = !latestUpdate;
  hardwareUpdated.textContent = latestUpdate
    ? `LAST SCAN: ${formatContentDate(latestUpdate, true)}`
    : "";
  updateHardwareStatus();
}

function updateHardwareStatus() {
  const statuses = new Map(hardwareState.statuses.map((status) => [status.machine, status]));
  hardwareMachines.querySelectorAll(".hardware-machine").forEach((card) => {
    const status = statuses.get(card.dataset.machine);
    const badge = card.querySelector(".hardware-live-badge");
    const live = card.querySelector(".hardware-live");
    const chatter = live.querySelector(".hardware-live-chatter");
    chatter.hidden = true;
    badge.hidden = !status;
    if (!status) {
      live.hidden = true;
      updateHardwareNas(live.querySelector(".hardware-nas"), null, false);
      return;
    }
    const online = Date.now() - new Date(status.updated_at).getTime() < hardwareOnlineWindowMs;
    badge.dataset.state = online ? "online" : "offline";
    badge.textContent = online ? "LIVE" : "OFFLINE";
    live.hidden = false;
    live.classList.toggle("is-offline", !online);
    const meters = live.querySelectorAll(".hardware-meter");
    const memoryPercent = status.memory_total_mb && status.memory_used_mb !== null
      ? Math.round((status.memory_used_mb / status.memory_total_mb) * 100)
      : null;
    setHardwareMeter(meters[0], online ? status.cpu_percent : null);
    setHardwareMeter(meters[1], online ? status.gpu_percent : null);
    setHardwareMeter(
      meters[2],
      online ? memoryPercent : null,
      memoryPercent === null
        ? ""
        : `${(status.memory_used_mb / 1024).toFixed(1)} / ${Math.round(status.memory_total_mb / 1024)} GB`,
    );
    const uptime = live.querySelector(".hardware-live-uptime");
    if (online && status.booted_at) {
      uptime.dataset.bootedAt = status.booted_at;
      uptime.textContent = `UPTIME ${formatHardwareUptime(status.booted_at)}`;
    } else {
      delete uptime.dataset.bootedAt;
      uptime.textContent = online ? "" : `LAST SEEN ${formatContentDate(status.updated_at, true)}`;
    }
    updateHardwareNas(live.querySelector(".hardware-nas"), status.nas_metrics, online);
    if (online && hardwareChatter.length) {
      chatter.hidden = false;
      chatter.textContent = `AGENT CHATTER // ${hardwareChatter[Math.floor(Date.now() / 6000) % hardwareChatter.length]}`;
    }
  });
}

// Tells live agents someone is watching so they report every few seconds.
function pingHardwareWatch() {
  if (Date.now() - hardwareState.watchedAt < hardwareWatchPingMs) {
    return;
  }
  hardwareState.watchedAt = Date.now();
  const { url, anonKey } = window.SUPABASE_CONFIG;
  fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/hardware_watch`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: "{}",
  }).catch(() => {});
}

async function refreshHardwareStatus() {
  if (document.hidden) {
    return;
  }
  pingHardwareWatch();
  try {
    hardwareState.statuses = await fetchPublicContentTable(
      "site_hardware_status?select=*&order=machine.asc",
    );
    renderHardwareCards();
  } catch (error) {
    console.warn("Unable to load live hardware status:", error);
  }
}

function startHardwareStatus() {
  if (hardwareState.timer) {
    return;
  }
  refreshHardwareStatus();
  hardwareState.timer = window.setInterval(refreshHardwareStatus, hardwareStatusPollMs);
  hardwareState.ticker = window.setInterval(tickHardwareUptime, 1000);
}

function stopHardwareStatus() {
  window.clearInterval(hardwareState.timer);
  window.clearInterval(hardwareState.ticker);
  hardwareState.timer = 0;
  hardwareState.ticker = 0;
}

function renderHardware(items) {
  hardwareState.items = items;
  renderHardwareCards();
}

async function loadPublicContent() {
  if (!publicContentRequest) {
    resumeEmpty.textContent = "Synchronizing résumé data...";
    nowEmpty.textContent = "Synchronizing NOW.TXT...";
    changelogEmpty.textContent = "Synchronizing changelog entries...";
    gamesEmpty.textContent = "Synchronizing favorite games...";
    hardwareEmpty.textContent = "Scanning hardware inventory...";
    publicContentRequest = requestPublicContent()
      .then((content) => {
        renderResume(
          content.resumeProfile,
          content.resumeEntries,
          content.resumeEducation ?? [],
          content.resumeCertifications ?? [],
        );
        renderNow(content.nowProfile);
        renderChangelog(content.changelogEntries);
        renderFavoriteGames(content.favoriteGames);
        renderHardware(content.hardware ?? []);
      })
      .catch((error) => {
        console.error("Unable to load public content:", error);
        resumeEmpty.textContent = "Résumé data is temporarily unavailable.";
        nowEmpty.textContent = "NOW.TXT is temporarily unavailable.";
        changelogEmpty.textContent = "Changelog data is temporarily unavailable.";
        gamesEmpty.textContent = "Favorite games are temporarily unavailable.";
        hardwareEmpty.textContent = "Hardware inventory is temporarily unavailable.";
        publicContentRequest = null;
        throw error;
      });
  }
  return publicContentRequest;
}

window.addEventListener("desktop-window:opened", (event) => {
  if (publicContentWindowIds.has(event.detail.windowId)) {
    loadPublicContent().catch(() => {});
  }
  if (event.detail.windowId === "hardware-window") {
    startHardwareStatus();
  }
});

window.addEventListener("desktop-window:closed", (event) => {
  if (event.detail.windowId === "hardware-window") {
    stopHardwareStatus();
  }
});

document.addEventListener("visibilitychange", () => {
  if (hardwareState.timer && !document.hidden) {
    refreshHardwareStatus();
  }
});

if (!document.getElementById("hardware-window").hidden) {
  startHardwareStatus();
}

if (
  [...publicContentWindowIds].some(
    (windowId) => !document.getElementById(windowId).hidden,
  )
) {
  loadPublicContent().catch(() => {});
}
