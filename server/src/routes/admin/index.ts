import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../../db.js';
import { HttpError, badRequest, parse } from '../../lib/errors.js';
import {
  SESSION_COOKIE,
  cookieOptions,
  createSession,
  destroySession,
  hashPassword,
  requireAdmin,
  verifyPassword,
} from '../../lib/auth.js';
import { STATUSES, optionalText, todayIST } from '../../lib/fields.js';
import { emailEnabled } from '../../lib/email.js';
import { config } from '../../config.js';
import { adminWriteLimiter, loginLimiter } from '../../middleware/rateLimits.js';
import {
  addNote,
  bookingEditSchema,
  changeStatus,
  editBooking,
  getAdminBooking,
  listBookings,
  listQuerySchema,
  serializeAdminBooking,
} from '../../services/bookings.js';
import { contentRouter } from './content.js';
import { vehiclesRouter } from './vehicles.js';

export const adminRouter = Router();

adminRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
const loginSchema = z.object({ email: z.string().trim().toLowerCase().max(160), password: z.string().min(1).max(200) });

adminRouter.post('/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const user = await one<{ id: string; email: string; name: string; password_hash: string; is_active: boolean }>(
    'select id, email, name, password_hash, is_active from admin_users where email = $1',
    [email],
  );
  const ok = await verifyPassword(user?.password_hash ?? null, password);
  if (!user || !ok || !user.is_active) throw new HttpError(401, 'Incorrect email or password.', 'invalid_credentials');
  await query('update admin_users set last_login_at = now() where id = $1', [user.id]);
  const { token, ttlMs } = await createSession(user.id, req.ip, req.get('user-agent'));
  res.cookie(SESSION_COOKIE, token, cookieOptions(ttlMs));
  res.json({ admin: { id: user.id, email: user.email, name: user.name } });
});

adminRouter.post('/auth/logout', async (req, res) => {
  await destroySession(req.cookies?.[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE, cookieOptions());
  res.json({ ok: true });
});

// Everything below requires a signed-in administrator.
adminRouter.use(requireAdmin);
adminRouter.use((req, res, next) => (req.method === 'GET' ? next() : adminWriteLimiter(req, res, next)));

adminRouter.get('/auth/me', (req, res) => {
  res.json({ admin: req.admin, features: { email: emailEnabled(), supabaseStorage: config.supabaseStorage } });
});

const passwordSchema = z
  .object({ currentPassword: z.string().min(1), newPassword: z.string().min(12, 'Use at least 12 characters').max(200) })
  .refine((v) => v.currentPassword !== v.newPassword, { path: ['newPassword'], message: 'Choose a different password' });

adminRouter.post('/auth/password', async (req, res) => {
  const { currentPassword, newPassword } = parse(passwordSchema, req.body);
  const user = await one<{ password_hash: string }>('select password_hash from admin_users where id = $1', [req.admin!.id]);
  if (!user || !(await verifyPassword(user.password_hash, currentPassword))) {
    throw badRequest('Your current password is incorrect.', { currentPassword: 'Incorrect password' });
  }
  await query('update admin_users set password_hash = $2 where id = $1', [req.admin!.id, await hashPassword(newPassword)]);
  // Sign out every other session
  await query('delete from admin_sessions where admin_id = $1 and id <> $2', [req.admin!.id, req.sessionId]);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
adminRouter.get('/dashboard', async (_req, res) => {
  const today = todayIST();
  const [counts, fleet, upcoming, recent, activity, enquiries] = await Promise.all([
    query<{ status: string; n: number }>('select status, count(*)::int as n from bookings group by status'),
    one<{ active: number; inactive: number; available_today: number }>(
      `select count(*) filter (where is_active)::int as active,
              count(*) filter (where not is_active)::int as inactive,
              count(*) filter (where is_active
                and not exists (select 1 from bookings b where b.vehicle_id = v.id and b.status in ('confirmed','completed') and b.trip_range @> $1::date)
                and not exists (select 1 from vehicle_blocks k where k.vehicle_id = v.id and $1::date between k.start_date and k.end_date))::int as available_today
         from vehicles v`,
      [today],
    ),
    query(
      `select b.*, to_char(b.pickup_time, 'HH24:MI') as pickup_time, v.name as vehicle_name, v.slug as vehicle_slug, v.seats as vehicle_seats
         from bookings b left join vehicles v on v.id = b.vehicle_id
        where b.status = 'confirmed' and coalesce(b.return_date, b.trip_date) >= $1
        order by b.trip_date, b.pickup_time limit 6`,
      [today],
    ),
    query(
      `select b.*, to_char(b.pickup_time, 'HH24:MI') as pickup_time, v.name as vehicle_name, v.slug as vehicle_slug, v.seats as vehicle_seats
         from bookings b left join vehicles v on v.id = b.vehicle_id order by b.created_at desc limit 6`,
    ),
    query(
      `select e.id, e.kind, e.from_status, e.to_status, e.note, e.actor, e.created_at, b.id as booking_id, b.reference, b.customer_name
         from booking_events e join bookings b on b.id = e.booking_id order by e.created_at desc, e.id desc limit 10`,
    ),
    one<{ n: number }>(`select count(*)::int as n from enquiries where status = 'new'`),
  ]);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, counts.find((c) => c.status === s)?.n ?? 0]));
  res.json({
    today,
    bookings: { total: counts.reduce((a, c) => a + c.n, 0), ...byStatus },
    vehicles: { active: fleet?.active ?? 0, inactive: fleet?.inactive ?? 0, availableToday: fleet?.available_today ?? 0 },
    newEnquiries: enquiries?.n ?? 0,
    upcoming: upcoming.map(serializeAdminBooking),
    recent: recent.map(serializeAdminBooking),
    activity: activity.map((a) => ({
      id: a.id,
      kind: a.kind,
      fromStatus: a.from_status,
      toStatus: a.to_status,
      note: a.note,
      actor: a.actor,
      at: a.created_at,
      bookingId: a.booking_id,
      reference: a.reference,
      customerName: a.customer_name,
    })),
  });
});

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------
const idParam = z.object({ id: z.uuid('Invalid id') });

