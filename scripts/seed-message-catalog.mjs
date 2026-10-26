import { writeFile } from "node:fs/promises";
import { messageCatalogDefaults } from "./message-catalog-data.mjs";

const rows = messageCatalogDefaults();
const json = JSON.stringify(rows);
if (json.includes("$catalog_seed$")) throw new Error("Seed delimiter occurs in message data.");
await writeFile(new URL("../supabase/migrations/20261025031000_seed_message_catalog.sql", import.meta.url),
  `-- Snapshot of the existing bundled catalogs, including local additions at migration time.\n`
  + `insert into public.site_message_catalog (position, profile, category, text, weight, colorful, format, enabled)\n`
  + `select position, profile, category, text, weight, colorful, format, enabled\n`
  + `from jsonb_to_recordset($catalog_seed$${json}$catalog_seed$::jsonb)\n`
  + `as entry(position integer, profile text, category text, text text, weight double precision, colorful boolean, format jsonb, enabled boolean);\n`);
console.log(`Seeded ${rows.length} messages across ${new Set(rows.map((row) => `${row.profile}/${row.category}`)).size} pools.`);
