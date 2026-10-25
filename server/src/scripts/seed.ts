/**
 * Seeds the fleet and services from the business's own photographs. Idempotent: existing rows
 * (matched by slug) are left alone, so it never overwrites edits made in the admin dashboard.
 *
 * Only facts visible in the photos are seeded (make and body features). Registration numbers are
 * deliberately never seeded: they must not appear anywhere on the website.
 * Seating capacity, amenities and prices are left blank for the business to fill in.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROJECT_ROOT } from '../config.js';
import { pool, tx } from '../db.js';

interface Manifest {
  photos: Record<string, { base: string; widths: number[]; width: number; height: number; alt: string }>;
}

const VEHICLES = [
  {
    slug: 'force-traveller-elite-livery',
    name: 'Force Traveller — Elite Livery',
    category: 'bus',
    make_model: 'Force Traveller',
    tagline: 'Our signature white traveller in Elite Travel Hub colours.',
    description:
      'A high-roof Force Traveller in white with the Elite Travel Hub stripes. It has curtained windows and soft cabin lighting for evening trips.',
    amenities: ['Curtained windows', 'Ambient cabin lighting', 'High roof'],
    is_featured: true,
    sort_order: 1,
    photos: [
      'traveller-elite-livery-night-profile',
      'traveller-elite-livery-side-quarter',
      'traveller-elite-livery-night-front-quarter',
      'traveller-elite-livery-front',
      'traveller-elite-livery-rear-night',
    ],
  },
  {
    slug: 'force-traveller-black-grille',
    name: 'Force Traveller — Black Grille',
    category: 'bus',
    make_model: 'Force Traveller',
    tagline: 'A white Force Traveller with a black front grille.',
    description:
      'A high-roof Force Traveller in white, with a black mesh grille, a shaped front bumper, a roof ladder and a spare wheel at the back.',
    amenities: ['High roof', 'Roof ladder', 'Rear spare wheel'],
    is_featured: true,
    sort_order: 2,
    photos: ['traveller-black-grille-front-street', 'traveller-black-grille-front-garden', 'traveller-black-grille-rear'],
  },
  {
    slug: 'toyota-innova',
    name: 'Toyota Innova',
    category: 'car',
    make_model: 'Toyota Innova',
    tagline: 'A silver Toyota Innova for families and small groups.',
    description: 'A comfortable silver Toyota Innova for family trips, small groups and special occasions such as weddings.',
    amenities: [],
    is_featured: true,
    sort_order: 3,
    photos: ['toyota-innova-front'],
  },
  {
    // Only appears in the fleet line-up photo — kept hidden until it has its own photographs.
    slug: 'traveller-third',
    name: 'Traveller — awaiting photos',
    category: 'bus',
    make_model: null,
    tagline: null,
    description: 'Add photographs of this vehicle and confirm its details, then enable it to show it on the website.',
    amenities: [],
    is_featured: false,
    sort_order: 4,
    is_active: false,
    photos: ['fleet-three-travellers-lineup'],
  },
];

const SERVICES = [
  { slug: 'tourist-bus-rental', icon: 'bus', title: 'Tourist bus rental', summary: 'Tourist travellers for groups, with room for everyone and their luggage.', body: 'Hire a traveller for a day trip, a pilgrimage or a tour of several days. Tell us how many people are travelling, where you are going and when, and we will suggest the right vehicle.' },
  { slug: 'travel-cars', icon: 'car', title: 'Travel cars', summary: 'Cars for small families and smaller groups.', body: 'For a family trip or a small group, book one of our cars. Ask us about the driver and timings when you send your request.' },
  { slug: 'group-transportation', icon: 'users', title: 'Group transportation', summary: 'One vehicle and one schedule for your office, college or wedding group.', body: 'Office outings, study tours, events and functions. Tell us the number of people and the schedule, and we will plan the vehicles and timings.' },
  { slug: 'family-trips', icon: 'heart', title: 'Family trips', summary: 'Holidays, temple visits and family get-togethers.', body: 'From grandparents to children — travel at your own pace and stop wherever you need to.' },
  { slug: 'outstation-travel', icon: 'route', title: 'Outstation travel', summary: 'One-way trips, round trips and tours of several days, in Kerala and beyond.', body: 'Tell us your route and dates. We will confirm the vehicle, timings and fare with you before your trip is booked.' },
  { slug: 'sightseeing', icon: 'mountain', title: 'Sightseeing', summary: 'Hill stations, backwaters, beaches and heritage sites — at your own pace.', body: 'Plan a day of sightseeing or a weekend trip. Tell us the places you want to see and we will help you plan the timings.' },
  { slug: 'customised-travel', icon: 'sparkles', title: 'Customised travel', summary: 'Have a different plan? Tell us and we will arrange it.', body: 'Special routes, special occasions or trips with many stops — send us the details or call us to talk it through.' },
];

export async function seed(log = console.log) {
  const manifest = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, 'client', 'src', 'data', 'photos.json'), 'utf8')) as Manifest;
  await tx(async (db) => {
    for (const v of VEHICLES) {
      const { rows } = await db.query<{ id: string }>(
        `insert into vehicles (slug, name, category, make_model, tagline, description, amenities, is_featured, sort_order, is_active)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (slug) do nothing returning id`,
        [v.slug, v.name, v.category, v.make_model, v.tagline, v.description, v.amenities, v.is_featured, v.sort_order, v.is_active ?? true],
      );
      const id = rows[0]?.id;
      if (!id) {
        log(`vehicle exists, skipped: ${v.slug}`);
        continue;
      }
      for (const [i, key] of v.photos.entries()) {
        const p = manifest.photos[key];
        if (!p) throw new Error(`photos.json has no entry ${key} — run npm run images:process`);
        await db.query(
          `insert into vehicle_images (vehicle_id, src_base, widths, width, height, alt, storage, sort_order) values ($1,$2,$3,$4,$5,$6,'static',$7)`,
          [id, p.base, p.widths, p.width, p.height, p.alt, i],
        );
      }
      log(`vehicle added: ${v.slug} (${v.photos.length} photos)`);
    }
    for (const [i, s] of SERVICES.entries()) {
      const { rowCount } = await db.query(
        `insert into services (slug, title, summary, body, icon, sort_order) values ($1,$2,$3,$4,$5,$6) on conflict (slug) do nothing`,
        [s.slug, s.title, s.summary, s.body, s.icon, i],
      );
      log(rowCount ? `service added: ${s.slug}` : `service exists, skipped: ${s.slug}`);
    }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  seed()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
