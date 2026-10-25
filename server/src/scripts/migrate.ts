/**
 * Applies supabase/migrations/*.sql in order.
 *
 * Applied versions are recorded in supabase_migrations.schema_migrations — the same table the
 * Supabase CLI uses — so this runner and `supabase db push` / `supabase start` never double-apply.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROJECT_ROOT } from '../config.js';
import { pool } from '../db.js';

const dir = path.join(PROJECT_ROOT, 'supabase', 'migrations');

export async function migrate(log = console.log) {
  const client = await pool.connect();
  try {
    await client.query(`create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text)`);
    const applied = new Set((await client.query('select version from supabase_migrations.schema_migrations')).rows.map((r) => r.version));
    const files = (await fs.readdir(dir)).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
    let count = 0;
    for (const file of files) {
      const [version, ...rest] = file.replace(/\.sql$/, '').split('_');
      if (applied.has(version!)) continue;
      const sql = await fs.readFile(path.join(dir, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)', [version, rest.join('_')]);
        await client.query('commit');
      } catch (err) {
        await client.query('rollback');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
      log(`applied ${file}`);
      count++;
    }
    log(count ? `${count} migration(s) applied` : 'database is up to date');
  } finally {
    client.release();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  migrate()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
