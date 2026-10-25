import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool, query } from '../db.js';
import { addDays, normalizePhone, todayIST } from '../lib/fields.js';
import { adminAgent, app, bookingBody, post, resetDb, seedAdmin, seedVehicle } from './helpers.js';

beforeEach(async () => {
  await resetDb();
  await seedAdmin();
});
afterAll(() => pool.end());

describe('phone normalisation', () => {
  it.each([
    ['9847012345', '+919847012345'],
    ['+91 98470 12345', '+919847012345'],
    ['09847012345', '+919847012345'],
    ['+44 7911 123456', '+447911123456'],
    ['12345', null],
    ['5847012345', null],
  ])('%s → %s', (input, expected) => expect(normalizePhone(input)).toBe(expected));
});

describe('public booking requests', () => {
  it('rejects state-changing requests without the CSRF header', async () => {
    const vehicleId = await seedVehicle();
    const res = await request(app).post('/api/bookings').send(bookingBody(vehicleId));
    expect(res.status).toBe(403);
    expect(await query('select 1 from bookings')).toHaveLength(0);
  });

  it('validates required fields on the server', async () => {
    const res = await post('/api/bookings', { customerName: 'A' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation');
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(['customerName', 'customerPhone', 'pickupLocation', 'destination', 'tripDate', 'pickupTime', 'passengers']));
  });

  it('rejects past trip dates and a return date before the trip', async () => {
    const vehicleId = await seedVehicle();
    const past = await post('/api/bookings', bookingBody(vehicleId, { tripDate: addDays(todayIST(), -1) }));
    expect(past.status).toBe(400);
    expect(past.body.fields.tripDate).toBeDefined();
    const backwards = await post('/api/bookings', bookingBody(vehicleId, { returnDate: todayIST() }));
    expect(backwards.status).toBe(400);
    expect(backwards.body.fields.returnDate).toBeDefined();
  });

  it('saves a pending booking with a unique reference, normalised phone and a history event', async () => {
    const vehicleId = await seedVehicle();
    const res = await post('/api/bookings', bookingBody(vehicleId));
    expect(res.status).toBe(201);
    expect(res.body.reference).toMatch(/^ETH-\d{4}-[A-Z0-9]{5}$/);
    expect(res.body.status).toBe('pending');
    const [row] = await query('select status, customer_phone, trip_range::text from bookings where reference = $1', [res.body.reference]);
    expect(row.status).toBe('pending');
    expect(row.customer_phone).toBe('+919847012345');
    const events = await query('select kind, to_status from booking_events');
    expect(events).toEqual([{ kind: 'created', to_status: 'pending' }]);
  });

  it('returns the original reference for an accidental double submission', async () => {
    const vehicleId = await seedVehicle();
    const a = await post('/api/bookings', bookingBody(vehicleId));
    const b = await post('/api/bookings', bookingBody(vehicleId));
    expect(b.status).toBe(200);
    expect(b.body).toMatchObject({ reference: a.body.reference, duplicate: true });
    expect(await query('select 1 from bookings')).toHaveLength(1);
  });

  it('accepts a request without a specific vehicle', async () => {
    const res = await post('/api/bookings', bookingBody(null));
    expect(res.status).toBe(201);
  });

  it('refuses disabled vehicles, mismatched categories and groups larger than the seats', async () => {
    const disabled = await seedVehicle({ slug: 'off', is_active: false });
    expect((await post('/api/bookings', bookingBody(disabled))).status).toBe(400);
    const car = await seedVehicle({ slug: 'car', category: 'car', seats: 7 });
    expect((await post('/api/bookings', bookingBody(car))).status).toBe(400); // category 'bus' in body
    const small = await post('/api/bookings', bookingBody(car, { vehicleCategory: 'car', passengers: 9 }));
    expect(small.status).toBe(400);
    expect(small.body.code).toBe('too_many_passengers');
  });

  it('computes an indicative fare only when a day rate is configured', async () => {
    const priced = await seedVehicle({ slug: 'priced', day_rate: 5000 });
    const res = await post('/api/bookings', bookingBody(priced));
    expect(res.body.estimatedPrice).toBe(15000); // 3 days inclusive
    const unpriced = await seedVehicle({ slug: 'unpriced' });
    expect((await post('/api/bookings', bookingBody(unpriced, { customerPhone: '9000000001' }))).body.estimatedPrice).toBeNull();
  });
});

describe('booking lifecycle and availability', () => {
  it('confirms, blocks overlapping requests, and shows the status to the customer', async () => {
    const vehicleId = await seedVehicle();
    const admin = await adminAgent();
    const created = await post('/api/bookings', bookingBody(vehicleId));
    const [{ id }] = await query('select id from bookings');

    // Before confirmation the customer sees "pending"
    const before = await post('/api/bookings/lookup', { reference: created.body.reference, phone: '+91 98470 12345' });
    expect(before.body.booking.status).toBe('pending');

    const confirm = await admin.post(`/api/admin/bookings/${id}/status`).set('X-ETH-Request', '1').send({ status: 'confirmed', note: 'See you at 6:30' });
    expect(confirm.status).toBe(200);
    expect(confirm.body.booking.status).toBe('confirmed');
    expect(confirm.body.email).toBe('skipped'); // no SMTP in tests — never claims delivery

    // A new request overlapping the confirmed dates is refused
    const overlap = await post('/api/bookings', bookingBody(vehicleId, { customerPhone: '9000000002', tripDate: addDays(todayIST(), 31), returnDate: addDays(todayIST(), 35) }));
    expect(overlap.status).toBe(409);
    expect(overlap.body.code).toBe('unavailable');

    // Adjacent dates are fine
    const after = await post('/api/bookings', bookingBody(vehicleId, { customerPhone: '9000000003', tripDate: addDays(todayIST(), 33), returnDate: addDays(todayIST(), 34) }));
    expect(after.status).toBe(201);

    const lookup = await post('/api/bookings/lookup', { reference: created.body.reference, phone: '9847012345' });
    expect(lookup.status).toBe(200);
    expect(lookup.body.booking).toMatchObject({ status: 'confirmed', firstName: 'Anil' });
    expect(lookup.body.booking.timeline.map((t: { status: string }) => t.status)).toEqual(['pending', 'confirmed']);
    // The lookup never exposes the full contact details
    expect(JSON.stringify(lookup.body)).not.toContain('98470');
  });

  it('lets only one of two overlapping requests be confirmed, even concurrently', async () => {
    const vehicleId = await seedVehicle();
    const admin = await adminAgent();
    await post('/api/bookings', bookingBody(vehicleId, { customerPhone: '9000000011' }));
    await post('/api/bookings', bookingBody(vehicleId, { customerPhone: '9000000012', pickupTime: '08:00' }));
    const ids = (await query<{ id: string }>('select id from bookings order by created_at')).map((r) => r.id);
    expect(ids).toHaveLength(2);

    const results = await Promise.all(ids.map((id) => admin.post(`/api/admin/bookings/${id}/status`).set('X-ETH-Request', '1').send({ status: 'confirmed' })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const confirmed = await query("select 1 from bookings where status = 'confirmed'");
    expect(confirmed).toHaveLength(1);
  });

  it('the database itself rejects overlapping confirmations from interleaved transactions', async () => {
    const vehicleId = await seedVehicle();
    await post('/api/bookings', bookingBody(vehicleId, { customerPhone: '9000000041' }));
    await post('/api/bookings', bookingBody(vehicleId, { customerPhone: '9000000042', pickupTime: '09:00' }));
    const [one, two] = (await query<{ id: string }>('select id from bookings order by created_at')).map((r) => r.id);

    // Two connections, both mid-transaction, bypassing every application-level check.
    const a = await pool.connect();
    const b = await pool.connect();
    try {
      await a.query('begin');
      await b.query('begin');
      await a.query("update bookings set status = 'confirmed' where id = $1", [one]);
      const second = b.query("update bookings set status = 'confirmed' where id = $1", [two]); // waits on A
      await a.query('commit');
      await expect(second).rejects.toMatchObject({ code: '23P01' });
      await b.query('rollback');
    } finally {
      a.release();
      b.release();
    }
    expect(await query("select 1 from bookings where status = 'confirmed'")).toHaveLength(1);
  });

  it('requires an assigned vehicle to confirm and enforces allowed transitions', async () => {
    const admin = await adminAgent();
    await post('/api/bookings', bookingBody(null));
    const [{ id }] = await query('select id from bookings');
    const noVehicle = await admin.post(`/api/admin/bookings/${id}/status`).set('X-ETH-Request', '1').send({ status: 'confirmed' });
    expect(noVehicle.status).toBe(400);

    const vehicleId = await seedVehicle();
    const edit = await admin.patch(`/api/admin/bookings/${id}`).set('X-ETH-Request', '1').send({ ...bookingBody(vehicleId), quotedFare: '18000', adminNotes: 'Called customer' });
    expect(edit.status).toBe(200);
    expect(edit.body.booking.vehicle.id).toBe(vehicleId);
    expect(edit.body.booking.quotedFare).toBe(18000);

    expect((await admin.post(`/api/admin/bookings/${id}/status`).set('X-ETH-Request', '1').send({ status: 'confirmed' })).status).toBe(200);
    expect((await admin.post(`/api/admin/bookings/${id}/status`).set('X-ETH-Request', '1').send({ status: 'completed' })).status).toBe(200);
    const reopen = await admin.post(`/api/admin/bookings/${id}/status`).set('X-ETH-Request', '1').send({ status: 'pending' });
    expect(reopen.status).toBe(400);

    const detail = await admin.get(`/api/admin/bookings/${id}`);
    expect(detail.body.booking.events.map((e: { kind: string }) => e.kind)).toEqual(['created', 'edit', 'status', 'status']);
    expect(detail.body.booking.events[1].note).toContain('vehicle');
  });

  it('cancelling releases the dates', async () => {
    const vehicleId = await seedVehicle();
    const admin = await adminAgent();
    await post('/api/bookings', bookingBody(vehicleId));
    const [{ id }] = await query('select id from bookings');
    await admin.post(`/api/admin/bookings/${id}/status`).set('X-ETH-Request', '1').send({ status: 'confirmed' });
    expect((await post('/api/bookings', bookingBody(vehicleId, { customerPhone: '9000000021' }))).status).toBe(409);
    await admin.post(`/api/admin/bookings/${id}/status`).set('X-ETH-Request', '1').send({ status: 'cancelled' });
    expect((await post('/api/bookings', bookingBody(vehicleId, { customerPhone: '9000000021' }))).status).toBe(201);
  });

  it('respects admin-blocked dates and exposes availability without customer data', async () => {
    const vehicleId = await seedVehicle();
    const admin = await adminAgent();
    const start = addDays(todayIST(), 30);
    const block = await admin.post(`/api/admin/vehicles/${vehicleId}/blocks`).set('X-ETH-Request', '1').send({ startDate: start, endDate: start, reason: 'Servicing' });
    expect(block.status).toBe(201);
    expect((await post('/api/bookings', bookingBody(vehicleId))).status).toBe(409);

    const avail = await request(app).get('/api/vehicles/test-traveller/availability');
    expect(avail.status).toBe(200);
    expect(avail.body.busy).toEqual([{ start, end: start, kind: 'unavailable' }]);
    expect(JSON.stringify(avail.body)).not.toContain('Servicing');
  });

  it('reports confirmed trips far in the future (availability covers the whole booking horizon)', async () => {
    const vehicleId = await seedVehicle();
    const admin = await adminAgent();
    const far = addDays(todayIST(), 300);
    await post('/api/bookings', bookingBody(vehicleId, { tripType: 'one_way', tripDate: far, returnDate: null }));
    const [{ id }] = await query('select id from bookings');
    await admin.post(`/api/admin/bookings/${id}/status`).set('X-ETH-Request', '1').send({ status: 'confirmed' });
    const res = await request(app).get(`/api/vehicles/test-traveller/availability?to=${addDays(todayIST(), 400)}`);
    expect(res.body.to).toBe(addDays(todayIST(), 400));
    expect(res.body.busy).toEqual([{ start: far, end: far, kind: 'booked' }]);
    // Requests beyond the cap are clamped rather than ignored
    expect((await request(app).get(`/api/vehicles/test-traveller/availability?to=${addDays(todayIST(), 900)}`)).body.to).toBe(addDays(todayIST(), 400));
  });

  it('gives the same answer for a wrong phone and a wrong reference', async () => {
    const vehicleId = await seedVehicle();
    const created = await post('/api/bookings', bookingBody(vehicleId));
    const wrongPhone = await post('/api/bookings/lookup', { reference: created.body.reference, phone: '9000000099' });
    const wrongRef = await post('/api/bookings/lookup', { reference: 'ETH-2601-ZZZZZ', phone: '9847012345' });
    expect(wrongPhone.status).toBe(404);
    expect(wrongRef.status).toBe(404);
    expect(wrongPhone.body.error).toBe(wrongRef.body.error);
  });
});
