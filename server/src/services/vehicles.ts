import { query, type Queryable } from '../db.js';

export interface VehicleRow {
  id: string;
  slug: string;
  name: string;
  category: 'bus' | 'car';
  make_model: string | null;
  registration: string | null;
  seats: number | null;
  tagline: string | null;
  description: string | null;
  amenities: string[];
  specs: { label: string; value: string }[];
  day_rate: number | null;
  rate_per_km: number | null;
  min_km_per_day: number | null;
  price_note: string | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ImageRow {
  id: string;
  vehicle_id: string;
  src_base: string;
  widths: number[];
  width: number;
  height: number;
  alt: string;
  storage: string;
  sort_order: number;
}

export const serializeImage = (img: ImageRow) => ({
  id: img.id,
  base: img.src_base,
  widths: img.widths,
  width: img.width,
  height: img.height,
  alt: img.alt,
});

export function hasPricing(v: VehicleRow) {
  return v.day_rate != null || v.rate_per_km != null || Boolean(v.price_note);
}

/**
 * Public shape — only what a customer needs. Pricing appears only when the business configured it.
 * Registration numbers are never sent to the public site.
 */
export function serializeVehicle(v: VehicleRow, images: ImageRow[]) {
  return {
    id: v.id,
    slug: v.slug,
    name: v.name,
    category: v.category,
    makeModel: v.make_model,
    seats: v.seats,
    tagline: v.tagline,
    description: v.description,
    amenities: v.amenities,
    specs: v.specs,
    pricing: hasPricing(v)
      ? { dayRate: v.day_rate, ratePerKm: v.rate_per_km, minKmPerDay: v.min_km_per_day, note: v.price_note }
      : null,
    isFeatured: v.is_featured,
    images: images.map(serializeImage),
  };
}

export async function imagesFor(vehicleIds: string[]) {
  if (!vehicleIds.length) return new Map<string, ImageRow[]>();
  const rows = await query<ImageRow>('select * from vehicle_images where vehicle_id = any($1) order by sort_order, created_at', [vehicleIds]);
  const map = new Map<string, ImageRow[]>();
  for (const r of rows) map.set(r.vehicle_id, [...(map.get(r.vehicle_id) ?? []), r]);
  return map;
}

export async function listPublicVehicles() {
  const vehicles = await query<VehicleRow>('select * from vehicles where is_active order by sort_order, name');
  const images = await imagesFor(vehicles.map((v) => v.id));
  return vehicles.map((v) => serializeVehicle(v, images.get(v.id) ?? []));
}

/** Date ranges (inclusive) in which a vehicle cannot take a new trip. No customer data is exposed. */
export async function busyRanges(db: Queryable, vehicleId: string, from: string, to: string, excludeBookingId?: string) {
  const { rows } = await db.query<{ start: string; end: string; kind: 'booked' | 'unavailable' }>(
    `select trip_date as start, coalesce(return_date, trip_date) as end, 'booked' as kind
       from bookings
      where vehicle_id = $1 and status in ('confirmed', 'completed')
        and trip_range && daterange($2::date, $3::date, '[]')
        and id is distinct from $4::uuid
     union all
     select start_date, end_date, 'unavailable'
       from vehicle_blocks
      where vehicle_id = $1 and daterange(start_date, end_date, '[]') && daterange($2::date, $3::date, '[]')
     order by 1`,
    [vehicleId, from, to, excludeBookingId ?? null],
  );
  return rows;
}
