import type { PoolClient } from 'pg';
import { z } from 'zod';
import { one, query, tx } from '../db.js';
import { sendEmail, type EmailResult } from '../lib/email.js';
import { HttpError, badRequest, conflict, notFound } from '../lib/errors.js';
import {
  CATEGORIES,
  STATUSES,
  TRIP_TYPES,
  addDays,
  daysBetweenInclusive,
  isoDate,
  newBookingReference,
  optionalNumber,
  optionalEmail,
  optionalText,
  phone,
  text,
  timeOfDay,
  todayIST,
  type BookingStatus,
} from '../lib/fields.js';
import { config } from '../config.js';
import { busyRanges, type VehicleRow } from './vehicles.js';

const MAX_DAYS_AHEAD = 400;
const MAX_TRIP_DAYS = 60;

const tripShape = {
  vehicleCategory: z.enum(CATEGORIES, { error: 'Choose a vehicle type' }),
  vehicleId: z.uuid().optional().nullable().transform((v) => v ?? null),
  pickupLocation: text(160, 2),
  destination: text(160, 2),
  tripType: z.enum(TRIP_TYPES, { error: 'Choose a trip type' }),
  tripDate: isoDate,
  returnDate: isoDate.optional().nullable().or(z.literal('').transform(() => null)).transform((v) => v ?? null),
  pickupTime: timeOfDay,
  passengers: z.coerce.number({ error: 'Enter the number of passengers' }).int().min(1, 'At least 1').max(80, 'At most 80'),
  requirements: optionalText(1000),
};

function checkDates(v: { tripType: string; tripDate: string; returnDate: string | null }, ctx: z.RefinementCtx, allowPast: boolean) {
  const today = todayIST();
  if (!allowPast && v.tripDate < today) ctx.addIssue({ code: 'custom', path: ['tripDate'], message: 'Trip date can’t be in the past' });
  if (v.tripDate > addDays(today, MAX_DAYS_AHEAD)) ctx.addIssue({ code: 'custom', path: ['tripDate'], message: 'We take bookings up to about a year ahead' });
  if (v.tripType === 'round_trip' || v.tripType === 'multi_day') {
    if (!v.returnDate) ctx.addIssue({ code: 'custom', path: ['returnDate'], message: 'Add a return date' });
  }
  if (v.returnDate) {
    if (v.returnDate < v.tripDate) ctx.addIssue({ code: 'custom', path: ['returnDate'], message: 'Return date must be on or after the trip date' });
    else if (daysBetweenInclusive(v.tripDate, v.returnDate) > MAX_TRIP_DAYS) ctx.addIssue({ code: 'custom', path: ['returnDate'], message: `Trips longer than ${MAX_TRIP_DAYS} days — please call us` });
  }
}

export const bookingRequestSchema = z
  .object({
    customerName: text(120, 2),
    customerPhone: phone,
    customerEmail: optionalEmail,
    ...tripShape,
    // Honeypot: real visitors never see or fill this field.
    website: z.string().max(0).optional().or(z.string().transform(() => 'BOT')),
  })
  .superRefine((v, ctx) => checkDates(v, ctx, false))
  .transform((v) => ({ ...v, returnDate: v.tripType === 'one_way' || v.tripType === 'local' ? (v.returnDate && v.returnDate !== v.tripDate ? v.returnDate : null) : v.returnDate }));

export const bookingEditSchema = z
  .object({
    customerName: text(120, 2),
    customerPhone: phone,
    customerEmail: optionalEmail,
    ...tripShape,
    quotedFare: optionalNumber(z.number().min(0).max(10_000_000)),
    adminNotes: optionalText(4000),
  })
  .superRefine((v, ctx) => checkDates(v, ctx, true));

export type BookingRequest = z.output<typeof bookingRequestSchema>;

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Request received',
  confirmed: 'Confirmed',
  rejected: 'Not available',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

/** Which status changes an administrator may make. */
export const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'pending'],
  rejected: ['pending'],
  cancelled: ['pending'],
  completed: [],
};

/**
 * 'update' serialises everything that can confirm a trip for this vehicle: a second confirmation
 * waits for the first to commit and then sees its booking. The exclusion constraint backs this up.
 */
async function loadVehicle(db: PoolClient, id: string, lock: 'share' | 'update' | null = null) {
  const { rows } = await db.query<VehicleRow>(`select * from vehicles where id = $1${lock ? ` for ${lock}` : ''}`, [id]);
  return rows[0] ?? null;
}

