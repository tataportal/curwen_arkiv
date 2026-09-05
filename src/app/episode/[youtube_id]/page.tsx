import EpisodeDetail from '@/components/EpisodeDetail';
export default async function EpisodePage({ params }: { params: Promise<{ youtube_id: string }> }) {
  const { youtube_id } = await params;
  return <EpisodeDetail youtubeId={youtube_id} />;
}
