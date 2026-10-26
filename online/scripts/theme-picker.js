(() => {
  let pickerIndex = 0;

  function bind(select, variantSelect) {
    const preference = window.BITS_THEME_PREFERENCE;
    const id = `theme-picker-${++pickerIndex}`;
    const picker = document.createElement("details");
    picker.className = "theme-picker";
    const summary = document.createElement("summary");
    const list = document.createElement("div");
    list.className = "theme-picker-list";
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", "Theme families");
    picker.append(summary, list);
    const buttons = [];
    const branches = [];
    const labels = new Map();

    function branch(parent, name, level) {
      const details = document.createElement("details");
      details.className = "theme-picker-branch";
      details.name = `${id}-${level}`;
      const heading = document.createElement("summary");
      heading.textContent = name;
      details.append(heading);
      parent.append(details);
      branches.push(details);
      return details;
    }

    function choice(parent, theme, text, variant = null) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "theme-picker-choice";
      button.textContent = text;
      button.dataset.theme = theme.id;
      if (variant) button.dataset.variant = variant.id;
      button.addEventListener("click", () => {
        select.value = theme.id;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        if (variant) {
          variantSelect.value = variant.id;
          variantSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
        picker.open = false;
        const appMenu = picker.closest(".app-menu");
        (appMenu?.querySelector("summary") ?? summary).focus();
      });
      parent.append(button);
      buttons.push(button);
    }

    for (const group of preference.getGroups()) {
      const family = branch(list, group.name, "family");
      for (const theme of group.themes) {
        const name = theme.id === "macos" ? "Modern macOS" : theme.name;
        const label = `${name}${theme.experimental ? " (experimental)" : ""}`;
        labels.set(theme.id, `${group.name} / ${name}`);
        if (theme.variants?.length) {
          const submenu = branch(family, label, group.name);
          for (const variant of theme.variants) choice(submenu, theme, variant.name, variant);
        } else {
          choice(family, theme, label);
        }
      }
    }

    function sync() {
      const themeId = document.documentElement.dataset.interfaceTheme;
      const variant = preference.getVariant(themeId);
      summary.textContent = `${labels.get(themeId)}${variant ? ` / ${variant.name}` : ""}`;
      summary.setAttribute("aria-label", `Choose theme. Current: ${summary.textContent}`);
      for (const button of buttons) {
        button.setAttribute("aria-pressed", String(button.dataset.theme === themeId
          && (!button.dataset.variant || button.dataset.variant === variant?.id)));
      }
    }

    picker.addEventListener("toggle", () => {
      if (!picker.open) return;
      for (const details of branches) {
        details.open = Boolean(details.querySelector('[aria-pressed="true"]'));
      }
    });
    picker.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      const details = event.target.closest("details[open]");
      if (details?.open) {
        details.open = false;
        details.querySelector("summary").focus();
        event.preventDefault();
        event.stopPropagation();
      }
    });
    select.closest("label").classList.add("theme-picker-native");
    variantSelect.closest("label").classList.add("theme-picker-native");
    select.closest("label").before(picker);
    window.addEventListener("bits:theme-applied", sync);
    select.addEventListener("change", sync);
    variantSelect.addEventListener("change", sync);
    sync();
  }

  window.BITS_THEME_PICKER = { bind };
})();
