import type {RetrievalEpisode} from '@/lib/retrieval/model';
import {resultMoments} from '@/lib/evidence-presentation';
import {EvidenceList} from './EvidenceList';
export default function SearchResults({episodes,query}:{episodes:RetrievalEpisode[];query:string}) {return <EvidenceList items={resultMoments(episodes)} query={query}/>;}
