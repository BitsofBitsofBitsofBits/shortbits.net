(() => {
  const navigation = document.querySelector(".public-nav");
  const preference = window.BITS_THEME_PREFERENCE;
  if (!navigation) return;

  const settings = document.createElement("dialog");
  settings.id = "blog-theme-settings";
  settings.className = "blog-theme-settings";
  settings.dataset.blogThemeSettings = "";
  settings.setAttribute("aria-labelledby", "blog-theme-title");
  const heading = document.createElement("div");
  heading.className = "blog-theme-heading";
  const title = document.createElement("h2");
  title.id = "blog-theme-title";
  title.textContent = "Theme settings";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "blog-theme-close";
  close.textContent = "Close";
  close.setAttribute("aria-label", "Close theme settings");
  heading.append(title, close);
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "blog-theme-trigger";
  trigger.textContent = "Theme settings";
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-controls", settings.id);
  const controls = document.createElement("div");
  controls.className = "blog-theme-controls";
  function createSelect(id, text) {
    const label = document.createElement("label");
    const name = document.createElement("span");
    const select = document.createElement("select");
    name.textContent = text;
    select.id = id;
    label.append(name, select);
    controls.append(label);
    return select;
  }
  const theme = createSelect("blog-theme-select", "Theme");
  theme.autofocus = true;
  const scheme = createSelect("blog-scheme-select", "Color mode");
  const variant = createSelect("blog-variant-select", "Variant");
  const reading = window.BITS_BLOG_READING_WIDTH;
  const width = createSelect("blog-reading-width-select", "Reading width");
  width.setAttribute("aria-label", "Reading width");
  for (const [value, label] of [["comfortable", "Comfortable (default)"], ["wide", "Wide"], ["full", "Full width"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    width.append(option);
  }
  const widthHelp = document.createElement("p");
  widthHelp.className = "blog-reading-width-help";
  widthHelp.textContent = "Comfortable leaves margins on large screens. Wide gives more room; Full width uses all available space. Phones keep the same compact gutters. This choice is saved only in this browser.";
  const widthStatus = document.createElement("p");
  widthStatus.id = "blog-reading-width-status";
  widthStatus.className = "blog-reading-width-help";
  widthStatus.setAttribute("role", "status");
  widthStatus.setAttribute("aria-live", "polite");
  widthHelp.id = "blog-reading-width-help";
  width.setAttribute("aria-describedby", `${widthHelp.id} ${widthStatus.id}`);
  const syncWidth = () => {
    width.value = reading?.value || "comfortable";
    width.disabled = !reading;
    widthStatus.textContent = !reading ? "Reading width could not load. Reload the page to try again."
      : reading.storageError ? "Browser storage is unavailable. Your reading width works here but may not be retained after navigation." : "";
  };
  width.addEventListener("change", () => reading?.select(width.value));
  window.addEventListener("bits:blog-reading-width", syncWidth);
  syncWidth();
  if (preference) theme.replaceChildren(...preference.buildOptions());
  const sync = () => { theme.value = document.documentElement.dataset.interfaceTheme; };
  theme.addEventListener("change", () => {
    preference.select(theme.value);
    preference.apply(theme.value);
  });
  if (preference) {
    preference.bindColorSchemeSelect(scheme);
    preference.bindVariantSelect(variant);
    window.BITS_THEME_PICKER.bind(theme, variant);
  } else {
    theme.disabled = scheme.disabled = variant.disabled = true;
    const appearanceStatus = document.createElement("p");
    appearanceStatus.className = "blog-reading-width-help";
    appearanceStatus.textContent = "Appearance settings could not load. Reading width is still available; reload to retry appearance settings.";
    controls.append(appearanceStatus);
    console.error("Blog appearance settings are unavailable.");
  }
  window.addEventListener("bits:theme-applied", sync);
  window.addEventListener("storage", (event) => {
    if (preference && (event.key === null || ["bits-interface-theme", preference.choiceKey, preference.dismissalKey].includes(event.key))) {
      preference.apply(preference.resolve());
    }
  });
  window.addEventListener("pageshow", () => { if (preference) preference.apply(preference.resolve()); });
  trigger.addEventListener("click", () => settings.showModal());
  close.addEventListener("click", () => settings.close());
  settings.addEventListener("click", (event) => {
    if (event.target !== settings) return;
    const bounds = settings.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom) {
      settings.close();
    }
  });
  sync();
  settings.append(heading, controls, widthHelp, widthStatus);
  document.body.append(settings);
  navigation.append(trigger);
})();
