#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { corpusHasIssues, discoverCorpus, fingerprint, prepareEpisode } from '../src/lib/ingestion';
import { PARSER_VERSION } from '../src/lib/vtt-parser';

async function main() {
  const args = process.argv.slice(2);
  const option = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
  const directory = args[0] && !args[0].startsWith('--') ? args[0] : 'data/raw';
  const expected = Number(option('--expected') ?? 477);
  if (!Number.isInteger(expected) || expected < 1) throw new Error('--expected must be a positive integer');
  const write = args.includes('--write');
  if (write && args.includes('--dry-run')) throw new Error('Choose --write or --dry-run');
  const corpus = discoverCorpus(directory, expected), before = fingerprint(corpus.root);
  const report = { ...corpus.summary, mode: write ? 'write' : 'dry-run', parser_version: PARSER_VERSION,
    checked_at: new Date().toISOString(), directory: corpus.root, total_chunks: 0, total_cues: 0,
    parse_failures: [] as { id: string; error: string }[], ingestion_failures: [] as { id: string; error: string }[],
    episodes: [] as { youtube_id: string; chunks: number; cues: number; source_hash: string; status: string }[],
    corpus_unchanged: true, ready: false };
  // Preflight the entire corpus before the first possible write.
  for (const pair of corpus.pairs) {
    try {
      const ep = prepareEpisode(pair), cues = ep.chunks.reduce((n,c) => n + c.cues.length, 0);
      report.total_chunks += ep.chunks.length; report.total_cues += cues;
      report.episodes.push({ youtube_id: ep.metadata.youtube_id, chunks: ep.chunks.length, cues, source_hash: ep.source_hash, status: 'parsed' });
    } catch (e) { report.parse_failures.push({ id: pair.metadata.youtube_id, error: (e as Error).message }); }
  }
  report.corpus_unchanged = before === fingerprint(corpus.root);
  report.ready = !corpusHasIssues(corpus.summary) && !report.parse_failures.length && report.corpus_unchanged;
  if (write && report.ready) {
    dotenv.config({ path: ['.env.local', '.env'], quiet: true });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (!url || !key || key.startsWith('sb_publishable_')) throw new Error('Ingestion requires Supabase URL and a server secret/service-role key');
    const db = createClient(url, key, { auth: { persistSession: false } });
    for (const pair of corpus.pairs) {
      try {
        const ep = prepareEpisode(pair);
        const row = report.episodes.find(r => r.youtube_id === ep.metadata.youtube_id)!;
        if (ep.source_hash !== row.source_hash) throw new Error('Episode changed after preflight');
        const { error, data } = await db.rpc('replace_archive_episode', { episode: ep.metadata, chunk_rows: ep.chunks,
          content_hash: ep.source_hash, parser_revision: ep.parser_version });
        if (error) throw new Error(error.message);
        row.status = data.status;
      } catch (e) { report.ingestion_failures.push({ id: pair.metadata.youtube_id, error: (e as Error).message }); }
    }
  }
  report.ready = report.ready && !report.ingestion_failures.length;
  const destination = option('--report');
  if (destination) {
    const file = path.resolve(destination);
    if (file === corpus.root || file.startsWith(corpus.root + path.sep)) throw new Error('Report must be outside source corpus');
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  }
  const { episodes, ...summary } = report;
  console.log(JSON.stringify({ ...summary, episodes_reported: episodes.length,
    chunks_per_episode: { min: Math.min(...episodes.map(e => e.chunks)), max: Math.max(...episodes.map(e => e.chunks)) } }, null, 2));
  if (!report.ready) process.exitCode = 2;
}
main().catch(e => { console.error((e as Error).message); process.exitCode = 1; });
