import { NextRequest, NextResponse } from 'next/server';
import { getEpisodes } from '@/lib/search';
import { apiError } from '@/lib/api-errors';
export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams;
    return NextResponse.json(await getEpisodes(Number(p.get('page') || 1), Number(p.get('page_size') || 24), p.get('q') || '', p.get('order') === 'asc' ? 'asc' : 'desc'));
  } catch (error) { return apiError(error); }
}
