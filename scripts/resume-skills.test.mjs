import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { parseHTML } from "linkedom";
import { resumeContext } from "./build-resume.mjs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const migration = await readFile(new URL("../supabase/migrations/20261028093000_resume_skills.sql", import.meta.url), "utf8");
const fixture = JSON.parse(await readFile(new URL("./fixtures/resume-data.json", import.meta.url), "utf8"));

test("skills migration seeds Toolkit categories and deduplicates only published experience technologies", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create table site_resume_entries (position integer primary key, technologies text, enabled boolean);
      insert into site_resume_entries values
      (1, E'Windows Server, powershell;Zendesk|Customer Support\\nVEEAM  Zendesk', true),
      (2, 'zendesk, Active Directory, Documentation', true),
      (3, 'Private draft skill', false);`);
    const original = (await db.query("select * from site_resume_entries order by position")).rows;
    await db.exec(migration);
    const rows = (await db.query("select category, skills from site_resume_skills order by position")).rows;
    assert.equal(rows.length, 7);
    assert.equal(rows[0].category, "Systems & identity");
    assert.equal(rows[6].skills, "Zendesk, Customer Support, Documentation");
    assert.deepEqual((await db.query("select * from site_resume_entries order by position")).rows, original);
    assert.ok(!rows.some(row => row.skills.includes("Private")));
    const names = (await db.query("select content_backup_tables() as names")).rows[0].names;
    assert.ok(names.includes("site_resume_skills"));
    assert.deepEqual(names, [...names].sort());

    await db.exec("set role anon");
    assert.equal((await db.query("select * from site_resume_skills")).rows.length, 7);
    await assert.rejects(db.exec("delete from site_resume_skills"), /permission denied/);
    await assert.rejects(db.exec("update site_resume_skills set skills = 'changed'"), /permission denied/);
    await db.exec("set role authenticated");
    await db.exec("insert into site_resume_skills(position, category, skills) values (8, 'Private', 'Draft skill')");
    await assert.rejects(db.exec("update site_resume_skills set category = ' ', enabled = true where position = 8"), /check constraint/);
    await assert.rejects(db.exec("insert into site_resume_skills(position, enabled) values (9, true)"), /check constraint/);
    await assert.rejects(db.exec("insert into site_resume_skills(position) values (0)"), /check constraint|row-level security/);
    await db.exec("update site_resume_skills set enabled = false where position = 1; set role anon");
    assert.equal((await db.query("select * from site_resume_skills")).rows.length, 6);
  } finally {
    await db.close();
  }
});

test("Skills are authoritative, escaped, ordered, and independent of retained per-role technology fields", async () => {
  const template = await readFile(new URL("../professional/resume/index.html", import.meta.url), "utf8");
  const { document } = parseHTML(template);
  const { ResumeContent } = await resumeContext(root, document);
  const data = structuredClone(fixture);
  data.entries[0].technologies = "Legacy skill that must not appear";
  data.skills = [
    { category: "<Support>", skills: "Zendesk, zendesk, <PowerShell>" },
    { category: "Systems", skills: "Windows Server" },
  ];
  ResumeContent.render(data);
  assert.equal(document.querySelector("#resume-experience").textContent.includes("Legacy skill"), false);
  assert.deepEqual([...document.querySelectorAll("#resume-skills dt")].map(node => node.textContent), ["<Support>", "Systems"]);
  assert.equal(document.querySelector("#resume-skills dd").textContent, "Zendesk, <PowerShell>");
  assert.equal(document.querySelector("#resume-skills powershell"), null);
  assert.equal(document.querySelector("#resume-skills").closest("section").hidden, false);
  ResumeContent.render({ ...data, skills: [] });
  assert.equal(document.querySelector("#resume-skills").children.length, 0);
  assert.equal(document.querySelector("#resume-skills").closest("section").hidden, true);
  ResumeContent.render(data);
  assert.equal(document.querySelector("#resume-skills").closest("section").hidden, false);
});
