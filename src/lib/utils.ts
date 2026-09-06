/**
 * Formats a duration in seconds into HH:MM:SS or MM:SS
 * e.g., 751 -> "12:31", 3725 -> "01:02:05"
 */
export function formatTimestamp(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  
  const secNum = Math.floor(totalSeconds);
  const hours = Math.floor(secNum / 3600);
  const minutes = Math.floor((secNum % 3600) / 60);
  const seconds = secNum % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Parses WebVTT timestamp string "00:01:23.456" or "01:23.456" into float seconds
 */
export function parseVTTTimestamp(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  }
  return 0;
}

/**
 * Formats a date string into readable Spanish format (e.g. "15 mar 2024")
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Builds direct YouTube link with start timestamp
 */
export function buildYouTubeTimestampUrl(youtubeId: string, startSeconds: number): string {
  const sec = Math.round(Math.max(0,startSeconds)*1000)/1000;
  return `https://youtube.com/watch?v=${youtubeId}&t=${sec}`;
}
