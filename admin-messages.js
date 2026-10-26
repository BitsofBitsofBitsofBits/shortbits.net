(() => {
  const section = document.querySelector("#message-library-editor");
  if (!section) return;
  const catalog = window.BITS_MESSAGE_CATALOG;
  const get = (id) => document.getElementById(`message-${id}`);
  const profile = get("profile");
  const category = get("category");
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
  let markupTarget = text;
  const preview = get("preview");
  const previous = get("page-previous");
  const next = get("page-next");
  const save = get("save");
  const remove = get("delete");
  const add = get("new");
  const formats = new Map();
  const poolForm = get("pool-form");
  const timezoneForm = get("timezone-form");
  let pools = [];
  let editingPool = null;
  let poolDirty = false;
  let poolReady = false;
  let page = 0;
  let total = 0;
  let selected = null;
  let dirty = false;
  let busy = false;
  let request = 0;
  let searchTimer;
  let selectedProfile = "standard";
  let selectedCategory = "messages";

  function report(message, state = "") {
    status.textContent = message;
    status.dataset.state = state;
  }
  function controls() {
    form.inert = busy || !poolReady;
    poolForm.inert = busy || !poolReady;
    timezoneForm.inert = busy || !poolReady;
    list.inert = busy;
    [save, add, profile, category, search].forEach((control) => { control.disabled = busy || !poolReady; });
    get("reload").disabled = busy;
    get("pool-delete").disabled = busy || !editingPool;
    remove.disabled = busy || selected === null;
    previous.disabled = busy || page === 0;
    next.disabled = busy || (page + 1) * 25 >= total;
  }
  function previewMessage() {
    const isWeighted = catalog.weighted(category.value);
    const option = {
      text: text.value, markup: markup.checked, colorful: isWeighted && colorful.checked,
      format: isWeighted ? Object.fromEntries([...formats].map(([key, input]) => [key, input.value])) : {},
    };
    window.BITS_MESSAGE_TEXT.render(preview, option);
    const supportsMistype = category.value === "messages";
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
    markupTarget = text;
    formats.forEach((input, key) => { input.value = row?.format[key] ?? ""; });
    get("editing-label").textContent = selected === null ? "NEW MESSAGE" : `EDITING MESSAGE ${selected}`;
    const isWeighted = catalog.weighted(category.value);
    get("weighted-options").hidden = !isWeighted;
    get("weighted-options").disabled = !isWeighted;
    previewMessage();
    controls();
  }
  function discard() {
    return (!dirty && !poolDirty) || window.confirm("Discard the unsaved message or pool changes?");
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
      edit();
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
      edit();
      if (!await load()) return;
      report("Message deleted. Remaining enabled entries will be used; empty pools use fallbacks.", "success");
    } catch (error) {
      console.error("Unable to delete message:", error);
      report(`Message deletion failed: ${error.message}`, "error");
    } finally { busy = false; controls(); }
  }
  async function load() {
    const current = ++request;
    report("Loading message library...");
    try {
      let query = adminClient.from("site_message_catalog").select("*", { count: "exact" })
        .eq("profile", profile.value).eq("category", category.value);
      if (search.value.trim()) query = query.ilike("text", `%${search.value.trim().replace(/[\\%_]/g, "\\$&")}%`);
      const { data, error, count } = await query.order("position").range(page * 25, page * 25 + 24);
      if (current !== request) return;
      if (error) throw error;
      if (!Array.isArray(data) || !Number.isInteger(count)) throw new Error("Message library returned invalid data.");
      data.forEach(catalog.validate);
      total = count;
      if (page > 0 && page * 25 >= total) { page = Math.max(0, Math.ceil(total / 25) - 1); return await load(); }
      list.replaceChildren(...data.map((row) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `${row.enabled ? "" : "[HIDDEN] "}${row.text.slice(0, 140)}`;
        const select = () => { if (discard()) { edit(row); focusEditor(); } };
        button.addEventListener("click", select);
        const actions = document.createElement("div");
        actions.className = "repeatable-admin-actions";
        for (const action of ["edit", "delete"]) {
          const control = document.createElement("button");
          control.type = "button";
          control.dataset.messageAction = action;
          control.textContent = action.toUpperCase();
          control.setAttribute("aria-label", `${action === "edit" ? "Edit" : "Delete"} message ${row.position}`);
          control.addEventListener("click", action === "edit" ? select : () => deleteMessage(row));
          actions.append(control);
        }
        item.append(button, actions);
        return item;
      }));
      get("page-label").textContent = `${total ? page * 25 + 1 : 0}-${Math.min(total, (page + 1) * 25)} of ${total}`;
      report(`${total} message(s) in this pool. Select one to edit, or add a message.`, "success");
      return true;
    } catch (error) {
      if (current !== request) return;
      list.replaceChildren();
      total = 0;
      console.error("Unable to load message library:", error);
      report(`Message library failed to load: ${error.message}. Check that its migrations are deployed; change a filter to retry.`, "error");
      return false;
    } finally {
      if (current === request) controls();
    }
  }
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
  [profile, category].forEach((filter) => filter.addEventListener("change", () => {
    if (!discard()) { profile.value = selectedProfile; category.value = selectedCategory; return; }
    selectedProfile = profile.value;
    selectedCategory = category.value;
    page = 0;
    editPool(pools.find((pool) => pool.id === profile.value));
    edit();
    load();
  }));
  search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
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
  add.addEventListener("click", () => { if (discard()) { edit(); focusEditor(); } });
  get("reload").addEventListener("click", () => { if (discard()) reloadLibrary(); });
  poolForm.addEventListener("input", () => { poolDirty = true; });
  get("pool-new").addEventListener("click", () => {
    if (!discard()) return;
    edit();
    editPool();
    get("pool-title").focus();
  });
  poolForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || (dirty && !window.confirm("Discard unsaved message changes and save this pool?"))) return;
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
      edit();
      await load();
      reportPool("Pool saved. Add messages below; public schedules refresh within five minutes on reload or refocus.", "success");
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
      edit();
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
      reportPool(`Calendar timezone saved: ${data.timezone}. Public calendars refresh within five minutes on reload or refocus.`, "success");
    } catch (error) {
      console.error("Unable to save message timezone:", error);
      reportPool(`Timezone save failed: ${error.message}`, "error");
    } finally { busy = false; controls(); }
  });
  previous.addEventListener("click", () => { page--; load(); });
  next.addEventListener("click", () => { page++; load(); });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
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
    } finally { busy = false; controls(); }
  });
  remove.addEventListener("click", () => { if (selected !== null) deleteMessage({ position: selected }); });
  window.addEventListener("admin:authenticated", reloadLibrary);
  edit();
})();
