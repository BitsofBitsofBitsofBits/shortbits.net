((root) => {
  const block = new Set(["paragraph", "heading", "blockquote", "bulletList", "orderedList", "listItem",
    "taskList", "taskItem", "codeBlock", "horizontalRule", "table", "tableRow", "tableCell", "tableHeader",
    "image", "legacyMarkdown"]);
  const inline = new Set(["text", "hardBreak"]);
  const bodyBlocks = new Set([...block].filter(type => !["listItem", "taskItem", "tableRow", "tableCell", "tableHeader"].includes(type)));
  const markNames = new Set(["bold", "italic", "underline", "strike", "code", "highlight", "link", "style"]);
  const attrs = {
    heading: ["level"], orderedList: ["start", "type"], taskItem: ["checked"], codeBlock: ["language"],
    tableCell: ["colspan", "rowspan", "colwidth", "align"], tableHeader: ["colspan", "rowspan", "colwidth", "align"],
    image: ["src", "alt", "caption"], legacyMarkdown: ["source"], link: ["href", "target", "rel", "class"],
    style: ["color", "font", "size"],
  };
  function url(value, image = false) {
    if (typeof value !== "string" || !value || value.length > 2000 || /[\u0000-\u0020]/.test(value)) throw new Error("Invalid article URL.");
    const parsed = new URL(value, "https://www.shortbits.net");
    if (!(image ? ["https:"] : ["https:", "http:", "mailto:"]).includes(parsed.protocol)
      || parsed.username || parsed.password) throw new Error("Unsafe article URL.");
    return value;
  }
  function keys(value, allowed) {
    if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).some(key => !allowed.includes(key))) throw new Error("Unsupported article structure.");
  }
  function validate(value) {
    keys(value, ["version", "doc"]);
    if (value.version !== 1) throw new Error("Unsupported article content version.");
    let count = 0;
    function node(current, parent = "", depth = 0) {
      keys(current, ["type", "attrs", "content", "text", "marks"]);
      if (++count > 20000 || depth > 40) throw new Error("Article content is too complex.");
      const type = current.type;
      if (parent === "" ? type !== "doc" : !block.has(type) && !inline.has(type)) throw new Error("Unsupported article node.");
      const children = current.content ?? [];
      if (!Array.isArray(children)) throw new Error("Invalid article children.");
      keys(current.attrs ?? {}, attrs[type] ?? []);
      const a = current.attrs ?? {};
      if (type === "text" && (typeof current.text !== "string" || !current.text || children.length)) throw new Error("Invalid article text.");
      if (type !== "text" && current.text !== undefined) throw new Error("Unexpected article text.");
      if (["horizontalRule", "hardBreak", "image", "legacyMarkdown"].includes(type) && children.length) throw new Error("Invalid leaf node.");
      if (type === "heading" && (!Number.isInteger(a.level) || a.level < 1 || a.level > 6)) throw new Error("Invalid heading.");
      if (type === "orderedList" && a.start !== undefined && (!Number.isInteger(a.start) || a.start < 1 || a.start > 100000)) throw new Error("Invalid list.");
      if (type === "orderedList" && a.type != null && a.type !== "1") throw new Error("Unsupported numbering style.");
      if (type === "taskItem" && typeof a.checked !== "boolean") throw new Error("Invalid task.");
      if (type === "codeBlock" && a.language != null && !/^[a-z0-9_-]{0,60}$/i.test(a.language)) throw new Error("Invalid code language.");
      if (type === "image") {
        url(a.src, true);
        if (typeof a.alt !== "string" || !a.alt.trim() || a.alt.length > 1000
          || typeof a.caption !== "string" || a.caption.length > 2000) throw new Error("Images need accessible alt text.");
      }
      if (type === "legacyMarkdown" && (typeof a.source !== "string" || !a.source.trim() || a.source.length > 200000)) throw new Error("Invalid protected Markdown.");
      if (["tableCell", "tableHeader"].includes(type)) {
        if (a.align != null && !["left", "center", "right"].includes(a.align)) throw new Error("Invalid table alignment.");
        for (const key of ["colspan", "rowspan"]) if (a[key] != null && (!Number.isInteger(a[key]) || a[key] < 1 || a[key] > 100)) throw new Error("Invalid table span.");
        if (a.colwidth != null && (!Array.isArray(a.colwidth) || a.colwidth.length > 100 || a.colwidth.some(n => !Number.isInteger(n) || n < 1 || n > 10000))) throw new Error("Invalid table width.");
      }
      const childrenAllowed = type === "codeBlock" ? new Set(["text"]) : ["paragraph", "heading"].includes(type) ? inline
        : type === "doc" || type === "blockquote" || ["listItem", "taskItem", "tableCell", "tableHeader"].includes(type) ? bodyBlocks
        : ["bulletList", "orderedList"].includes(type) ? new Set(["listItem"])
        : type === "taskList" ? new Set(["taskItem"]) : type === "table" ? new Set(["tableRow"])
        : type === "tableRow" ? new Set(["tableCell", "tableHeader"]) : new Set();
      if (["doc", "blockquote", "bulletList", "orderedList", "taskList", "listItem", "taskItem", "table", "tableRow", "tableCell", "tableHeader"].includes(type) && !children.length) throw new Error("Missing article children.");
      if (["listItem", "taskItem"].includes(type) && children[0]?.type !== "paragraph") throw new Error("Lists must start with a paragraph.");
      for (const child of children) {
        if (!childrenAllowed.has(child?.type)) throw new Error("Invalid article nesting.");
        node(child, type, depth + 1);
      }
      if (current.marks !== undefined && (!inline.has(type) || !Array.isArray(current.marks))) throw new Error("Invalid article marks.");
      if (parent === "codeBlock" && current.marks?.length) throw new Error("Code blocks cannot contain text marks.");
      const used = new Set();
      for (const mark of current.marks ?? []) {
        keys(mark, ["type", "attrs"]);
        if (!markNames.has(mark.type) || used.has(mark.type)) throw new Error("Unsupported article mark.");
        used.add(mark.type);
        keys(mark.attrs ?? {}, attrs[mark.type] ?? []);
        if (mark.type === "link") url(mark.attrs?.href);
        if (mark.type === "style") {
          for (const [key, v] of Object.entries(mark.attrs ?? {})) {
            if (v === null) continue;
            if (typeof v !== "string") throw new Error("Invalid text style.");
            if (key === "color" && !/^(?:#(?:[a-f0-9]{3}|[a-f0-9]{4}|[a-f0-9]{6}|[a-f0-9]{8})|accent|red|orange|yellow|green|cyan|blue|purple|pink|white|muted|rainbow)$/i.test(v)) throw new Error("Invalid text color.");
            if (key === "font" && !root.BITS_MARKDOWN?.customFontFamily(v)) throw new Error("Invalid font.");
            if (key === "size" && !["small", "normal", "large", "huge"].includes(v)) throw new Error("Invalid text size.");
          }
        }
      }
    }
    node(value.doc);
    if (JSON.stringify(value).length > 1000000) throw new Error("Article exceeds the rich-text limit.");
    return value;
  }
  function render(value) {
    validate(value);
    const markdown = root.BITS_MARKDOWN;
    function renderNode(node) {
      const a = node.attrs ?? {};
      if (node.type === "legacyMarkdown") return markdown.render(a.source);
      if (node.type === "text" || node.type === "hardBreak") {
        let element = node.type === "text" ? document.createTextNode(node.text) : document.createElement("br");
        for (const mark of node.marks ?? []) {
          const tags = { bold: "strong", italic: "em", underline: "u", strike: "s", code: "code", highlight: "mark", link: "a", style: "span" };
          const wrapper = document.createElement(tags[mark.type]);
          if (mark.type === "link") { wrapper.href = url(mark.attrs.href); wrapper.rel = "noreferrer"; }
          if (mark.type === "style") {
            const style = mark.attrs ?? {};
            const classes = [];
            if (style.color) {
              const hex = markdown.hexColor(style.color);
              if (hex) wrapper.style.color = hex;
              else classes.push(`blog-text-color-${style.color.toLowerCase()}`);
            }
            if (style.font) {
              const custom = markdown.customFontFamily(style.font);
              if (!custom) throw new Error("Invalid rich text font.");
              wrapper.style.fontFamily = custom;
            }
            if (style.size) classes.push(`blog-text-size-${style.size}`);
            wrapper.className = classes.join(" ");
          }
          wrapper.append(element); element = wrapper;
        }
        return element;
      }
      const tags = { doc: "", paragraph: "p", heading: `h${a.level}`, blockquote: "blockquote", bulletList: "ul",
        orderedList: "ol", listItem: "li", taskList: "ul", taskItem: "li", codeBlock: "pre",
        horizontalRule: "hr", hardBreak: "br", table: "table", tableRow: "tr", tableCell: "td", tableHeader: "th", image: "figure" };
      const element = node.type === "doc" ? document.createDocumentFragment() : document.createElement(tags[node.type]);
      if (node.type === "image") {
        const image = document.createElement("img");
        image.src = a.src; image.alt = a.alt; image.loading = "lazy"; image.decoding = "async"; image.referrerPolicy = "no-referrer";
        element.className = "blog-markdown-image"; element.append(image);
        if (a.caption) { const caption = document.createElement("figcaption"); caption.textContent = a.caption; element.append(caption); }
      } else if (node.type === "codeBlock") {
        const code = document.createElement("code"); code.textContent = (node.content ?? []).map(child => child.text ?? "").join("");
        if (a.language) code.dataset.language = a.language;
        element.append(code);
      } else {
        if (node.type === "taskList") element.className = "blog-task-list";
        if (node.type === "taskItem") {
          const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = a.checked;
          checkbox.disabled = true; checkbox.setAttribute("aria-label", a.checked ? "Completed" : "Not completed"); element.append(checkbox);
        }
        if (node.type === "orderedList" && a.start && a.start !== 1) element.setAttribute("start", String(a.start));
        if (["tableCell", "tableHeader"].includes(node.type)) {
          if (a.align) element.setAttribute("align", a.align);
          if (node.type === "tableHeader") element.scope = "col";
          for (const key of ["colspan", "rowspan"]) if (a[key] > 1) element.setAttribute(key, String(a[key]));
        }
        for (const child of node.content ?? []) element.append(renderNode(child));
      }
      if (node.type === "table") {
        const wrapper = document.createElement("div"); wrapper.className = "blog-markdown-table";
        wrapper.tabIndex = 0; wrapper.setAttribute("role", "region"); wrapper.setAttribute("aria-label", "Scrollable table"); wrapper.append(element); return wrapper;
      }
      return element;
    }
    return renderNode(value.doc);
  }
  function text(value) {
    validate(value);
    function content(node) { return node.text ?? (node.type === "legacyMarkdown" ? node.attrs.source : (node.content ?? []).map(content).join(" ")); }
    return content(value.doc);
  }
  const api = Object.freeze({ validate, render, text, url, renderPost: post => post.body_rich ? render(post.body_rich) : root.BITS_MARKDOWN.render(post.body_markdown),
    readingTime: post => root.BITS_MARKDOWN.readingTime(post.body_rich ? text(post.body_rich) : post.body_markdown) });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BITS_BLOG_CONTENT = api;
})(typeof window === "undefined" ? globalThis : window);
