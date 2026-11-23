export const MAX_BODY_BYTES = 65_536;
const versionPattern = /^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})(?:\.(0|[1-9][0-9]{0,3}))?$/;
export const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, required, optional = []) => record(value)
  && required.every(key => Object.hasOwn(value, key))
  && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
export function normalizeVersion(value) {
  if (typeof value !== "string" || !versionPattern.test(value)) throw new Error("Invalid version.");
  return value.replace(/\.0$/, match => value.split(".").length === 3 ? "" : match);
}
function text(value, limit) {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f-\u009f\uD800-\uDFFF]/u.test(value)) throw new Error("Invalid note text.");
  const normalized = value.replace(/^ +| +$/g, "");
  if (![...normalized].length || [...normalized].length > limit) throw new Error("Invalid note length.");
  return normalized;
}
export function validateRelease(value) {
  if (!exactKeys(value, ["release_id", "notes"], ["version"])
    || typeof value.release_id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,99}$/.test(value.release_id)
    || !Array.isArray(value.notes) || value.notes.length < 1 || value.notes.length > 20) throw new Error("Invalid reviewed release.");
  const notes = value.notes.map(note => {
    if (!exactKeys(note, ["title", "summary"])) throw new Error("Invalid note fields.");
    return { title: text(note.title, 80), summary: text(note.summary, 800) };
  });
  if (new Set(notes.map(note => note.title)).size !== notes.length) throw new Error("Duplicate note title.");
  return { release_id: value.release_id, ...(Object.hasOwn(value, "version") ? { version: normalizeVersion(value.version) } : {}), notes };
}
export function validatePayload(value) {
  if (!exactKeys(value, ["release_id", "notes", "source_commit", "run_url"], ["version"])
    || typeof value.source_commit !== "string" || !/^[a-f0-9]{40}$/.test(value.source_commit)
    || typeof value.run_url !== "string" || value.run_url.length > 300
    || !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/[1-9][0-9]*$/.test(value.run_url)) throw new Error("Invalid publication context.");
  const { source_commit, run_url, ...release } = value;
  return { ...validateRelease(release), source_commit, run_url };
}
export function validateResult(value, payload) {
  if (!exactKeys(value, ["ok", "release_id", "version", "published_at", "positions", "idempotent"])
    || value.ok !== true || value.release_id !== payload.release_id || typeof value.idempotent !== "boolean"
    || typeof value.published_at !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value.published_at)
    || !Number.isFinite(Date.parse(value.published_at))
    || !Array.isArray(value.positions) || value.positions.length !== payload.notes.length
    || value.positions.some((position, index) => !Number.isSafeInteger(position) || position < 1 || position > 2_147_483_647
      || index > 0 && position !== value.positions[index - 1] + 1)
    || normalizeVersion(value.version) !== value.version
    || Object.hasOwn(payload, "version") && value.version !== payload.version) throw new Error("Invalid publisher response.");
  return value;
}
export async function readBoundedJson(body, limit = MAX_BODY_BYTES) {
  const reader = body?.getReader();
  if (!reader) throw new Error("invalid");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("oversized"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
