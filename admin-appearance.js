(() => {
  const root = document.documentElement;
  let preference = "system";
  try {
    preference = localStorage.getItem("bits-admin-appearance") || "system";
  } catch {
    preference = "system";
  }
  if (!["system", "light", "dark"].includes(preference)) {
    preference = "system";
  }
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  root.dataset.adminAppearancePreference = preference;
  root.dataset.adminAppearance = preference === "system"
    ? (prefersDark ? "dark" : "light")
    : preference;

  try {
    if (localStorage.getItem("bits-admin-nav-collapsed") === "true") {
      root.dataset.adminNavCollapsed = "true";
    }
  } catch {
    // Storage can be unavailable in private modes.
  }
})();
