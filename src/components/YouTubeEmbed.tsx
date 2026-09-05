'use client';
import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { buildYouTubeTimestampUrl, formatTimestamp } from '@/lib/utils';
import { loadYouTubeAPI, type YouTubePlayer } from '@/lib/youtube-api';
interface YouTubeEmbedProps {
  youtubeId: string; initialSeconds?: number; seekToSeconds?: number | null; seekRequestId?: number;
  autoplay?: boolean; className?: string; onTimeUpdate?: (seconds: number) => void;
}
export default function YouTubeEmbed({ youtubeId, initialSeconds = 0, seekToSeconds, seekRequestId = 0,
  autoplay = false, className = '', onTimeUpdate }: YouTubeEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null), playerRef = useRef<YouTubePlayer | null>(null);
  const latest = useRef({ initialSeconds, seekToSeconds, autoplay, onTimeUpdate });
  latest.current = { initialSeconds, seekToSeconds, autoplay, onTimeUpdate };
  const [ready, setReady] = useState(false), [time, setTime] = useState(initialSeconds), [error, setError] = useState('');
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    let disposed = false, instance: YouTubePlayer | undefined;
    setReady(false); setError(''); setTime(latest.current.initialSeconds);
    const mount = document.createElement('div');
    host.replaceChildren(mount);
    loadYouTubeAPI().then(api => {
      if (disposed) return;
      instance = new api.Player(mount, { videoId: youtubeId,
        playerVars: { start: Math.max(0, Math.floor(latest.current.initialSeconds)), autoplay: latest.current.autoplay ? 1 : 0, rel: 0 },
        events: {
          onReady: event => {
            if (disposed) return;
            playerRef.current = event.target; setReady(true);
            const start = latest.current.seekToSeconds ?? latest.current.initialSeconds;
            if (start > 0) event.target.seekTo(start, true);
          },
          onError: () => { if (!disposed) setError('No se pudo reproducir este video. Puedes abrirlo en YouTube.'); },
        },
      });
    }).catch(e => { if (!disposed) setError(e.message); });
    return () => { disposed = true; playerRef.current = null; instance?.destroy(); host.replaceChildren(); };
  }, [youtubeId]);
  useEffect(() => {
    if (ready && seekToSeconds != null && Number.isFinite(seekToSeconds)) {
      playerRef.current?.seekTo(Math.max(0, seekToSeconds), true); playerRef.current?.playVideo(); setTime(Math.max(0, seekToSeconds));
    }
  }, [ready, seekToSeconds, seekRequestId]);
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      const t = playerRef.current?.getCurrentTime();
      if (t != null && Number.isFinite(t)) { setTime(t); latest.current.onTimeUpdate?.(t); }
    }, 1000);
    return () => clearInterval(interval);
  }, [ready]);
  return <div className={`relative flex flex-col bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden shadow-2xl ${className}`}>
    <div className="flex justify-between px-3 py-2 bg-zinc-900 text-xs font-mono text-zinc-400">
      <span className="text-amber-400">{formatTimestamp(time)}</span>
      <a href={buildYouTubeTimestampUrl(youtubeId, time)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">Abrir en YouTube <ExternalLink className="w-3 h-3" /></a>
    </div>
    {error && <p role="alert" className="p-3 text-sm text-red-300">{error}</p>}
    <div ref={containerRef} className="w-full aspect-video bg-black [&>iframe]:w-full [&>iframe]:h-full" />
  </div>;
}
