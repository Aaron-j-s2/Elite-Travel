import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../../config.js';
import { one, query, tx } from '../../db.js';
import { badRequest, conflict, notFound, parse } from '../../lib/errors.js';
import { CATEGORIES, isoDate, optionalNumber, optionalText, slug, slugify, text, todayIST } from '../../lib/fields.js';
import { ACCEPTED_TYPES, deleteStoredImage, storeVehicleImage } from '../../lib/storage.js';
import { imagesFor, serializeImage, type ImageRow, type VehicleRow } from '../../services/vehicles.js';

export const vehiclesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.UPLOAD_MAX_MB * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (ACCEPTED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(badRequest('Upload JPEG, PNG, WebP or AVIF images only.'));
  },
});

const idParam = z.object({ id: z.uuid() });
const money = optionalNumber(z.number().min(0, 'Can’t be negative').max(1_000_000));

const vehicleSchema = z.object({
  name: text(120, 2),
  slug: slug.optional().or(z.literal('').transform(() => undefined)),
  category: z.enum(CATEGORIES),
  makeModel: optionalText(120),
  registration: optionalText(30),
  seats: optionalNumber(z.number().int('Whole numbers only').min(1).max(80)),
  tagline: optionalText(160),
  description: optionalText(4000),
  amenities: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  specs: z.array(z.object({ label: text(40), value: text(120) })).max(20).default([]),
  dayRate: money,
  ratePerKm: money,
  minKmPerDay: optionalNumber(z.number().int().min(0).max(2000)),
  priceNote: optionalText(300),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(-1000).max(1000).default(0),
});

function serializeAdminVehicle(v: VehicleRow & { upcoming_count?: number; booking_count?: number }, images: ImageRow[]) {
  return {
    id: v.id,
    slug: v.slug,
    name: v.name,
    category: v.category,
    makeModel: v.make_model,
    registration: v.registration,
    seats: v.seats,
    tagline: v.tagline,
    description: v.description,
    amenities: v.amenities,
    specs: v.specs,
    dayRate: v.day_rate,
    ratePerKm: v.rate_per_km,
    minKmPerDay: v.min_km_per_day,
    priceNote: v.price_note,
    isActive: v.is_active,
    isFeatured: v.is_featured,
    sortOrder: v.sort_order,
    upcomingCount: v.upcoming_count ?? 0,
    bookingCount: v.booking_count ?? 0,
    images: images.map((i) => ({ ...serializeImage(i), storage: i.storage, sortOrder: i.sort_order })),
    updatedAt: v.updated_at,
  };
}

async function loadAdminVehicle(id: string) {
  const v = await one<VehicleRow & { upcoming_count: number; booking_count: number }>(
    `select v.*,
            (select count(*)::int from bookings b where b.vehicle_id = v.id and b.status = 'confirmed' and coalesce(b.return_date, b.trip_date) >= $2) as upcoming_count,
            (select count(*)::int from bookings b where b.vehicle_id = v.id) as booking_count
       from vehicles v where v.id = $1`,
    [id, todayIST()],
  );
  if (!v) throw notFound('Vehicle not found');
  const images = await imagesFor([id]);
  const blocks = await query(
    `select id, start_date as "startDate", end_date as "endDate", reason from vehicle_blocks where vehicle_id = $1 and end_date >= $2 order by start_date`,
    [id, todayIST()],
  );
  return { ...serializeAdminVehicle(v, images.get(id) ?? []), blocks };
}

const columns = (d: z.output<typeof vehicleSchema>) => [
  d.name, d.category, d.makeModel, d.registration, d.seats, d.tagline, d.description, d.amenities, JSON.stringify(d.specs),
  d.dayRate, d.ratePerKm, d.minKmPerDay, d.priceNote, d.isActive, d.isFeatured, d.sortOrder,
];

vehiclesRouter.get('/', async (_req, res) => {
  const rows = await query<VehicleRow & { upcoming_count: number; booking_count: number }>(
    `select v.*,
            (select count(*)::int from bookings b where b.vehicle_id = v.id and b.status = 'confirmed' and coalesce(b.return_date, b.trip_date) >= $1) as upcoming_count,
            (select count(*)::int from bookings b where b.vehicle_id = v.id) as booking_count
       from vehicles v order by v.sort_order, v.name`,
    [todayIST()],
  );
  const images = await imagesFor(rows.map((r) => r.id));
  res.json({ items: rows.map((v) => serializeAdminVehicle(v, images.get(v.id) ?? [])) });
});

vehiclesRouter.get('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  res.json({ vehicle: await loadAdminVehicle(id) });
});

vehiclesRouter.post('/', async (req, res) => {
  const d = parse(vehicleSchema, req.body);
  const s = d.slug ?? slugify(d.name);
  if (!s) throw badRequest('Give the vehicle a name with letters or numbers.');
  const row = await one<{ id: string }>(
    `insert into vehicles (name, category, make_model, registration, seats, tagline, description, amenities, specs,
                           day_rate, rate_per_km, min_km_per_day, price_note, is_active, is_featured, sort_order, slug)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id`,
    [...columns(d), s],
  ).catch((err) => {
    if (err.code === '23505') throw conflict('Another vehicle already uses that web address (slug).');
    throw err;
  });
  res.status(201).json({ vehicle: await loadAdminVehicle(row!.id) });
});

