import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError, type ZodType, type z } from 'zod';
import multer from 'multer';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'error',
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, 'bad_request', details);
export const notFound = (msg = 'Not found') => new HttpError(404, msg, 'not_found');
export const conflict = (msg: string, code = 'conflict') => new HttpError(409, msg, code);

export function parse<S extends ZodType>(schema: S, data: unknown): z.output<S> {
  const res = schema.safeParse(data);
  if (!res.success) throw res.error;
  return res.data;
}

function zodFields(err: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}

export const notFoundApi: RequestHandler = (_req, _res, next) => next(notFound('Unknown API route'));

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Please check the highlighted fields.', code: 'validation', fields: zodFields(err) });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code, ...(err.details ? { details: err.details } : {}) });
    return;
  }
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'That image is too large.' : 'Upload rejected.';
    res.status(400).json({ error: msg, code: 'upload' });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON body.', code: 'bad_request' });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body too large.', code: 'too_large' });
    return;
  }
  // Postgres constraint errors that can reach here are client mistakes, not crashes
  if (err?.code === '23505') {
    res.status(409).json({ error: 'That value is already in use.', code: 'duplicate' });
    return;
  }
  if (err?.code === '23P01') {
    res.status(409).json({ error: 'This vehicle already has a confirmed trip on those dates.', code: 'overlap' });
    return;
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.', code: 'internal' });
};