/** Throws 409 when the vehicle has a confirmed trip or an unavailability block on any of the dates. */
async function assertVehicleFree(db: PoolClient, vehicleId: string, from: string, to: string, ignoreBookingId?: string) {
  const busy = await busyRanges(db, vehicleId, from, to, ignoreBookingId);
  if (busy.length) {
    throw conflict('This vehicle is already booked or unavailable on those dates. Please choose other dates or another vehicle.', 'unavailable');
  }
}

function estimate(vehicle: VehicleRow | null, tripDate: string, returnDate: string | null) {
  if (!vehicle?.day_rate) return null;
  return Math.round(vehicle.day_rate * daysBetweenInclusive(tripDate, returnDate ?? tripDate) * 100) / 100;
}

async function logEvent(
  db: PoolClient,
  bookingId: string,
  e: { kind: 'created' | 'status' | 'edit' | 'note'; from?: string | null; to?: string | null; note?: string | null; adminId?: string | null; actor: string },
) {
  await db.query(
    'insert into booking_events (booking_id, kind, from_status, to_status, note, admin_id, actor) values ($1, $2, $3, $4, $5, $6, $7)',
    [bookingId, e.kind, e.from ?? null, e.to ?? null, e.note ?? null, e.adminId ?? null, e.actor],
  );
}

// ---------------------------------------------------------------------------
// Public: create a booking request
// ---------------------------------------------------------------------------
export async function createBookingRequest(input: BookingRequest) {
  if (input.website === 'BOT') throw badRequest('Request rejected.');

  const result = await tx(async (db) => {
    let vehicle: VehicleRow | null = null;
    if (input.vehicleId) {
      vehicle = await loadVehicle(db, input.vehicleId, 'share');
      if (!vehicle || !vehicle.is_active) throw badRequest('That vehicle is not available for booking. Please choose another.', { vehicleId: 'Choose another vehicle' });
      if (vehicle.category !== input.vehicleCategory) throw badRequest('The selected vehicle does not match the vehicle type.', { vehicleId: 'Vehicle does not match the type' });
      if (vehicle.seats && input.passengers > vehicle.seats) {
        throw new HttpError(400, `${vehicle.name} seats up to ${vehicle.seats}. Choose a larger vehicle or call us to plan for your group.`, 'too_many_passengers', { passengers: `Up to ${vehicle.seats} in this vehicle` });
      }
      await assertVehicleFree(db, vehicle.id, input.tripDate, input.returnDate ?? input.tripDate);
    }

    // Same person, same trip, still pending → treat as a double submission and return the original.
    const dup = await db.query<{ reference: string }>(
      `select reference from bookings
        where customer_phone = $1 and trip_date = $2 and pickup_time = $3 and vehicle_id is not distinct from $4
          and status = 'pending' and created_at > now() - interval '24 hours'
        limit 1`,
      [input.customerPhone, input.tripDate, input.pickupTime, input.vehicleId],
    );
    if (dup.rows[0]) return { reference: dup.rows[0].reference, duplicate: true, vehicle, booking: null };

    const estimated = estimate(vehicle, input.tripDate, input.returnDate);
    for (let attempt = 0; attempt < 6; attempt++) {
      const reference = newBookingReference();
      await db.query('savepoint ref_try');
      try {
        const { rows } = await db.query<{ id: string; reference: string; created_at: string }>(
          `insert into bookings (reference, customer_name, customer_phone, customer_email, vehicle_category, vehicle_id,
                                 pickup_location, destination, trip_type, trip_date, return_date, pickup_time, passengers,
                                 requirements, estimated_price)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           returning id, reference, created_at`,
          [reference, input.customerName, input.customerPhone, input.customerEmail, input.vehicleCategory, input.vehicleId, input.pickupLocation,
           input.destination, input.tripType, input.tripDate, input.returnDate, input.pickupTime, input.passengers, input.requirements, estimated],
        );
        const booking = rows[0]!;
        await logEvent(db, booking.id, { kind: 'created', to: 'pending', actor: 'customer', note: 'Request submitted on the website' });
        return { reference: booking.reference, duplicate: false, vehicle, booking: { ...booking, estimated } };
      } catch (err: any) {
        await db.query('rollback to savepoint ref_try');
        if (err?.code === '23505' && String(err.constraint).includes('reference')) continue; // astronomically rare collision
        throw err;
      }
    }
    throw new Error('Could not allocate a booking reference');
  });

  if (!result.duplicate) {
    const v = result.vehicle;
    void sendEmail(
      config.BUSINESS_NOTIFY_EMAIL,
      `New booking request ${result.reference} — ${input.customerName}`,
      [
        `A new booking request was submitted on the website.`,
        ``,
        `Reference:   ${result.reference}`,
        `Customer:    ${input.customerName}`,
        `Phone:       ${input.customerPhone}`,
        `Email:       ${input.customerEmail ?? '—'}`,
        `Vehicle:     ${v ? v.name : `Any ${input.vehicleCategory === 'bus' ? 'tourist bus / traveller' : 'car'}`}`,
        `Trip:        ${input.tripDate}${input.returnDate ? ` → ${input.returnDate}` : ''} at ${input.pickupTime} (${input.tripType.replace('_', ' ')})`,
        `From → To:   ${input.pickupLocation} → ${input.destination}`,
        `Passengers:  ${input.passengers}`,
        `Notes:       ${input.requirements ?? '—'}`,
        ``,
        `Review it in the admin dashboard: ${config.PUBLIC_SITE_URL}/admin/bookings`,
      ].join('\n'),
    );
  }

  return {
    reference: result.reference,
    duplicate: result.duplicate,
    status: 'pending' as const,
    estimatedPrice: result.booking?.estimated ?? null,
  };
}

