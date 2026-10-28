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
  for (const [id, label] of Object.entries(window.BITS_MARKDOWN.fonts)) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = label;
    get("markup-font").append(option);
  }
  const customFontOption = document.createElement("option");
  customFontOption.value = "custom";
  customFontOption.textContent = "Custom...";
  get("markup-font").append(customFontOption);
  for (const [name, description] of Object.entries(window.BITS_MESSAGE_TEXT.variables)) {
    const term = document.createElement("dt");
    const code = document.createElement("code");
    code.textContent = `%${name}%`;
    term.append(code);
    const definition = document.createElement("dd");
    definition.textContent = description;
    get("variable-list").append(term, definition);
    const option = document.createElement("option");
    option.value = name;
    option.textContent = `%${name}%`;
    option.title = description;
    get("variable-select").append(option);
  }
  const paginations = [...section.querySelectorAll("[data-message-pagination]")];
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
  let poolTimezone = "America/Chicago";
  let poolDirty = false;
  let timezoneDirty = false;
  let poolReady = false;
  let page = 0;
  let pageSize = 25;
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
    get("pool-edit").disabled = blocked;
    get("pool-save").disabled = blocked || editingPool === "standard";
    get("pool-fields").disabled = editingPool === "standard";
    get("pool-delete").disabled = blocked || !editingPool?.startsWith("custom-");
    get("pool-reset").disabled = blocked || !pools.some(pool => pool.id === editingPool);
    remove.disabled = blocked || selected === null;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    paginations.forEach((navigation) => {
      navigation.querySelectorAll("[data-message-page]").forEach((button) => {
        const backwards = ["first", "previous"].includes(button.dataset.messagePage);
        button.disabled = blocked || (backwards ? page === 0 : page >= pageCount - 1);
      });
      const number = navigation.querySelector("[data-message-page-number]");
      if (number.options.length !== pageCount) {
        number.replaceChildren(...Array.from({ length: pageCount }, (_, index) => {
          const option = document.createElement("option");
          option.value = String(index);
          option.textContent = `${index + 1} of ${pageCount}`;
          return option;
        }));
      } else {
        [...number.options].forEach((option, index) => { option.textContent = `${index + 1} of ${pageCount}`; });
      }
      number.value = String(page);
      number.disabled = blocked || !total;
      const size = navigation.querySelector("[data-message-page-size]");
      size.value = String(pageSize);
      size.disabled = blocked;
      navigation.querySelector("[data-message-range]").textContent =
        `${total ? page * pageSize + 1 : 0}-${Math.min(total, (page + 1) * pageSize)} of ${total}${category.value === "bootMessages" ? " fixed entries" : ""}`;
    });
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
    const option = window.BITS_MESSAGE_TEXT.snapshot({
      text: text.value, markup: markup.checked, colorful: isWeighted && colorful.checked,
      format: isWeighted ? Object.fromEntries([...formats].map(([key, input]) => [key, input.value])) : {},
    });
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
    get("toolbar-target").textContent = `Editing: ${markupTarget === correctedText ? "corrected text" : "message text"}`;
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
    get("custom-font").hidden = true;
    get("custom-font-status").textContent = "";
    get("custom-font-family").value = "";
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
    get("pool-select").value = editingPool ?? "";
    get("pool-reset").hidden = !catalog.builtinProfiles.includes(editingPool) || editingPool === "standard"
      || !pools.some(value => value.id === editingPool);
    get("pool-delete").hidden = !editingPool?.startsWith("custom-");
    syncPoolSchedule();
    controls();
  }
  function selectedPool(id = profile.value) {
    if (id === "standard") return { id, title: "Standard / year-round", schedule: "automatic", mode: "additive", enabled: true };
    return pools.find(pool => pool.id === id) ?? catalog.builtinPool(id);
  }
  function syncPoolSchedule() {
    const builtin = catalog.builtinProfiles.includes(editingPool);
    const automatic = get("pool-schedule").value === "automatic";
    get("pool-schedule").querySelector('[value="automatic"]').disabled = !builtin;
    get("pool-dates").hidden = automatic;
    get("pool-start").disabled = automatic;
    get("pool-end").disabled = automatic;
    get("pool-start").required = !automatic;
    if (editingPool === "standard") {
      get("pool-summary").textContent = "Always active as the year-round fallback. Its messages remain editable in Messages; use New pool to add a schedule.";
      return;
    }
    const year = catalog.calendarDate(new Date(), poolTimezone).getFullYear();
    const defaults = builtin ? catalog.builtinSchedule(editingPool, year) : null;
    const dates = defaults?.ranges.map(range => range.start === range.end ? range.start : `${range.start} through ${range.end}`).join("; ");
    const rule = defaults ? `Built-in rule: ${defaults.rule} ${year}: ${dates || "no matching dates"}. ` : "";
    const enabled = get("pool-enabled").checked ? "Enabled" : "Disabled";
    const mode = get("pool-mode").value === "exclusive" ? "exclusive" : "additive";
    const range = automatic ? "automatic dates" : `${get("pool-schedule").value}: ${get("pool-start").value || "choose start"} through ${get("pool-end").value || get("pool-start").value || "choose end"}`;
    get("pool-summary").textContent = `${rule}Current settings: ${enabled}, ${mode}, ${range}. Calendar timezone: ${poolTimezone}.`;
  }
  async function loadPools(preferred = profile.value) {
    const [definitions, settings] = await Promise.all([
      adminClient.from("site_message_pools").select("*").order("title"),
      adminClient.from("site_message_settings").select("*").eq("id", "primary").single(),
    ]);
    if (definitions.error) throw definitions.error;
    if (settings.error) throw settings.error;
    if (!Array.isArray(definitions.data) || definitions.data.length >= 1000 || !settings.data) {
      throw new Error("Invalid pool settings or too many pool definitions (maximum 999).");
    }
    catalog.validateTimezone(settings.data.timezone);
    catalog.setAdminPools(definitions.data);
    pools = definitions.data;
    profile.replaceChildren(...catalog.profiles.map((value) => {
      const option = document.createElement("option");
      option.value = value;
      const pool = pools.find((item) => item.id === value);
      option.textContent = pool ? `${pool.enabled ? "" : "[DISABLED] "}${pool.title}`
        : value === "standard" ? "Standard / year-round" : catalog.builtinPool(value).title;
      return option;
    }));
    profile.value = catalog.profiles.includes(preferred) ? preferred : "standard";
    selectedProfile = profile.value;
    get("timezone").value = settings.data.timezone;
    poolTimezone = settings.data.timezone;
    timezoneDirty = false;
    poolReady = true;
    get("pool-select").replaceChildren(...[
      Object.assign(document.createElement("option"), { value: "", textContent: "New custom pool..." }),
      ...Array.from(profile.options, option => option.cloneNode(true)),
    ]);
    editPool(selectedPool());
    reportPool(`${pools.filter(pool => pool.id.startsWith("custom-")).length} custom pool(s), ${pools.filter(pool => !pool.id.startsWith("custom-")).length} built-in override(s). Dates use ${settings.data.timezone}.`, "success");
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
      const { data, error, count } = await query.order("position").range(page * pageSize, (page + 1) * pageSize - 1);
      if (current !== request) return;
      if (error) throw error;
      if (!Array.isArray(data) || !Number.isInteger(count)) throw new Error("Message library returned invalid data.");
      data.forEach(catalog.validate);
      total = count;
      if (page > 0 && page * pageSize >= total) { page = Math.max(0, Math.ceil(total / pageSize) - 1); return await load(); }
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
      const state = stateFilter.value === "all" ? "" : `${stateFilter.value} `;
      report(`${total} ${state}${noun} in this pool${filtered}. Select one to edit, or add a message.`, "success");
      return true;
    } catch (error) {
      if (current !== request) return;
      closeEditor();
      list.replaceChildren();
      pageRows = [];
      total = 0;
      page = 0;
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
    const labels = {
      color: "Text color", fontWeight: "Font weight", fontFamily: "Font family",
      fontSize: "Font size", fontStyle: "Font style", letterSpacing: "Letter spacing",
      textDecoration: "Text decoration", textTransform: "Text transform",
    };
    label.textContent = labels[key];
    input.maxLength = 200;
    input.placeholder = ({
      color: "#123456", fontWeight: "700", fontFamily: "Aptos, Arial, sans-serif",
      fontSize: "18px", fontStyle: "italic", letterSpacing: "0.05em",
      textDecoration: "underline", textTransform: "uppercase",
    })[key];
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
    editPool(selectedPool());
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
  form.addEventListener("input", (event) => {
    if (get("markup-toolbar").contains(event.target) && !get("weighted-options").contains(event.target)) return;
    dirty = true;
    previewMessage();
  });
  [text, correctedText].forEach((field) => field.addEventListener("focus", () => {
    markupTarget = field;
    get("toolbar-target").textContent = `Editing: ${field === correctedText ? "corrected text" : "message text"}`;
  }));
  function insertText({ open = "", close = "", variable } = {}) {
    const target = markupTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const content = variable ? `%${variable}%` : target.value.slice(start, end) || "words";
    if (target.value.length - (end - start) + open.length + content.length + close.length > target.maxLength) {
      report("The message would exceed 2,000 characters. Shorten it before inserting text or formatting.", "error");
      target.focus();
      return;
    }
    target.setRangeText(open + content + close, start, end, "end");
    if (!variable) {
      target.setSelectionRange(start + open.length, start + open.length + content.length);
      markup.checked = true;
    }
    dirty = true;
    previewMessage();
    target.focus();
  }
  const delimiters = { bold: ["**", "**"], italic: ["*", "*"], underline: ["++", "++"],
    strike: ["~~", "~~"], code: ["`", "`"], rainbow: ["{{color:rainbow|", "}}"] };
  section.querySelectorAll("[data-message-markup]").forEach((button) => button.addEventListener("click", () => {
    const type = button.dataset.messageMarkup;
    const [open, close] = type === "color" ? [`{{color:${get("markup-color").value}|`, "}}"] : delimiters[type];
    insertText({ open, close });
  }));
  for (const [id, directive] of [["markup-font", "font"], ["markup-size", "size"]]) {
    get(id).addEventListener("change", (event) => {
      const value = event.target.value;
      if (directive === "font" && value === "custom") {
        get("custom-font").hidden = false;
        get("custom-font-status").textContent = "";
        get("custom-font-family").focus();
      } else if (value) {
        if (directive === "font") get("custom-font").hidden = true;
        insertText({ open: `{{${directive}:${value}|`, close: "}}" });
      }
      event.target.value = "";
    });
  }
  get("custom-font-apply").addEventListener("click", () => {
    const family = window.BITS_MARKDOWN.customFontFamily(get("custom-font-family").value);
    if (!family) {
      get("custom-font-status").textContent = "Enter font names separated by commas (up to 200 characters), without CSS rules, URLs, or markup.";
      get("custom-font-family").focus();
      return;
    }
    insertText({ open: `{{font:custom:${family}|`, close: "}}" });
  });
  get("custom-font-cancel").addEventListener("click", () => {
    get("custom-font").hidden = true;
    get("custom-font-status").textContent = "";
    markupTarget.focus();
  });
  get("custom-font-family").addEventListener("input", () => { get("custom-font-status").textContent = ""; });
  get("custom-font-family").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      get("custom-font-apply").click();
    }
  });
  form.addEventListener("invalid", (event) => {
    if (get("defaults").contains(event.target)) get("defaults").open = true;
  }, true);
  section.querySelectorAll("[data-message-variable]").forEach((button) => button.addEventListener("click", () => {
    insertText({ variable: button.dataset.messageVariable });
  }));
  get("variable-select").addEventListener("change", () => {
    get("variable-insert").disabled = !get("variable-select").value;
  });
  get("variable-insert").addEventListener("click", () => {
    insertText({ variable: get("variable-select").value });
  });
  add.addEventListener("click", () => toggleEditor());
  get("cancel").addEventListener("click", () => { if (discardMessage()) closeEditor(true); });
  get("reload").addEventListener("click", () => { if (discard({ calendar: true })) reloadLibrary(); });
  poolForm.addEventListener("input", (event) => {
    if (event.target === get("pool-select")) return;
    poolDirty = true;
    syncPoolSchedule();
  });
  get("pool-schedule").addEventListener("change", syncPoolSchedule);
  get("pool-select").addEventListener("change", async () => {
    const id = get("pool-select").value;
    if (!discard()) { get("pool-select").value = editingPool ?? ""; return; }
    closeEditor();
    if (!id) { editPool(); return; }
    profile.value = id;
    selectedProfile = id;
    page = 0;
    editPool(selectedPool(id));
    await load();
  });
  get("pool-edit").addEventListener("click", () => {
    window.BITS_ADMIN_SHELL.showSubsection("messages", "pools");
    get("pool-select").focus();
  });
  get("pool-new").addEventListener("click", () => {
    if (!discard()) return;
    closeEditor();
    editPool();
    get("pool-title").focus();
  });
  poolForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || editingPool === "standard"
      || ((dirty || timezoneDirty) && !window.confirm("Discard unsaved message or calendar changes and save this pool?"))) return;
    busy = true;
    controls();
    try {
      const row = {
        id: editingPool ?? `custom-${crypto.randomUUID()}`, title: get("pool-title").value.trim(),
        schedule: get("pool-schedule").value,
        starts_on: get("pool-schedule").value === "automatic" ? null : get("pool-start").value,
        ends_on: get("pool-schedule").value === "automatic" ? null : get("pool-end").value || get("pool-start").value, mode: get("pool-mode").value,
        enabled: get("pool-enabled").checked, updated_at: new Date().toISOString(),
      };
      catalog.validatePool(row);
      const query = pools.some(pool => pool.id === editingPool) ? adminClient.from("site_message_pools").update(row).eq("id", editingPool)
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
    if (busy || !editingPool?.startsWith("custom-") || !discard()
      || !window.confirm("Permanently delete this custom pool AND ALL its messages, including hidden messages?")) return;
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
  get("pool-reset").addEventListener("click", async () => {
    if (busy || !catalog.builtinPool(editingPool) || !discard()
      || !window.confirm("Restore the built-in dates, behavior, name, and enabled state? This does not delete any messages.")) return;
    busy = true;
    controls();
    try {
      const id = editingPool;
      const { data, error } = await adminClient.from("site_message_pools").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("The override no longer exists. Reload the library.");
      await loadPools(id);
      page = 0;
      closeEditor();
      await load();
      reportPool("Built-in defaults restored. All messages were retained.", "success");
    } catch (error) {
      console.error("Unable to reset built-in message pool:", error);
      reportPool(`Pool reset failed: ${error.message}`, "error");
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
      poolTimezone = data.timezone;
      syncPoolSchedule();
      reportPool(`Calendar timezone saved: ${data.timezone}. Public calendars refresh within five minutes on reload or refocus.`, "success");
    } catch (error) {
      console.error("Unable to save message timezone:", error);
      reportPool(`Timezone save failed: ${error.message}`, "error");
    } finally { busy = false; controls(); }
  });
  timezoneForm.addEventListener("input", () => { timezoneDirty = true; });
  async function navigateMessages(targetPage, targetSize, control) {
    if (busy || loading || searching || !poolReady) return;
    if (!discardMessage()) { controls(); return; }
    closeEditor();
    page = targetPage;
    pageSize = targetSize;
    if (!await load()) return;
    const top = paginations[0];
    if (!top.contains(control)) {
      top.scrollIntoView({ block: "start" });
      top.querySelector(control.hasAttribute("data-message-page-size") || !total
        ? "[data-message-page-size]" : "[data-message-page-number]").focus({ preventScroll: true });
    } else if (control.disabled) {
      top.querySelector("[data-message-page-number]").focus({ preventScroll: true });
    }
  }
  paginations.forEach((navigation) => {
    navigation.querySelectorAll("[data-message-page]").forEach((button) => {
      button.addEventListener("click", () => {
        const targets = { first: 0, previous: page - 1, next: page + 1, last: Math.max(0, Math.ceil(total / pageSize) - 1) };
        navigateMessages(targets[button.dataset.messagePage], pageSize, button);
      });
    });
    const number = navigation.querySelector("[data-message-page-number]");
    number.addEventListener("change", () => navigateMessages(Number(number.value), pageSize, number));
    const size = navigation.querySelector("[data-message-page-size]");
    size.addEventListener("change", () => navigateMessages(0, Number(size.value), size));
  });
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
