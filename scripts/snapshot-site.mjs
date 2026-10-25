#!/usr/bin/env node
/**
 * Saves the site's current content and fleet from a running API into the website bundle
 * (client/src/data/site-snapshot.json). The website falls back to this snapshot when it is
 * deployed without its server (e.g. as a static site), so pages still show the vehicles,
 * services and copy. Forms still need the server.
 *
 *   npm run snapshot:site                 (reads http://localhost:4000)
 *   API_URL=https://example.com npm run snapshot:site
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = process.env.API_URL ?? 'http://localhost:4000';
const get = async (p) => {
  const res = await fetch(api + p);
  if (!res.ok) throw new Error(`${p} → ${res.status}`);
  return res.json();
};

const [site, { vehicles }] = await Promise.all([get('/api/site'), get('/api/vehicles')]);
const out = path.join(root, 'client', 'src', 'data', 'site-snapshot.json');
await fs.writeFile(out, JSON.stringify({ site, vehicles }, null, 2) + '\n');
console.log(`snapshot → ${path.relative(root, out)} (${vehicles.length} vehicles, ${site.services.length} services)`);