// ---------------------------------------------------------------------------
// Public: status lookup (reference + the phone number used on the booking)
// ---------------------------------------------------------------------------
export async function lookupBooking(reference: string, customerPhone: string) {
  const row = await one(
    `select b.id, b.reference, b.status, b.trip_type, b.trip_date, b.return_date, to_char(b.pickup_time, 'HH24:MI') as pickup_time,
            b.pickup_location, b.destination, b.passengers, b.vehicle_category, b.estimated_price, b.quoted_fare, b.created_at,
            b.customer_name, b.customer_phone, v.name as vehicle_name, v.slug as vehicle_slug
       from bookings b left join vehicles v on v.id = b.vehicle_id
      where b.reference = $1`,
    [reference.trim().toUpperCase()],
  );
  // Same response whether the reference or the phone is wrong — no enumeration.
  if (!row || row.customer_phone !== customerPhone) throw notFound('We couldn’t find a booking with that reference and mobile number.');
  const events = await query(
    `select kind, to_status, created_at from booking_events where booking_id = $1 and kind in ('created', 'status') order by created_at`,
    [row.id],
  );
  return {
    reference: row.reference,
    status: row.status as BookingStatus,
    statusLabel: STATUS_LABEL[row.status as BookingStatus],
    firstName: String(row.customer_name).split(/\s+/)[0],
    tripType: row.trip_type,
    tripDate: row.trip_date,
    returnDate: row.return_date,
    pickupTime: row.pickup_time,
    pickupLocation: row.pickup_location,
    destination: row.destination,
    passengers: row.passengers,
    vehicleCategory: row.vehicle_category,
    vehicle: row.vehicle_name ? { name: row.vehicle_name, slug: row.vehicle_slug } : null,
    estimatedPrice: row.estimated_price,
    quotedFare: row.quoted_fare,
    submittedAt: row.created_at,
    timeline: events.map((e) => ({ status: e.to_status, at: e.created_at })),
  };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
const BOOKING_SELECT = `
  select b.*, to_char(b.pickup_time, 'HH24:MI') as pickup_time, v.name as vehicle_name, v.slug as vehicle_slug, v.seats as vehicle_seats
    from bookings b left join vehicles v on v.id = b.vehicle_id`;

export function serializeAdminBooking(r: any) {
  return {
    id: r.id,
    reference: r.reference,
    status: r.status as BookingStatus,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    customerEmail: r.customer_email,
    vehicleCategory: r.vehicle_category,
    vehicleId: r.vehicle_id,
    vehicle: r.vehicle_id ? { id: r.vehicle_id, name: r.vehicle_name, slug: r.vehicle_slug, seats: r.vehicle_seats } : null,
    pickupLocation: r.pickup_location,
    destination: r.destination,
    tripType: r.trip_type,
    tripDate: r.trip_date,
    returnDate: r.return_date,
    pickupTime: r.pickup_time,
    passengers: r.passengers,
    requirements: r.requirements,
    estimatedPrice: r.estimated_price,
    quotedFare: r.quoted_fare,
    adminNotes: r.admin_notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const listQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(STATUSES).optional().or(z.literal('').transform(() => undefined)),
  from: isoDate.optional().or(z.literal('').transform(() => undefined)),
  to: isoDate.optional().or(z.literal('').transform(() => undefined)),
  vehicleId: z.uuid().optional().or(z.literal('').transform(() => undefined)),
  sort: z.enum(['created_desc', 'trip_asc', 'trip_desc']).default('created_desc'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
});

export async function listBookings(f: z.output<typeof listQuerySchema>) {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    const digits = f.q.replace(/\D/g, '');
    const parts = [`b.reference ilike ${p(like)}`, `b.customer_name ilike ${p(like)}`];
    if (digits.length >= 4) parts.push(`b.customer_phone like ${p(`%${digits}%`)}`);
    where.push(`(${parts.join(' or ')})`);
  }
  if (f.status) where.push(`b.status = ${p(f.status)}`);
  if (f.from) where.push(`coalesce(b.return_date, b.trip_date) >= ${p(f.from)}`);
  if (f.to) where.push(`b.trip_date <= ${p(f.to)}`);
  if (f.vehicleId) where.push(`b.vehicle_id = ${p(f.vehicleId)}`);
  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const order = { created_desc: 'b.created_at desc', trip_asc: 'b.trip_date asc, b.pickup_time asc', trip_desc: 'b.trip_date desc, b.pickup_time desc' }[f.sort];
  const totalRow = await one<{ n: number }>(`select count(*)::int as n from bookings b ${whereSql}`, params);
  const rows = await query(`${BOOKING_SELECT} ${whereSql} order by ${order} limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`, params);
  return { items: rows.map(serializeAdminBooking), total: totalRow?.n ?? 0, page: f.page, pageSize: f.pageSize };
}

export async function getAdminBooking(id: string) {
  const row = await one(`${BOOKING_SELECT} where b.id = $1`, [id]);
  if (!row) throw notFound('Booking not found');
  const events = await query(
    `select e.id, e.kind, e.from_status, e.to_status, e.note, e.actor, e.created_at, a.name as admin_name, a.email as admin_email
       from booking_events e left join admin_users a on a.id = e.admin_id
      where e.booking_id = $1 order by e.created_at, e.id`,
    [id],
  );
  return {
    ...serializeAdminBooking(row),
    allowedTransitions: TRANSITIONS[row.status as BookingStatus],
    events: events.map((e) => ({
      id: e.id,
      kind: e.kind,
      fromStatus: e.from_status,
      toStatus: e.to_status,
      note: e.note,
      actor: e.admin_name || e.admin_email || e.actor,
      at: e.created_at,
    })),
  };
}

const STATUS_EMAIL: Partial<Record<BookingStatus, (ref: string) => [string, string]>> = {
  confirmed: (ref) => [`Your booking ${ref} is confirmed`, 'Good news — Elite Travel Hub has confirmed your booking.'],
  rejected: (ref) => [`Update on your booking request ${ref}`, 'Unfortunately we are unable to take this booking request. Please call us — we may be able to suggest another vehicle or date.'],
  cancelled: (ref) => [`Your booking ${ref} has been cancelled`, 'Your booking has been cancelled. If this is unexpected, please call us.'],
  completed: (ref) => [`Thank you for travelling with us — ${ref}`, 'Your trip is marked as completed. Thank you for travelling with Elite Travel Hub.'],
};

export async function changeStatus(id: string, to: BookingStatus, note: string | null, admin: { id: string; email: string }) {
  const updated = await tx(async (db) => {
    const { rows } = await db.query('select * from bookings where id = $1 for update', [id]);
    const b = rows[0];
    if (!b) throw notFound('Booking not found');
    const from = b.status as BookingStatus;
    if (from === to) throw badRequest(`This booking is already ${to}.`);
    if (!TRANSITIONS[from].includes(to)) throw badRequest(`A ${from} booking can’t be changed to ${to}.`);
    if (to === 'confirmed') {
      if (!b.vehicle_id) throw badRequest('Assign a vehicle to this booking before confirming it.', { vehicleId: 'Assign a vehicle' });
      const v = await loadVehicle(db, b.vehicle_id, 'update');
      if (!v?.is_active) throw badRequest('The assigned vehicle is disabled. Assign another vehicle first.');
      await assertVehicleFree(db, b.vehicle_id, b.trip_date, b.return_date ?? b.trip_date, b.id);
    }
    // The exclusion constraint is the final guard against two concurrent confirmations.
    await db.query('update bookings set status = $2 where id = $1', [id, to]);
    await logEvent(db, id, { kind: 'status', from, to, note, adminId: admin.id, actor: admin.email });
    return b;
  });

  let email: EmailResult = 'skipped';
  const tpl = STATUS_EMAIL[to];
  if (tpl && updated.customer_email) {
    const [subject, lead] = tpl(updated.reference);
    email = await sendEmail(
      updated.customer_email,
      subject,
      [
        `Hello ${String(updated.customer_name).split(/\s+/)[0]},`,
        '',
        lead,
        note ? `\nMessage from our team: ${note}` : '',
        '',
        `Booking reference: ${updated.reference}`,
        `Trip date: ${updated.trip_date}`,
        `Check your booking at any time: ${config.PUBLIC_SITE_URL}/booking/status?ref=${updated.reference}`,
        '',
        'Elite Travel Hub · +91 90473 39000 · elitetourandtravel2026@gmail.com',
      ].join('\n'),
    );
  }
  return { booking: await getAdminBooking(id), email };
}

const EDIT_FIELDS: [keyof z.output<typeof bookingEditSchema>, string, string][] = [
  ['customerName', 'customer_name', 'customer name'],
  ['customerPhone', 'customer_phone', 'phone'],
  ['customerEmail', 'customer_email', 'email'],
  ['vehicleCategory', 'vehicle_category', 'vehicle type'],
  ['vehicleId', 'vehicle_id', 'vehicle'],
  ['pickupLocation', 'pickup_location', 'pickup'],
  ['destination', 'destination', 'destination'],
  ['tripType', 'trip_type', 'trip type'],
  ['tripDate', 'trip_date', 'trip date'],
  ['returnDate', 'return_date', 'return date'],
  ['pickupTime', 'pickup_time', 'pickup time'],
  ['passengers', 'passengers', 'passengers'],
  ['requirements', 'requirements', 'requirements'],
  ['quotedFare', 'quoted_fare', 'quoted fare'],
  ['adminNotes', 'admin_notes', 'internal notes'],
];

export async function editBooking(id: string, input: z.output<typeof bookingEditSchema>, admin: { id: string; email: string }) {
  await tx(async (db) => {
    const { rows } = await db.query(`select *, to_char(pickup_time, 'HH24:MI') as pickup_time from bookings where id = $1 for update`, [id]);
    const b = rows[0];
    if (!b) throw notFound('Booking not found');
    if (b.status === 'completed') throw badRequest('Completed bookings can’t be edited.');

    let vehicle: VehicleRow | null = null;
    if (input.vehicleId) {
      vehicle = await loadVehicle(db, input.vehicleId, b.status === 'confirmed' ? 'update' : 'share');
      if (!vehicle) throw badRequest('Vehicle not found.', { vehicleId: 'Choose a vehicle' });
      if (vehicle.category !== input.vehicleCategory) throw badRequest('The vehicle does not match the vehicle type.', { vehicleId: 'Vehicle does not match the type' });
    } else if (b.status === 'confirmed') {
      throw badRequest('A confirmed booking must keep an assigned vehicle.', { vehicleId: 'Required for confirmed bookings' });
    }
    if (b.status === 'confirmed' && vehicle) {
      await assertVehicleFree(db, vehicle.id, input.tripDate, input.returnDate ?? input.tripDate, b.id);
    }

    const changed = EDIT_FIELDS.filter(([k, col]) => String(input[k] ?? '') !== String(b[col] ?? ''));
    if (!changed.length) return;
    const sets = EDIT_FIELDS.map(([, col], i) => `${col} = $${i + 2}`).join(', ');
    const values = EDIT_FIELDS.map(([k]) => input[k] ?? null);
    const est = estimate(vehicle, input.tripDate, input.returnDate);
    await db.query(`update bookings set ${sets}, estimated_price = $${values.length + 2} where id = $1`, [id, ...values, est]);
    await logEvent(db, id, { kind: 'edit', note: `Updated ${changed.map(([, , label]) => label).join(', ')}`, adminId: admin.id, actor: admin.email });
  });
  return getAdminBooking(id);
}

export async function addNote(id: string, note: string, admin: { id: string; email: string }) {
  await tx(async (db) => {
    const { rowCount } = await db.query('select 1 from bookings where id = $1', [id]);
    if (!rowCount) throw notFound('Booking not found');
    await logEvent(db, id, { kind: 'note', note, adminId: admin.id, actor: admin.email });
  });
  return getAdminBooking(id);
}