vehiclesRouter.patch('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const d = parse(vehicleSchema, req.body);
  const existing = await one<VehicleRow>('select * from vehicles where id = $1', [id]);
  if (!existing) throw notFound('Vehicle not found');
  if (existing.category !== d.category) {
    const used = await one('select 1 from bookings where vehicle_id = $1 and status in ($2, $3) limit 1', [id, 'pending', 'confirmed']);
    if (used) throw badRequest('This vehicle has open bookings, so its category can’t change.');
  }
  await query(
    `update vehicles set name=$1, category=$2, make_model=$3, registration=$4, seats=$5, tagline=$6, description=$7, amenities=$8, specs=$9,
            day_rate=$10, rate_per_km=$11, min_km_per_day=$12, price_note=$13, is_active=$14, is_featured=$15, sort_order=$16,
            slug=$17 where id=$18`,
    [...columns(d), d.slug ?? existing.slug, id],
  ).catch((err) => {
    if (err.code === '23505') throw conflict('Another vehicle already uses that web address (slug).');
    throw err;
  });
  res.json({ vehicle: await loadAdminVehicle(id) });
});

vehiclesRouter.delete('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const used = await one('select 1 from bookings where vehicle_id = $1 limit 1', [id]);
  if (used) throw conflict('This vehicle has booking history, so it can’t be deleted. Disable it instead to hide it from the website.', 'in_use');
  const images = await query<ImageRow>('select * from vehicle_images where vehicle_id = $1', [id]);
  const deleted = await one('delete from vehicles where id = $1 returning id', [id]);
  if (!deleted) throw notFound('Vehicle not found');
  await Promise.all(images.map(deleteStoredImage));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------
vehiclesRouter.post('/:id/images', upload.array('images', 10), async (req, res) => {
  const { id } = parse(idParam, req.params);
  const vehicle = await one<VehicleRow>('select * from vehicles where id = $1', [id]);
  if (!vehicle) throw notFound('Vehicle not found');
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) throw badRequest('Choose at least one image.');
  const maxOrder = (await one<{ m: number }>('select coalesce(max(sort_order), -1)::int as m from vehicle_images where vehicle_id = $1', [id]))!.m;
  let order = maxOrder;
  for (const file of files) {
    const stored = await storeVehicleImage(file.buffer);
    await query(
      `insert into vehicle_images (vehicle_id, src_base, widths, width, height, alt, storage, sort_order) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, stored.srcBase, stored.widths, stored.width, stored.height, `${vehicle.name} — photo`, stored.storage, ++order],
    );
  }
  res.status(201).json({ vehicle: await loadAdminVehicle(id) });
});

vehiclesRouter.patch('/:id/images/:imageId', async (req, res) => {
  const { id, imageId } = parse(z.object({ id: z.uuid(), imageId: z.uuid() }), req.params);
  const { alt } = parse(z.object({ alt: text(200, 3) }), req.body);
  const row = await one('update vehicle_images set alt = $3 where id = $2 and vehicle_id = $1 returning id', [id, imageId, alt]);
  if (!row) throw notFound('Photo not found');
  res.json({ vehicle: await loadAdminVehicle(id) });
});

vehiclesRouter.put('/:id/images/order', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { order } = parse(z.object({ order: z.array(z.uuid()).max(100) }), req.body);
  await tx(async (db) => {
    for (const [i, imageId] of order.entries()) {
      await db.query('update vehicle_images set sort_order = $3 where id = $2 and vehicle_id = $1', [id, imageId, i]);
    }
  });
  res.json({ vehicle: await loadAdminVehicle(id) });
});

vehiclesRouter.delete('/:id/images/:imageId', async (req, res) => {
  const { id, imageId } = parse(z.object({ id: z.uuid(), imageId: z.uuid() }), req.params);
  const img = await one<ImageRow>('delete from vehicle_images where id = $2 and vehicle_id = $1 returning *', [id, imageId]);
  if (!img) throw notFound('Photo not found');
  await deleteStoredImage(img);
  res.json({ vehicle: await loadAdminVehicle(id) });
});

// ---------------------------------------------------------------------------
// Unavailable dates
// ---------------------------------------------------------------------------
const blockSchema = z
  .object({ startDate: isoDate, endDate: isoDate, reason: optionalText(200) })
  .refine((b) => b.endDate >= b.startDate, { path: ['endDate'], message: 'End date must be on or after the start date' });

vehiclesRouter.post('/:id/blocks', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const b = parse(blockSchema, req.body);
  const exists = await one('select 1 from vehicles where id = $1', [id]);
  if (!exists) throw notFound('Vehicle not found');
  const clash = await one<{ reference: string }>(
    `select reference from bookings where vehicle_id = $1 and status = 'confirmed' and trip_range && daterange($2::date, $3::date, '[]') limit 1`,
    [id, b.startDate, b.endDate],
  );
  if (clash) throw conflict(`Confirmed booking ${clash.reference} falls in those dates. Reassign or cancel it first.`);
  await query('insert into vehicle_blocks (vehicle_id, start_date, end_date, reason) values ($1,$2,$3,$4)', [id, b.startDate, b.endDate, b.reason]);
  res.status(201).json({ vehicle: await loadAdminVehicle(id) });
});

vehiclesRouter.delete('/:id/blocks/:blockId', async (req, res) => {
  const { id, blockId } = parse(z.object({ id: z.uuid(), blockId: z.uuid() }), req.params);
  await query('delete from vehicle_blocks where id = $2 and vehicle_id = $1', [id, blockId]);
  res.json({ vehicle: await loadAdminVehicle(id) });
});
