import { config } from 'dotenv';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from 'pg';

// Load the test environment (separate DB + Redis logical DB) before anything else.
config({ path: '.env.test', override: true });

/** Runs once before the whole suite: ensure the test DB exists, then apply migrations. */
export default async function setup(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL missing — is apps/api/.env.test present?');

  const dbName = new URL(dbUrl).pathname.replace(/^\//, '');
  const adminUrl = new URL(dbUrl);
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!rowCount) await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  // Apply all migrations (incl. the hand-written raw SQL) to the test DB.
  execSync('pnpm prisma migrate deploy', {
    cwd: resolve(process.cwd(), '../..'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: dbUrl, DIRECT_URL: process.env.DIRECT_URL ?? dbUrl },
  });
}
