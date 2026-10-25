import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { config } from '../config.js';

/*
 * In-memory limits — fine for a single server process. If you run several instances behind a
 * load balancer, plug in a shared store (see express-rate-limit docs).
 */
const make = (windowMinutes: number, limit: number, message: string, key?: (req: any) => string) =>
  rateLimit({
    windowMs: windowMinutes * 60_000,
    limit: config.isTest ? 10_000 : limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: message, code: 'rate_limited' },
    ...(key ? { keyGenerator: key } : {}),
  });

export const bookingLimiter = make(60, 12, 'Too many booking requests from this connection. Please call us instead.');
export const lookupLimiter = make(15, 30, 'Too many lookups. Please wait a few minutes and try again.');
export const contactLimiter = make(60, 8, 'Too many messages from this connection. Please call us instead.');
export const loginLimiter = make(15, 10, 'Too many sign-in attempts. Please wait 15 minutes.', (req) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().slice(0, 160) : '';
  return `${ipKeyGenerator(req.ip ?? '')}|${email}`;
});
export const adminWriteLimiter = make(1, 120, 'Slow down a little.');
