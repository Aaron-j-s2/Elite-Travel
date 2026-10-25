import pg from 'pg';

/** Creates the throwaway test database (if needed) and applies migrations to it. */
export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/elite_test');
  const dbName = url.pathname.slice(1);
  if (!/^[a-z_][a-z0-9_]*test[a-z0-9_]*$/.test(dbName)) throw new Error(`Refusing to run tests against "${dbName}" — the test database name must contain "test".`);
  const admin = new pg.Client({ connectionString: Object.assign(new URL(url), { pathname: '/postgres' }).toString() });
  await admin.connect();
  const exists = await admin.query('select 1 from pg_database where datname = $1', [dbName]);
  if (!exists.rowCount) await admin.query(`create database ${dbName}`);
  await admin.end();

  process.env.DATABASE_URL = url.toString();
  process.env.NODE_ENV = 'test';
  const { migrate } = await import('../scripts/migrate.js');
  const { pool } = await import('../db.js');
  await migrate(() => {});
  await pool.end();
}
