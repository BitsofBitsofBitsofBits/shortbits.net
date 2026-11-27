export async function openThemePicker(picker) {
  if (await picker.getAttribute("open") !== null) return;
  await Promise.all([
    picker.evaluate(picker => new Promise(resolve => {
      const opened = event => {
        if (event.target !== picker || !picker.open) return;
        picker.removeEventListener("toggle", opened);
        resolve();
      };
      picker.addEventListener("toggle", opened);
    })),
    picker.locator(":scope > summary").click(),
  ]);
}

export async function applyThemeAndWait(page, entry) {
  await page.evaluate(entry => new Promise((resolve, reject) => {
    const previous = document.querySelector("#bits-theme-stylesheet");
    let current;
    const cleanup = () => {
      document.removeEventListener("load", loaded, true);
      document.removeEventListener("error", failed, true);
    };
    const loaded = event => { if (event.target === current) { cleanup(); resolve(); } };
    const failed = event => {
      if (event.target === current) { cleanup(); reject(new Error("Theme stylesheet failed to load.")); }
    };
    document.addEventListener("load", loaded, true);
    document.addEventListener("error", failed, true);
    try {
      window.BITS_THEME_PREFERENCE.apply(entry.theme, { scheme: entry.scheme, variant: entry.variant });
      current = document.querySelector("#bits-theme-stylesheet");
      if (!current || current === previous) { cleanup(); resolve(); }
    } catch (error) { cleanup(); reject(error); }
  }), entry);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

export async function chooseTheme(page, picker, theme, variant = null) {
  await openThemePicker(picker);
  const selector = `[data-theme="${theme}"]${variant ? `[data-variant="${variant}"]` : ""}`;
  const family = picker.locator(".theme-picker-list > .theme-picker-branch")
    .filter({ has: page.locator(selector) });
  if (await family.getAttribute("open") === null) await family.locator(":scope > summary").click();
  const branch = family.locator(":scope > .theme-picker-branch").filter({ has: page.locator(selector) });
  if (await branch.count() && await branch.getAttribute("open") === null) await branch.locator(":scope > summary").click();
  await family.locator(selector).first().click();
}
