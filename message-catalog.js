(() => {
  const profiles = ["standard", "new-year", "christmas", "halloween", "birthday", "valentines",
    "st-patricks", "easter", "earth-day", "independence-day", "pi-day", "april-fools",
    "404-day", "may-fourth", "leap-day", "thanksgiving", "friday-the-13th"];
  const categories = {
    messages: "Rotating status messages", activities: "Activities", shutdownMessages: "Shutdown messages",
    bootMessages: "Endless boot messages", initialBootSteps: "Initial boot steps",
    playingDeadMessages: "Playing-dead messages", glitchMessages: "Desktop glitch messages",
    "monitor.cpu": "Monitor / CPU", "monitor.gpu": "Monitor / GPU", "monitor.network": "Monitor / Network",
    "monitor.ram": "Monitor / RAM", "monitor.storage": "Monitor / Storage", "monitor.thermal": "Monitor / Temperature",
  };
  const styles = window.BITS_MESSAGE_TEXT.styles;
  const bindings = new Map();
  const ttl = 300_000;
  let snapshot = null;
  let loadedAt = 0;
  let started = false;
  let pending = null;
  let status = "Bundled messages are active.";
  const activeProfiles = () => ["standard", ...(window.BITS_SEASONAL_PROFILE?.ids ?? [])];
  const cacheKey = () => `bits-message-catalog-v1:${activeProfiles().join(",")}`;
  const weighted = (category) => category === "messages" || category === "activities";
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function validate(row) {
    if (row?.corrected_text != null && (row.category !== "messages"
      || typeof row.corrected_text !== "string" || !row.corrected_text.trim()
      || row.corrected_text.length > 2000 || row.corrected_text === row.text)) {
      throw new Error("Mistype corrections need different, nonblank corrected text of at most 2,000 characters and are only supported for splash/status messages.");
    }
    if (!row || !Number.isInteger(row.position) || row.position <= 0
      || !profiles.includes(row.profile) || !Object.hasOwn(categories, row.category)
      || typeof row.text !== "string" || !row.text.trim() || row.text.length > 2000
      || !Number.isFinite(row.weight) || row.weight <= 0 || row.weight > 1000
      || typeof row.colorful !== "boolean" || !row.format || typeof row.format !== "object" || Array.isArray(row.format)
      || (row.markup !== undefined && typeof row.markup !== "boolean")
      || Object.entries(row.format).some(([key, value]) => !styles.includes(key)
        || typeof value !== "string" || value.length > 200 || /[;<>{}]|url\s*\(/i.test(value))
      || (!weighted(row.category) && (row.weight !== 1 || row.colorful || Object.keys(row.format).length))) {
      throw new Error("The message catalog contains an invalid entry.");
    }
    return row;
  }

  function applyBinding(key, binding) {
    if (!snapshot || !activeProfiles().includes(binding.profile)) return;
    const rows = snapshot.filter((row) => `${row.profile}/${row.category}` === key);
    const values = rows.length ? rows.map((row) => weighted(row.category)
      ? { text: row.text, weight: row.weight, colorful: row.colorful, format: clone(row.format), markup: row.markup ?? false,
        ...(row.corrected_text == null ? {} : { correctedText: row.corrected_text }) }
      : row.markup ? { text: row.text, markup: true } : row.text)
      : clone(binding.fallback);
    if (!rows.length && binding.fallback.length) {
      console.warn(`No enabled database entries for ${key}; using bundled messages.`);
    }
    binding.target.splice(0, binding.target.length, ...values);
  }

  function bind(profile, category, target) {
    const key = `${profile}/${category}`;
    if (!bindings.has(key)) {
      if (weighted(category)) target.forEach((option) => {
        if (typeof option.format?.bold === "boolean") {
          const { bold, ...format } = option.format;
          option.format = { ...format, fontWeight: format.fontWeight ?? (bold ? "700" : "400") };
        }
      });
      const binding = { profile, category, target, fallback: clone(target) };
      bindings.set(key, binding);
      applyBinding(key, binding);
    }
    return target;
  }

  function registerProfiles(definitions) {
    definitions.forEach((profile) => {
      Object.keys(categories).filter((key) => !key.startsWith("monitor.")).forEach((key) => {
        if (Array.isArray(profile[key])) bind(profile.id, key, profile[key]);
      });
      Object.entries(profile.monitorJokes ?? {}).forEach(([metric, pool]) => bind(profile.id, `monitor.${metric}`, pool));
    });
  }

  function apply(rows) {
    if (!Array.isArray(rows) || rows.length > 10000) throw new Error("The message catalog has an invalid size.");
    rows.forEach(validate);
    if (new Set(rows.map((row) => row.position)).size !== rows.length) throw new Error("The message catalog contains duplicate IDs.");
    snapshot = rows;
    bindings.forEach((binding, key) => applyBinding(key, binding));
    window.dispatchEvent(new CustomEvent("bits:messages-updated"));
  }

  async function refresh() {
    if (pending) return pending;
    pending = Promise.resolve().then(async () => {
      try {
        const { url, anonKey } = window.SUPABASE_CONFIG ?? {};
        if (!url || !anonKey) throw new Error("Message database configuration is missing.");
        const rows = [];
        for (let offset = 0; ; offset += 500) {
          const query = new URLSearchParams({
            select: "position,profile,category,text,weight,colorful,format,markup,corrected_text",
            enabled: "eq.true", profile: `in.(${activeProfiles().join(",")})`,
            order: "position.asc", limit: "500", offset: String(offset),
          });
          const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/site_message_catalog?${query}`, {
            headers: { apikey: anonKey }, signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) throw new Error(`Message catalog returned HTTP ${response.status}.`);
          const page = await response.json();
          if (!Array.isArray(page)) throw new Error("Message catalog returned invalid data.");
          rows.push(...page);
          if (rows.length > 10000) throw new Error("Message catalog exceeds 10,000 entries.");
          if (page.length < 500) break;
        }
        apply(rows);
        loadedAt = Date.now();
        status = "Database messages are active; empty pools use bundled messages.";
        try {
          localStorage.setItem(cacheKey(), JSON.stringify({ rows, loadedAt }));
        } catch (error) {
          console.warn("Unable to cache database messages:", error);
        }
        return true;
      } catch (error) {
        status = "Message database unavailable; cached or bundled messages remain active.";
        console.warn(status, error);
        return false;
      } finally {
        pending = null;
      }
    });
    return pending;
  }

  function start() {
    if (started) return;
    started = true;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey()) ?? "null");
      if (cached) {
        if (!Number.isFinite(cached.loadedAt)) throw new Error("Invalid message cache timestamp.");
        apply(cached.rows);
        loadedAt = cached.loadedAt;
        status = "Cached database messages are active.";
      }
    } catch (error) {
      console.warn("Unable to restore cached messages; using bundled messages:", error);
    }
    const schedule = () => {
      if (Date.now() - loadedAt < ttl) return;
      if (window.requestIdleCallback) window.requestIdleCallback(() => refresh(), { timeout: 5000 });
      else window.setTimeout(() => refresh(), 1000);
    };
    if (document.documentElement.dataset.runtime === "pending") {
      window.addEventListener("bits:runtime-ready", schedule, { once: true });
    } else if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", schedule, { once: true });
    } else schedule();
    window.addEventListener("focus", schedule);
  }

  window.BITS_MESSAGE_CATALOG = { profiles, categories, styles, weighted, validate, bind, registerProfiles, start, refresh,
    get status() { return status; } };
  for (const [category, global] of [["messages", "BITS_MESSAGES"], ["activities", "BITS_ACTIVITIES"], ["shutdownMessages", "BITS_SHUTDOWN_MESSAGES"]]) {
    if (Array.isArray(window[global])) bind("standard", category, window[global]);
  }
})();
