import { NextRequest, NextResponse } from 'next/server';
import { searchTranscript } from '@/lib/search';
import { apiError } from '@/lib/api-errors';
export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams;
    return NextResponse.json(await searchTranscript(p.get('q') || '', Number(p.get('page') || 1), Number(p.get('page_size') || 20)));
  } catch (error) { return apiError(error); }
}
