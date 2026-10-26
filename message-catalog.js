(() => {
  const builtinProfiles = ["standard", "new-year", "christmas", "halloween", "birthday", "valentines",
    "st-patricks", "easter", "earth-day", "independence-day", "pi-day", "april-fools",
    "404-day", "may-fourth", "leap-day", "thanksgiving", "friday-the-13th"];
  const profiles = [...builtinProfiles];
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
  let pools = [];
  let timezone = null;
  let loadedDay = "";
  const formatters = new Map();
  const validatedZones = new Set();
  const temporal = typeof Temporal === "undefined" ? null : Temporal;
  const activeProfiles = (options, date = new Date()) => ["standard", ...(window.BITS_GET_SEASONAL_PROFILE?.(date, options)?.ids ?? [])];
  const cacheKey = () => "bits-message-catalog-v2";
  const weighted = (category) => category === "messages" || category === "activities";
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function validateEntry(row, allowedProfiles) {
    if (row?.corrected_text != null && (row.category !== "messages"
      || typeof row.corrected_text !== "string" || !row.corrected_text.trim()
      || row.corrected_text.length > 2000 || row.corrected_text === row.text)) {
      throw new Error("Mistype corrections need different, nonblank corrected text of at most 2,000 characters and are only supported for splash/status messages.");
    }
    if (!row || !Number.isInteger(row.position) || row.position <= 0
      || !allowedProfiles.includes(row.profile) || !Object.hasOwn(categories, row.category)
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

  const validate = (row) => validateEntry(row, profiles);
  function validateTimezone(value) {
    if (typeof value !== "string" || !value.trim() || value.length > 100 || /^[+-]/.test(value)) throw new Error("Enter a valid IANA timezone, such as America/Chicago.");
    if (!validatedZones.has(value)) {
      if (temporal) temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(value);
      else formatters.set(value, new Intl.DateTimeFormat("en-US", {
        timeZone: value, year: "numeric", month: "2-digit", day: "2-digit",
      }));
      validatedZones.add(value);
    }
    return value;
  }
  function calendarDate(date, zone = timezone) {
    if (!zone) return date;
    validateTimezone(zone);
    const parts = temporal ? temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(zone)
      : Object.fromEntries(formatters.get(zone).formatToParts(date).map(({ type, value }) => [type, value]));
    return new Date(`${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T12:00:00`);
  }
  const dayKey = (date) => `${date.getFullYear().toString().padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  function validatePool(pool) {
    const validDate = (value) => typeof value === "string" && /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)
      && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
    if (!pool || !/^custom-[a-z0-9-]{1,70}$/.test(pool.id) || typeof pool.title !== "string"
      || !pool.title.trim() || pool.title.length > 100 || !["annual", "once"].includes(pool.schedule)
      || !["exclusive", "additive"].includes(pool.mode) || typeof pool.enabled !== "boolean"
      || !validDate(pool.starts_on) || !validDate(pool.ends_on)
      || (pool.schedule === "once" && pool.ends_on < pool.starts_on)) {
      throw new Error("Enter a pool name, valid dates, and an additive/exclusive mode. One-time ranges must end on or after their start.");
    }
    return pool;
  }
  function setAdminPools(values) {
    values.forEach(validatePool);
    pools = values;
    profiles.splice(0, profiles.length, ...builtinProfiles, ...values.map((pool) => pool.id));
  }
  function valueFor(row) {
    return weighted(row.category)
      ? { text: row.text, weight: row.weight, colorful: row.colorful, format: clone(row.format), markup: row.markup ?? false,
        ...(row.corrected_text == null ? {} : { correctedText: row.corrected_text }) }
      : row.markup ? { text: row.text, markup: true } : row.text;
  }
  function scheduledProfiles(date, definitions = pools) {
    const today = dayKey(date);
    return definitions.filter((pool) => {
      if (!pool.enabled) return false;
      if (pool.schedule === "once") return today >= pool.starts_on && today <= pool.ends_on;
      const day = today.slice(5), start = pool.starts_on.slice(5), end = pool.ends_on.slice(5);
      return start <= end ? day >= start && day <= end : day >= start || day <= end;
    }).map((pool) => {
      const profile = { id: pool.id, mode: pool.mode, monitorJokes: {} };
      Object.keys(categories).forEach((category) => {
        const values = (snapshot ?? []).filter((row) => row.profile === pool.id && row.category === category).map(valueFor);
        if (category.startsWith("monitor.")) profile.monitorJokes[category.slice(8)] = values;
        else profile[category] = values;
      });
      return profile;
    });
  }

  function applyBinding(key, binding, ids = activeProfiles()) {
    if (!snapshot || !ids.includes(binding.profile)) return;
    const rows = snapshot.filter((row) => `${row.profile}/${row.category}` === key);
    const values = rows.length ? rows.map(valueFor)
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

  function apply(rows, definitions, zone) {
    if (!Array.isArray(definitions) || definitions.length > 1000) throw new Error("Invalid scheduled message pools.");
    definitions.forEach(validatePool);
    if (new Set(definitions.map((pool) => pool.id)).size !== definitions.length) throw new Error("Duplicate message pool IDs.");
    validateTimezone(zone);
    if (!Array.isArray(rows) || rows.length > 10000) throw new Error("The message catalog has an invalid size.");
    const allowed = [...builtinProfiles, ...definitions.map((pool) => pool.id)];
    rows.forEach((row) => validateEntry(row, allowed));
    if (new Set(rows.map((row) => row.position)).size !== rows.length) throw new Error("The message catalog contains duplicate IDs.");
    setAdminPools(definitions);
    timezone = zone;
    snapshot = rows;
    const ids = activeProfiles();
    bindings.forEach((binding, key) => applyBinding(key, binding, ids));
    window.dispatchEvent(new CustomEvent("bits:messages-updated"));
  }

  async function refresh() {
    if (pending) return pending;
    pending = Promise.resolve().then(async () => {
      try {
        const { url, anonKey } = window.SUPABASE_CONFIG ?? {};
        if (!url || !anonKey) throw new Error("Message database configuration is missing.");
        const read = async (table, query) => {
          const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${table}?${new URLSearchParams(query)}`, {
            headers: { apikey: anonKey }, signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) throw new Error(`${table} returned HTTP ${response.status}.`);
          const result = await response.json();
          if (!Array.isArray(result)) throw new Error(`${table} returned invalid data.`);
          return result;
        };
        const [settings, definitions] = await Promise.all([
          read("site_message_settings", { select: "id,timezone", id: "eq.primary" }),
          read("site_message_pools", { select: "id,title,schedule,starts_on,ends_on,mode,enabled", enabled: "eq.true", order: "id.asc", limit: "1000" }),
        ]);
        if (settings.length !== 1 || settings[0].id !== "primary") throw new Error("The message calendar settings are missing.");
        if (definitions.length >= 1000) throw new Error("Too many custom pools; at most 999 are supported.");
        const zone = validateTimezone(settings[0].timezone);
        definitions.forEach(validatePool);
        const selectionDate = new Date();
        const ids = activeProfiles({ pools: definitions, timezone: zone }, selectionDate);
        const rows = [];
        for (let offset = 0; ; offset += 500) {
          const query = new URLSearchParams({
            select: "position,profile,category,text,weight,colorful,format,markup,corrected_text",
            enabled: "eq.true", profile: `in.(${ids.join(",")})`,
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
        apply(rows, definitions, zone);
        loadedAt = selectionDate.getTime();
        loadedDay = dayKey(calendarDate(selectionDate));
        status = "Database messages are active; empty pools use bundled messages.";
        try {
          localStorage.setItem(cacheKey(), JSON.stringify({ rows, pools: definitions, timezone: zone, loadedAt }));
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
        apply(cached.rows, cached.pools, cached.timezone);
        loadedAt = cached.loadedAt;
        loadedDay = dayKey(calendarDate(new Date(loadedAt)));
        status = "Cached database messages are active.";
      }
    } catch (error) {
      console.warn("Unable to restore cached messages; using bundled messages:", error);
    }
    const schedule = () => {
      if (Date.now() - loadedAt < ttl && loadedDay === dayKey(calendarDate(new Date()))) return;
      if (window.requestIdleCallback) window.requestIdleCallback(() => refresh(), { timeout: 5000 });
      else window.setTimeout(() => refresh(), 1000);
    };
    if (document.documentElement.dataset.runtime === "pending") {
      window.addEventListener("bits:runtime-ready", schedule, { once: true });
    } else if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", schedule, { once: true });
    } else schedule();
    window.addEventListener("focus", schedule);
    const checkDay = () => {
      if (!document.hidden && snapshot && loadedDay !== dayKey(calendarDate(new Date()))) schedule();
      window.setTimeout(checkDay, 60_000);
    };
    window.setTimeout(checkDay, 60_000);
  }

  window.BITS_MESSAGE_CATALOG = { profiles, builtinProfiles, categories, styles, weighted, validate, validatePool,
    validateTimezone, calendarDate, scheduledProfiles, setAdminPools, bind, registerProfiles, start, refresh,
    get status() { return status; } };
  for (const [category, global] of [["messages", "BITS_MESSAGES"], ["activities", "BITS_ACTIVITIES"], ["shutdownMessages", "BITS_SHUTDOWN_MESSAGES"]]) {
    if (Array.isArray(window[global])) bind("standard", category, window[global]);
  }
})();
