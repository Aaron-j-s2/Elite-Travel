import request from 'supertest';
import { createApp } from '../app.js';
import { hashPassword } from '../lib/auth.js';
import { query } from '../db.js';
import { addDays, todayIST } from '../lib/fields.js';

export const app = createApp();
export const ADMIN = { email: 'owner@test.local', password: 'correct-horse-battery' };

export async function resetDb() {
  await query(`truncate booking_events, bookings, vehicle_blocks, vehicle_images, vehicles, enquiries, services, testimonials,
                site_settings, admin_sessions, admin_users restart identity cascade`);
}

export async function seedAdmin() {
  await query('insert into admin_users (email, name, password_hash) values ($1, $2, $3)', [ADMIN.email, 'Owner', await hashPassword(ADMIN.password)]);
}

export async function seedVehicle(over: Partial<{ slug: string; name: string; category: string; seats: number | null; day_rate: number | null; is_active: boolean }> = {}) {
  const v = { slug: 'test-traveller', name: 'Test Traveller', category: 'bus', seats: 17, day_rate: null, is_active: true, ...over };
  const rows = await query<{ id: string }>(
    'insert into vehicles (slug, name, category, seats, day_rate, is_active) values ($1,$2,$3,$4,$5,$6) returning id',
    [v.slug, v.name, v.category, v.seats, v.day_rate, v.is_active],
  );
  return rows[0]!.id;
}

/** Supertest agent that keeps cookies and sends the CSRF header. */
export async function adminAgent() {
  const agent = request.agent(app);
  const res = await agent.post('/api/admin/auth/login').set('X-ETH-Request', '1').send(ADMIN);
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export const post = (url: string, body: object) => request(app).post(url).set('X-ETH-Request', '1').send(body);

export function bookingBody(vehicleId: string | null, over: Record<string, unknown> = {}) {
  const tripDate = addDays(todayIST(), 30);
  return {
    customerName: 'Anil Kumar',
    customerPhone: '98470 12345',
    customerEmail: '',
    vehicleCategory: 'bus',
    vehicleId,
    pickupLocation: 'Thiruvrambu',
    destination: 'Munnar',
    tripType: 'round_trip',
    tripDate,
    returnDate: addDays(tripDate, 2),
    pickupTime: '06:30',
    passengers: 12,
    requirements: '',
    ...over,
  };
}
