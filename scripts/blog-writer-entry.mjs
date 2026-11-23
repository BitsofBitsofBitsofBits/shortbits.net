import { Editor, Node, Mark, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";

const content = window.BITS_BLOG_CONTENT;
const markdown = window.BITS_MARKDOWN;
const form = document.querySelector("#writer-form");
const status = document.querySelector("#writer-status");
const workspace = document.querySelector("#writer-workspace");
const save = document.querySelector("#writer-save");
const dialog = document.querySelector("#writer-dialog");
const formatDialog = document.querySelector("#writer-format-dialog");
const value = document.querySelector("#writer-value");
const source = document.querySelector("#writer-source");
let client, editor, authorized = false, busy = false, id = "", version = null, original = "", baseline = "", mode = "";
let detailBusy = false;
const channel = new URLSearchParams(location.search).get("channel");
const opener = window.opener;
function report(message, error = false) {
  status.textContent = message;
  status.dataset.state = error ? "error" : "";
}
function snapshot() {
  return JSON.stringify([editor?.getJSON(), ...["title", "slug", "excerpt", "published_at"].map(key => form.elements[key].value), form.elements.published.checked]);
}
const dirty = () => authorized && baseline && snapshot() !== baseline;
for (const kind of ["theme", "format"]) {
  const popup = document.querySelector(`#writer-${kind}-dialog`);
  const trigger = document.querySelector(`#writer-${kind}-open`);
  trigger.addEventListener("click", () => {
    if (!authorized) return;
    popup.showModal();
    trigger.setAttribute("aria-expanded", "true");
    (popup.querySelector(".theme-picker > summary") || popup.querySelector("[data-command]") || popup.querySelector("button")).focus();
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
}
document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && authorized) { event.preventDefault(); form.requestSubmit(); }
});
function load(post) {
  id = post.id || ""; version = post.updated_at || null; original = post.body_markdown || "";
  if (post.body_rich) content.validate(post.body_rich);
  for (const name of ["title", "slug", "excerpt"]) form.elements[name].value = post[name] || "";
  form.elements.published.checked = Boolean(post.published);
  if (post.published_at) {
    const date = new Date(post.published_at);
    form.elements.published_at.value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  } else form.elements.published_at.value = "";
  editor.commands.setContent(post.body_rich?.doc || { type: "doc", content: original.trim()
    ? [{ type: "legacyMarkdown", attrs: { source: original } }, { type: "paragraph" }]
    : [{ type: "paragraph" }] });
  baseline = snapshot();
  report(original && !post.body_rich ? "Original Markdown preserved. Import explicitly or edit its protected source; nothing has been converted or saved." : "Ready to write. Changes are not saved automatically.");
}
function showDialog(kind) {
  formatDialog.close();
  mode = kind; value.value = ""; source.value = "";
  document.querySelector("#writer-dialog-error").textContent = "";
  document.querySelector("#writer-alt").value = "";
  document.querySelector("#writer-caption").value = "";
  document.querySelector("#writer-file").value = "";
  document.querySelector("#writer-file-label").hidden = kind !== "image";
  document.querySelector("#writer-upload-help").hidden = kind !== "image";
  for (const name of ["value", "alt", "caption", "source"]) document.querySelector(`#writer-${name}-label`).hidden =
    name === "source" ? kind !== "legacy" : name === "value" ? kind === "legacy" : kind !== "image";
  document.querySelector("#writer-dialog-title").textContent = kind === "legacy" ? "Edit protected original Markdown" : kind === "image" ? "Insert accessible image" : "Insert link";
  if (kind === "legacy") {
    const node = editor.state.selection.node;
    if (node?.type.name !== "legacyMarkdown") { report("Select the protected Markdown section first.", true); return; }
    source.value = node.attrs.source;
  }
  dialog.showModal();
  (kind === "legacy" ? source : value).focus();
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
      onUpdate: () => { updateToolbar(); report("Unsaved changes."); },
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
      authorized = false; workspace.hidden = true; editor.destroy(); editor = null; original = ""; baseline = "";
      report("Signed out. Sign in through Admin to continue.");
    });
    if (opener && channel) {
      report("Waiting for your Admin draft...");
      let accepted = false;
      window.addEventListener("message", event => {
        if (!authorized || accepted || event.origin !== location.origin || event.source !== opener || event.data?.type !== "bits:writer-draft" || event.data.channel !== channel) return;
        accepted = true;
        try { load(event.data.post); } catch (error) { report(`Draft could not load: ${error.message}`, true); }
      });
      opener.postMessage({ type: "bits:writer-ready", channel }, location.origin);
      window.setTimeout(() => { if (!accepted) report("Admin did not provide the draft. Reopen the writer from Admin; your original draft is unchanged.", true); }, 10000);
    } else {
      const postId = new URLSearchParams(location.search).get("post");
      if (postId) {
        const { data, error } = await client.from("site_blog_posts").select("*").eq("id", postId).single();
        if (error) throw error; load(data);
      } else load({});
    }
  } catch (error) { console.error("Unable to open blog writer:", error); authorized = false; workspace.hidden = true; report(`Writer could not open: ${error.message}`, true); }
}
document.querySelector(".writer-header a").addEventListener("click", event => {
  if (dirty() && !window.confirm("Leave without saving your article changes?")) event.preventDefault();
});
window.addEventListener("beforeunload", event => { if (dirty()) { event.preventDefault(); event.returnValue = ""; } });
form.addEventListener("input", event => { if (authorized && event.target.name) report(dirty() ? "Unsaved changes." : "No unsaved changes."); });
for (const button of document.querySelectorAll("[data-command]")) {
  button.addEventListener("mousedown", event => event.preventDefault());
  button.addEventListener("click", () => {
    const commands = { bold: "toggleBold", italic: "toggleItalic", underline: "toggleUnderline", strike: "toggleStrike", code: "toggleCode",
      bulletList: "toggleBulletList", orderedList: "toggleOrderedList", taskList: "toggleTaskList", blockquote: "toggleBlockquote", codeBlock: "toggleCodeBlock", undo: "undo", redo: "redo" };
    const command = button.dataset.command;
    if (!authorized) return;
    formatDialog.close();
    if (command === "heading") editor.chain().focus().toggleHeading({ level: 2 }).run();
    else if (command === "highlight") editor.chain().focus().toggleMark("highlight").run();
    else if (command === "table") editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    else if (["addRowAfter", "addColumnAfter", "deleteTable"].includes(command)) editor.chain().focus()[command]().run();
    else editor.chain().focus()[commands[command]]().run();
    updateToolbar();
  });
}
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
      if (editor.state.selection.empty) editor.chain().focus().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
      else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
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
    editor.chain().setMark("style", { ...editor.getAttributes("style"), [kind]: event.target.value || null }).run();
  });
}
document.querySelector("#writer-import").addEventListener("click", () => {
  formatDialog.close();
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
    report("Formatted copy imported. Original source is retained; save explicitly to adopt rich-text storage.");
  } catch (error) { editor.commands.setContent(previous); report(error.message, true); }
});
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!authorized || busy) return;
  try {
    const rich = { version: 1, doc: editor.getJSON() }; content.validate(rich);
    if (!content.text(rich).trim() && !JSON.stringify(rich).includes('"image"')) throw new Error("Write an article before saving.");
    const title = form.elements.title.value.trim(), slug = form.elements.slug.value.trim().toLowerCase(), excerpt = form.elements.excerpt.value.trim();
    if (!title || !excerpt || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 100) throw new Error("Title, excerpt and a valid slug are required.");
    const published = form.elements.published.checked;
    const input = form.elements.published_at.value;
    const publishedAt = input ? new Date(input).toISOString() : published ? new Date().toISOString() : null;
    const payload = { title, slug, excerpt, body_markdown: original, body_rich: rich, published, published_at: publishedAt, updated_at: new Date().toISOString() };
    const savedSnapshot = snapshot();
    busy = true; save.disabled = true; report("Saving article...");
    let query = id ? client.from("site_blog_posts").update(payload).eq("id", id) : client.from("site_blog_posts").insert(payload);
    if (id && version) query = query.eq("updated_at", version);
    const { data, error } = await query.select("id,updated_at").single();
    if (error) throw new Error(error.code === "23505" ? "Another post uses that slug." : `Save failed: ${error.message}. If another editor changed this post, reopen it before retrying.`);
    if (!data?.id || !Number.isFinite(Date.parse(data.updated_at))) throw new Error("The server's save response could not be confirmed. Keep this draft and reload the saved post separately before retrying.");
    if (!authorized) return;
    id = data.id; version = data.updated_at;
    baseline = savedSnapshot;
    report(dirty() ? "Saved the submitted version. Your newer edits are still unsaved." : published ? "Post saved. Live readers use it when the publish time is due." : "Draft saved. It is not published.");
    opener?.postMessage({ type: "bits:writer-saved", channel, id }, location.origin);
    history.replaceState(null, "", `?post=${encodeURIComponent(id)}`);
  } catch (error) { console.error("Unable to save visual article:", error); report(error.message, true); }
  finally { busy = false; save.disabled = false; }
});
void initialize();
