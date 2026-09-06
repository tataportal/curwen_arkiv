import { cp, mkdir, mkdtemp, readFile, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
const root = process.cwd();
const basePath = process.env.PAGES_BASE_PATH || '/curwen_arkiv';
if (!/^\/[a-zA-Z0-9_-]+$/.test(basePath)) throw new Error('Invalid Pages base path');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Set the public Supabase URL and public anonymous/publishable key.');
if (key.startsWith('sb_secret_')) throw new Error('Never export a secret key.');
if (!key.startsWith('sb_publishable_')) {
  let payload;
  try { payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url')); } catch { throw new Error('Invalid public Supabase key'); }
  if (payload.role !== 'anon') throw new Error('Only the anonymous role can be published.');
}
const stage = await mkdtemp(join(tmpdir(), 'curwen-pages-'));
await mkdir(join(stage, 'src'), { recursive: true });
// Assemble a static presentation build without modifying the working app,
// ingestion, migrations, corpus, or API handlers.
await cp(join(root, 'src'), join(stage, 'src'), { recursive: true, filter: path => {
  const relative = path.slice(join(root, 'src').length).replaceAll('\\', '/');
  return !relative.startsWith('/app/api') && !relative.startsWith('/app/episode/[youtube_id]');
} });
for (const file of ['package.json', 'tsconfig.json', 'postcss.config.mjs']) await cp(join(root, file), join(stage, file));
await symlink(join(root, 'node_modules'), join(stage, 'node_modules'), 'dir');
await writeFile(join(stage, 'next.config.mjs'), 'export default ' + JSON.stringify({
  output: 'export', basePath, trailingSlash: true, images: { unoptimized: true }, devIndicators: false,
}) + ';\n');
const env = {
  PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_STATIC_ARCHIVE: 'true', NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: key,
  NEXT_PUBLIC_RETRIEVAL_API_BASE: process.env.NEXT_PUBLIC_RETRIEVAL_API_BASE || 'https://curwen-retrieval-api.tataportal.chatgpt.site',
};
const build = spawnSync(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'build', '--webpack'], { cwd: stage, env, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);
const out = join(stage, 'out');
await writeFile(join(out, '.nojekyll'), '');
// Pages cannot rewrite dynamic routes. Preserve inbound /episode/VIDEO_ID
// links by routing them to the live-data episode shell, including timestamps.
const redirect = `<script>(function(){var b=${JSON.stringify(basePath)},p=location.pathname.slice(b.length),m=p.match(/^\\/episode\\/([\\w-]{11})\\/?$/);if(m){var q=new URLSearchParams(location.search);q.set('id',m[1]);location.replace(b+'/episode/?'+q.toString());}})();</script>`;
const notFound = await readFile(join(out, '404.html'), 'utf8');
await writeFile(join(out, '404.html'), notFound.replace('</head>', redirect + '</head>'));
await mkdir(resolve('out'), { recursive: true });
await cp(out, resolve('out'), { recursive: true });
console.log('Static frontend exported to out/; backend source remains unchanged.');
