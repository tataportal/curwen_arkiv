import { NextResponse } from 'next/server';
import { ArchiveError } from './search';
export function apiError(error: unknown) {
  if (!(error instanceof ArchiveError)) console.error('Archive request failed:', error);
  return NextResponse.json({ error: error instanceof ArchiveError ? error.message : 'No se pudo consultar el archivo. Intenta nuevamente.' },
    { status: error instanceof ArchiveError ? error.status : 503 });
}
