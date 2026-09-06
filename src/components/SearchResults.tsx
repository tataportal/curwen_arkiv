'use client';
import type {ClusteredSearchResult} from '@/lib/types';
import {resultMoments} from '@/lib/evidence-presentation';
import {EvidenceList} from './EvidenceList';
export default function SearchResults({results,query}:{results:ClusteredSearchResult[];query:string}) {
  return <EvidenceList items={resultMoments(results)} query={query}/>;
}
