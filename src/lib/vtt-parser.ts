import { parseVTTTimestamp } from './utils';

export const PARSER_VERSION = '2.0.0';
export interface RawCue { start_seconds: number; end_seconds: number; text: string }
export interface ParsedChunk extends RawCue { cues: RawCue[] }

export function cleanVTTLine(raw: string): string {
  return raw.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ').trim();
}

function overlapLength(previous: string[], current: string[]): number {
  for (let n = Math.min(previous.length, current.length); n > 0; n--) {
    if (previous.slice(-n).every((word, i) => word.toLocaleLowerCase('es') === current[i].toLocaleLowerCase('es'))) return n;
  }
  return 0;
}
export function deduplicateRollingText(previous: string, current: string): string {
  const words = current.split(/\s+/).filter(Boolean);
  return words.slice(overlapLength(previous.split(/\s+/).filter(Boolean), words)).join(' ');
}

/** Preserve source cue timing, using inline word timing for the first new word.
 * Only overlapping/contiguous cues participate in rolling deduplication. A later
 * repetition after a pause is a new occurrence, not a rolling caption.
 */
export function parseVTTCues(content: string): RawCue[] {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!/^WEBVTT(?:\s|$)/.test(normalized)) throw new Error('Missing WEBVTT header');
  const timing = /^((?:\d{2,}:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d{2,}:)?\d{2}:\d{2}\.\d{3})(?:\s.*)?$/;
  let previousWords: string[] = [], previousEnd = -1, previousStart = -1;
  const cues: RawCue[] = [];
  for (const block of normalized.split(/\n{2,}/)) {
    const lines = block.split('\n');
    if (/^(NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0])) continue;
    const at = lines.findIndex(line => line.includes('-->'));
    if (at < 0) {
      if (block.trim() && !block.startsWith('WEBVTT')) throw new Error('Caption block has no timestamp');
      continue;
    }
    const match = lines[at].trim().match(timing);
    if (!match) throw new Error(`Malformed cue timestamp: ${lines[at]}`);
    const start = parseVTTTimestamp(match[1]), end = parseVTTTimestamp(match[2]);
    if (!Number.isFinite(start) || end <= start || start < previousStart) throw new Error(`Invalid cue interval: ${lines[at]}`);
    // Break raw markup into timed pieces before stripping tags.
    let time = start;
    const words: { text: string; time: number }[] = [];
    for (const piece of lines.slice(at + 1).join(' ').split(/(<(?:\d{2,}:)?\d{2}:\d{2}\.\d{3}>)/)) {
      if (/^<\d/.test(piece)) {
        time = parseVTTTimestamp(piece.slice(1, -1));
        // YouTube emits some final inline times 10 ms past its display cue end.
        if (time < start || time > end + 0.020001) throw new Error('Inline timestamp outside cue');
      } else {
        for (const text of cleanVTTLine(piece).split(' ').filter(Boolean)) words.push({ text, time });
      }
    }
    const rawWords = words.map(w => w.text);
    const overlap = start <= previousEnd + 0.05 ? overlapLength(previousWords, rawWords) : 0;
    const fresh = words.slice(overlap);
    if (fresh.length) {
      if (fresh[0].time >= end) throw new Error('First new word is outside cue interval');
      cues.push({ start_seconds: fresh[0].time, end_seconds: end, text: fresh.map(w => w.text).join(' ') });
    }
    previousWords = rawWords;
    previousEnd = end;
    previousStart = start;
  }
  if (!cues.length) throw new Error('Transcript has no usable cues');
  return cues;
}

export function chunkCues(cues: RawCue[], minDuration = 30, maxDuration = 60): ParsedChunk[] {
  if (minDuration <= 0 || maxDuration < minDuration) throw new Error('Invalid chunk durations');
  const chunks: ParsedChunk[] = [];
  let group: RawCue[] = [];
  function flush() {
    if (!group.length) return;
    chunks.push({ start_seconds: group[0].start_seconds,
      end_seconds: Math.max(...group.map(c => c.end_seconds)),
      text: group.map(c => c.text).join(' '), cues: group });
    group = [];
  }
  for (const cue of cues) {
    if (group.length) {
      const duration = cue.end_seconds - group[0].start_seconds;
      const previous = group[group.length - 1];
      if (duration >= maxDuration || (duration >= minDuration && cue.start_seconds - previous.end_seconds >= 2.5)
        || (duration >= 45 && /[.?!]$/.test(previous.text))) flush();
    }
    group.push(cue);
  }
  flush();
  return chunks;
}
export function parseAndChunkVTT(content: string, minDuration = 30, maxDuration = 60): ParsedChunk[] {
  return chunkCues(parseVTTCues(content), minDuration, maxDuration);
}
