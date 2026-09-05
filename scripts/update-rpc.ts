/** Explicit migration runner. Never invoked by ingestion, tests, or dry-run. */
import fs from 'node:fs';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });
async function main() {
  if (!process.argv.includes('--apply')) throw new Error('No changes made. Review the tracked migration and explicitly pass --apply after approval.');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for migrations; credentials must not be stored in source code.');
  const db = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
  try {
    await db.connect();
    await db.query(fs.readFileSync('supabase/migrations/20260905010000_repair_archive_foundation.sql', 'utf8'));
    console.log('Foundation migration applied. No corpus imported.');
  } finally { await db.end(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
