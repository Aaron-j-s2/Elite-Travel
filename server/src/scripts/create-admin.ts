/**
 * Creates an administrator, or resets an existing administrator's password.
 * There is deliberately no public sign-up route.
 *
 *   npm run admin:create -- --email owner@example.com --name "Owner"
 *     (prompts for the password; or pass ADMIN_PASSWORD in the environment for automation)
 */
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { z } from 'zod';
import { hashPassword } from '../lib/auth.js';
import { one, pool, query } from '../db.js';

async function promptHidden(question: string) {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  const write = (rl as any)._writeToOutput?.bind(rl);
  (rl as any)._writeToOutput = (s: string) => write?.(s.startsWith(question) ? s : '*');
  const answer = await rl.question(question);
  rl.close();
  stdout.write('\n');
  return answer;
}

async function main() {
  const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string', default: '' } } });
  const email = z.email('Pass a valid --email').parse(values.email?.trim().toLowerCase());
  const password = process.env.ADMIN_PASSWORD ?? (await promptHidden('Password (min 12 characters): '));
  if (password.length < 12) throw new Error('Password must be at least 12 characters.');

  const existing = await one('select id from admin_users where email = $1', [email]);
  const hash = await hashPassword(password);
  if (existing) {
    await query('update admin_users set password_hash = $2, is_active = true, name = coalesce(nullif($3, \'\'), name) where id = $1', [existing.id, hash, values.name]);
    await query('delete from admin_sessions where admin_id = $1', [existing.id]);
    console.log(`Password reset for ${email}; existing sessions signed out.`);
  } else {
    await query('insert into admin_users (email, name, password_hash) values ($1, $2, $3)', [email, values.name ?? '', hash]);
    console.log(`Administrator ${email} created.`);
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
