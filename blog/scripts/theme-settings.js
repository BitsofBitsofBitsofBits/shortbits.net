(() => {
  const navigation = document.querySelector(".public-nav");
  const preference = window.BITS_THEME_PREFERENCE;
  if (!navigation || !preference) return;

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
  theme.replaceChildren(...preference.buildOptions());
  const sync = () => { theme.value = document.documentElement.dataset.interfaceTheme; };
  theme.addEventListener("change", () => {
    preference.select(theme.value);
    preference.apply(theme.value);
  });
  preference.bindColorSchemeSelect(scheme);
  preference.bindVariantSelect(variant);
  window.addEventListener("bits:theme-applied", sync);
  window.addEventListener("storage", (event) => {
    if (event.key === null || ["bits-interface-theme", preference.choiceKey, preference.dismissalKey].includes(event.key)) {
      preference.apply(preference.resolve());
    }
  });
  window.addEventListener("pageshow", () => preference.apply(preference.resolve()));
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
  settings.append(heading, controls);
  document.body.append(settings);
  navigation.append(trigger);
})();
