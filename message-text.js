(() => {
  const styles = ["color", "fontWeight", "fontFamily", "fontSize", "fontStyle",
    "letterSpacing", "textDecoration", "textTransform"];
  const compiled = new WeakMap();
  const formats = new WeakMap();
  const emptyFormat = Object.freeze({});
  let segmenter;

  function splitCharacters(text) {
    if (/^[\x00-\x7F]*$/.test(text)) return Array.from(text);
    if (segmenter === undefined) {
      segmenter = typeof Intl.Segmenter === "function"
        ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
    }
    return segmenter ? Array.from(segmenter.segment(text), ({ segment }) => segment) : Array.from(text);
  }

  function isMessage(value) {
    return typeof value === "string" ? Boolean(value.trim())
      : Boolean(value && typeof value.text === "string" && value.text.trim() && value.markup === true);
  }

  function prepare(value) {
    const option = typeof value === "string" ? { text: value } : value;
    if (!option || typeof option.text !== "string") throw new Error("Invalid message text.");
    const cached = compiled.get(option);
    if (cached?.source === option.text && cached.markup === Boolean(option.markup)) return cached;
    let nodes = null;
    let characters;
    if (option.markup) {
      const build = (parent) => Array.from(parent.childNodes, (node) => node.nodeType === 3
        ? { characters: splitCharacters(node.textContent) }
        : { template: node.cloneNode(false), children: build(node) });
      nodes = build(window.BITS_MARKDOWN.renderInline(option.text));
      const flatten = (items) => items.flatMap((item) => item.characters ?? flatten(item.children));
      characters = flatten(nodes);
    } else characters = splitCharacters(option.text);
    const result = { source: option.text, markup: Boolean(option.markup), nodes, characters, text: characters.join("") };
    compiled.set(option, result);
    return result;
  }

  function applyFormat(element, format = emptyFormat) {
    if (formats.get(element) === format) return;
    styles.forEach((key) => { element.style[key] = ""; });
    Object.entries(format).forEach(([key, value]) => {
      if (!styles.includes(key)) throw new Error(`Unsupported message format property: ${key}`);
      element.style[key] = value;
    });
    formats.set(element, format);
  }

  function render(element, value, { length = Infinity, prefix = "", suffix = "" } = {}) {
    const option = typeof value === "string" ? { text: value } : value;
    const message = prepare(option);
    applyFormat(element, option.format);
    element.classList.toggle("is-colorful-text", Boolean(option.colorful));
    let remaining = Math.max(0, length);
    if (!message.nodes) {
      element.textContent = prefix + message.characters.slice(0, remaining).join("") + suffix;
      return;
    }
    const append = (parent, nodes) => {
      for (const node of nodes) {
        if (remaining <= 0) break;
        if (node.characters) {
          const text = node.characters.slice(0, remaining).join("");
          remaining -= Math.min(remaining, node.characters.length);
          if (text) parent.append(document.createTextNode(text));
        } else {
          const child = node.template.cloneNode(false);
          append(child, node.children);
          if (child.childNodes.length) parent.append(child);
        }
      }
    };
    const fragment = document.createDocumentFragment();
    fragment.append(document.createTextNode(prefix));
    append(fragment, message.nodes);
    fragment.append(document.createTextNode(suffix));
    element.replaceChildren(fragment);
  }

  window.BITS_MESSAGE_TEXT = Object.freeze({
    styles, splitCharacters, isMessage, prepare, applyFormat, render,
    plainText: (value) => prepare(value).text,
  });
})();
