export interface YouTubePlayer {
  destroy(): void; seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void; getCurrentTime(): number;
  mute(): void; unMute(): void; isMuted(): boolean; pauseVideo(): void;
  loadVideoById(options:{videoId:string;startSeconds:number;endSeconds:number}):void;
}
export interface YouTubeAPI {
  Player: new (element: HTMLElement, options: { videoId: string; playerVars: Record<string, number|string>;
    events: { onReady: (event: { target: YouTubePlayer }) => void; onError: () => void;
      onStateChange?:(event:{data:number})=>void; onAutoplayBlocked?:()=>void } }) => YouTubePlayer;
}
declare global { interface Window { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void } }
let loading: Promise<YouTubeAPI> | undefined;
export function loadYouTubeAPI(): Promise<YouTubeAPI> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    let tag = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    const previous = window.onYouTubeIframeAPIReady;
    const finish = () => {
      clearTimeout(timeout);
      tag?.removeEventListener('error', fail);
      if (window.onYouTubeIframeAPIReady === ready) window.onYouTubeIframeAPIReady = previous;
    };
    const fail = () => { finish(); loading = undefined; tag?.remove(); reject(new Error('No se pudo cargar el reproductor.')); };
    const ready = () => { finish(); previous?.(); if (window.YT?.Player) resolve(window.YT); else fail(); };
    const timeout = setTimeout(fail, 15000);
    window.onYouTubeIframeAPIReady = ready;
    if (!tag) { tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(tag); }
    tag.addEventListener('error', fail, { once: true });
  });
  return loading;
}
