'use client';
import { useEffect, useState } from 'react';
import EpisodeDetail from '@/components/EpisodeDetail';
export default function EpisodeEntry() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => { setId(new URLSearchParams(window.location.search).get('id') || ''); }, []);
  return id === null ? null : <EpisodeDetail youtubeId={id} />;
}
