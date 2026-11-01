(() => {
  const ignored = new Set(["SCRIPT", "STYLE", "HEAD", "META", "LINK", "IFRAME", "OBJECT", "SVG", "NOSCRIPT"]);
  const blocks = new Set(["P", "DIV", "SECTION", "ARTICLE", "HEADER", "FOOTER"]);
  const namedColors = {
    black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000",
    blue: "#0000ff", yellow: "#ffff00", orange: "#ffa500", purple: "#800080",
    pink: "#ffc0cb", gray: "#808080", grey: "#808080", cyan: "#00ffff",
    magenta: "#ff00ff", transparent: "#00000000",
  };

  function colorValue(value) {
    const hex = window.BITS_MARKDOWN.hexColor(value);
    if (hex) return hex;
    if (namedColors[value.toLowerCase()]) return namedColors[value.toLowerCase()];
    const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.exec(value);
    if (!rgb || rgb.slice(1, 4).some(part => Number(part) > 255)) return null;
    const channels = rgb.slice(1, 4).map(Number);
    if (rgb[4] !== undefined) channels.push(Number(rgb[4]) * 255);
    return `#${channels.map(channel => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
  }

  function fromHtml(html) {
    if (html.length > 1000000) throw new Error("The formatted clipboard is too large. Paste a smaller section or use plain-text paste.");
    const template = document.createElement("template");
    template.innerHTML = html;
    const children = (node, depth, inherited = {}) => Array.from(node.childNodes)
      .map(child => convert(child, depth + 1, inherited)).reduce((text, part) => {
        if (text.endsWith("\n\n") && part === " ") return text;
        if (part.startsWith("\n\n")) {
          text = text.replace(/[ \t]+$/, "");
          if (text.endsWith("\n\n")) part = part.replace(/^\n+/, "");
        }
        return text + part;
      }, "");
    const wrap = (text, before, after = before) => {
      const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
      return match[2] ? `${match[1]}${before}${match[2]}${after}${match[3]}` : text;
    };
    function convert(node, depth, inherited) {
      if (depth > 60) throw new Error("The formatted clipboard is too deeply nested. Paste a smaller section or use plain-text paste.");
      if (node.nodeType === 3) {
        let text = node.textContent.replace(/\s+/g, " ");
        if (inherited.italic) text = wrap(text, "_");
        if (inherited.bold) text = wrap(text, "**");
        if (inherited.underline) text = wrap(text, "++");
        if (inherited.strike) text = wrap(text, "~~");
        if (inherited.highlight) text = wrap(text, "==");
        if (inherited.font) text = wrap(text, `{{font:custom:${inherited.font}|`, "}}");
        if (inherited.color) text = wrap(text, `{{color:${inherited.color}|`, "}}");
        return text;
      }
      if (node.nodeType !== 1) return "";
      const tag = node.tagName.toUpperCase();
      if (ignored.has(tag) || node.hasAttribute("hidden") || node.style.display === "none" || node.style.visibility === "hidden") return "";
      if (tag === "BR") return "<br>";
      if (tag === "HR") return "\n\n---\n\n";
      if (tag === "PRE") {
        const code = node.textContent.replace(/\r\n?/g, "\n").replace(/\n$/, "");
        const longest = Array.from(code.matchAll(/`+/g)).reduce((length, match) => Math.max(length, match[0].length), 2);
        const fence = "`".repeat(longest + 1);
        return `\n\n${fence}\n${code}\n${fence}\n\n`;
      }
      if (tag === "CODE" && !node.textContent.includes("`") && !node.textContent.includes("\n")) {
        return wrap(node.textContent, "`");
      }
      const style = node.style;
      const decoration = style.textDecorationLine || style.textDecoration || "";
      const weight = style.fontWeight;
      const background = colorValue(style.backgroundColor || "");
      const formatting = {
        bold: weight ? /^(bold|bolder|[6-9]00)$/i.test(weight) : inherited.bold || ["B", "STRONG"].includes(tag),
        italic: style.fontStyle ? /^(italic|oblique)/i.test(style.fontStyle) : inherited.italic || ["I", "EM"].includes(tag),
        underline: inherited.underline || tag === "U" || decoration.includes("underline"),
        strike: inherited.strike || ["S", "STRIKE", "DEL"].includes(tag) || decoration.includes("line-through"),
        highlight: inherited.highlight || tag === "MARK"
          || Boolean(background && !["#ffffff", "#000000", "#fff", "#000"].includes(background)
            && !(background.length === 9 && background.endsWith("00"))),
        color: colorValue(style.color || node.getAttribute("color") || "") || inherited.color,
        font: window.BITS_MARKDOWN.customFontFamily(style.fontFamily || node.getAttribute("face") || "") || inherited.font,
      };
      if (tag === "A") {
        const href = node.getAttribute("href") || "";
        try {
          const url = new URL(href, window.location.origin);
          if (["https:", "http:", "mailto:"].includes(url.protocol) && !/[\s()]/.test(url.href)) {
            return wrap(node.textContent.replace(/\s+/g, " ").replace(/[\[\]]/g, ""), "[", `](${url.href})`);
          }
        } catch {
          // Malformed links retain their visible label, never their destination.
        }
      }
      if (tag === "UL" || tag === "OL") {
        const items = Array.from(node.children).filter(child => child.tagName.toUpperCase() === "LI");
        return `\n\n${items.map((item, index) => `${tag === "OL" ? `${index + 1}.` : "-"} ${children(item, depth, formatting).trim().replace(/\n+/g, "<br>")}`).join("\n")}\n\n`;
      }
      if (tag === "TABLE") {
        const rows = Array.from(node.querySelectorAll("tr")).map(row => Array.from(row.children)
          .filter(cell => ["TH", "TD"].includes(cell.tagName.toUpperCase()))
          .map(cell => children(cell, depth, formatting).trim().replace(/\|/g, "/").replace(/\n+/g, "<br>")));
        if (!rows.length) return children(node, depth, formatting);
        const width = rows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
        const line = row => `| ${Array.from({ length: width }, (_, index) => row[index] || "").join(" | ")} |`;
        return `\n\n${line(rows[0])}\n${line(Array(width).fill("---"))}\n${rows.slice(1).map(line).join("\n")}\n\n`;
      }
      const text = children(node, depth, formatting);
      if (/^H[1-6]$/.test(tag)) return `\n\n${"#".repeat(Number(tag[1]))} ${text.trim()}\n\n`;
      if (tag === "BLOCKQUOTE") return `\n\n> ${text.trim().replace(/\n{2,}/g, "<br><br>").replace(/\n/g, "<br>")}\n\n`;
      return blocks.has(tag) ? `\n\n${text.trim()}\n\n` : text;
    }
    return children(template.content, 0).replace(/^\n+|\n+$/g, "");
  }

  window.BITS_BLOG_PASTE = Object.freeze({ fromHtml });
})();
