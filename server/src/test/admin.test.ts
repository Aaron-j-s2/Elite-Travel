import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../config.js';
import { pool, query } from '../db.js';
import { ADMIN, adminAgent, app, bookingBody, post, resetDb, seedAdmin, seedVehicle } from './helpers.js';

beforeEach(async () => {
  await resetDb();
  await seedAdmin();
});
afterAll(() => pool.end());

describe('admin authentication', () => {
  it('protects every admin endpoint', async () => {
    for (const url of ['/api/admin/dashboard', '/api/admin/bookings', '/api/admin/vehicles', '/api/admin/enquiries', '/api/admin/settings', '/api/admin/auth/me']) {
      const res = await request(app).get(url);
      expect(res.status, url).toBe(401);
    }
    const write = await request(app).post('/api/admin/vehicles').set('X-ETH-Request', '1').send({ name: 'Hack', category: 'bus' });
    expect(write.status).toBe(401);
  });

  it('rejects a wrong password and unknown emails identically', async () => {
    const wrong = await post('/api/admin/auth/login', { email: ADMIN.email, password: 'nope-nope-nope' });
    const unknown = await post('/api/admin/auth/login', { email: 'who@test.local', password: 'nope-nope-nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
    expect(wrong.headers['set-cookie']).toBeUndefined();
  });

  it('stores only an argon2 hash and issues an httpOnly, SameSite=Strict session cookie', async () => {
    const [user] = await query('select password_hash from admin_users');
    expect(user.password_hash).toMatch(/^\$argon2id\$/);
    expect(user.password_hash).not.toContain(ADMIN.password);

    const res = await post('/api/admin/auth/login', ADMIN);
    expect(res.status).toBe(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/eth_admin=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    const [session] = await query('select token_hash from admin_sessions');
    expect(cookie).not.toContain(session.token_hash); // only the hash is stored server-side
  });

  it('logs out by destroying the session', async () => {
    const agent = await adminAgent();
    expect((await agent.get('/api/admin/auth/me')).status).toBe(200);
    expect((await agent.post('/api/admin/auth/logout').set('X-ETH-Request', '1')).status).toBe(200);
    expect((await agent.get('/api/admin/auth/me')).status).toBe(401);
    expect(await query('select 1 from admin_sessions')).toHaveLength(0);
  });

  it('blocks admin writes without the CSRF header even with a valid session', async () => {
    const agent = await adminAgent();
    const res = await agent.post('/api/admin/vehicles').send({ name: 'No header', category: 'bus' });
    expect(res.status).toBe(403);
  });

  it('has no public registration endpoint', async () => {
    expect((await post('/api/admin/auth/register', { email: 'x@y.z', password: 'whatever-whatever' })).status).toBe(401);
  });
});

describe('dashboard', () => {
  it('reports real counts from the database', async () => {
    const agent = await adminAgent();
    const empty = await agent.get('/api/admin/dashboard');
    expect(empty.body.bookings.total).toBe(0);

    const vehicleId = await seedVehicle();
    await post('/api/bookings', bookingBody(vehicleId));
    await post('/api/bookings', bookingBody(null, { customerPhone: '9000000031' }));
    const res = await agent.get('/api/admin/dashboard');
    expect(res.body.bookings).toMatchObject({ total: 2, pending: 2, confirmed: 0 });
    expect(res.body.vehicles).toMatchObject({ active: 1, availableToday: 1 });
    expect(res.body.recent).toHaveLength(2);
  });
});

describe('booking search', () => {
  it('filters by text, phone digits, status and date', async () => {
    const agent = await adminAgent();
    const vehicleId = await seedVehicle();
    const a = await post('/api/bookings', bookingBody(vehicleId, { customerName: 'Meera Nair', customerPhone: '9123456780' }));
    await post('/api/bookings', bookingBody(null, { customerName: 'Joseph Mathew', customerPhone: '9988776655' }));

    const byName = await agent.get('/api/admin/bookings?q=meera');
    expect(byName.body.items.map((b: { customerName: string }) => b.customerName)).toEqual(['Meera Nair']);
    expect((await agent.get('/api/admin/bookings?q=887766')).body.items[0].customerName).toBe('Joseph Mathew');
    expect((await agent.get(`/api/admin/bookings?q=${a.body.reference}`)).body.total).toBe(1);
    expect((await agent.get('/api/admin/bookings?status=confirmed')).body.total).toBe(0);
    expect((await agent.get('/api/admin/bookings?from=2099-01-01')).body.total).toBe(0);
    // SQL wildcards in the search are treated literally
    expect((await agent.get('/api/admin/bookings?q=%25')).body.total).toBe(0);
  });
});

describe('vehicle management', () => {
  it('creates and edits a vehicle; blank prices stay hidden', async () => {
    const agent = await adminAgent();
    const created = await agent.post('/api/admin/vehicles').set('X-ETH-Request', '1').send({ name: 'Tempo Traveller 17', category: 'bus', seats: '17', dayRate: '', ratePerKm: '', amenities: ['Push-back seats'] });
    expect(created.status).toBe(201);
    const v = created.body.vehicle;
    expect(v).toMatchObject({ slug: 'tempo-traveller-17', seats: 17, dayRate: null, ratePerKm: null });

    const pub = await request(app).get('/api/vehicles');
    expect(pub.body.vehicles[0].pricing).toBeNull();

    const edited = await agent.patch(`/api/admin/vehicles/${v.id}`).set('X-ETH-Request', '1').send({ name: 'Tempo Traveller 17', category: 'bus', seats: 17, dayRate: '4500', priceNote: 'Tolls extra', isActive: true });
    expect(edited.status).toBe(200);
    const pub2 = await request(app).get('/api/vehicles');
    expect(pub2.body.vehicles[0].pricing).toMatchObject({ dayRate: 4500, note: 'Tolls extra' });

    const disabled = await agent.patch(`/api/admin/vehicles/${v.id}`).set('X-ETH-Request', '1').send({ name: 'Tempo Traveller 17', category: 'bus', isActive: false });
    expect(disabled.status).toBe(200);
    expect((await request(app).get('/api/vehicles')).body.vehicles).toHaveLength(0);
    expect((await request(app).get('/api/vehicles/tempo-traveller-17')).status).toBe(404);
  });

  it('validates vehicle input', async () => {
    const agent = await adminAgent();
    const res = await agent.post('/api/admin/vehicles').set('X-ETH-Request', '1').send({ name: '', category: 'plane', seats: '200', dayRate: '-5' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(['name', 'category', 'seats', 'dayRate']));
  });

  it('refuses to delete a vehicle with booking history', async () => {
    const agent = await adminAgent();
    const vehicleId = await seedVehicle();
    await post('/api/bookings', bookingBody(vehicleId));
    const res = await agent.delete(`/api/admin/vehicles/${vehicleId}`).set('X-ETH-Request', '1');
    expect(res.status).toBe(409);
  });

  it('uploads photos as resized WebP variants and rejects non-images', async () => {
    const agent = await adminAgent();
    const vehicleId = await seedVehicle();
    const jpeg = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: '#335544' } }).jpeg().toBuffer();
    const res = await agent.post(`/api/admin/vehicles/${vehicleId}/images`).set('X-ETH-Request', '1').attach('images', jpeg, { filename: 'bus.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
    const img = res.body.vehicle.images[0];
    expect(img.widths).toEqual([480, 960, 1600, 1800]);
    for (const w of img.widths) expect(fs.existsSync(path.join(config.UPLOAD_DIR, 'vehicles', `${path.basename(img.base)}-${w}.webp`))).toBe(true);

    const fake = await agent.post(`/api/admin/vehicles/${vehicleId}/images`).set('X-ETH-Request', '1').attach('images', Buffer.from('<?php echo 1; ?>'), { filename: 'evil.jpg', contentType: 'image/jpeg' });
    expect(fake.status).toBe(400);
    const wrongType = await agent.post(`/api/admin/vehicles/${vehicleId}/images`).set('X-ETH-Request', '1').attach('images', Buffer.from('GIF89a'), { filename: 'x.gif', contentType: 'image/gif' });
    expect(wrongType.status).toBe(400);

    const del = await agent.delete(`/api/admin/vehicles/${vehicleId}/images/${img.id}`).set('X-ETH-Request', '1');
    expect(del.status).toBe(200);
    expect(fs.existsSync(path.join(config.UPLOAD_DIR, 'vehicles', `${path.basename(img.base)}-480.webp`))).toBe(false);
  });
});

describe('content management', () => {
  it('validates and saves site settings, reflected on the public API', async () => {
    const agent = await adminAgent();
    const bad = await agent.put('/api/admin/settings/contact').set('X-ETH-Request', '1').send({ businessName: '', email: 'not-an-email', whatsapp: 'abc' });
    expect(bad.status).toBe(400);

    const site = await request(app).get('/api/site');
    const contact = { ...site.body.settings.contact, hours: 'Open every day' };
    const ok = await agent.put('/api/admin/settings/contact').set('X-ETH-Request', '1').send(contact);
    expect(ok.status).toBe(200);
    expect((await request(app).get('/api/site')).body.settings.contact.hours).toBe('Open every day');

    const unknownKey = await agent.put('/api/admin/settings/secrets').set('X-ETH-Request', '1').send({});
    expect(unknownKey.status).toBe(400);
  });

  it('only shows published testimonials publicly', async () => {
    const agent = await adminAgent();
    await agent.post('/api/admin/testimonials').set('X-ETH-Request', '1').send({ authorName: 'Draft Person', quote: 'Not yet approved for the site', isPublished: false });
    expect((await request(app).get('/api/site')).body.testimonials).toHaveLength(0);
    await agent.post('/api/admin/testimonials').set('X-ETH-Request', '1').send({ authorName: 'Real Customer', quote: 'A genuine review we received', isPublished: true, sourceNote: 'Google review' });
    const pub = (await request(app).get('/api/site')).body.testimonials;
    expect(pub).toHaveLength(1);
    expect(pub[0]).not.toHaveProperty('sourceNote');
  });

  it('stores contact-form enquiries for the admin only', async () => {
    const res = await post('/api/enquiries', { name: 'Priya', phone: '9876543210', message: 'Do you go to Ooty?' });
    expect(res.status).toBe(201);
    const agent = await adminAgent();
    const list = await agent.get('/api/admin/enquiries');
    expect(list.body.items[0]).toMatchObject({ name: 'Priya', phone: '+919876543210', status: 'new' });
  });
});

describe('public API hygiene', () => {
  it('never returns customer data from public endpoints', async () => {
    const vehicleId = await seedVehicle();
    await post('/api/bookings', bookingBody(vehicleId, { customerEmail: 'secret@example.com' }));
    const agent = await adminAgent();
    const [{ id }] = await query('select id from bookings');
    await agent.post(`/api/admin/bookings/${id}/status`).set('X-ETH-Request', '1').send({ status: 'confirmed' });
    for (const url of ['/api/site', '/api/vehicles', '/api/vehicles/test-traveller', '/api/vehicles/test-traveller/availability', '/sitemap.xml']) {
      const res = await request(app).get(url);
      expect(res.text, url).not.toMatch(/Anil|98470|secret@example\.com/);
    }
  });

  it('returns JSON 404s for unknown API routes and sets security headers', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
