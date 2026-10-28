(() => {
  const styles = ["color", "fontWeight", "fontFamily", "fontSize", "fontStyle",
    "letterSpacing", "textDecoration", "textTransform"];
  const compiled = new WeakMap();
  const formats = new WeakMap();
  const emptyFormat = Object.freeze({});
  const contextKey = Symbol("messageVariables");
  const dateFormats = new Map();
  const variables = Object.freeze({
    currentdate: "Visitor-local date", date: "Alias for currentdate", day: "Full weekday name",
    time: "Visitor-local time, including seconds", year: "Four-digit year", month: "Full month name",
    dayofmonth: "Day of the month", hour: "24-hour clock hour", minute: "Two-digit minute",
    second: "Two-digit second", timezone: "Visitor's timezone", useragent: "Browser type, not the raw user-agent",
    browser: "Alias for useragent", os: "Operating system", language: "Browser language", hostname: "Current hostname",
  });
  const variablePattern = /%%|%([a-z][a-z0-9]*)%/gi;
  let segmenter;

  function browserName(device) {
    const brands = device.userAgentData?.brands ?? [];
    const brand = ["Microsoft Edge", "Opera", "Brave", "Google Chrome", "Chromium"]
      .find(name => brands.some(entry => entry.brand === name));
    if (brand && brand !== "Google Chrome" && brand !== "Chromium") return brand;
    const agent = device.userAgent ?? "";
    for (const [pattern, name] of [
      [/Edg(?:e|A|iOS)?\//, "Microsoft Edge"], [/OPR\/|OPiOS\//, "Opera"],
      [/SamsungBrowser\//, "Samsung Internet"], [/Vivaldi\//, "Vivaldi"],
      [/Firefox\/|FxiOS\//, "Firefox"], [/Chromium\//, "Chromium"],
      [/Chrome\/|CriOS\//, "Google Chrome"], [/Version\/.*Safari\//, "Safari"],
    ]) {
      if (pattern.test(agent)) return name === "Google Chrome" ? brand || name : name;
    }
    return brand || "Unknown browser";
  }

  function operatingSystem(device) {
    const agent = device.userAgent ?? "";
    if (/Android/.test(agent)) return "Android";
    if (/iPhone|iPad|iPod/.test(agent)) return "iOS";
    if (/CrOS/.test(agent)) return "ChromeOS";
    if (/Windows/.test(agent)) return "Windows";
    if (/Macintosh|Mac OS X/.test(agent)) return device.maxTouchPoints > 1 ? "iPadOS" : "macOS";
    if (/Linux/.test(agent)) return "Linux";
    return "Unknown OS";
  }

  function variableContext() {
    const device = typeof navigator === "undefined" ? {} : navigator;
    return {
      date: new Date(), values: new Map(),
      browser: browserName(device), os: operatingSystem(device),
      language: device.language || "Unknown language", hostname: window.location?.hostname || "Unknown host",
    };
  }

  function resolveVariable(name, context) {
    if (context.values.has(name)) return context.values.get(name);
    const { date } = context;
    const format = (key, options) => {
      if (!dateFormats.has(key)) dateFormats.set(key, new Intl.DateTimeFormat(undefined, options));
      return dateFormats.get(key).format(date);
    };
    let value;
    switch (name) {
      case "currentdate": case "date": value = format("date", { dateStyle: "medium" }); break;
      case "day": value = format("day", { weekday: "long" }); break;
      case "time": value = format("time", { timeStyle: "medium" }); break;
      case "year": value = String(date.getFullYear()).padStart(4, "0"); break;
      case "month": value = format("month", { month: "long" }); break;
      case "dayofmonth": value = String(date.getDate()); break;
      case "hour": value = String(date.getHours()).padStart(2, "0"); break;
      case "minute": value = String(date.getMinutes()).padStart(2, "0"); break;
      case "second": value = String(date.getSeconds()).padStart(2, "0"); break;
      case "timezone":
        if (!dateFormats.has("timezone")) dateFormats.set("timezone", new Intl.DateTimeFormat());
        value = dateFormats.get("timezone").resolvedOptions().timeZone || "Unknown timezone";
        break;
      case "useragent": case "browser": value = context.browser; break;
      case "os": value = context.os; break;
      case "language": value = context.language; break;
      case "hostname": value = context.hostname; break;
    }
    context.values.set(name, value);
    return value;
  }

  function interpolate(text, context) {
    return text.replace(variablePattern, (match, name) => match === "%%" ? "%"
      : Object.hasOwn(variables, name.toLowerCase()) ? resolveVariable(name.toLowerCase(), context) : match);
  }

  function snapshot(value) {
    const option = typeof value === "string" ? { text: value } : value;
    if (!option || typeof option.text !== "string") throw new Error("Invalid message text.");
    if (option[contextKey]) return option;
    return { ...option, [contextKey]: variableContext() };
  }

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
    const dynamic = /%%|%[a-z][a-z0-9]*%/i.test(option.text);
    const cached = compiled.get(option);
    if (cached?.source === option.text && cached.markup === Boolean(option.markup)
      && (!dynamic || option[contextKey])) return cached;
    let context = option[contextKey];
    const resolve = (text) => {
      if (!dynamic) return text;
      context ??= variableContext();
      return interpolate(text, context);
    };
    let nodes = null;
    let characters;
    if (option.markup) {
      const build = (parent) => Array.from(parent.childNodes, (node) => node.nodeType === 3
        ? { characters: splitCharacters(resolve(node.textContent)) }
        : { template: node.cloneNode(false), children: build(node) });
      nodes = build(window.BITS_MARKDOWN.renderInline(option.text));
      const flatten = (items) => items.flatMap((item) => item.characters ?? flatten(item.children));
      characters = flatten(nodes);
    } else characters = splitCharacters(resolve(option.text));
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
    styles, variables, snapshot, splitCharacters, isMessage, prepare, applyFormat, render,
    plainText: (value) => prepare(value).text,
  });
})();
