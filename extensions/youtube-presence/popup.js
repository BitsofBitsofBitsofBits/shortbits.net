const form = document.querySelector("#settings");
const token = document.querySelector("#token");
const enabled = document.querySelector("#enabled");
const save = document.querySelector("#save");
const output = document.querySelector("#status");
function show(message, error = false) {
  output.textContent = message;
  output.dataset.error = String(error);
}
async function load() {
  const settings = await chrome.storage.local.get(["enabled", "token", "lastError", "currentTitle"]);
  enabled.checked = settings.enabled === true;
  token.placeholder = settings.token ? "Configured - leave blank to keep" : "sbyt_...";
  show(settings.lastError || (settings.enabled
    ? `Sharing is on.${settings.currentTitle ? ` Latest video: ${settings.currentTitle}` : ""}`
    : "Sharing is off."), Boolean(settings.lastError));
}
form.addEventListener("submit", async event => {
  event.preventDefault();
  save.disabled = true;
  show("Saving...");
  try {
    const result = await chrome.runtime.sendMessage({ type: "configure", token: token.value, enabled: enabled.checked });
    if (!result?.ok) throw new Error(result?.error || "The extension did not confirm the settings.");
    token.value = "";
    await load();
  } catch (error) {
    console.error("Unable to save YouTube sharing settings:", error);
    const settings = await chrome.storage.local.get("enabled");
    enabled.checked = settings.enabled === true;
    show(error.message, true);
  } finally { save.disabled = false; }
});
load().catch(error => {
  console.error("Unable to load YouTube sharing settings:", error);
  show(`Unable to load settings: ${error.message}`, true);
});
