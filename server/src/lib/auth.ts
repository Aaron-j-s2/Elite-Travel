import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { CookieOptions, RequestHandler } from 'express';
import { config } from '../config.js';
import { one, query } from '../db.js';
import { HttpError } from './errors.js';

export const SESSION_COOKIE = 'eth_admin';

// OWASP-recommended Argon2id parameters (19 MiB, t=2, p=1)
const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = hash('not-a-real-password-elite', ARGON);

export const hashPassword = (password: string) => hash(password, ARGON);

export async function verifyPassword(passwordHash: string | null, password: string) {
  try {
    return await verify(passwordHash ?? (await DUMMY_HASH), password);
  } catch {
    return false;
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    admin?: AdminUser;
    sessionId?: string;
  }
}

export function cookieOptions(maxAgeMs?: number): CookieOptions {
  return { httpOnly: true, secure: config.cookieSecure, sameSite: 'strict', path: '/api', ...(maxAgeMs ? { maxAge: maxAgeMs } : {}) };
}

export async function createSession(adminId: string, ip: string | undefined, userAgent: string | undefined) {
  const token = randomBytes(32).toString('base64url');
  const ttlMs = config.SESSION_TTL_HOURS * 3_600_000;
  await query(
    `insert into admin_sessions (admin_id, token_hash, expires_at, ip, user_agent) values ($1, $2, now() + $3 * interval '1 millisecond', $4, $5)`,
    [adminId, sha256(token), ttlMs, ip ?? null, userAgent?.slice(0, 300) ?? null],
  );
  // Opportunistic cleanup of expired sessions
  query('delete from admin_sessions where expires_at < now()').catch(() => {});
  return { token, ttlMs };
}

export async function destroySession(token: string | undefined) {
  if (token) await query('delete from admin_sessions where token_hash = $1', [sha256(token)]);
}

/** Requires a valid, unexpired session belonging to an active administrator. */
export const requireAdmin: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || token.length < 20) return next(new HttpError(401, 'Please sign in.', 'unauthenticated'));
  const row = await one<AdminUser & { session_id: string }>(
    `update admin_sessions s set last_seen_at = now()
       from admin_users u
      where s.token_hash = $1 and s.expires_at > now() and u.id = s.admin_id and u.is_active
      returning s.id as session_id, u.id, u.email, u.name`,
    [sha256(token)],
  );
  if (!row) return next(new HttpError(401, 'Your session has expired. Please sign in again.', 'unauthenticated'));
  req.admin = { id: row.id, email: row.email, name: row.name };
  req.sessionId = row.session_id;
  next();
};

/**
 * CSRF defence for cookie-authenticated requests: every state-changing API call must carry a
 * custom header. Browsers will not send custom headers cross-site without a CORS preflight,
 * which this server never grants. (SameSite=Strict cookies are the second layer.)
 */
export const requireCsrfHeader: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-eth-request') !== '1') return next(new HttpError(403, 'Request blocked.', 'csrf'));
  next();
};
