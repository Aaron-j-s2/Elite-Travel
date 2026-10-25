import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { requireCsrfHeader } from './lib/auth.js';
import { errorHandler, notFoundApi } from './lib/errors.js';
import { metaFor, renderHead, robotsTxt, sitemapXml } from './lib/seo.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin/index.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  const storageOrigin = config.SUPABASE_URL ? new URL(config.SUPABASE_URL).origin : null;
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', ...(storageOrigin ? [storageOrigin] : [])],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameSrc: ['https://www.google.com'],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: config.isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // ---- API -------------------------------------------------------------------
  const api = express.Router();
  api.use(express.json({ limit: '100kb' }));
  api.use(cookieParser());
  api.use(requireCsrfHeader);
  api.use('/admin', adminRouter);
  api.use('/', publicRouter);
  api.use(notFoundApi);
  api.use(errorHandler);
  app.use('/api', api);

  // ---- Uploaded images (local storage driver) ----------------------------------
  app.use('/uploads', express.static(config.UPLOAD_DIR, { immutable: true, maxAge: '365d', index: false, fallthrough: false }));

  app.get('/robots.txt', (_req, res) => res.type('text/plain').send(robotsTxt()));
  app.get('/sitemap.xml', async (_req, res, next) => {
    try {
      res.type('application/xml').send(await sitemapXml());
    } catch (err) {
      next(err);
    }
  });

  // ---- Built React app with per-page <head> --------------------------------------
  const indexFile = path.join(config.CLIENT_DIST, 'index.html');
  if (fs.existsSync(indexFile)) {
    const template = fs.readFileSync(indexFile, 'utf8');
    app.use(
      express.static(config.CLIENT_DIST, {
        index: false,
        setHeaders(res, file) {
          // Vite assets are content-hashed; photos keep stable names, so cache them for a month.
          if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          else if (file.includes(`${path.sep}images${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=2592000');
        },
      }),
    );
    app.get('/{*splat}', async (req, res, next) => {
      try {
        const { meta, status } = await metaFor(req.path);
        res
          .status(status)
          .type('html')
          .set('Cache-Control', 'no-cache')
          .send(template.replace(/<title>[\s\S]*?<\/title>/, '').replace('<!--app-head-->', renderHead(meta, req.path)));
      } catch (err) {
        next(err);
      }
    });
  }

  app.use(errorHandler);
  return app;
}
