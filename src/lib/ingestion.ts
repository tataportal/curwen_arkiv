import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { PARSER_VERSION, parseAndChunkVTT } from './vtt-parser';
import { generateDeterministicChunkId } from './chunk-id';

export interface EpisodeMetadata {
  youtube_id: string; title: string; description: string | null; published_at: string | null;
  duration_seconds: number; thumbnail_url: string; youtube_url: string;
}
export interface EpisodePair { metadata: EpisodeMetadata; json_path: string; vtt_path: string }
export function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? walk(path.join(dir, e.name)) : e.isFile() ? [path.join(dir, e.name)] : []).sort();
}
export function fingerprint(dir: string): string {
  return createHash('sha256').update(JSON.stringify(walk(dir).map(p => {
    const s = fs.statSync(p); return [p, s.size, s.mtimeMs];
  }))).digest('hex');
}
export function idFromVttName(name: string): string | undefined {
  return name.match(/^\d{8}_([\w-]{11})_/)?.[1]
    || name.match(/\[([\w-]{11})\](?:\.[^.]+)*\.vtt$/)?.[1]
    || name.match(/^([\w-]{11})(?:\.[^.]+)*\.vtt$/)?.[1];
}
export function normalizeMetadata(info: Record<string, any>): EpisodeMetadata {
  if (!/^[\w-]{11}$/.test(info.id) || info._type === 'playlist') throw new Error('Not a YouTube video');
  if (typeof info.title !== 'string' || !info.title.trim()) throw new Error('Missing episode title');
  let published: string | null = null;
  const timestamp = info.timestamp ?? info.release_timestamp;
  if (timestamp != null) published = new Date(Number(timestamp) * 1000).toISOString();
  else if (info.upload_date) {
    if (!/^\d{8}$/.test(info.upload_date)) throw new Error('Invalid upload date');
    const d = info.upload_date; published = new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T00:00:00Z`).toISOString();
  }
  const duration = Math.round(Number(info.duration ?? 0));
  if (!Number.isFinite(duration) || duration < 0) throw new Error('Invalid duration');
  return { youtube_id: info.id, title: info.title, description: info.description || null,
    published_at: published, duration_seconds: duration,
    thumbnail_url: info.thumbnail || `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`,
    youtube_url: `https://www.youtube.com/watch?v=${info.id}` };
}
export function discoverCorpus(directory: string, expectedVideos = 477) {
  const root = path.resolve(directory.replace(/^~(?=\/|$)/, homedir()));
  const files = walk(root), jsons = files.filter(p => p.endsWith('.info.json')), vtts = files.filter(p => p.endsWith('.vtt'));
  const metas = new Map<string, { file: string; metadata: EpisodeMetadata }[]>();
  const knownIds = new Set<string>();
  const transcripts = new Map<string, string[]>();
  const invalidJson: { file: string; error: string }[] = [], excluded: string[] = [], unknownVtt: string[] = [];
  const add = <T>(map: Map<string, T[]>, id: string, value: T) => map.set(id, [...(map.get(id) || []), value]);
  for (const file of jsons) {
    try {
      const info = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (info._type === 'playlist' || !/^[\w-]{11}$/.test(info.id || '')) { excluded.push(file); continue; }
      knownIds.add(info.id);
      add(metas, info.id, { file, metadata: normalizeMetadata(info) });
    } catch (e) { invalidJson.push({ file, error: (e as Error).message }); }
  }
  for (const file of vtts) {
    let id = idFromVttName(path.basename(file));
    if (!id) {
      const matches = [...metas].filter(([, items]) => items.some(item => {
        const base = item.file.replace(/\.info\.json$/, '');
        return ['.vtt', '.es.vtt', '.es-orig.vtt'].some(suffix => file === base + suffix);
      }));
      if (matches.length === 1) id = matches[0][0];
    }
    if (id) add(transcripts, id, file); else unknownVtt.push(file);
  }
  const duplicates = {
    json: [...metas].filter(([, v]) => v.length > 1).map(([id, v]) => ({ id, files: v.map(x => x.file) })),
    vtt: [...transcripts].filter(([, v]) => v.length > 1).map(([id, files]) => ({ id, files })),
  };
  const conflicts: string[] = [], pairs: EpisodePair[] = [];
  for (const [id, records] of metas) {
    const candidates = transcripts.get(id);
    if (!candidates) continue;
    const selected = [...candidates].sort((a,b) => Number(b.endsWith('.es-orig.vtt')) - Number(a.endsWith('.es-orig.vtt')) || a.localeCompare(b));
    // Equal copies are counted but processed only once. Different sources require review.
    if (records.some(r => JSON.stringify(r.metadata) !== JSON.stringify(records[0].metadata))
      || selected.some(f => !fs.readFileSync(f).equals(fs.readFileSync(selected[0])))) { conflicts.push(id); continue; }
    pairs.push({ metadata: records[0].metadata, json_path: records[0].file, vtt_path: selected[0] });
  }
  pairs.sort((a,b) => a.metadata.youtube_id.localeCompare(b.metadata.youtube_id));
  return { root, pairs, summary: {
    expected_videos: expectedVideos, unique_videos: knownIds.size,
    target_difference: knownIds.size - expectedVideos, info_json_files: jsons.length, vtt_files: vtts.length,
    valid_pairs: [...knownIds].filter(id => transcripts.has(id) && metas.has(id)).length,
    missing_vtt: [...knownIds].filter(id => !transcripts.has(id)).sort(),
    missing_json: [...transcripts.keys()].filter(id => !knownIds.has(id)).sort(),
    duplicates, conflicting_duplicate_ids: conflicts, invalid_json: invalidJson, excluded_nonvideo_json: excluded,
    unrecognized_vtt: unknownVtt,
  } };
}
export function prepareEpisode(pair: EpisodePair) {
  const source = fs.readFileSync(pair.vtt_path, 'utf8');
  let index = 0;
  const parsed = parseAndChunkVTT(source).map(chunk => ({ ...chunk, cues: chunk.cues.map(c => ({ ...c, cue_index: index++ })) }));
  const chunks = parsed.map((chunk, i) => {
    // Look ahead one whole chunk so phrases across a chunk boundary remain searchable.
    // Only starts belonging to the current chunk are emitted by the search RPC.
    const search_cues = [...chunk.cues, ...(parsed[i + 1]?.cues || [])];
    return { ...chunk, id: generateDeterministicChunkId(pair.metadata.youtube_id, chunk.start_seconds, chunk.end_seconds),
      search_cues, search_text: search_cues.map(c => c.text).join(' ') };
  });
  const source_hash = createHash('sha256').update(JSON.stringify({ parser: PARSER_VERSION, metadata: pair.metadata, chunks })).digest('hex');
  return { metadata: pair.metadata, chunks, source_hash, parser_version: PARSER_VERSION };
}
export function corpusHasIssues(summary: ReturnType<typeof discoverCorpus>['summary']) {
  return summary.target_difference !== 0 || summary.missing_vtt.length > 0 || summary.missing_json.length > 0
    || summary.invalid_json.length > 0 || summary.conflicting_duplicate_ids.length > 0 || summary.unrecognized_vtt.length > 0;
}
