(() => {
  const blockStartPattern = /^(?:#{1,6}\s+|```|>\s?|[-*+]\s+|\d+\.\s+|(?:-{3,}|\*{3,})\s*$|\|.+\|$)/;
  const inlinePattern = /(!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)|\{\{(color|font|size):?([^|}]*)\|([^}]+)\}\}|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|`([^`\n]+)`|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\+\+([^+\n]+)\+\+|==([^=\n]+)==|\*([^*\n]+)\*|_([^_\n]+)_|~~([^~\n]+)~~)/g;
  const allowedColors = new Set([
    "accent", "red", "orange", "yellow", "green", "cyan", "blue", "purple",
    "pink", "white", "muted", "rainbow",
  ]);
  const allowedFonts = new Set(["default", "serif", "sans", "mono", "display"]);
  const allowedSizes = new Set(["small", "normal", "large", "huge"]);

  function safeLink(value, allowMail = true) {
    const trimmed = value.trim();
    if (trimmed.startsWith("#") || /^(?:\.{0,2}\/|\/)/.test(trimmed)) {
      return trimmed;
    }
    try {
      const url = new URL(trimmed);
      const protocols = allowMail ? ["https:", "http:", "mailto:"] : ["https:", "http:"];
      return protocols.includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  function appendInline(parent, source, options = {}) {
    let cursor = 0;
    inlinePattern.lastIndex = 0;
    for (const match of source.matchAll(inlinePattern)) {
      parent.append(document.createTextNode(source.slice(cursor, match.index)));
      if (options.textOnly && (match[2] !== undefined || match[8] !== undefined)) {
        parent.append(document.createTextNode(match[0]));
        cursor = match.index + match[0].length;
        continue;
      }
      let element;
      if (match[2] !== undefined) {
        const sourceUrl = safeLink(match[3], false);
        if (!sourceUrl || (/^https?:/i.test(sourceUrl) && !sourceUrl.startsWith("https:"))) {
          parent.append(document.createTextNode(match[0]));
          cursor = match.index + match[0].length;
          continue;
        }
        const figure = document.createElement("figure");
        const image = document.createElement("img");
        image.src = sourceUrl;
        image.alt = match[2];
        image.loading = "lazy";
        image.decoding = "async";
        image.referrerPolicy = "no-referrer";
        figure.className = "blog-markdown-image";
        figure.append(image);
        if (match[4]) {
          const caption = document.createElement("figcaption");
          caption.textContent = match[4];
          figure.append(caption);
        }
        element = figure;
      } else if (match[5] !== undefined) {
        const type = match[5];
        const value = match[6].trim().toLowerCase();
        const content = match[7];
        const allowedValues = {
          color: allowedColors,
          font: allowedFonts,
          size: allowedSizes,
        };
        if (!allowedValues[type].has(value)) {
          parent.append(document.createTextNode(match[0]));
          cursor = match.index + match[0].length;
          continue;
        }
        element = document.createElement("span");
        element.className = `blog-text-${type}-${value}`;
        appendInline(element, content, options);
      } else if (match[8] !== undefined) {
        const href = safeLink(match[9]);
        if (!href) {
          parent.append(document.createTextNode(match[0]));
          cursor = match.index + match[0].length;
          continue;
        }
        element = document.createElement("a");
        element.href = href;
        element.textContent = match[8];
        if (/^https?:/i.test(href) && new URL(href).origin !== window.location.origin) {
          element.target = "_blank";
          element.rel = "noreferrer";
        }
      } else if (match[10] !== undefined) {
        element = document.createElement("code");
        element.textContent = match[10];
      } else if (match[11] !== undefined || match[12] !== undefined) {
        element = document.createElement("strong");
        appendInline(element, match[11] ?? match[12], options);
      } else if (match[13] !== undefined) {
        element = document.createElement("u");
        appendInline(element, match[13], options);
      } else if (match[14] !== undefined) {
        element = document.createElement("mark");
        appendInline(element, match[14], options);
      } else if (match[15] !== undefined || match[16] !== undefined) {
        element = document.createElement("em");
        appendInline(element, match[15] ?? match[16], options);
      } else {
        element = document.createElement("s");
        appendInline(element, match[17], options);
      }
      parent.append(element);
      cursor = match.index + match[0].length;
    }
    parent.append(document.createTextNode(source.slice(cursor)));
  }

  function splitTableRow(line) {
    return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
  }

  function isTableDivider(line) {
    const cells = splitTableRow(line);
    return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  }

  function renderTable(lines, startIndex) {
    const headers = splitTableRow(lines[startIndex]);
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    headers.forEach((header) => {
      const cell = document.createElement("th");
      cell.scope = "col";
      appendInline(cell, header);
      headRow.append(cell);
    });
    head.append(headRow);
    table.append(head);
    const body = document.createElement("tbody");
    let index = startIndex + 2;
    while (index < lines.length && /^\|.+\|$/.test(lines[index].trim())) {
      const row = document.createElement("tr");
      splitTableRow(lines[index]).forEach((value) => {
        const cell = document.createElement("td");
        appendInline(cell, value);
        row.append(cell);
      });
      body.append(row);
      index += 1;
    }
    if (body.children.length) {
      table.append(body);
    }
    const wrapper = document.createElement("div");
    wrapper.className = "blog-markdown-table";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", "Scrollable table");
    wrapper.append(table);
    return { element: wrapper, nextIndex: index };
  }

  function render(markdown, options = {}) {
    const fragment = document.createDocumentFragment();
    const lines = String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n");
    const headingOffset = Number.isInteger(options.headingOffset) ? options.headingOffset : 1;
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }

      if (
        /^\|.+\|$/.test(line.trim())
        && index + 1 < lines.length
        && isTableDivider(lines[index + 1])
      ) {
        const table = renderTable(lines, index);
        fragment.append(table.element);
        index = table.nextIndex;
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
        let taskList = false;
        while (index < lines.length) {
          const itemMatch = itemPattern.exec(lines[index]);
          if (!itemMatch) {
            break;
          }
          const item = document.createElement("li");
          const taskMatch = /^\[([ xX])\]\s+(.+)$/.exec(itemMatch[1]);
          if (taskMatch) {
            taskList = true;
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = taskMatch[1].toLowerCase() === "x";
            checkbox.disabled = true;
            checkbox.setAttribute("aria-label", checkbox.checked ? "Completed" : "Not completed");
            item.append(checkbox);
            appendInline(item, taskMatch[2]);
          } else {
            appendInline(item, itemMatch[1]);
          }
          list.append(item);
          index += 1;
        }
        if (taskList) {
          list.className = "blog-task-list";
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
      if (
        paragraph.childNodes.length === 1
        && paragraph.firstElementChild?.classList.contains("blog-markdown-image")
      ) {
        fragment.append(paragraph.firstElementChild);
      } else {
        fragment.append(paragraph);
      }
    }
    return fragment;
  }

  function readingTime(markdown) {
    const words = String(markdown ?? "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[#>*_~`+\[\](){|}-]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 220));
  }

  function renderInline(source) {
    const fragment = document.createDocumentFragment();
    appendInline(fragment, String(source ?? ""), { textOnly: true });
    return fragment;
  }

  window.BITS_MARKDOWN = Object.freeze({ render, renderInline, readingTime });
})();
