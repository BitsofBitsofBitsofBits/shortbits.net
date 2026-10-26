(() => {
  const section = document.querySelector("#message-library-editor");
  if (!section) return;
  const catalog = window.BITS_MESSAGE_CATALOG;
  const get = (id) => document.getElementById(`message-${id}`);
  const profile = get("profile");
  const category = get("category");
  const stateFilter = get("state-filter");
  const search = get("search");
  const list = get("library-list");
  const form = get("library-form");
  const status = get("library-status");
  const text = get("text");
  const weight = get("weight");
  const colorful = get("colorful");
  const enabled = get("enabled");
  const markup = get("markup");
  const mistype = get("mistype");
  const correctedText = get("corrected-text");
  const author = get("author");
  let markupTarget = text;
  const preview = get("preview");
  const previous = get("page-previous");
  const next = get("page-next");
  const save = get("save");
  const remove = get("delete");
  const add = get("new");
  const panel = get("inline-panel");
  const editorHome = get("editor-home");
  const selectPage = get("select-page");
  const checked = new Set();
  let pageRows = [];
  let editorOpen = false;
  const formats = new Map();
  const poolForm = get("pool-form");
  const timezoneForm = get("timezone-form");
  let pools = [];
  let editingPool = null;
  let poolDirty = false;
  let timezoneDirty = false;
  let poolReady = false;
  let page = 0;
  let total = 0;
  let selected = null;
  let dirty = false;
  let busy = false;
  let loading = false;
  let searching = false;
  let request = 0;
  let searchTimer;
  let selectedProfile = "standard";
  let selectedCategory = "messages";
  let selectedState = "all";
  let selectedSearch = "";

  function report(message, state = "") {
    status.textContent = message;
    status.dataset.state = state;
  }
  function describePool() {
    const help = get("pool-help");
    const boot = category.value === "bootMessages";
    help.hidden = !boot;
    help.textContent = "";
    if (!boot) return;
    const generator = window.BITS_BOOT_MESSAGE_GENERATOR;
    const combinations = generator.combinations.toLocaleString("en-US");
    help.textContent = `This list edits fixed boot messages, not every possible boot line. `
      + `Entry counts follow the status and search filters; All entries includes disabled messages. `
      + `The built-in generator also combines ${generator.actions.length} actions, ${generator.subjects.length} subjects, `
      + `and ${generator.results.length} results/statuses: ${combinations} possible combinations. `
      + `Those generator parts are defined in code, not editable in this list. `
      + `Additive scheduled pools mix in extra fixed messages; a nonempty active exclusive boot pool replaces the normal fixed/generated mix. `
      + `Phase, theme, narrative, and event lines can add further variety.`;
  }
  function controls() {
    const blocked = busy || loading || !poolReady || searching;
    form.inert = blocked;
    poolForm.inert = blocked;
    timezoneForm.inert = blocked;
    list.inert = blocked;
    [save, add, get("cancel")].forEach((control) => { control.disabled = blocked; });
    [profile, category, stateFilter, search].forEach((control) => { control.disabled = busy || loading || !poolReady; });
    get("reload").disabled = busy || loading || searching;
    get("pool-delete").disabled = blocked || !editingPool;
    remove.disabled = blocked || selected === null;
    previous.disabled = blocked || page === 0;
    next.disabled = blocked || (page + 1) * 25 >= total;
    selectPage.disabled = blocked || !pageRows.length;
    selectPage.checked = pageRows.length > 0 && checked.size === pageRows.length;
    selectPage.indeterminate = checked.size > 0 && checked.size < pageRows.length;
    get("selected-count").textContent = `${checked.size} selected`;
    ["enable", "disable", "delete"].forEach((action) => {
      get(`bulk-${action}`).disabled = blocked || !checked.size;
    });
  }
  function previewMessage() {
    const isWeighted = catalog.weighted(category.value);
    const option = {
      text: text.value, markup: markup.checked, colorful: isWeighted && colorful.checked,
      format: isWeighted ? Object.fromEntries([...formats].map(([key, input]) => [key, input.value])) : {},
    };
    window.BITS_MESSAGE_TEXT.render(preview, option);
    const supportsMistype = category.value === "messages";
    get("author-options").hidden = !supportsMistype;
    get("author-options").disabled = !supportsMistype;
    const attribution = supportsMistype ? author.value.trim() : "";
    get("author-preview").hidden = !attribution;
    get("author-preview").textContent = attribution ? `Author: ${attribution}` : "";
    get("mistype-options").hidden = !supportsMistype;
    get("mistype-options").disabled = !supportsMistype;
    const corrects = supportsMistype && mistype.checked;
    correctedText.disabled = !corrects;
    correctedText.required = corrects;
    if (!corrects && markupTarget === correctedText) markupTarget = text;
    get("corrected-preview-container").hidden = !corrects;
    if (corrects) window.BITS_MESSAGE_TEXT.render(get("corrected-preview"), { ...option, text: correctedText.value });
    else get("corrected-preview").replaceChildren();
  }
  function edit(row = null) {
    selected = row?.position ?? null;
    dirty = false;
    text.value = row?.text ?? "";
    weight.value = row?.weight ?? 1;
    colorful.checked = row?.colorful ?? false;
    enabled.checked = row?.enabled ?? false;
    markup.checked = row?.markup ?? false;
    mistype.checked = row?.corrected_text != null;
    correctedText.value = row?.corrected_text ?? "";
    author.value = row?.author ?? "";
    markupTarget = text;
    formats.forEach((input, key) => { input.value = row?.format[key] ?? ""; });
    get("editing-label").textContent = selected === null ? "NEW MESSAGE" : `EDITING MESSAGE ${selected}`;
    const isWeighted = catalog.weighted(category.value);
    get("weighted-options").hidden = !isWeighted;
    get("weighted-options").disabled = !isWeighted;
    previewMessage();
    controls();
  }
  function discard({ calendar = false } = {}) {
    return (!dirty && !poolDirty && (!calendar || !timezoneDirty)) ||
      window.confirm(calendar ? "Discard the unsaved message, pool, or calendar changes?" : "Discard the unsaved message or pool changes?");
  }
  function discardMessage() {
    return !dirty || window.confirm("Discard the unsaved message changes?");
  }
  function syncEditorControls() {
    add.setAttribute("aria-expanded", String(editorOpen && selected === null));
    list.querySelectorAll("[data-message-toggle]").forEach((button) => {
      button.setAttribute("aria-expanded", String(editorOpen && Number(button.dataset.messageToggle) === selected));
    });
    list.querySelectorAll("li").forEach((item) => {
      item.classList.toggle("is-editing", editorOpen && Number(item.dataset.messagePosition) === selected);
    });
  }
  function parkEditor() {
    panel.hidden = true;
    editorHome.append(panel);
  }
  function closeEditor(focus = false) {
    const trigger = selected === null ? add : list.querySelector(`[data-message-toggle="${selected}"]`);
    editorOpen = false;
    parkEditor();
    edit();
    syncEditorControls();
    if (focus) (trigger ?? add).focus();
  }
  function placeEditor(animate = false) {
    const host = selected === null ? get("new-panel-slot") : list.querySelector(`[data-message-position="${selected}"]`);
    if (!host) { closeEditor(); return; }
    host.append(panel);
    panel.hidden = false;
    syncEditorControls();
    if (animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      panel.animate([{ height: "0px", opacity: 0 }, { height: `${panel.scrollHeight}px`, opacity: 1 }], {
        duration: 180, easing: "ease-out",
      });
    }
  }
  function toggleEditor(row = null) {
    if (busy || loading || searching || !discardMessage()) return;
    if (editorOpen && selected === (row?.position ?? null)) { closeEditor(true); return; }
    edit(row);
    editorOpen = true;
    placeEditor(true);
    focusEditor();
  }
  function focusEditor() {
    form.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    text.focus({ preventScroll: true });
  }
  function reportPool(message, state = "") {
    get("pool-status").textContent = message;
    get("pool-status").dataset.state = state;
  }
  function editPool(pool = null) {
    editingPool = pool?.id ?? null;
    poolDirty = false;
    get("pool-label").textContent = pool ? `EDITING POOL: ${pool.title}` : "NEW CUSTOM POOL";
    get("pool-title").value = pool?.title ?? "";
    get("pool-schedule").value = pool?.schedule ?? "annual";
    get("pool-start").value = pool?.starts_on ?? "";
    get("pool-end").value = pool?.ends_on ?? "";
    get("pool-mode").value = pool?.mode ?? "additive";
    get("pool-enabled").checked = pool?.enabled ?? false;
    controls();
  }
  async function loadPools(preferred = profile.value) {
    const [definitions, settings] = await Promise.all([
      adminClient.from("site_message_pools").select("*").order("title"),
      adminClient.from("site_message_settings").select("*").eq("id", "primary").single(),
    ]);
    if (definitions.error) throw definitions.error;
    if (settings.error) throw settings.error;
    if (!Array.isArray(definitions.data) || definitions.data.length >= 1000 || !settings.data) {
      throw new Error("Invalid pool settings or too many custom pools (maximum 999).");
    }
    catalog.validateTimezone(settings.data.timezone);
    catalog.setAdminPools(definitions.data);
    pools = definitions.data;
    profile.replaceChildren(...catalog.profiles.map((value) => {
      const option = document.createElement("option");
      option.value = value;
      const pool = pools.find((item) => item.id === value);
      option.textContent = pool ? `${pool.enabled ? "" : "[DISABLED] "}${pool.title}` : value === "standard" ? "Standard / year-round" : value.replaceAll("-", " ");
      return option;
    }));
    profile.value = catalog.profiles.includes(preferred) ? preferred : "standard";
    selectedProfile = profile.value;
    get("timezone").value = settings.data.timezone;
    timezoneDirty = false;
    poolReady = true;
    editPool(pools.find((pool) => pool.id === profile.value));
    reportPool(`${pools.length} custom pool(s). Dates use ${settings.data.timezone}.`, "success");
  }
  async function reloadLibrary() {
    busy = true;
    controls();
    try {
      await loadPools();
      page = 0;
      closeEditor();
      await load();
    } catch (error) {
      console.error("Unable to load message pool settings:", error);
      report(`Message pool settings failed to load: ${error.message}. Check the scheduled-pools migration, then reload the library.`, "error");
      reportPool(`Pool settings failed to load: ${error.message}`, "error");
    } finally { busy = false; controls(); }
  }
  async function deleteMessage(row) {
    if (busy || !discard() || !window.confirm(`Delete message ${row.position} permanently? Empty pools use their fallback.`)) return;
    busy = true;
    controls();
    try {
      const { data, error } = await adminClient.from("site_message_catalog").delete().eq("position", row.position).select("position");
      if (error) throw error;
      if (!data?.length) throw new Error("The message no longer exists. Reload the library.");
      closeEditor();
      if (!await load()) return;
      report("Message deleted. Remaining enabled entries will be used; empty pools use fallbacks.", "success");
    } catch (error) {
      console.error("Unable to delete message:", error);
      report(`Message deletion failed: ${error.message}`, "error");
    } finally { busy = false; controls(); }
  }
  async function load() {
    const current = ++request;
    window.clearTimeout(searchTimer);
    searching = false;
    loading = true;
    checked.clear();
    pageRows = [];
    controls();
    report("Loading message library...");
    describePool();
    try {
      let query = adminClient.from("site_message_catalog").select("*", { count: "exact" })
        .eq("profile", profile.value).eq("category", category.value);
      if (stateFilter.value !== "all") query = query.eq("enabled", stateFilter.value === "enabled");
      if (search.value.trim()) query = query.ilike("text", `%${search.value.trim().replace(/[\\%_]/g, "\\$&")}%`);
      const { data, error, count } = await query.order("position").range(page * 25, page * 25 + 24);
      if (current !== request) return;
      if (error) throw error;
      if (!Array.isArray(data) || !Number.isInteger(count)) throw new Error("Message library returned invalid data.");
      data.forEach(catalog.validate);
      total = count;
      if (page > 0 && page * 25 >= total) { page = Math.max(0, Math.ceil(total / 25) - 1); return await load(); }
      parkEditor();
      pageRows = data;
      list.replaceChildren(...data.map((row) => {
        const item = document.createElement("li");
        item.dataset.messagePosition = String(row.position);
        const header = document.createElement("div");
        header.className = "message-row-header";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.dataset.messageSelect = String(row.position);
        checkbox.setAttribute("aria-label", `Select message ${row.position}`);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) checked.add(row.position);
          else checked.delete(row.position);
          controls();
        });
        const button = document.createElement("button");
        button.type = "button";
        button.className = "message-row-text";
        button.dataset.messageToggle = String(row.position);
        button.setAttribute("aria-controls", panel.id);
        button.textContent = row.text.slice(0, 140) + (row.author ? ` - ${row.author}` : "");
        const select = () => toggleEditor(row);
        button.addEventListener("click", select);
        const badge = document.createElement("span");
        badge.className = `message-row-state${row.enabled ? " is-enabled" : ""}`;
        badge.textContent = row.enabled ? "Enabled" : "Disabled";
        header.append(checkbox, button, badge);
        const actions = document.createElement("div");
        actions.className = "repeatable-admin-actions";
        for (const action of ["edit", "delete"]) {
          const control = document.createElement("button");
          control.type = "button";
          control.dataset.messageAction = action;
          control.textContent = action.toUpperCase();
          control.setAttribute("aria-label", `${action === "edit" ? "Edit" : "Delete"} message ${row.position}`);
          if (action === "edit") {
            control.dataset.messageToggle = String(row.position);
            control.setAttribute("aria-controls", panel.id);
          }
          control.addEventListener("click", action === "edit" ? select : () => deleteMessage(row));
          actions.append(control);
        }
        item.append(header, actions);
        return item;
      }));
      if (!data.length) {
        const empty = document.createElement("li");
        empty.className = "message-library-empty";
        empty.textContent = "No messages match this pool, status, and search. Add a message or change the filters.";
        list.append(empty);
      }
      if (editorOpen) placeEditor();
      else syncEditorControls();
      const boot = category.value === "bootMessages";
      const noun = boot ? "fixed message(s)" : "message(s)";
      const filtered = search.value.trim() ? " matching this search" : "";
      get("page-label").textContent = `${total ? page * 25 + 1 : 0}-${Math.min(total, (page + 1) * 25)} of ${total}${boot ? " fixed entries" : ""}`;
      const state = stateFilter.value === "all" ? "" : `${stateFilter.value} `;
      report(`${total} ${state}${noun} in this pool${filtered}. Select one to edit, or add a message.`, "success");
      return true;
    } catch (error) {
      if (current !== request) return;
      closeEditor();
      list.replaceChildren();
      pageRows = [];
      total = 0;
      console.error("Unable to load message library:", error);
      report(`Message library failed to load: ${error.message}. Check that its migrations are deployed; change a filter to retry.`, "error");
      return false;
    } finally {
      if (current === request) { loading = false; controls(); }
    }
  }
  async function bulkAction(action) {
    if (busy || loading || searching || !checked.size || !discardMessage()) return;
    const ids = [...checked];
    const verb = { enable: "enabled", disable: "disabled", delete: "deleted" }[action];
    const warning = action === "delete" ? " This is permanent. Empty pools use their fallback." : "";
    if (!window.confirm(`${action.toUpperCase()} ${ids.length} selected message(s) on this page?${warning}`)) return;
    busy = true;
    controls();
    try {
      const table = adminClient.from("site_message_catalog");
      const query = action === "delete" ? table.delete() : table.update({
        enabled: action === "enable", updated_at: new Date().toISOString(),
      });
      const { data, error } = await query.eq("profile", selectedProfile).eq("category", selectedCategory)
        .in("position", ids).select("position");
      if (error) throw error;
      if (!Array.isArray(data) || data.some((row) => !ids.includes(row.position)) ||
          new Set(data.map((row) => row.position)).size !== data.length) {
        throw new Error("The database returned an invalid bulk result. Reload the library before trying again.");
      }
      closeEditor();
      if (!await load()) return;
      if (data.length !== ids.length) {
        throw new Error(`${data.length} of ${ids.length} selected messages were ${verb}. Other entries changed or no longer exist; the page has been reloaded.`);
      }
      report(`${data.length} selected message(s) ${verb}.${action === "enable" ? " Disabled pools still remain hidden." : ""}`, "success");
    } catch (error) {
      console.error("Unable to apply bulk message action:", error);
      report(`Bulk ${action} failed: ${error.message}`, "error");
    } finally {
      busy = false;
      controls();
      (checked.size ? get(`bulk-${action}`) : pageRows.length ? selectPage : add).focus({ preventScroll: true });
    }
  }
  selectPage.addEventListener("change", () => {
    checked.clear();
    list.querySelectorAll("[data-message-select]").forEach((checkbox) => {
      checkbox.checked = selectPage.checked;
      if (checkbox.checked) checked.add(Number(checkbox.dataset.messageSelect));
    });
    controls();
  });
  ["enable", "disable", "delete"].forEach((action) => {
    get(`bulk-${action}`).addEventListener("click", () => bulkAction(action));
  });
  for (const value of catalog.profiles) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value === "standard" ? "Standard / year-round" : value.replaceAll("-", " ");
    profile.append(option);
  }
  for (const [key, label] of Object.entries(catalog.categories)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = label;
    category.append(option);
  }
  for (const key of catalog.styles) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    label.textContent = key;
    input.maxLength = 200;
    input.dataset.messageFormat = key;
    label.append(input);
    formats.set(key, input);
    get("format-fields").append(label);
  }
  [profile, category, stateFilter].forEach((filter) => filter.addEventListener("change", () => {
    if (!discard()) {
      profile.value = selectedProfile;
      category.value = selectedCategory;
      stateFilter.value = selectedState;
      return;
    }
    selectedProfile = profile.value;
    selectedCategory = category.value;
    selectedState = stateFilter.value;
    page = 0;
    editPool(pools.find((pool) => pool.id === profile.value));
    closeEditor();
    load();
  }));
  search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    if (!discardMessage()) { search.value = selectedSearch; return; }
    selectedSearch = search.value;
    closeEditor();
    checked.clear();
    list.querySelectorAll("[data-message-select]").forEach((checkbox) => { checkbox.checked = false; });
    searching = true;
    controls();
    searchTimer = window.setTimeout(() => { page = 0; load(); }, 250);
  });
  form.addEventListener("input", () => { dirty = true; previewMessage(); });
  [text, correctedText].forEach((field) => field.addEventListener("focus", () => { markupTarget = field; }));
  const delimiters = { bold: ["**", "**"], italic: ["*", "*"], underline: ["++", "++"],
    strike: ["~~", "~~"], code: ["`", "`"], rainbow: ["{{color:rainbow|", "}}"] };
  section.querySelectorAll("[data-message-markup]").forEach((button) => button.addEventListener("click", () => {
    const type = button.dataset.messageMarkup;
    const [open, close] = type === "color" ? [`{{color:${get("markup-color").value}|`, "}}"] : delimiters[type];
    const target = markupTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const selection = target.value.slice(start, end) || "words";
    if (target.value.length - (end - start) + open.length + selection.length + close.length > target.maxLength) {
      report("The formatted message would exceed 2,000 characters. Shorten it before adding markup.", "error");
      return;
    }
    target.setRangeText(open + selection + close, start, end, "select");
    target.setSelectionRange(start + open.length, start + open.length + selection.length);
    markup.checked = true;
    dirty = true;
    previewMessage();
    target.focus();
  }));
  add.addEventListener("click", () => toggleEditor());
  get("cancel").addEventListener("click", () => { if (discardMessage()) closeEditor(true); });
  get("reload").addEventListener("click", () => { if (discard({ calendar: true })) reloadLibrary(); });
  poolForm.addEventListener("input", () => { poolDirty = true; });
  get("pool-new").addEventListener("click", () => {
    if (!discard()) return;
    closeEditor();
    editPool();
    get("pool-title").focus();
  });
  poolForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || ((dirty || timezoneDirty) && !window.confirm("Discard unsaved message or calendar changes and save this pool?"))) return;
    busy = true;
    controls();
    try {
      const row = {
        id: editingPool ?? `custom-${crypto.randomUUID()}`, title: get("pool-title").value.trim(),
        schedule: get("pool-schedule").value, starts_on: get("pool-start").value,
        ends_on: get("pool-end").value || get("pool-start").value, mode: get("pool-mode").value,
        enabled: get("pool-enabled").checked, updated_at: new Date().toISOString(),
      };
      catalog.validatePool(row);
      const query = editingPool ? adminClient.from("site_message_pools").update(row).eq("id", editingPool)
        : adminClient.from("site_message_pools").insert(row);
      const { data, error } = await query.select("*").single();
      if (error) throw error;
      if (!data) throw new Error("The pool was not saved. Reload the library.");
      editPool(data);
      await loadPools(row.id);
      page = 0;
      closeEditor();
      await load();
      reportPool("Pool saved. Open Messages to add entries; public schedules refresh within five minutes on reload or refocus.", "success");
    } catch (error) {
      console.error("Unable to save message pool:", error);
      reportPool(`Pool save failed: ${error.message}`, "error");
    } finally { busy = false; controls(); }
  });
  get("pool-delete").addEventListener("click", async () => {
    if (busy || !editingPool || !window.confirm("Permanently delete this custom pool AND ALL its messages, including hidden messages?")) return;
    busy = true;
    controls();
    try {
      const { data, error } = await adminClient.from("site_message_pools").delete().eq("id", editingPool).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("The pool no longer exists. Reload the library.");
      await loadPools("standard");
      page = 0;
      closeEditor();
      await load();
      reportPool("Custom pool and its messages deleted.", "success");
    } catch (error) {
      console.error("Unable to delete message pool:", error);
      reportPool(`Pool deletion failed: ${error.message}`, "error");
    } finally { busy = false; controls(); }
  });
  timezoneForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    controls();
    try {
      const timezone = catalog.validateTimezone(get("timezone").value.trim());
      const { data, error } = await adminClient.from("site_message_settings")
        .update({ timezone, updated_at: new Date().toISOString() }).eq("id", "primary").select("*").single();
      if (error) throw error;
      if (!data) throw new Error("The calendar settings were not saved. Reload the library.");
      timezoneDirty = false;
      reportPool(`Calendar timezone saved: ${data.timezone}. Public calendars refresh within five minutes on reload or refocus.`, "success");
    } catch (error) {
      console.error("Unable to save message timezone:", error);
      reportPool(`Timezone save failed: ${error.message}`, "error");
    } finally { busy = false; controls(); }
  });
  timezoneForm.addEventListener("input", () => { timezoneDirty = true; });
  previous.addEventListener("click", () => { if (discardMessage()) { closeEditor(); page--; load(); } });
  next.addEventListener("click", () => { if (discardMessage()) { closeEditor(); page++; load(); } });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    const focusTarget = panel.contains(document.activeElement) ? document.activeElement : null;
    busy = true;
    controls();
    report("Saving message...");
    try {
      let position = selected;
      if (position === null) {
        const { data, error } = await adminClient.from("site_message_catalog").select("position").order("position", { ascending: false }).limit(1);
        if (error) throw error;
        position = (data[0]?.position ?? 0) + 1;
      }
      const isWeighted = catalog.weighted(category.value);
      const row = {
        position, profile: profile.value, category: category.value, text: text.value.trim(),
        weight: isWeighted ? Number(weight.value) : 1, colorful: isWeighted && colorful.checked,
        format: isWeighted ? Object.fromEntries([...formats].filter(([, input]) => input.value.trim())
          .map(([key, input]) => [key, input.value.trim()])) : {},
        enabled: enabled.checked, updated_at: new Date().toISOString(),
        markup: markup.checked,
        corrected_text: category.value === "messages" && mistype.checked ? correctedText.value.trim() : null,
        author: category.value === "messages" ? author.value.trim() || null : null,
      };
      catalog.validate(row);
      const query = selected === null ? adminClient.from("site_message_catalog").insert(row)
        : adminClient.from("site_message_catalog").update(row).eq("position", selected);
      const { data, error } = await query.select("*").single();
      if (error) throw error;
      if (!data) throw new Error("The message was not saved. Reload the library and try again.");
      edit(data);
      if (!await load()) return;
      report("Message saved. Public messages refresh within five minutes on reload or refocus; cached/bundled fallbacks remain available.", "success");
    } catch (error) {
      console.error("Unable to save message:", error);
      report(`Message save failed: ${error.message}`, "error");
    } finally {
      busy = false;
      controls();
      if (focusTarget) (editorOpen ? focusTarget : add).focus({ preventScroll: true });
    }
  });
  remove.addEventListener("click", () => { if (selected !== null) deleteMessage({ position: selected }); });
  window.addEventListener("admin:authenticated", reloadLibrary);
  window.addEventListener("beforeunload", (event) => {
    if (!dirty && !poolDirty && !timezoneDirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
  edit();
})();
