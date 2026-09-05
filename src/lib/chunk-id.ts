import { createHash } from 'node:crypto';

/**
 * Generates a RFC 4122 compliant deterministic UUID (version 5-style)
 * from youtube_id + start_seconds + end_seconds using SHA-256
 */
export function generateDeterministicChunkId(
  youtubeId: string,
  startSeconds: number,
  endSeconds: number
): string {
  const input = `${youtubeId}:${startSeconds.toFixed(3)}:${endSeconds.toFixed(3)}`;
  const hash = createHash('sha256').update(input).digest('hex');

  // Format as 8-4-4-4-12 hex UUID
  // Set version 5 (0x50) and variant RFC 4122 (0x80)
  const part1 = hash.substring(0, 8);
  const part2 = hash.substring(8, 12);
  const part3 = '5' + hash.substring(13, 16); // Version 5
  const variantHex = (parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80;
  const part4 = variantHex.toString(16).padStart(2, '0') + hash.substring(18, 20);
  const part5 = hash.substring(20, 32);

  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

