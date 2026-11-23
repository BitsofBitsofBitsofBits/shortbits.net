import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";

export const nonce = () => randomUUID();
export const snapshot = (overrides = {}) => ({
  title: "Synthetic article", slug: "synthetic-article", excerpt: "Synthetic excerpt",
  body_markdown: "Original **Markdown**", body_rich: null, published_at: null, ...overrides,
});
export async function migration(db, name) {
  await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
}
export async function rpc(db, name, args = []) {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(",");
  return (await db.query(`select public.${name}(${placeholders}) as result`,
    args.map(value => value && typeof value === "object" ? JSON.stringify(value) : value))).rows[0].result;
}
export const save = (db, state, s, request = nonce(), checkpoint = false) =>
  rpc(db, "save_blog_draft", [state.draft_id, state.version, state.base_public_version, s, request, checkpoint]);
export const publish = (db, state, request = nonce(), accept = false, expected = state.live?.updated_at ?? null) =>
  rpc(db, "publish_blog_draft", [state.draft_id, state.version, request, expected, accept]);
export async function database({ backups = false } = {}) {
  const db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  await migration(db, "20261016215500_create_blog_posts.sql");
  await migration(db, "20261101120000_increase_blog_post_limit.sql");
  await migration(db, "20261104160000_create_blog_views.sql");
  await migration(db, "20261123094500_blog_rich_content.sql");
  if (backups) {
    const singletons = ["pronoun_profiles", "site_now", "site_resume_profile"];
    for (const table of [
      ...singletons, "site_changelog", "site_favorite_games", "site_hardware", "site_hardware_machine_order",
      "site_resume_certifications", "site_resume_education", "site_resume_entries",
      "spotify_featured_playlists", "spotify_featured_tracks",
    ]) {
      await db.exec(`create table public.${table}(id text primary key, body text not null check(body <> 'INVALID'));
        insert into public.${table} values('${singletons.includes(table) ? "primary" : "one"}','synthetic');
        grant select,insert,update,delete on public.${table} to authenticated;`);
    }
    await migration(db, "20261022030000_content_backups.sql");
    await db.exec("create table site_analytics_windows_daily(window_slug text constraint site_analytics_windows_daily_window_slug_check check(window_slug='about'));");
    for (const name of [
      "20261025010000_create_creators.sql", "20261025030000_create_message_catalog.sql",
      "20261025032000_message_inline_markup.sql", "20261025033000_message_mistype_corrections.sql",
      "20261025034000_scheduled_message_pools.sql", "20261026030000_message_authors.sql",
      "20261026090000_featured_project.sql", "20261028070000_builtin_message_pool_settings.sql",
    ]) await migration(db, name);
    await db.exec("alter table site_resume_entries add position integer default 1, add technologies text, add enabled boolean default false;");
    await migration(db, "20261028093000_resume_skills.sql");
    await migration(db, "20261028180000_social_links.sql");
  }
  await migration(db, "20261123150000_private_blog_drafts.sql");
  await db.exec("set role authenticated;");
  return db;
}
export async function liveFixture(db, overrides = {}) {
  let state = await rpc(db, "load_blog_draft");
  state = await save(db, state, snapshot(overrides));
  return publish(db, state);
}
export async function raw(db, id) {
  return (await db.query("select to_jsonb(p) as row from site_blog_posts p where id=$1", [id])).rows[0]?.row;
}
export async function future(db, offset = "1 day") {
  return (await db.query(`select (now()+$1::interval)::text as t`, [offset])).rows[0].t;
}
