import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp, { type Metadata } from 'sharp';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { badRequest } from './errors.js';

/*
 * Vehicle photo storage. Uploads are decoded and re-encoded by sharp (which proves the file
 * really is an image, applies EXIF rotation and strips metadata such as GPS), then stored as
 * responsive WebP variants: `${base}-${width}.webp`.
 *
 * Driver: Supabase Storage when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set,
 * otherwise the local UPLOAD_DIR (served at /uploads).
 */

export const UPLOAD_WIDTHS = [480, 960, 1600, 2400];
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif']);

export interface StoredImage {
  srcBase: string;
  widths: number[];
  width: number;
  height: number;
  storage: 'local' | 'supabase';
}

let supabase: SupabaseClient | null = null;
let bucketReady: Promise<void> | null = null;

function client() {
  supabase ??= createClient(config.SUPABASE_URL!, config.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  return supabase;
}

async function ensureBucket() {
  bucketReady ??= (async () => {
    const sb = client();
    const { data } = await sb.storage.getBucket(config.SUPABASE_STORAGE_BUCKET);
    if (!data) {
      const { error } = await sb.storage.createBucket(config.SUPABASE_STORAGE_BUCKET, {
        public: true,
        allowedMimeTypes: ['image/webp'],
        fileSizeLimit: 10 * 1024 * 1024,
      });
      if (error && !/exists/i.test(error.message)) throw error;
    }
  })().catch((err) => {
    bucketReady = null;
    throw err;
  });
  return bucketReady;
}

export async function storeVehicleImage(buffer: Buffer): Promise<StoredImage> {
  let meta: Metadata;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw badRequest('That file is not a readable image.');
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) throw badRequest('Upload a JPEG, PNG, WebP or AVIF image.');
  if (!meta.width || !meta.height || meta.width < 600 || meta.height < 400) throw badRequest('Images must be at least 600×400 pixels.');
  if (meta.width * meta.height > 60_000_000) throw badRequest('That image is too large to process.');

  const oriented = sharp(buffer).rotate();
  const { info } = await oriented.clone().toBuffer({ resolveWithObject: true });
  const widths = [...new Set(UPLOAD_WIDTHS.filter((w) => w < info.width).concat(Math.min(info.width, UPLOAD_WIDTHS.at(-1)!)))].sort((a, b) => a - b);
  const id = randomUUID();
  const variants = await Promise.all(
    widths.map(async (w) => ({ w, data: await oriented.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer() })),
  );

  if (config.supabaseStorage) {
    await ensureBucket();
    const sb = client();
    for (const v of variants) {
      const { error } = await sb.storage
        .from(config.SUPABASE_STORAGE_BUCKET)
        .upload(`vehicles/${id}-${v.w}.webp`, v.data, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
      if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }
    const base = sb.storage.from(config.SUPABASE_STORAGE_BUCKET).getPublicUrl(`vehicles/${id}`).data.publicUrl;
    return { srcBase: base, widths, width: info.width, height: info.height, storage: 'supabase' };
  }

  const dir = path.join(config.UPLOAD_DIR, 'vehicles');
  await fs.mkdir(dir, { recursive: true });
  for (const v of variants) await fs.writeFile(path.join(dir, `${id}-${v.w}.webp`), v.data);
  return { srcBase: `/uploads/vehicles/${id}`, widths, width: info.width, height: info.height, storage: 'local' };
}

export async function deleteStoredImage(img: { src_base: string; widths: number[]; storage: string }) {
  try {
    if (img.storage === 'supabase' && config.supabaseStorage) {
      const id = img.src_base.split('/').pop();
      await client()
        .storage.from(config.SUPABASE_STORAGE_BUCKET)
        .remove(img.widths.map((w) => `vehicles/${id}-${w}.webp`));
    } else if (img.storage === 'local') {
      const id = path.basename(img.src_base);
      await Promise.all(img.widths.map((w) => fs.rm(path.join(config.UPLOAD_DIR, 'vehicles', `${id}-${w}.webp`), { force: true })));
    }
    // 'static' images ship with the site build and are never deleted from disk.
  } catch (err) {
    console.warn('[storage] could not delete image files', (err as Error).message);
  }
}
