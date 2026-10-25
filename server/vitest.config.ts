import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['src/test/global-setup.ts'],
    fileParallelism: false, // tests share one database
    testTimeout: 20_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/elite_test',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      UPLOAD_DIR: path.join(os.tmpdir(), 'elite-test-uploads'),
      PUBLIC_SITE_URL: 'http://localhost:5173',
      SMTP_HOST: '',
    },
  },
});
