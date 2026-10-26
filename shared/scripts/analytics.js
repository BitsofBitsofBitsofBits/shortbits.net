const statsWindow = document.querySelector("#stats-window");
const statsRefresh = document.querySelector("#stats-refresh");
const statsStatus = document.querySelector("#stats-status");
const statsPrivacyStatus = document.querySelector("#stats-privacy-status");
const statsPopularWindows = document.querySelector("#stats-popular-windows");
const statsFields = {
  todayViews: document.querySelector("#stats-today-views"),
  todaySessions: document.querySelector("#stats-today-sessions"),
  totalViews: document.querySelector("#stats-total-views"),
  totalSessions: document.querySelector("#stats-total-sessions"),
};
const analyticsWindowLabels = {
  about: "ABOUT_ME.TXT",
  pronouns: "PRONOUNS.JSON",
  spotify: "SPOTIFY.EXE",
  source: "SOURCE.CODE",
  monitor: "SYSTEM_MONITOR",
  settings: "CONTROL_PANEL.EXE",
  resume: "CAREER.SYS",
  now: "NOW.TXT",
  changelog: "CHANGELOG.LOG",
  guestbook: "GUESTBOOK.LOG",
  filesystem: "FILE_EXPLORER.EXE",
  games: "GAMES.EXE",
  creators: "CREATOR.FEED",
  hardware: "HARDWARE.SYS",
  notifications: "NOTIFICATIONS.LOG",
  stats: "STATS.EXE",
};
const analyticsWindows = new Set(Object.keys(analyticsWindowLabels));
const analyticsDisabled = navigator.globalPrivacyControl === true
  || navigator.doNotTrack === "1"
  || window.doNotTrack === "1";
const analyticsDay = new Date().toISOString().slice(0, 10);
const sessionCountKey = `bits-analytics-session-${analyticsDay}`;
const windowCountKey = `bits-analytics-windows-${analyticsDay}`;

function getAnalyticsConnection() {
  const { url, anonKey } = window.SUPABASE_CONFIG || {};
  if (!url || !anonKey) {
    throw new Error("Site analytics are not configured.");
  }
  return {
    endpoint: `${url}/rest/v1/rpc`,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
  };
}

async function callAnalyticsRpc(name, body = {}) {
  const { endpoint, headers } = getAnalyticsConnection();
  const response = await fetch(`${endpoint}/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `Analytics request failed with status ${response.status}: ${await response.text()}`,
    );
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function recordAnalyticsEvent(event, target = null) {
  if (analyticsDisabled) {
    return;
  }
  callAnalyticsRpc("record_site_analytics", {
    p_event: event,
    p_target: target,
  }).catch((error) => {
    console.error("Unable to update aggregate site analytics:", error);
  });
}

function readCountedWindows() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(windowCountKey) || "[]");
    return new Set(
      Array.isArray(stored)
        ? stored.filter((slug) => analyticsWindows.has(slug))
        : [],
    );
  } catch (error) {
    console.error("Unable to read session analytics state:", error);
    return new Set();
  }
}

const countedWindows = readCountedWindows();

function recordWindowOpen(windowId) {
  const slug = String(windowId || "").replace(/-window$/, "");
  if (!analyticsWindows.has(slug) || countedWindows.has(slug)) {
    return;
  }
  countedWindows.add(slug);
  try {
    sessionStorage.setItem(windowCountKey, JSON.stringify([...countedWindows]));
  } catch (error) {
    console.error("Unable to save session analytics state:", error);
  }
  recordAnalyticsEvent("window_open", slug);
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isValidAnalyticsResponse(stats) {
  return stats
    && stats.today
    && stats.totals
    && isNonNegativeInteger(stats.today.views)
    && isNonNegativeInteger(stats.today.sessions)
    && isNonNegativeInteger(stats.totals.views)
    && isNonNegativeInteger(stats.totals.sessions)
    && Array.isArray(stats.popular_windows)
    && stats.popular_windows.every((entry) => (
      entry
      && analyticsWindows.has(entry.slug)
      && isNonNegativeInteger(entry.opens)
    ));
}

function renderPopularWindows(windows) {
  const highestCount = Math.max(1, ...windows.map((entry) => entry.opens));
  statsPopularWindows.replaceChildren(
    ...windows.map((entry, index) => {
      const item = document.createElement("li");
      const rank = document.createElement("strong");
      const details = document.createElement("div");
      const label = document.createElement("span");
      const meter = document.createElement("i");
      const count = document.createElement("b");

      rank.textContent = String(index + 1).padStart(2, "0");
      label.textContent = analyticsWindowLabels[entry.slug];
      meter.style.setProperty(
        "--stats-meter",
        `${Math.max(4, (entry.opens / highestCount) * 100)}%`,
      );
      count.textContent = entry.opens.toLocaleString();
      details.append(label, meter);
      item.append(rank, details, count);
      return item;
    }),
  );
  if (!windows.length) {
    const empty = document.createElement("li");
    empty.className = "stats-empty";
    empty.textContent = "No window telemetry yet.";
    statsPopularWindows.append(empty);
  }
}

function renderStats(stats) {
  statsFields.todayViews.textContent = stats.today.views.toLocaleString();
  statsFields.todaySessions.textContent = stats.today.sessions.toLocaleString();
  statsFields.totalViews.textContent = stats.totals.views.toLocaleString();
  statsFields.totalSessions.textContent = stats.totals.sessions.toLocaleString();
  renderPopularWindows(stats.popular_windows);
}

async function loadSiteStats() {
  statsRefresh.disabled = true;
  statsStatus.textContent = "Reading aggregate counters...";
  statsStatus.dataset.state = "";
  try {
    const stats = await callAnalyticsRpc("get_site_analytics");
    if (!isValidAnalyticsResponse(stats)) {
      throw new Error("Analytics response is malformed.");
    }
    renderStats(stats);
    statsStatus.textContent = stats.updated_at
      ? `Counters synchronized ${new Date(stats.updated_at).toLocaleString()}.`
      : "Counters initialized. Awaiting the first suspicious visitor.";
    statsStatus.dataset.state = "success";
  } catch (error) {
    console.error("Unable to load aggregate site analytics:", error);
    statsStatus.textContent = "Statistics signal is currently unavailable.";
    statsStatus.dataset.state = "error";
  } finally {
    statsRefresh.disabled = false;
  }
}

statsPrivacyStatus.textContent = analyticsDisabled
  ? "Your browser privacy signal is active. This visit is not counted."
  : "Aggregate counting is active. No visitor identifier is transmitted.";

statsRefresh.addEventListener("click", loadSiteStats);
window.addEventListener("desktop-window:opened", (event) => {
  recordWindowOpen(event.detail?.windowId);
  if (event.detail?.windowId === "stats-window") {
    loadSiteStats();
  }
});
recordAnalyticsEvent("view");
try {
  if (!analyticsDisabled && sessionStorage.getItem(sessionCountKey) !== "true") {
    sessionStorage.setItem(sessionCountKey, "true");
    recordAnalyticsEvent("session");
  }
} catch (error) {
  console.error("Unable to update daily session analytics:", error);
}

window.setInterval(() => {
  if (!statsWindow.hidden && !document.hidden) {
    loadSiteStats();
  }
}, 60000);

window.BITS_ANALYTICS = {
  disabled: analyticsDisabled,
  load: loadSiteStats,
  record: recordAnalyticsEvent,
};
