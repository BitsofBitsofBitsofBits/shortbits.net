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
