import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";

export const query = `query ShortBitsMonitor {
  metrics {
    cpu { percentTotal }
    memory { total used available }
    network { name bytesReceived bytesSent lastUpdated }
  }
  info { os { uptime } }
  array {
    state
    capacity { kilobytes { free used total } }
    disks { idx type status temp isSpinning numErrors }
  }
}`;

export class CollectorError extends Error {
  constructor(code, fatal = false) {
    super(code);
    this.fatal = fatal;
  }
}

function requireValue(condition, code) {
  if (!condition) throw new CollectorError(code);
}

function number(value, min, max, code, integer = false) {
  const result = typeof value === "number" ? value
    : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  requireValue(Number.isFinite(result) && result >= min && result <= max
    && (!integer || Number.isSafeInteger(result)), code);
  return result;
}

export function validateConfig(config) {
  requireValue(config && typeof config === "object", "CONFIG_INVALID");
  for (const field of ["unraidUrl", "supabaseUrl"]) {
    let url;
    try { url = new URL(config[field]); } catch { throw new CollectorError("CONFIG_URL_INVALID", true); }
    requireValue(url.protocol === "https:" && !url.username && !url.password
      && !url.search && !url.hash, "CONFIG_HTTPS_REQUIRED");
    requireValue(field === "unraidUrl" ? url.pathname === "/graphql" : url.pathname === "/",
      "CONFIG_URL_PATH_INVALID");
  }
  requireValue(typeof config.unraidApiKey === "string"
    && config.unraidApiKey.trim().length >= 8 && !/[\r\n]/.test(config.unraidApiKey), "CONFIG_API_KEY_INVALID");
  requireValue(/^sbhw_[A-Za-z0-9_-]{43}$/.test(config.deviceToken), "CONFIG_DEVICE_TOKEN_INVALID");
  requireValue(typeof config.supabaseKey === "string" && config.supabaseKey.length > 10
    && !/[\r\n]/.test(config.supabaseKey), "CONFIG_PUBLIC_KEY_INVALID");
  if (!config.supabaseKey.startsWith("sb_publishable_")) {
    let role;
    try {
      role = JSON.parse(Buffer.from(config.supabaseKey.split(".")[1], "base64url").toString()).role;
    } catch {
      throw new CollectorError("CONFIG_USE_PUBLIC_PUBLISHABLE_OR_ANON_KEY", true);
    }
    requireValue(role === "anon", "CONFIG_USE_PUBLIC_PUBLISHABLE_OR_ANON_KEY");
  }
  requireValue(typeof config.networkInterface === "string"
    && /^[A-Za-z0-9_.:-]{1,64}$/.test(config.networkInterface), "CONFIG_INTERFACE_INVALID");
  return config;
}

export function networkSample(networks, interfaceName, previous, now) {
  requireValue(Array.isArray(networks), "NETWORK_RESPONSE_INVALID");
  const matches = networks.filter((entry) => entry?.name === interfaceName);
  requireValue(matches.length === 1, "NETWORK_INTERFACE_NOT_FOUND_OR_AMBIGUOUS");
  const entry = matches[0];
  const current = {
    received: number(entry.bytesReceived, 0, Number.MAX_SAFE_INTEGER, "NETWORK_COUNTER_INVALID", true),
    sent: number(entry.bytesSent, 0, Number.MAX_SAFE_INTEGER, "NETWORK_COUNTER_INVALID", true),
    time: Date.parse(entry.lastUpdated),
  };
  requireValue(Number.isFinite(current.time) && Math.abs(now - current.time) <= 120_000,
    "NETWORK_TIMESTAMP_STALE_OR_CLOCK_INCORRECT");
  let rx = null;
  let tx = null;
  if (previous) {
    requireValue(current.time > previous.time, "NETWORK_TIMESTAMP_NOT_ADVANCING");
    if (current.received >= previous.received && current.sent >= previous.sent) {
      const seconds = (current.time - previous.time) / 1000;
      rx = Math.round((current.received - previous.received) / seconds);
      tx = Math.round((current.sent - previous.sent) / seconds);
      requireValue(rx <= 1e12 && tx <= 1e12, "NETWORK_RATE_INVALID");
    }
  }
  return { current, rx, tx };
}

