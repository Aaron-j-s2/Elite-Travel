import { randomInt } from 'node:crypto';
import { z } from 'zod';

/** Today's calendar date in India (bookings are local-day based). */
export function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetweenInclusive(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/**
 * Normalise a phone number to E.164. Ten-digit Indian mobiles (with or without 0/91 prefix)
 * become +91XXXXXXXXXX; other numbers must already carry a + country code.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  const indian = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  if (/^[6-9]\d{9}$/.test(indian) && (!trimmed.startsWith('+') || digits.startsWith('91'))) return `+91${indian}`;
  if (trimmed.startsWith('+') && /^\d{8,15}$/.test(digits)) return `+${digits}`;
  return null;
}

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion

/** ETH-YYMM-XXXXX — short enough to read over the phone, random enough not to be guessed. */
export function newBookingReference(now = new Date()): string {
  const yymm = `${String(now.getUTCFullYear()).slice(2)}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  let code = '';
  for (let i = 0; i < 5; i++) code += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `ETH-${yymm}-${code}`;
}

// ---------------------------------------------------------------------------
// Reusable zod fields
// ---------------------------------------------------------------------------
export const text = (max: number, min = 1) =>
  z
    .string({ error: 'Required' })
    .trim()
    .min(min, min <= 1 ? 'Required' : `At least ${min} characters`)
    .max(max, `At most ${max} characters`);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const phone = z
  .string({ error: 'Required' })
  .trim()
  .min(1, 'Required')
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid mobile number' });
      return z.NEVER;
    }
    return n;
  });

export const optionalEmail = z
  .string()
  .trim()
  .max(160)
  .optional()
  .nullable()
  .transform((v) => (v ? v.toLowerCase() : null))
  .refine((v) => v === null || z.email().safeParse(v).success, 'Enter a valid email address');

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v), 'Invalid date');

export const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');

export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only')
  .max(80);

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export const CATEGORIES = ['bus', 'car'] as const;
export const TRIP_TYPES = ['one_way', 'round_trip', 'multi_day', 'local'] as const;
export const STATUSES = ['pending', 'confirmed', 'rejected', 'cancelled', 'completed'] as const;
export type BookingStatus = (typeof STATUSES)[number];

/** Optional numeric form field: '' / null / undefined → null, otherwise coerced and validated. */
export const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), z.coerce.number().pipe(schema).nullable());
