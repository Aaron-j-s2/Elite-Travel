import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../../db.js';
import { conflict, notFound, parse } from '../../lib/errors.js';
import { optionalText, slug, slugify, text } from '../../lib/fields.js';
import { SETTING_KEYS, getSettings, saveSetting, type SettingKey } from '../../services/settings.js';

export const contentRouter = Router();

const idParam = z.object({ id: z.uuid() });

// ---------------------------------------------------------------------------
// Site settings
// ---------------------------------------------------------------------------
contentRouter.get('/settings', async (_req, res) => {
  res.json({ settings: await getSettings() });
});

contentRouter.put('/settings/:key', async (req, res) => {
  const { key } = parse(z.object({ key: z.enum(SETTING_KEYS as [SettingKey, ...SettingKey[]]) }), req.params);
  res.json({ key, value: await saveSetting(key, req.body, req.admin!.id) });
});

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------
export const SERVICE_ICONS = ['bus', 'car', 'users', 'heart', 'route', 'mountain', 'map', 'sparkles', 'briefcase', 'landmark'] as const;

const serviceSchema = z.object({
  title: text(80, 2),
  slug: slug.optional().or(z.literal('').transform(() => undefined)),
  summary: text(240),
  body: z.string().trim().max(4000).default(''),
  icon: z.enum(SERVICE_ICONS).default('route'),
  image: optionalText(200),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(-1000).max(1000).default(0),
});

const serviceCols = `id, slug, title, summary, body, icon, image, is_active as "isActive", sort_order as "sortOrder"`;

contentRouter.get('/services', async (_req, res) => {
  res.json({ items: await query(`select ${serviceCols} from services order by sort_order, title`) });
});

contentRouter.post('/services', async (req, res) => {
  const s = parse(serviceSchema, req.body);
  const row = await one(
    `insert into services (slug, title, summary, body, icon, image, is_active, sort_order) values ($1,$2,$3,$4,$5,$6,$7,$8) returning ${serviceCols}`,
    [s.slug ?? slugify(s.title), s.title, s.summary, s.body, s.icon, s.image, s.isActive, s.sortOrder],
  ).catch((err) => {
    if (err.code === '23505') throw conflict('Another service already uses that slug.');
    throw err;
  });
  res.status(201).json({ item: row });
});

contentRouter.put('/services/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const s = parse(serviceSchema, req.body);
  const row = await one(
    `update services set slug = coalesce($2, slug), title=$3, summary=$4, body=$5, icon=$6, image=$7, is_active=$8, sort_order=$9 where id=$1 returning ${serviceCols}`,
    [id, s.slug ?? null, s.title, s.summary, s.body, s.icon, s.image, s.isActive, s.sortOrder],
  ).catch((err) => {
    if (err.code === '23505') throw conflict('Another service already uses that slug.');
    throw err;
  });
  if (!row) throw notFound('Service not found');
  res.json({ item: row });
});

contentRouter.delete('/services/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  await query('delete from services where id = $1', [id]);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Testimonials — genuine reviews only; hidden until published
// ---------------------------------------------------------------------------
const testimonialSchema = z.object({
  authorName: text(80, 2),
  authorPlace: optionalText(80),
  quote: text(800, 10),
  tripLabel: optionalText(80),
  sourceNote: optionalText(200),
  isPublished: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(-1000).max(1000).default(0),
});

const tCols = `id, author_name as "authorName", author_place as "authorPlace", quote, trip_label as "tripLabel", source_note as "sourceNote",
               is_published as "isPublished", sort_order as "sortOrder", created_at as "createdAt"`;

contentRouter.get('/testimonials', async (_req, res) => {
  res.json({ items: await query(`select ${tCols} from testimonials order by sort_order, created_at desc`) });
});

contentRouter.post('/testimonials', async (req, res) => {
  const t = parse(testimonialSchema, req.body);
  const row = await one(
    `insert into testimonials (author_name, author_place, quote, trip_label, source_note, is_published, sort_order) values ($1,$2,$3,$4,$5,$6,$7) returning ${tCols}`,
    [t.authorName, t.authorPlace, t.quote, t.tripLabel, t.sourceNote, t.isPublished, t.sortOrder],
  );
  res.status(201).json({ item: row });
});

contentRouter.put('/testimonials/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const t = parse(testimonialSchema, req.body);
  const row = await one(
    `update testimonials set author_name=$2, author_place=$3, quote=$4, trip_label=$5, source_note=$6, is_published=$7, sort_order=$8 where id=$1 returning ${tCols}`,
    [id, t.authorName, t.authorPlace, t.quote, t.tripLabel, t.sourceNote, t.isPublished, t.sortOrder],
  );
  if (!row) throw notFound('Testimonial not found');
  res.json({ item: row });
});

contentRouter.delete('/testimonials/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  await query('delete from testimonials where id = $1', [id]);
  res.json({ ok: true });
});
