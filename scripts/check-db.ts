import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  '';

console.log('Using Supabase Key prefix:', key.slice(0, 15));
const supabase = createClient(url, key);

async function check() {
  const vRes = await supabase.from('videos').select('*').limit(1);
  console.log('Videos select result:', JSON.stringify(vRes, null, 2));

  const cRes = await supabase.from('transcript_chunks').select('*').limit(1);
  console.log('Chunks select result:', JSON.stringify(cRes, null, 2));
}

check();
