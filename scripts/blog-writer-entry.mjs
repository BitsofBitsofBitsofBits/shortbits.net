import { Editor, Node, Mark, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { DraftAutosave } from "./blog-draft-autosave.mjs";

const content = window.BITS_BLOG_CONTENT;
const markdown = window.BITS_MARKDOWN;
const taxonomy = window.BITS_BLOG_TAXONOMY;
let taxonomyCatalog = { tags: [], series: [] };
const form = document.querySelector("#writer-form");
const status = document.querySelector("#writer-status");
const workspace = document.querySelector("#writer-workspace");
const save = document.querySelector("#writer-save");
const dialog = document.querySelector("#writer-dialog");
const value = document.querySelector("#writer-value");
const linkText = document.querySelector("#writer-link-text");
const source = document.querySelector("#writer-source");
const colorSelect = document.querySelector("#writer-color");
const customColorControls = document.querySelector("#writer-custom-color-controls");
const customColor = document.querySelector("#writer-custom-color");
const customColorHex = document.querySelector("#writer-custom-color-hex");
const customColorError = document.querySelector("#writer-custom-color-error");
const syncCustomColor = window.BITS_MARKDOWN.bindHexColorInputs(customColor, customColorHex);
customColorHex.addEventListener("input", () => { customColorError.textContent = ""; });
const headingSelect = document.querySelector("#writer-heading");
let client, editor, authorized = false, busy = false, id = "", version = null, original = "", baseline = "", mode = "";
let detailBusy = false;
let autosave, draftState, loading = false, loadedTime = "", loadedTimeValue = "", historyRequest = 0, selectedRevision = null;
const recovery = document.querySelector("#writer-recovery");
const historyDialog = document.querySelector("#writer-history-dialog");
const historyStatus = document.querySelector("#writer-history-status");
const historyList = document.querySelector("#writer-history-list");
const historyPreview = document.querySelector("#writer-history-preview");
const restoreButton = document.querySelector("#writer-history-restore");
const channel = new URLSearchParams(location.search).get("channel");
const opener = window.opener;
function report(message, error = false) {
  status.textContent = message;
  status.dataset.state = error ? "error" : "";
}
function snapshot() {
  return JSON.stringify(draftSnapshot());
}
function draftSnapshot() {
  const input = form.elements.published_at.value;
  return {
    title: form.elements.title.value, slug: form.elements.slug.value.trim().toLowerCase(), excerpt: form.elements.excerpt.value,
    body_markdown: original, body_rich: { version: 1, doc: editor.getJSON() },
    published_at: input === loadedTimeValue ? loadedTime || null : input ? new Date(input).toISOString() : null,
    ...taxonomy.captureFields(form, draftState?.snapshot, taxonomyCatalog),
  };
}
const dirty = () => authorized && Boolean(autosave?.dirty);
async function rpc(name, args, signal) {
  let query = client.rpc(name, args);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  if (!authorized) throw new Error("Your writer session is closed.");
  return data;
}
function updateDraftState(state) {
  if (!state?.draft_id || !state.snapshot || !Number.isInteger(state.revision) || state.revision < 0
    || (state.version !== null && !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(state.version))
    || Object.keys(state.snapshot).sort().join() !== "body_markdown,body_rich,excerpt,published_at,series,series_order,slug,tags,title") throw new Error("The server's draft state could not be confirmed. The taxonomy migration and compatible writer must be deployed together.");
  taxonomy.read(state.snapshot);
  draftState = state; id = state.draft_id; version = state.version;
  document.querySelector("#writer-publication-state").textContent = state.live?.published ? "Live article" : state.scheduled_at ? "Scheduled" : "Private draft";
  document.querySelector("#writer-cancel-schedule").hidden = !state.scheduled_at;
}
function startAutosave() {
  autosave?.stop();
  autosave = new DraftAutosave({
    capture: draftSnapshot, version: draftState.version,
    save: (request, signal) => {
      try { content.validate(request.snapshot.body_rich); }
      catch (error) { throw Object.assign(error, { definitive: true }); }
      try { taxonomy.read(request.snapshot); }
      catch (error) { throw Object.assign(error, { definitive: true, taxonomyInput: true }); }
      return rpc("save_blog_draft", {
        p_id: id, p_expected_version: request.version, p_base_public_version: draftState.base_public_version,
        p_snapshot: request.snapshot, p_request_id: request.requestId, p_checkpoint: request.checkpoint,
      }, signal);
    },
    onState: (state, error) => {
      recovery.hidden = state !== "error" && state !== "conflict";
      document.querySelector("#writer-retry").hidden = state === "conflict";
      if (state === "saving") report("Saving private draft...");
      else if (state === "dirty") report("Unsaved changes. Autosave pending.");
      else if (state === "saved") report("Private draft saved. The live article is unchanged.");
      else if (state === "idle") report("No private changes to save yet.");
      else if (error) report(`${state === "conflict" ? "Autosave paused: another editor changed this draft." : `Draft save failed: ${error.message}`} Local changes remain in this tab.`, true);
    },
    onSaved: state => {
      if (state.draft_id !== id) throw new Error("The response belongs to a different draft. Reload the latest draft before retrying.");
      updateDraftState(state); baseline = autosave.baseline;
      opener?.postMessage({ type: "bits:writer-draft-saved", channel, id, postId: state.post_id }, location.origin);
      history.replaceState(null, "", `?draft=${encodeURIComponent(id)}`);
    },
  });
  baseline = snapshot();
  recovery.hidden = true;
}
function changed() {
  if (!authorized || loading || !autosave || busy) return;
  try {
    taxonomy.read(draftSnapshot());
    if (autosave.error?.taxonomyInput) autosave.error = null;
    autosave.changed();
  }
  catch (error) {
    autosave.clearTimer(); autosave.clearMaxTimer();
    report(`${error.message} Complete valid tag and series details before autosaving. Local changes remain here.`, true);
  }
}
function closeDropdowns() {
  for (const menu of document.querySelectorAll(".writer-dropdown[open]")) menu.open = false;
}
for (const menu of document.querySelectorAll(".writer-dropdown")) {
  menu.addEventListener("toggle", () => {
    if (menu.open) for (const other of document.querySelectorAll(".writer-dropdown[open]")) if (other !== menu) other.open = false;
  });
}
document.addEventListener("pointerdown", event => {
  for (const menu of document.querySelectorAll(".writer-dropdown[open]")) if (!menu.contains(event.target)) menu.open = false;
});
document.addEventListener("focusin", event => {
  for (const menu of document.querySelectorAll(".writer-dropdown[open]")) if (!menu.contains(event.target)) menu.open = false;
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  const menu = document.querySelector(".writer-dropdown[open]");
  if (!menu) return;
  event.preventDefault();
  menu.open = false;
  menu.querySelector("summary").focus();
});
{
  const popup = document.querySelector("#writer-theme-dialog");
  const trigger = document.querySelector("#writer-theme-open");
  trigger.addEventListener("click", () => {
    if (!authorized) return;
    closeDropdowns();
    popup.showModal();
    trigger.setAttribute("aria-expanded", "true");
    (popup.querySelector(".theme-picker > summary") || popup.querySelector("button")).focus();
  });
  popup.querySelector("[data-writer-close]").addEventListener("click", () => popup.close());
  popup.addEventListener("close", () => trigger.setAttribute("aria-expanded", "false"));
  popup.addEventListener("click", event => {
    if (event.target !== popup) return;
    const box = popup.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) popup.close();
  });
}
const Legacy = Node.create({
  name: "legacyMarkdown", group: "block", atom: true, selectable: true,
  addAttributes() { return { source: { default: "" } }; },
  parseHTML() { return []; },
  renderHTML() { return ["div", { "data-protected-markdown": "true" }, "Protected original Markdown"]; },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("section");
      dom.className = "writer-legacy-block";
      dom.contentEditable = "false";
      const label = document.createElement("p");
      label.className = "writer-legacy-label";
      label.textContent = "Original Markdown preserved — select this section, then Edit protected Markdown.";
      dom.append(label, markdown.render(node.attrs.source));
      return { dom };
    };
  },
});
const Image = Node.create({
  name: "image", group: "block", atom: true,
  addAttributes() { return { src: { default: "" }, alt: { default: "" }, caption: { default: "" } }; },
  parseHTML() {
    return [{ tag: "figure.blog-markdown-image", getAttrs: element => ({
      src: element.querySelector("img")?.getAttribute("src"), alt: element.querySelector("img")?.alt ?? "",
      caption: element.querySelector("figcaption")?.textContent ?? "",
    }) }];
  },
  renderHTML({ node }) {
    return ["figure", { class: "blog-markdown-image" }, ["img", { src: node.attrs.src, alt: node.attrs.alt }],
      ...(node.attrs.caption ? [["figcaption", {}, node.attrs.caption]] : [])];
  },
});
const Style = Mark.create({
  name: "style",
  addAttributes() { return { color: { default: null }, font: { default: null }, size: { default: null } }; },
  parseHTML() {
    return [{ tag: "span", getAttrs: element => {
      const color = [...element.classList].find(c => c.startsWith("blog-text-color-"))?.slice(16) || element.style.color;
      const size = [...element.classList].find(c => c.startsWith("blog-text-size-"))?.slice(15);
      const font = element.style.fontFamily;
      if (color && !markdown.hexColor(color) && !/^(accent|red|orange|yellow|green|cyan|blue|purple|pink|white|muted|rainbow)$/.test(color)) return false;
      return color || size || font ? { color: color || null, size: size || null, font: font || null } : false;
    } }];
  },
  renderHTML({ HTMLAttributes }) {
    const a = HTMLAttributes;
    const classes = [];
    const styles = [];
    if (a.color) {
      const hex = markdown.hexColor(a.color);
      if (hex) styles.push(`color:${hex}`); else classes.push(`blog-text-color-${a.color}`);
    }
    if (a.font) styles.push(`font-family:${markdown.customFontFamily(a.font)}`);
    if (a.size) classes.push(`blog-text-size-${a.size}`);
    return ["span", mergeAttributes({ class: classes.join(" "), style: styles.join(";") }), 0];
  },
});
const Highlight = Mark.create({ name: "highlight", parseHTML: () => [{ tag: "mark" }], renderHTML: () => ["mark", {}, 0] });
function updateToolbar() {
  for (const button of document.querySelectorAll("[data-command][aria-pressed]")) button.setAttribute("aria-pressed", String(editor.isActive(button.dataset.command)));
  headingSelect.value = editor.isActive("heading") ? String(editor.getAttributes("heading").level) : "";
  const style = editor.getAttributes("style");
  for (const kind of ["font", "size"]) document.querySelector(`#writer-${kind}`).value = style[kind] || "";
  const color = style.color || "";
  const hex = markdown.hexColor(color);
  const preset = [...colorSelect.options].find(option => option.value.toLowerCase() === color.toLowerCase());
  colorSelect.value = preset?.value || (hex ? "custom" : "");
  customColorControls.hidden = colorSelect.value !== "custom";
  if (hex) {
    customColorHex.value = hex;
    syncCustomColor();
  }
}
document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && authorized) { event.preventDefault(); form.requestSubmit(); }
});
function load(post) {
  loading = true;
  original = post.body_markdown || "";
  if (post.body_rich) content.validate(post.body_rich);
  for (const name of ["title", "slug", "excerpt"]) form.elements[name].value = post[name] || "";
  taxonomy.populate(form, post);
  loadedTime = post.published_at || "";
  if (post.published_at) {
    const date = new Date(post.published_at);
    form.elements.published_at.value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  } else form.elements.published_at.value = "";
  loadedTimeValue = form.elements.published_at.value;
  editor.commands.setContent(post.body_rich?.doc || { type: "doc", content: original.trim()
    ? [{ type: "legacyMarkdown", attrs: { source: original } }, { type: "paragraph" }]
    : [{ type: "paragraph" }] });
  baseline = snapshot();
  loading = false;
}
async function openDraft(identity) {
  const [state, catalog] = await Promise.all([
    rpc("load_blog_draft", { p_id: identity || null }), rpc("list_blog_taxonomy", {}),
  ]);
  taxonomy.suggestions(form, catalog); taxonomyCatalog = catalog;
  updateDraftState(state); load(state.snapshot); startAutosave();
  report(original && !state.snapshot.body_rich ? "Original Markdown preserved. Autosaves stay private; import explicitly or edit its protected source." : "Autosave ready. Only Publish revision changes the live article.");
}
function showDialog(kind) {
  closeDropdowns();
  mode = kind; value.value = ""; source.value = ""; linkText.value = "";
  document.querySelector("#writer-link-text-label").hidden = kind !== "link";
  document.querySelector("#writer-value-title").textContent = kind === "link" ? "Link" : "Image URL";
  document.querySelector("#writer-dialog-error").textContent = "";
  document.querySelector("#writer-alt").value = "";
  document.querySelector("#writer-caption").value = "";
  document.querySelector("#writer-file").value = "";
  document.querySelector("#writer-file-label").hidden = kind !== "image";
  document.querySelector("#writer-upload-help").hidden = kind !== "image";
  for (const name of ["value", "alt", "caption", "source"]) document.querySelector(`#writer-${name}-label`).hidden =
    name === "source" ? kind !== "legacy" : name === "value" ? kind === "legacy" : kind !== "image";
  document.querySelector("#writer-dialog-title").textContent = kind === "legacy" ? "Edit protected original Markdown" : kind === "image" ? "Insert accessible image" : "Insert link";
  if (kind === "link") {
    if (editor.state.selection.node?.type.name === "legacyMarkdown") { report("Select editable text, not a protected Markdown section.", true); return; }
    if (editor.isActive("link")) editor.chain().extendMarkRange("link").run();
    value.value = editor.getAttributes("link").href || "";
    const { from, to } = editor.state.selection;
    linkText.value = editor.state.doc.textBetween(from, to, " ");
  }
  if (kind === "legacy") {
    const node = editor.state.selection.node;
    if (node?.type.name !== "legacyMarkdown") { report("Select the protected Markdown section first.", true); return; }
    source.value = node.attrs.source;
  }
  dialog.showModal();
  (kind === "legacy" ? source : kind === "link" ? linkText : value).focus();
}
function semantic(node) {
  if (node.nodeType === 3) return ["text", node.textContent];
  if (node.nodeType !== 1) return [...node.childNodes].map(semantic);
  if (["DIV", "TBODY", "THEAD"].includes(node.tagName)) return [...node.childNodes].map(semantic);
  const relevant = ["href", "src", "alt", "class", "style", "start", "colspan", "rowspan"];
  return [node.tagName, relevant.map(k => [k, node.getAttribute(k) || ""]).filter(([, v]) => v), [...node.childNodes].map(semantic)];
}
async function initialize() {
  try {
    client = window.createSiteSupabaseClient();
    const session = await client.auth.getSession();
    if (session.error) throw session.error;
    if (!session.data.session) { report("Sign in through Admin before opening the writer."); return; }
    const user = await client.auth.getUser();
    if (user.error || !user.data.user) throw new Error("Your session could not be verified. Sign in through Admin again.");
    authorized = true;
    editor = new Editor({
      element: document.querySelector("#writer-body"),
      extensions: [StarterKit.configure({ link: { openOnClick: false }, trailingNode: false }), TableKit.configure({ table: { resizable: false } }), TaskList, TaskItem.configure({ nested: false, HTMLAttributes: { "data-type": "taskItem" } }), Style, Highlight, Image, Legacy],
      content: { type: "doc", content: [{ type: "paragraph" }] },
      editorProps: { attributes: { role: "textbox", "aria-label": "Article body", "aria-multiline": "true", spellcheck: "true" } },
      onUpdate: () => { updateToolbar(); changed(); },
      onSelectionUpdate: updateToolbar,
    });
    const preference = window.BITS_THEME_PREFERENCE;
    const theme = document.querySelector("#writer-theme");
    const variant = document.querySelector("#writer-variant");
    theme.replaceChildren(...preference.buildOptions());
    theme.value = document.documentElement.dataset.interfaceTheme;
    theme.addEventListener("change", () => preference.apply(theme.value, { scheme: document.documentElement.dataset.colorScheme }));
    const scheme = document.querySelector("#writer-scheme");
    scheme.replaceChildren(...["dark", "light"].map(value => { const option = document.createElement("option"); option.value = value; option.textContent = value; return option; }));
    function syncTheme() {
      const root = document.documentElement;
      theme.value = root.dataset.interfaceTheme;
      const current = preference.getTheme(theme.value);
      variant.replaceChildren(...(current.variants ?? []).map(value => { const option = document.createElement("option"); option.value = value.id; option.textContent = value.name; return option; }));
      variant.value = root.dataset.themeVariant || ""; variant.disabled = !current.variants?.length;
      scheme.value = root.dataset.colorScheme;
      scheme.disabled = current.schemes?.length === 1;
    }
    syncTheme();
    scheme.addEventListener("change", () => preference.apply(theme.value, { scheme: scheme.value }));
    variant.addEventListener("change", () => preference.apply(theme.value, { variant: variant.value, scheme: document.documentElement.dataset.colorScheme }));
    window.addEventListener("bits:theme-applied", syncTheme);
    window.BITS_THEME_PICKER.bind(theme, variant);
    workspace.hidden = false;
    client.auth.onAuthStateChange(event => {
      if (event !== "SIGNED_OUT") return;
      for (const popup of document.querySelectorAll(".writer-popup[open]")) popup.close();
      closeDropdowns();
      authorized = false; autosave?.stop(); historyRequest++; historyPreview.replaceChildren(); historyList.replaceChildren(); selectedRevision = null;
      workspace.hidden = true; editor.destroy(); editor = null; original = ""; baseline = ""; draftState = null;
      form.reset(); taxonomyCatalog = { tags: [], series: [] }; taxonomy.suggestions(form, taxonomyCatalog);
      report("Signed out. Sign in through Admin to continue.");
    });
    if (opener && channel) {
      report("Waiting for your Admin draft...");
      let accepted = false;
      window.addEventListener("message", async event => {
        if (!authorized || accepted || event.origin !== location.origin || event.source !== opener || event.data?.type !== "bits:writer-draft" || event.data.channel !== channel) return;
        accepted = true;
        try {
          const post = event.data.post;
          await openDraft(post.id);
          if ((post.draft_version || null) !== draftState.version) {
            throw Object.assign(new Error("The Admin form is based on an older draft. Reopen it with the latest saved version before transferring edits."), { code: "40001" });
          }
          load(post); changed();
        } catch (error) { autosave?.pause(error); report(`Draft could not load: ${error.message}`, true); }
      });
      opener.postMessage({ type: "bits:writer-ready", channel }, location.origin);
      window.setTimeout(() => { if (!accepted) report("Admin did not provide the draft. Reopen the writer from Admin; your original draft is unchanged.", true); }, 10000);
    } else {
      const params = new URLSearchParams(location.search);
      await openDraft(params.get("draft") || params.get("post"));
    }
  } catch (error) { autosave?.stop(); authorized = false; workspace.hidden = true; report(`Writer could not open: ${error.message}`, true); }
}
document.querySelector(".writer-header a").addEventListener("click", event => {
  if (dirty() && !window.confirm("Leave without saving your article changes?")) event.preventDefault();
});
window.addEventListener("beforeunload", event => { if (dirty()) { event.preventDefault(); event.returnValue = ""; } });
form.addEventListener("input", event => {
  if (event.target.name === "series" && event.target.value.trim() && !form.elements.series_order.value) form.elements.series_order.value = "1";
  if (event.target.name) changed();
});
for (const button of document.querySelectorAll("[data-command]")) {
  button.addEventListener("mousedown", event => event.preventDefault());
  button.addEventListener("click", () => {
    const commands = { bold: "toggleBold", italic: "toggleItalic", underline: "toggleUnderline", strike: "toggleStrike", code: "toggleCode",
      bulletList: "toggleBulletList", orderedList: "toggleOrderedList", taskList: "toggleTaskList", blockquote: "toggleBlockquote", codeBlock: "toggleCodeBlock", undo: "undo", redo: "redo" };
    const command = button.dataset.command;
    if (!authorized) return;
    closeDropdowns();
    if (command === "highlight") editor.chain().focus().toggleMark("highlight").run();
    else if (command === "table") editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    else if (["addRowAfter", "addColumnAfter", "deleteTable"].includes(command)) editor.chain().focus()[command]().run();
    else editor.chain().focus()[commands[command]]().run();
    updateToolbar();
  });
}
headingSelect.addEventListener("change", () => {
  if (!authorized) return;
  const selected = headingSelect.value;
  closeDropdowns();
  if (editor.state.selection.node?.type.name === "legacyMarkdown") {
    report("Select editable article text, not a protected Markdown section.", true);
    updateToolbar();
    return;
  }
  const level = Number(selected);
  if (selected && (!Number.isInteger(level) || level < 1 || level > 6)) {
    report("Choose a supported heading level.", true);
    updateToolbar();
    return;
  }
  const chain = editor.chain().focus();
  const applied = (selected ? chain.setHeading({ level }) : chain.setParagraph()).run();
  updateToolbar();
  if (!applied) report("Place the cursor in editable article text to change its heading.", true);
});
document.querySelector("#writer-link").addEventListener("click", () => showDialog("link"));
document.querySelector("#writer-image").addEventListener("click", () => showDialog("image"));
document.querySelector("#writer-legacy").addEventListener("click", () => showDialog("legacy"));
document.querySelector("#writer-cancel").addEventListener("click", () => dialog.close());
dialog.addEventListener("cancel", event => { if (detailBusy) event.preventDefault(); });
document.querySelector("#writer-dialog-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!authorized || detailBusy) return;
  const apply = event.currentTarget.querySelector('[type="submit"]');
  const cancel = document.querySelector("#writer-cancel");
  detailBusy = true; apply.disabled = true; cancel.disabled = true;
  try {
    if (mode === "legacy") {
      if (!source.value.trim()) throw new Error("Protected source cannot be empty. Delete the selected section explicitly instead.");
      editor.chain().focus().updateAttributes("legacyMarkdown", { source: source.value }).run();
    } else if (mode === "link") {
      const href = content.url(value.value.trim());
      if (!linkText.value.trim()) throw new Error("Enter the text shown for this link.");
      const { from, to } = editor.state.selection;
      if (!editor.state.selection.empty && editor.state.doc.textBetween(from, to, " ") === linkText.value) {
        editor.chain().focus().setLink({ href }).run();
      } else editor.chain().focus().insertContent({ type: "text", text: linkText.value, marks: [{ type: "link", attrs: { href } }] }).run();
    }
    else {
      const alt = document.querySelector("#writer-alt").value.trim();
      if (!alt) throw new Error("Accessible alt text is required.");
      const file = document.querySelector("#writer-file").files[0];
      let src = value.value.trim();
      if (file) {
        const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
        if (!extensions[file.type] || file.size > 5 * 1024 * 1024) throw new Error("Use a JPEG, PNG, WebP or GIF image no larger than 5 MB.");
        const path = `${new Date().toISOString().slice(0, 7).replace("-", "/")}/${crypto.randomUUID()}.${extensions[file.type]}`;
        document.querySelector("#writer-dialog-error").textContent = "Uploading image...";
        const result = await client.storage.from("blog-images").upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: false });
        if (result.error) throw new Error(`Image upload failed: ${result.error.message}`);
        src = client.storage.from("blog-images").getPublicUrl(path).data.publicUrl;
      }
      const a = { src: content.url(src, true), alt, caption: document.querySelector("#writer-caption").value };
      content.validate({ version: 1, doc: { type: "doc", content: [{ type: "image", attrs: a }] } });
      editor.chain().focus().insertContent({ type: "image", attrs: a }).run();
    }
    dialog.close();
  } catch (error) { document.querySelector("#writer-dialog-error").textContent = error.message; }
  finally { detailBusy = false; apply.disabled = false; cancel.disabled = false; }
});
for (const kind of ["color", "font", "size"]) {
  document.querySelector(`#writer-${kind}`).addEventListener("change", event => {
    if (!authorized) return;
    if (kind === "color" && event.target.value === "custom") {
      customColorControls.hidden = false;
      customColor.focus();
      return;
    }
    closeDropdowns();
    editor.chain().focus().setMark("style", { ...editor.getAttributes("style"), [kind]: event.target.value || null }).run();
  });
}
document.querySelector("#writer-custom-color-apply").addEventListener("click", () => {
  if (!authorized) return;
  const color = markdown.hexColor(customColorHex.value);
  if (!color) {
    customColorError.textContent = "Enter RGB, RGBA, RRGGBB or RRGGBBAA, optionally prefixed with #.";
    customColorHex.focus();
    return;
  }
  customColorError.textContent = "";
  closeDropdowns();
  editor.chain().focus().setMark("style", { ...editor.getAttributes("style"), color }).run();
});
customColorHex.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    document.querySelector("#writer-custom-color-apply").click();
  }
});
document.querySelector("#writer-import").addEventListener("click", () => {
  closeDropdowns();
  if (!authorized || !original.trim()) { report("There is no original Markdown to import.", true); return; }
  const previous = editor.getJSON();
  if (previous.content.some(n => n.type !== "legacyMarkdown" && !(n.type === "paragraph" && !n.content?.length))) {
    report("Import is available before visual edits. Keep your current changes or undo them first.", true); return;
  }
  try {
    const container = document.createElement("div"); container.append(markdown.render(original));
    editor.commands.setContent(container.innerHTML);
    const rich = { version: 1, doc: editor.getJSON() };
    content.validate(rich);
    const result = document.createElement("div"); result.append(content.render(rich));
    if (JSON.stringify(semantic(container)) !== JSON.stringify(semantic(result))) throw new Error("Some original formatting cannot be imported exactly. It remains protected; use Edit protected Markdown for that section.");
    report("Formatted copy imported into the private draft. Original source is retained; publishing remains explicit.");
  } catch (error) { editor.commands.setContent(previous); report(error.message, true); }
});
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!authorized || busy) return;
  try {
    save.disabled = true; await autosave.flush(true);
  } catch (error) { report(`Draft save failed: ${error.message}`, true); }
  finally { save.disabled = false; }
});
function freeze(frozen) {
  busy = frozen; editor?.setEditable(!frozen, false);
  for (const control of form.querySelectorAll("input,textarea,button,select")) control.disabled = frozen;
  for (const control of historyDialog.querySelectorAll("button")) control.disabled = frozen;
  restoreButton.disabled = frozen || !selectedRevision;
}
document.querySelector("#writer-retry").addEventListener("click", async () => {
  try { await autosave.retry(); } catch (error) { report(`Draft retry failed: ${error.message}`, true); }
});
document.querySelector("#writer-reload").addEventListener("click", async () => {
  if (dirty() && !window.confirm("Discard local unsaved changes and load the latest private draft?")) return;
  try { freeze(true); await openDraft(id); } catch (error) { report(`Draft reload failed: ${error.message}`, true); }
  finally { freeze(false); }
});
async function mutation(name, args) {
  const state = await rpc(name, args);
  if (state?.request_id !== args.p_request_id || !state.version || state.draft_id !== id) throw new Error("The operation could not be confirmed. Reload the latest draft before retrying.");
  updateDraftState(state); load(state.snapshot); startAutosave();
  history.replaceState(null, "", `?draft=${encodeURIComponent(id)}`);
  return state;
}
document.querySelector("#writer-publish").addEventListener("click", async () => {
  if (!authorized || busy) return;
  try {
    const next = draftSnapshot(); content.validate(next.body_rich);
    if (!next.title.trim() || !next.excerpt.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(next.slug) || next.slug.length < 3) throw new Error("Title, excerpt and a valid slug are required to publish.");
    if (!content.text(next.body_rich).trim() && !JSON.stringify(next.body_rich).includes('"image"')) throw new Error("Write an article before publishing.");
    freeze(true); await autosave.flush(false);
    const current = await rpc("load_blog_draft", { p_id: id });
    const drift = current.base_public_version !== current.live?.updated_at && Boolean(current.live);
    if (drift && !window.confirm("The live article changed since this draft started. Publish this entire revision over the current live article?")) return;
    const scheduled = next.published_at && Date.parse(next.published_at) > Date.now();
    if (!drift && !window.confirm(scheduled ? "Schedule this saved revision? Any current live article stays visible until the selected time." : "Publish this saved revision to the public article now?")) return;
    const state = await mutation("publish_blog_draft", {
      p_id: id, p_expected_version: autosave.version, p_request_id: crypto.randomUUID(),
      p_expected_public_version: current.live?.updated_at || null, p_accept_live_change: drift,
    });
    report(state.scheduled_at ? "Revision scheduled. Any current live article is unchanged until it is due." : "Revision published. Live readers use this version.");
    opener?.postMessage({ type: "bits:writer-saved", channel, id: state.post_id || id }, location.origin);
  } catch (error) { autosave?.pause(error); report(`Publication failed: ${error.message}. Reload the latest draft if the response was interrupted.`, true); }
  finally { freeze(false); }
});
document.querySelector("#writer-history-open").addEventListener("click", async () => {
  if (!authorized || busy) return;
  closeDropdowns(); historyDialog.showModal();
  document.querySelector("#writer-history-open").setAttribute("aria-expanded", "true");
  document.querySelector("#writer-history-close").focus();
  historyStatus.textContent = "Loading private history..."; historyList.replaceChildren(); historyPreview.replaceChildren(); restoreButton.disabled = true;
  const serial = ++historyRequest;
  try {
    if (!autosave.error) await autosave.flush(false);
    const revisions = autosave.version ? await rpc("list_blog_draft_history", { p_id: id }) : [];
    if (!historyDialog.open || serial !== historyRequest) return;
    if (!Array.isArray(revisions)) throw new Error("History response could not be confirmed.");
    historyStatus.textContent = revisions.length ? `${revisions.length} retained checkpoints. Select a version to preview.` : "No saved checkpoints yet. Save draft to create one.";
    for (const revision of revisions) {
      const button = document.createElement("button"); button.type = "button";
      button.textContent = `${new Date(revision.created_at).toLocaleString()} · ${revision.reason} · ${revision.title || "Untitled"}`;
      button.addEventListener("click", async () => {
        const selection = ++historyRequest; restoreButton.disabled = true; historyPreview.replaceChildren(); selectedRevision = null;
        try {
          const result = await rpc("get_blog_draft_revision", { p_id: id, p_revision_id: revision.id });
          if (!historyDialog.open || selection !== historyRequest) return;
          const title = document.createElement("h2"); title.textContent = result.snapshot.title || "Untitled";
          const metadata = taxonomy.read(result.snapshot);
          const meta = document.createElement("p"); meta.textContent = `Slug: ${result.snapshot.slug || "(incomplete)"} · Excerpt: ${result.snapshot.excerpt || "(incomplete)"} · Tags: ${metadata.tags.map(tag => tag.name).join(", ") || "None"} · Series: ${metadata.series ? `${metadata.series.name} (order ${metadata.series_order})` : "None"}`;
          const body = result.snapshot.body_rich ? content.render(result.snapshot.body_rich) : markdown.render(result.snapshot.body_markdown);
          historyPreview.replaceChildren(title, meta, body); selectedRevision = revision.id; restoreButton.disabled = false;
          historyStatus.textContent = "Preview only. Restore to draft does not publish.";
        } catch (error) { historyStatus.textContent = `Preview failed: ${error.message}`; }
      });
      historyList.append(button);
    }
  } catch (error) { historyStatus.textContent = `History could not load: ${error.message}`; }
});
document.querySelector("#writer-history-close").addEventListener("click", () => historyDialog.close());
historyDialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
historyDialog.addEventListener("click", event => {
  if (event.target !== historyDialog || busy) return;
  const box = historyDialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) historyDialog.close();
});
historyDialog.addEventListener("close", () => {
  historyRequest++; selectedRevision = null; historyPreview.replaceChildren(); historyList.replaceChildren(); restoreButton.disabled = true;
  document.querySelector("#writer-history-open").setAttribute("aria-expanded", "false");
});
restoreButton.addEventListener("click", async () => {
  if (!authorized || busy || !selectedRevision) return;
  try {
    freeze(true); restoreButton.disabled = true; await autosave.flush(true);
    await mutation("restore_blog_draft_revision", { p_id: id, p_revision_id: selectedRevision, p_expected_version: autosave.version, p_request_id: crypto.randomUUID() });
    historyDialog.close(); report("Revision restored to the private draft. Live content and approved schedules are unchanged.");
  } catch (error) { autosave?.pause(error); historyStatus.textContent = `Restore failed: ${error.message}. Reload the latest draft if the response was interrupted.`; }
  finally { freeze(false); restoreButton.disabled = !selectedRevision; }
});
document.querySelector("#writer-cancel-schedule").addEventListener("click", async () => {
  if (!authorized || busy || !window.confirm("Cancel the approved scheduled revision? Any currently live article remains visible.")) return;
  try {
    freeze(true); await autosave.flush(false);
    await mutation("cancel_blog_draft_schedule", { p_id: id, p_expected_version: autosave.version, p_request_id: crypto.randomUUID() });
    historyDialog.close(); report("Scheduled revision cancelled. Any currently live article is unchanged.");
  } catch (error) { autosave?.pause(error); historyStatus.textContent = `Cancellation failed: ${error.message}`; }
  finally { freeze(false); }
});
void initialize();
