import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeSiteVerification } from "./write-site-verification.mjs";

test("deployment writes only the verification file with its exact contents", async () => {
  const root = await mkdtemp(join(tmpdir(), "shortbits-verification-"));
  try {
    const filename = "google0123456789abcdef.html";
    for (const content of [`google-site-verification: ${filename}`, `google-site-verification: ${filename}\n`]) {
      await writeSiteVerification(root, content);
      assert.equal(await readFile(join(root, filename), "utf8"), content);
    }
    assert.deepEqual(await readdir(root), [filename]);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("missing, malformed, and unsafe verification values fail without creating files", async () => {
  const root = await mkdtemp(join(tmpdir(), "shortbits-verification-"));
  try {
    for (const content of [undefined, "", " ", "not verification", "google-site-verification: ../googleabc.html",
      "google-site-verification: googleabc.html\nextra content", "google-site-verification: /googleabc.html"]) {
      await assert.rejects(writeSiteVerification(root, content), /GOOGLE_SITE_VERIFICATION/);
    }
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true });
  }
});
