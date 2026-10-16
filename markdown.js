(() => {
  const blockStartPattern = /^(?:#{1,6}\s+|```|>\s?|[-*+]\s+|\d+\.\s+|(?:-{3,}|\*{3,})\s*$)/;
  const inlinePattern = /(\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|`([^`\n]+)`|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_|~~([^~\n]+)~~)/g;

  function safeLink(value) {
    const trimmed = value.trim();
    if (trimmed.startsWith("#") || /^(?:\.{0,2}\/|\/)/.test(trimmed)) {
      return trimmed;
    }
    try {
      const url = new URL(trimmed);
      return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  function appendInline(parent, source) {
    let cursor = 0;
    inlinePattern.lastIndex = 0;
    for (const match of source.matchAll(inlinePattern)) {
      parent.append(document.createTextNode(source.slice(cursor, match.index)));
      let element;
      if (match[2] !== undefined) {
        const href = safeLink(match[3]);
        if (!href) {
          parent.append(document.createTextNode(match[0]));
          cursor = match.index + match[0].length;
          continue;
        }
        element = document.createElement("a");
        element.href = href;
        element.textContent = match[2];
        if (/^https?:/i.test(href) && new URL(href).origin !== window.location.origin) {
          element.target = "_blank";
          element.rel = "noreferrer";
        }
      } else if (match[4] !== undefined) {
        element = document.createElement("code");
        element.textContent = match[4];
      } else if (match[5] !== undefined || match[6] !== undefined) {
        element = document.createElement("strong");
        appendInline(element, match[5] ?? match[6]);
      } else if (match[7] !== undefined || match[8] !== undefined) {
        element = document.createElement("em");
        appendInline(element, match[7] ?? match[8]);
      } else {
        element = document.createElement("s");
        appendInline(element, match[9]);
      }
      parent.append(element);
      cursor = match.index + match[0].length;
    }
    parent.append(document.createTextNode(source.slice(cursor)));
  }

  function render(markdown, options = {}) {
    const fragment = document.createDocumentFragment();
    const lines = String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n");
    const headingOffset = Number.isInteger(options.headingOffset)
      ? options.headingOffset
      : 1;
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }

      if (line.startsWith("```")) {
        const language = line.slice(3).trim().replace(/[^a-z0-9_-]/gi, "");
        const codeLines = [];
        index += 1;
        while (index < lines.length && !lines[index].startsWith("```")) {
          codeLines.push(lines[index]);
          index += 1;
        }
        index += index < lines.length ? 1 : 0;
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        if (language) {
          code.dataset.language = language;
          pre.setAttribute("aria-label", `${language} code example`);
        }
        code.textContent = codeLines.join("\n");
        pre.append(code);
        fragment.append(pre);
        continue;
      }

      const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
      if (headingMatch) {
        const level = Math.min(6, headingMatch[1].length + headingOffset);
        const heading = document.createElement(`h${level}`);
        appendInline(heading, headingMatch[2].trim());
        fragment.append(heading);
        index += 1;
        continue;
      }

      if (/^(?:-{3,}|\*{3,})\s*$/.test(line)) {
        fragment.append(document.createElement("hr"));
        index += 1;
        continue;
      }

      if (/^>\s?/.test(line)) {
        const quoteLines = [];
        while (index < lines.length && /^>\s?/.test(lines[index])) {
          quoteLines.push(lines[index].replace(/^>\s?/, ""));
          index += 1;
        }
        const quote = document.createElement("blockquote");
        const paragraph = document.createElement("p");
        appendInline(paragraph, quoteLines.join(" "));
        quote.append(paragraph);
        fragment.append(quote);
        continue;
      }

      const listMatch = /^(?:([-*+])|(\d+)\.)\s+(.+)$/.exec(line);
      if (listMatch) {
        const ordered = Boolean(listMatch[2]);
        const list = document.createElement(ordered ? "ol" : "ul");
        const itemPattern = ordered ? /^\d+\.\s+(.+)$/ : /^[-*+]\s+(.+)$/;
        while (index < lines.length) {
          const itemMatch = itemPattern.exec(lines[index]);
          if (!itemMatch) {
            break;
          }
          const item = document.createElement("li");
          appendInline(item, itemMatch[1]);
          list.append(item);
          index += 1;
        }
        fragment.append(list);
        continue;
      }

      const paragraphLines = [line.trim()];
      index += 1;
      while (
        index < lines.length
        && lines[index].trim()
        && !blockStartPattern.test(lines[index])
      ) {
        paragraphLines.push(lines[index].trim());
        index += 1;
      }
      const paragraph = document.createElement("p");
      appendInline(paragraph, paragraphLines.join(" "));
      fragment.append(paragraph);
    }
    return fragment;
  }

  function readingTime(markdown) {
    const words = String(markdown ?? "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[#>*_~`\[\]()-]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 220));
  }

  window.BITS_MARKDOWN = Object.freeze({ render, readingTime });
})();