export function normalize(data, config, previous = null, now = Date.now()) {
  requireValue(data && typeof data === "object", "API_DATA_MISSING");
  const cpu = number(data.metrics?.cpu?.percentTotal, 0, 100, "CPU_INVALID");
  const memory = data.metrics?.memory;
  const total = number(memory?.total, 1, 1e14, "MEMORY_INVALID", true);
  const used = number(memory?.used, 0, total, "MEMORY_INVALID", true);
  const booted = Date.parse(data.info?.os?.uptime);
  requireValue(Number.isFinite(booted) && booted <= now + 300_000
    && booted > now - 365 * 86_400_000, "UPTIME_INVALID");
  const array = data.array;
  requireValue(["STARTED", "STOPPED", "STARTING", "STOPPING"].includes(array?.state), "ARRAY_STATE_UNSUPPORTED");
  const capacity = array.capacity?.kilobytes;
  const storageTotal = number(capacity?.total, 0, 8e12, "CAPACITY_INVALID", true) * 1024;
  const storageUsed = number(capacity?.used, 0, storageTotal / 1024, "CAPACITY_INVALID", true) * 1024;
  const storageFree = number(capacity?.free, 0, storageTotal / 1024, "CAPACITY_INVALID", true) * 1024;
  requireValue(Math.abs(storageFree + storageUsed - storageTotal) <= 2048, "CAPACITY_INCONSISTENT");
  requireValue(Array.isArray(array.disks) && array.disks.length <= 60, "DISKS_INVALID");
  const indices = new Set();
  const drives = array.disks.filter((disk) => disk?.type === "DATA").map((disk) => {
    const slot = number(disk.idx, 1, 100, "DISK_SLOT_INVALID", true);
    requireValue(!indices.has(slot), "DUPLICATE_DISK_SLOT");
    indices.add(slot);
    requireValue(typeof disk.isSpinning === "boolean" || disk.isSpinning === null, "DISK_SPIN_INVALID");
    return {
      slot,
      status: disk.status === "DISK_OK" ? "ok"
        : disk.status === "DISK_DSBL" ? "error" : "unknown",
      temperature_c: disk.isSpinning === true && disk.temp !== null
        ? number(disk.temp, -20, 125, "DISK_TEMPERATURE_INVALID") : null,
      spinning: disk.isSpinning,
      errors: disk.numErrors === null ? null
        : number(disk.numErrors, 0, Number.MAX_SAFE_INTEGER, "DISK_ERRORS_INVALID", true),
    };
  }).sort((a, b) => a.slot - b.slot).map(({ slot, ...disk }) => disk);
  const network = networkSample(data.metrics.network, config.networkInterface, previous, now);
  // Build every public property explicitly. Never forward API objects or identifiers.
  return {
    status: {
      cpu_percent: Math.round(cpu),
      gpu_percent: null,
      memory_total_mb: Math.round(total / 1048576),
      memory_used_mb: Math.round(used / 1048576),
      booted_at: new Date(booted).toISOString(),
    },
    nas: {
      array_state: array.state,
      storage_total_bytes: storageTotal,
      storage_used_bytes: storageUsed,
      storage_free_bytes: storageFree,
      network_rx_bytes_sec: network.rx,
      network_tx_bytes_sec: network.tx,
      drives,
    },
    nextSample: network.current,
  };
}

export async function postJson(url, headers, body, service, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // Raw fetch errors can contain local URLs; only emit fixed diagnostic codes.
    throw new CollectorError(`${service}_CONNECTION_FAILED_CHECK_TLS_DNS_AND_CONNECTIVITY`);
  }
  if (!response.ok) {
    throw new CollectorError(`${service}_HTTP_${response.status}`,
      response.status === 401 || response.status === 403);
  }
  let result;
  try { result = await response.json(); } catch { throw new CollectorError(`${service}_INVALID_JSON`); }
  requireValue(result && typeof result === "object", `${service}_INVALID_RESPONSE`);
  if (service === "UNRAID") {
    requireValue(!result.errors?.length && result.data, "UNRAID_GRAPHQL_ERROR_CHECK_SCHEMA_AND_READ_PERMISSIONS");
  } else if (result.ok !== true) {
    throw new CollectorError(result.error === "invalid_token" ? "SITE_DEVICE_TOKEN_REVOKED"
      : "SITE_REPORT_REJECTED_CHECK_MIGRATION_AND_PAYLOAD", result.error === "invalid_token");
  }
  return result;
}

export async function main(args = process.argv.slice(2)) {
  const check = args.includes("--check");
  const configPath = process.env.SHORTBITS_CONFIG ?? "/config/config.json";
  let config;
  try {
    config = validateConfig(JSON.parse(await readFile(configPath, "utf8")));
  } catch (error) {
    console.error(error instanceof CollectorError ? error.message : "CONFIG_READ_FAILED_OR_INVALID_JSON");
    return 1;
  }
  let previous = null;
  let failures = 0;
  let checking = true;
  do {
    try {
      const result = await postJson(config.unraidUrl, { "x-api-key": config.unraidApiKey }, { query }, "UNRAID");
      const report = normalize(result.data, config, previous);
      previous = report.nextSample;
      if (check) {
        if (checking) {
          checking = false;
          await sleep(5000);
          continue;
        }
        console.log("CHECK_OK: TLS, API permissions, units, disk readings and advancing network counters verified. Nothing published.");
        return 0;
      }
      const site = await postJson(`${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/hardware_agent_nas_pulse`,
        { apikey: config.supabaseKey }, { p_token: config.deviceToken, p_status: report.status, p_nas: report.nas }, "SITE");
      failures = 0;
      console.log("REPORT_OK");
      await sleep(site.watched === true ? 5000 : 15_000);
    } catch (error) {
      console.error(error instanceof CollectorError ? error.message : "COLLECTOR_UNEXPECTED_ERROR");
      previous = null;
      if (check || error instanceof CollectorError && error.fatal) return 1;
      failures += 1;
      await sleep(Math.min(60_000, 5000 * 2 ** Math.min(failures, 4)));
    }
  } while (true);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
