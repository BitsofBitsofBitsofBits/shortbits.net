import test from "node:test";
import assert from "node:assert/strict";
import { normalize, networkSample, postJson, validateConfig } from "./collector.mjs";

const now = Date.parse("2026-10-23T12:00:00Z");
const config = { networkInterface: "br0" };
function fixture() {
  return {
    hostname: "PRIVATE_HOST",
    metrics: {
      cpu: { percentTotal: 2.6 },
      memory: { total: 128 * 1024 ** 3, used: 60 * 1024 ** 3, available: 70 * 1024 ** 3 },
      network: [
        { name: "br0", bytesReceived: "1000", bytesSent: "2000", lastUpdated: new Date(now).toISOString(), ip: "PRIVATE_IP" },
        { name: "shim", bytesReceived: 9000, bytesSent: 9000, lastUpdated: new Date(now).toISOString() },
      ],
    },
    info: { os: { uptime: new Date(now - 86_400_000).toISOString(), serial: "PRIVATE_SERIAL" } },
    array: {
      state: "STARTED",
      capacity: { kilobytes: { total: "1000", used: "600", free: "400" } },
      disks: [
        { idx: 2, type: "DATA", status: "DISK_OK", temp: null, isSpinning: false, numErrors: "0", serial: "PRIVATE_DRIVE" },
        { idx: 1, type: "DATA", status: "DISK_OK", temp: 36, isSpinning: true, numErrors: 0 },
      ],
    },
  };
}

test("normalizes units and builds a private-data-free public allowlist", () => {
  const report = normalize(fixture(), config, null, now);
  assert.equal(report.status.cpu_percent, 3);
  assert.equal(report.status.memory_total_mb, 131072);
  assert.equal(report.status.memory_used_mb, 61440);
  assert.equal(report.nas.storage_total_bytes, 1024000);
  assert.equal(report.nas.storage_used_bytes, 614400);
  assert.equal(report.nas.network_rx_bytes_sec, null);
  assert.equal(report.nas.drives[0].temperature_c, 36);
  assert.deepEqual(report.nas.drives[1], { status: "ok", temperature_c: null, spinning: false, errors: 0 });
  const outgoing = JSON.stringify({ p_status: report.status, p_nas: report.nas });
  for (const excluded of ["PRIVATE", "hostname", "serial", "br0", "shim", "idx", "bytesReceived"]) {
    assert.ok(!outgoing.includes(excluded), excluded);
  }
});

test("network uses one interface, source time, and counter deltas", () => {
  const data = fixture();
  const initial = networkSample(data.metrics.network, "br0", null, now);
  data.metrics.network[0].bytesReceived = 118532 + 1000;
  data.metrics.network[0].bytesSent = 2198531 + 2000;
  data.metrics.network[0].lastUpdated = new Date(now + 31280).toISOString();
  const next = networkSample(data.metrics.network, "br0", initial.current, now + 31280);
  assert.equal(next.rx, 3789);
  assert.equal(next.tx, 70286);
  data.metrics.network[0].bytesSent = 0;
  const reset = networkSample(data.metrics.network, "br0", initial.current, now + 31280);
  assert.equal(reset.rx, null);
  assert.equal(reset.tx, null);
});

test("rejects stale, duplicate, missing, and unsafe counter samples", () => {
  const data = fixture();
  const first = networkSample(data.metrics.network, "br0", null, now);
  assert.throws(() => networkSample(data.metrics.network, "br0", first.current, now), /NOT_ADVANCING/);
  assert.throws(() => networkSample(data.metrics.network, "br0", null, now + 180000), /STALE/);
  assert.throws(() => networkSample(data.metrics.network, "missing", null, now), /NOT_FOUND/);
  data.metrics.network.push(data.metrics.network[0]);
  assert.throws(() => networkSample(data.metrics.network, "br0", null, now), /AMBIGUOUS/);
  data.metrics.network.pop();
  data.metrics.network[0].bytesReceived = "9007199254740992";
  assert.throws(() => networkSample(data.metrics.network, "br0", null, now), /COUNTER/);
});

test("unknown disk status is not presented as healthy; sleeping temperature stays null", () => {
  const data = fixture();
  data.array.disks[0].status = "FUTURE_STATUS";
  data.array.disks[0].temp = 99;
  data.array.disks[0].numErrors = null;
  const drive = normalize(data, config, null, now).nas.drives[1];
  assert.equal(drive.status, "unknown");
  assert.equal(drive.temperature_c, null);
  assert.equal(drive.errors, null);
});

test("missing and malformed API fields cannot produce fresh healthy reports", () => {
  const mutations = [
    (d) => { d.metrics.cpu = null; },
    (d) => { d.metrics.memory.used = null; },
    (d) => { d.array.capacity.kilobytes.free = "9999"; },
    (d) => { d.array.state = "SURPRISE"; },
    (d) => { d.array.disks[0].idx = 1; },
    (d) => { d.array.disks[1].temp = 900; },
    (d) => { d.info.os.uptime = "not a date"; },
  ];
  for (const mutate of mutations) {
    const data = fixture();
    mutate(data);
    assert.throws(() => normalize(data, config, null, now));
  }
});

test("HTTP 200 GraphQL errors and partial responses are failures", async () => {
  const fake = async () => new Response(JSON.stringify({ data: fixture(), errors: [{ message: "PRIVATE_DETAIL" }] }));
  await assert.rejects(postJson("https://example.test", {}, {}, "UNRAID", fake), /GRAPHQL_ERROR/);
  const denied = async () => new Response("", { status: 403 });
  await assert.rejects(postJson("https://example.test", {}, {}, "UNRAID", denied),
    (error) => error.fatal && !error.message.includes("PRIVATE"));
  const broken = async () => { throw new Error("https://PRIVATE_KEY@example.test"); };
  await assert.rejects(postJson("https://example.test", {}, {}, "UNRAID", broken),
    (error) => error.message.includes("CONNECTION_FAILED") && !error.message.includes("PRIVATE_KEY"));
});

test("site rejection is not mistaken for delivery success", async () => {
  const fake = async () => new Response('{"ok":false,"error":"invalid_token"}');
  await assert.rejects(postJson("https://example.test", {}, {}, "SITE", fake),
    (error) => error.fatal && error.message === "SITE_DEVICE_TOKEN_REVOKED");
});

test("configuration enforces HTTPS, safe credentials, and an explicit interface", () => {
  const valid = {
    unraidUrl: "https://nas.example.test:444/graphql", supabaseUrl: "https://example.supabase.co",
    unraidApiKey: "example-test-key", supabaseKey: "sb_publishable_example_public_key",
    deviceToken: `sbhw_${"x".repeat(43)}`, networkInterface: "br0",
  };
  assert.equal(validateConfig(valid), valid);
  for (const change of [
    { unraidUrl: "http://nas.example.test/graphql" },
    { unraidUrl: "https://user:password@nas.example.test/graphql" },
    { unraidApiKey: "secret\nbad" },
    { supabaseKey: "sb_secret_example_private_key" },
    { deviceToken: "invalid" }, { networkInterface: "" },
  ]) assert.throws(() => validateConfig({ ...valid, ...change }));
});
