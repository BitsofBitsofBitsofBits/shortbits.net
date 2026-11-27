(() => {
  const blockStartPattern = /^(?:#{1,6}\s+|```|>\s?|[-*+]\s+|\d+\.\s+|(?:-{3,}|\*{3,})\s*$|\|.+\|$)/;
  const inlinePattern = /(!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)|\{\{(color|font|size):?([^|}]*)\|([^}]+)\}\}|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|`([^`\n]+)`|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\+\+([^+\n]+)\+\+|==([^=\n]+)==|\*([^*\n]+)\*|_([^_\n]+)_|~~([^~\n]+)~~|(<[bB][rR]\s*\/?>))/g;
  const allowedColors = new Set([
    "accent", "red", "orange", "yellow", "green", "cyan", "blue", "purple",
    "pink", "white", "muted", "rainbow",
  ]);
  const fonts = Object.freeze({
    default: "Default (site theme)", serif: "Serif", sans: "Sans serif", mono: "Monospace", display: "Display",
    "system-ui": "System UI", arial: "Arial", helvetica: "Helvetica", verdana: "Verdana",
    tahoma: "Tahoma", trebuchet: "Trebuchet MS", "segoe-ui": "Segoe UI",
    georgia: "Georgia", "times-new-roman": "Times New Roman", palatino: "Palatino",
    garamond: "Garamond", cambria: "Cambria",
    "courier-new": "Courier New", consolas: "Consolas", menlo: "Menlo", monaco: "Monaco",
    impact: "Impact", "arial-narrow": "Arial Narrow", "comic-sans": "Comic Sans MS",
  });
  const allowedFonts = new Set(Object.keys(fonts));
  const allowedSizes = new Set(["small", "normal", "large", "huge"]);

  function hexColor(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    return /^#(?:[a-f0-9]{3}|[a-f0-9]{4}|[a-f0-9]{6}|[a-f0-9]{8})$/i.test(normalized)
      ? normalized.toLowerCase() : null;
  }

  const colorLuminance = channels => channels.map(channel => channel / 255)
      .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const blendColor = (front, back) => front.slice(0, 3)
    .map((channel, index) => channel * front[3] + back[index] * (1 - front[3]));
  function hexChannels(value) {
    const hex = hexColor(value);
    if (!hex) throw new Error("Invalid text color.");
    let digits = hex.slice(1);
    if (digits.length <= 4) digits = [...digits].map(digit => digit.repeat(2)).join("");
    return [...digits.slice(0, 6).match(/../g).map(channel => Number.parseInt(channel, 16)),
      digits.length === 8 ? Number.parseInt(digits.slice(6), 16) / 255 : 1];
  }
  const channelsHex = channels => `#${channels.slice(0, channels[3] === 1 ? 3 : 4)
    .map((value, index) => Math.round(index === 3 ? value * 255 : value).toString(16).padStart(2, "0")).join("")}`;

  function readablePalette(values, backgrounds) {
    const originals = values.map(hexColor);
    const colors = originals.map(hexChannels);
    if (!Array.isArray(backgrounds) || !backgrounds.length || backgrounds.some(back =>
      !Array.isArray(back) || back.length !== 3 || back.some(channel => !Number.isFinite(channel) || channel < 0 || channel > 255))) {
      throw new Error("Invalid reading surface.");
    }
    const samples = palette => palette.flatMap((color, index) => index
      ? Array.from({ length: 21 }, (_, step) => color.map((channel, component) =>
        channel * step / 20 + palette[index - 1][component] * (1 - step / 20))) : [color]);
    const contrast = palette => Math.min(...samples(palette).map(front => {
      const differences = backgrounds.map(back => colorLuminance(blendColor(front, back)) - colorLuminance(back));
      if (Math.min(...differences) <= 0 && Math.max(...differences) >= 0) return 1;
      return Math.min(...backgrounds.map(back => {
        const a = colorLuminance(blendColor(front, back)), b = colorLuminance(back);
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      }));
    }));
    // Reserve headroom for the browser's 8-bit color rounding.
    const minimum = 4.55;
    if (contrast(colors) >= minimum) return originals;
    const candidates = [];
    for (const opaque of [false, true]) {
      for (const end of [0, 255]) {
        const palette = amount => colors.map(color => [
          ...color.slice(0, 3).map(channel => channel * (1 - amount) + end * amount),
          opaque ? 1 : color[3],
        ]);
        if (contrast(palette(1)) < minimum) continue;
        let low = 0, high = 1;
        for (let index = 0; index < 24; index++) {
          const middle = (low + high) / 2;
          if (contrast(palette(middle)) >= minimum) high = middle;
          else low = middle;
        }
        let amount = high;
        let result = palette(amount).map(color => hexChannels(channelsHex(color)));
        while (contrast(result) < minimum && amount < 1) {
          amount = Math.min(1, amount + 1 / 1024);
          result = palette(amount).map(color => hexChannels(channelsHex(color)));
        }
        const change = result.reduce((sum, color, index) => sum
          + color.slice(0, 3).reduce((total, channel, component) => total + (channel - colors[index][component]) ** 2, 0), 0);
        candidates.push({ result, change });
      }
      if (candidates.length) break;
    }
    if (!candidates.length) throw new Error("This reading surface cannot support readable colored text.");
    candidates.sort((a, b) => a.change - b.change);
    return candidates[0].result.map(channelsHex);
  }

  function readableHexColor(value, backgrounds = [[0, 0, 0], [35, 35, 35]]) {
    const original = hexColor(value);
    if (!original) throw new Error("Invalid text color.");
    return { original, color: readablePalette([original], backgrounds)[0] };
  }

  function applyReadableColors(container) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Unable to measure article colors.");
    const colors = new Map();
    const color = value => {
      if (!colors.has(value)) {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        const data = [...context.getImageData(0, 0, 1, 1).data];
        colors.set(value, [...data.slice(0, 3), data[3] / 255]);
      }
      return colors.get(value);
    };
    const extremes = values => [
      values.reduce((a, b) => colorLuminance(a) < colorLuminance(b) ? a : b),
      values.reduce((a, b) => colorLuminance(a) > colorLuminance(b) ? a : b),
    ];
    const layers = value => {
      const result = [];
      let start = 0, depth = 0;
      for (let index = 0; index < value.length; index++) {
        if (value[index] === "(") depth++;
        if (value[index] === ")") depth--;
        if (value[index] === "," && !depth) { result.push(value.slice(start, index)); start = index + 1; }
      }
      result.push(value.slice(start));
      return result;
    };
    const cache = new WeakMap();
    const background = element => {
      if (!element) return [[255, 255, 255]];
      if (cache.has(element)) return cache.get(element);
      const style = window.getComputedStyle(element);
      let values = background(element.parentElement).map(back => blendColor(color(style.backgroundColor), back));
      for (const layer of layers(style.backgroundImage).reverse()) {
        if (layer.trim() === "none" || style.backgroundClip.includes("text")) continue;
        const stops = layer.match(/(?:rgba?|color)\([^)]*\)|#[0-9a-f]{3,8}\b/gi);
        values = !stops || layer.includes("url(") ? [[0, 0, 0], [255, 255, 255]]
          : extremes(values.flatMap(back => stops.map(stop => blendColor(color(stop), back))));
      }
      cache.set(element, values);
      return values;
    };
    for (const element of container.querySelectorAll(".blog-color-readable")) {
      const original = hexColor(element.dataset.color);
      if (original) element.style.color = original;
      else element.style.removeProperty("color");
      const foreground = original || channelsHex(color(window.getComputedStyle(element).color));
      element.style.color = readableHexColor(foreground, background(element)).color;
    }
    for (const element of container.querySelectorAll(".blog-rainbow-surface .blog-text-color-rainbow")) {
      element.style.removeProperty("background-image");
      const gradient = window.getComputedStyle(element).backgroundImage;
      const stops = gradient.match(/(?:rgba?|color)\([^)]*\)|#[0-9a-f]{3,8}\b/gi);
      if (!stops?.length) throw new Error("Unable to measure article rainbow colors.");
      const palette = readablePalette(stops.map(stop => channelsHex(color(stop))), background(element));
      element.style.backgroundImage = `linear-gradient(90deg, ${palette.join(", ")})`;
    }
  }

  function bindHexColorInputs(picker, field) {
    const sync = () => {
      const hex = hexColor(field.value);
      if (!hex) return;
      const digits = hex.slice(1);
      picker.value = `#${digits.length <= 4 ? [...digits.slice(0, 3)].map(digit => digit + digit).join("") : digits.slice(0, 6)}`;
    };
    field.addEventListener("input", sync);
    picker.addEventListener("input", () => {
      const hex = hexColor(field.value);
      const alpha = hex?.length === 5 ? hex.slice(-1).repeat(2) : hex?.length === 9 ? hex.slice(-2) : "";
      field.value = picker.value + alpha;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    sync();
    return sync;
  }

  function customFontFamily(value) {
    if (typeof value !== "string" || !value.trim() || value.length > 200) return null;
    const families = value.split(",").map(family => family.trim());
    const name = /^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u;
    const normalized = [];
    for (const family of families) {
      const unquoted = /^(['"]).*\1$/.test(family) ? family.slice(1, -1) : family;
      if (!name.test(unquoted) || /^(?:inherit|initial|unset|revert|revert-layer)$/i.test(unquoted)) return null;
      const generic = /^(?:serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|emoji|math|fangsong)$/i;
      normalized.push(generic.test(unquoted) && unquoted === family ? unquoted.toLowerCase() : `"${unquoted}"`);
    }
    const result = normalized.join(", ");
    return result.length <= 200 ? result : null;
  }

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

  function directiveEnd(source, start) {
    const braces = /\{\{|\}\}/g;
    braces.lastIndex = start;
    let depth = 0;
    let match;
    while ((match = braces.exec(source))) {
      depth += match[0] === "{{" ? 1 : -1;
      if (depth === 0) return braces.lastIndex;
    }
    return -1;
  }

  function appendInline(parent, source, options = {}) {
    let cursor = 0;
    inlinePattern.lastIndex = 0;
    for (const match of source.matchAll(inlinePattern)) {
      if (match.index < cursor) continue;
      parent.append(document.createTextNode(source.slice(cursor, match.index)));
      let end = match.index + match[0].length;
      if (options.textOnly && (match[2] !== undefined || match[8] !== undefined || match[18] !== undefined)) {
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
        const rawValue = match[6].trim();
        const value = rawValue.toLowerCase();
        const hex = type === "color" ? hexColor(rawValue) : null;
        const custom = type === "font" && value.startsWith("custom:")
          ? customFontFamily(rawValue.slice("custom:".length)) : null;
        const balancedEnd = directiveEnd(source, match.index);
        if (balancedEnd < 0) {
          parent.append(document.createTextNode(match[0]));
          cursor = end;
          continue;
        }
        end = balancedEnd;
        const content = source.slice(source.indexOf("|", match.index) + 1, end - 2);
        const allowedValues = {
          color: allowedColors,
          font: allowedFonts,
          size: allowedSizes,
        };
        if (!hex && !custom && !allowedValues[type].has(value)) {
          parent.append(document.createTextNode(source.slice(match.index, end)));
          cursor = end;
          continue;
        }
        element = document.createElement("span");
        element.className = hex ? "blog-text-color-custom"
          : custom ? "blog-text-font-custom" : `blog-text-${type}-${value}`;
        if (hex) {
          element.style.color = hex;
          if (options.readableColors) {
            const presentation = readableHexColor(hex);
            element.className += " blog-color-readable";
            element.style.color = presentation.color;
            element.dataset.color = presentation.original;
          }
        }
        if (options.readableColors && type === "color" && !hex && value !== "rainbow") {
          element.className += " blog-color-readable";
          element.dataset.color = value;
        }
        if (custom) element.style.fontFamily = custom;
        appendInline(element, content, options);
        if (options.readableColors && type === "color" && value === "rainbow") {
          const surface = document.createElement("span");
          surface.className = "blog-rainbow-surface";
          surface.append(element);
          element = surface;
        }
      } else if (match[8] !== undefined) {
        const href = safeLink(match[9]);
        if (!href) {
          parent.append(document.createTextNode(match[0]));
          cursor = end;
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
      } else if (match[18] !== undefined) {
        element = document.createElement("br");
      } else {
        element = document.createElement("s");
        appendInline(element, match[17], options);
      }
      parent.append(element);
      cursor = end;
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

  function renderTable(lines, startIndex, options) {
    const headers = splitTableRow(lines[startIndex]);
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    headers.forEach((header) => {
      const cell = document.createElement("th");
      cell.scope = "col";
      appendInline(cell, header, options);
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
        appendInline(cell, value, options);
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
        const table = renderTable(lines, index, options);
        fragment.append(table.element);
        index = table.nextIndex;
        continue;
      }

      const fence = /^(`{3,})(.*)$/.exec(line);
      if (fence) {
        const language = fence[2].trim().replace(/[^a-z0-9_-]/gi, "");
        const closingFence = new RegExp(`^\`{${fence[1].length},}\\s*$`);
        const codeLines = [];
        index += 1;
        while (index < lines.length && !closingFence.test(lines[index])) {
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
        appendInline(heading, headingMatch[2].trim(), options);
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
        quoteLines.forEach((quoteLine, lineIndex) => {
          if (lineIndex) paragraph.append(document.createElement("br"));
          appendInline(paragraph, quoteLine, options);
        });
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
            appendInline(item, taskMatch[2], options);
          } else {
            appendInline(item, itemMatch[1], options);
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
      appendInline(paragraph, paragraphLines.join(" "), options);
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

  function bindFormattingShortcuts(field, actions) {
    field.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey
        || (!event.ctrlKey && !event.metaKey) || field.disabled || field.readOnly) return;
      const key = `${event.shiftKey ? "shift+" : ""}${event.key.toLowerCase()}`;
      const format = {
        b: "bold", i: "italic", u: "underline", k: "link",
        "shift+x": "strike", "shift+c": "inline-code", "shift+h": "highlight",
      }[key];
      if (!format || !Object.hasOwn(actions, format)) return;
      event.preventDefault();
      actions[format]();
    });
  }

  window.BITS_MARKDOWN = Object.freeze({
    fonts, hexColor, readableHexColor, applyReadableColors, bindHexColorInputs, customFontFamily, bindFormattingShortcuts, render, renderInline, readingTime,
  });
})();
