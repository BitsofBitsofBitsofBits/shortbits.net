const discordRefreshIntervalMs = 60_000;
const discordStatus = document.querySelector("#discord-presence-status");
const discordCustomStatus = document.querySelector("#discord-custom-status");
const discordActivity = document.querySelector("#discord-activity");
const discordClients = document.querySelector("#discord-clients");

let discordRefreshTimer;

function formatDiscordActivity(activity) {
  return [activity.name, activity.details, activity.state]
    .filter(Boolean)
    .join(" // ");
}

function renderDiscordPresence(presence) {
  if (!presence.enrolled) {
    discordStatus.textContent = "SETUP REQUIRED";
    discordCustomStatus.textContent = "Join Lanyard to publish presence";
    discordActivity.textContent = "Unavailable";
    discordClients.textContent = "None";
    return;
  }

  discordStatus.textContent = String(presence.status || "offline").toUpperCase();
  discordCustomStatus.textContent = presence.customStatus || "No custom status";
  discordActivity.textContent = presence.activities?.length
    ? presence.activities.map(formatDiscordActivity).join(" | ")
    : "No public activity";
  discordClients.textContent = presence.clients?.length
    ? presence.clients.join(", ").toUpperCase()
    : "NONE";
}

async function refreshDiscordPresence() {
  window.clearTimeout(discordRefreshTimer);
  const projectUrl = window.SUPABASE_CONFIG?.url;
  const anonKey = window.SUPABASE_CONFIG?.anonKey;

  if (!projectUrl || projectUrl.toLowerCase().includes("your_project_id")) {
    discordStatus.textContent = "NOT CONFIGURED";
    return;
  }

  try {
    const response = await fetch(`${projectUrl}/functions/v1/discord-presence`, {
      headers: anonKey ? { "apikey": anonKey } : {},
    });
    const presence = await response.json();
    if (!response.ok) {
      throw new Error(presence.error || `Discord presence returned ${response.status}.`);
    }
    renderDiscordPresence(presence);
  } catch (error) {
    console.error("Unable to load Discord presence:", error);
    discordStatus.textContent = "SIGNAL UNAVAILABLE";
    discordCustomStatus.textContent = "Presence could not be loaded";
    discordActivity.textContent = "Unavailable";
    discordClients.textContent = "Unknown";
  } finally {
    discordRefreshTimer = window.setTimeout(
      refreshDiscordPresence,
      discordRefreshIntervalMs,
    );
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshDiscordPresence();
  }
});

refreshDiscordPresence();
