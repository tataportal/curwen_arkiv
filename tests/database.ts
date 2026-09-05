import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
export async function testDatabase() {
  const db = new PGlite({ extensions: { uuid_ossp, pgcrypto } });
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  for (const file of fs.readdirSync('supabase/migrations').sort()) await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
  return db;
}