adminRouter.get('/bookings', async (req, res) => {
  res.json(await listBookings(parse(listQuerySchema, req.query)));
});

adminRouter.get('/bookings/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  res.json({ booking: await getAdminBooking(id) });
});

adminRouter.patch('/bookings/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  res.json({ booking: await editBooking(id, parse(bookingEditSchema, req.body), req.admin!) });
});

const statusSchema = z.object({ status: z.enum(STATUSES), note: optionalText(1000) });

adminRouter.post('/bookings/:id/status', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { status, note } = parse(statusSchema, req.body);
  res.json(await changeStatus(id, status, note, req.admin!));
});

adminRouter.post('/bookings/:id/notes', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { note } = parse(z.object({ note: z.string().trim().min(1, 'Write a note').max(2000) }), req.body);
  res.json({ booking: await addNote(id, note, req.admin!) });
});

// ---------------------------------------------------------------------------
// Enquiries
// ---------------------------------------------------------------------------
adminRouter.get('/enquiries', async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['new', 'handled']).optional() }), req.query);
  const rows = await query(
    `select id, name, phone, email, message, status, created_at as "createdAt" from enquiries ${status ? 'where status = $1' : ''} order by created_at desc limit 200`,
    status ? [status] : [],
  );
  res.json({ items: rows });
});

adminRouter.patch('/enquiries/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { status } = parse(z.object({ status: z.enum(['new', 'handled']) }), req.body);
  const row = await one('update enquiries set status = $2 where id = $1 returning id', [id, status]);
  if (!row) throw new HttpError(404, 'Enquiry not found', 'not_found');
  res.json({ ok: true });
});

adminRouter.delete('/enquiries/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  await query('delete from enquiries where id = $1', [id]);
  res.json({ ok: true });
});

adminRouter.use('/vehicles', vehiclesRouter);
adminRouter.use('/', contentRouter);
