import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

const app = createApp();
const server = app.listen(config.PORT, config.HOST, () => {
  console.log(`Elite Travel Hub API listening on http://${config.HOST}:${config.PORT} (${config.NODE_ENV})`);
  console.log(`  storage: ${config.supabaseStorage ? `Supabase bucket "${config.SUPABASE_STORAGE_BUCKET}"` : `local ${config.UPLOAD_DIR}`}`);
  console.log(`  email:   ${config.smtpEnabled ? `SMTP ${config.SMTP_HOST}` : 'not configured — notifications are skipped'}`);
});

function shutdown() {
  server.close(() => pool.end().then(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
