import { NextRequest, NextResponse } from 'next/server';
import { getEpisodeByYoutubeId } from '@/lib/search';
import { apiError } from '@/lib/api-errors';
export async function GET(request: NextRequest, { params }: { params: Promise<{ youtube_id: string }> }) {
  try {
    const { youtube_id } = await params;
    const episode = await getEpisodeByYoutubeId(youtube_id);
    return episode ? NextResponse.json({ episode }) : NextResponse.json({ error: 'Episodio no encontrado' }, { status: 404 });
  } catch (error) { return apiError(error); }
}
