import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (Supabase → Project Settings → Database)'),
  DATABASE_SSL: bool,
  PUBLIC_SITE_URL: z.string().url().default('http://localhost:5173'),
  TRUST_PROXY: z.string().optional(),
  COOKIE_SECURE: z.string().optional(),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(12),

  UPLOAD_DIR: z.string().default(path.join(SERVER_ROOT, 'uploads')),
  UPLOAD_MAX_MB: z.coerce.number().positive().max(20).default(8),
  SUPABASE_URL: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('vehicle-images'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: bool,
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  BUSINESS_NOTIFY_EMAIL: z.string().email().optional().or(z.literal('').transform(() => undefined)),

  CLIENT_DIST: z.string().default(path.join(PROJECT_ROOT, 'client', 'dist')),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  ...env,
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : env.NODE_ENV === 'production',
  trustProxy: env.TRUST_PROXY ? (/^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY) : false,
  supabaseStorage: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  smtpEnabled: Boolean(env.SMTP_HOST && env.MAIL_FROM),
};
