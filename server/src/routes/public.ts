import { Router } from 'express';
import { z } from 'zod';
import { one, query, pool } from '../db.js';
import { notFound, parse } from '../lib/errors.js';
import { addDays, isoDate, optionalEmail, phone, text, todayIST } from '../lib/fields.js';
import { sendEmail } from '../lib/email.js';
import { config } from '../config.js';
import { bookingLimiter, contactLimiter, lookupLimiter } from '../middleware/rateLimits.js';
import { bookingRequestSchema, createBookingRequest, lookupBooking } from '../services/bookings.js';
import { getSettings } from '../services/settings.js';
import { busyRanges, imagesFor, listPublicVehicles, serializeVehicle, type VehicleRow } from '../services/vehicles.js';

export const publicRouter = Router();

publicRouter.get('/health', async (_req, res) => {
  await query('select 1');
  res.json({ ok: true });
});

/** Everything the public pages need to render: editable content, services and published testimonials. */
publicRouter.get('/site', async (_req, res) => {
  const [settings, services, testimonials] = await Promise.all([
    getSettings(),
    query('select slug, title, summary, body, icon, image from services where is_active order by sort_order, title'),
    query('select id, author_name as "authorName", author_place as "authorPlace", quote, trip_label as "tripLabel" from testimonials where is_published order by sort_order, created_at desc'),
  ]);
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ settings, services, testimonials });
});

publicRouter.get('/vehicles', async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ vehicles: await listPublicVehicles() });
});

publicRouter.get('/vehicles/:slug', async (req, res) => {
  const v = await one<VehicleRow>('select * from vehicles where slug = $1 and is_active', [req.params.slug]);
  if (!v) throw notFound('Vehicle not found');
  const images = await imagesFor([v.id]);
  res.json({ vehicle: serializeVehicle(v, images.get(v.id) ?? []) });
});

const availabilityQuery = z.object({ from: isoDate.optional(), to: isoDate.optional() });

/** Busy date ranges only — never who booked or why. */
publicRouter.get('/vehicles/:slug/availability', async (req, res) => {
  const q = parse(availabilityQuery, req.query);
  const from = q.from && q.from > todayIST() ? q.from : todayIST();
  const maxTo = addDays(from, 400);
  const requested = q.to ?? addDays(from, 120);
  const to = requested > maxTo ? maxTo : requested;
  const v = await one<{ id: string }>('select id from vehicles where slug = $1 and is_active', [req.params.slug]);
  if (!v) throw notFound('Vehicle not found');
  const busy = await busyRanges(pool, v.id, from, to < from ? from : to);
  res.json({ from, to, busy });
});

publicRouter.post('/bookings', bookingLimiter, async (req, res) => {
  const input = parse(bookingRequestSchema, req.body);
  const result = await createBookingRequest(input);
  res.status(result.duplicate ? 200 : 201).json(result);
});

const lookupSchema = z.object({
  reference: z.string().trim().toUpperCase().regex(/^ETH-\d{4}-[A-Z0-9]{5}$/, 'Booking references look like ETH-2610-AB2CD'),
  phone,
});

publicRouter.post('/bookings/lookup', lookupLimiter, async (req, res) => {
  const { reference, phone: p } = parse(lookupSchema, req.body);
  res.set('Cache-Control', 'no-store');
  res.json({ booking: await lookupBooking(reference, p) });
});

const enquirySchema = z.object({
  name: text(120, 2),
  phone,
  email: optionalEmail,
  message: text(2000, 5),
  website: z.string().max(0).optional(),
});

publicRouter.post('/enquiries', contactLimiter, async (req, res) => {
  const e = parse(enquirySchema, req.body);
  await query('insert into enquiries (name, phone, email, message) values ($1, $2, $3, $4)', [e.name, e.phone, e.email, e.message]);
  void sendEmail(
    config.BUSINESS_NOTIFY_EMAIL,
    `Website enquiry from ${e.name}`,
    `${e.message}\n\n— ${e.name}\nPhone: ${e.phone}\nEmail: ${e.email ?? '—'}\n\nView enquiries: ${config.PUBLIC_SITE_URL}/admin/enquiries`,
  );
  res.status(201).json({ ok: true });
});
