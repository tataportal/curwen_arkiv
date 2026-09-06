import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchTranscript} from '../src/lib/search';
import {validateRetrievalResponse} from '../src/lib/retrieval-contract';
import {buildEvidenceBranch,buildCommonPaths,resultEvidence} from '../src/lib/evidence-network';
import {fixture,response} from './retrieval-fixture';
process.env.NEXT_PUBLIC_RETRIEVAL_API_BASE='https://retrieval.invalid';
test('legacy chunks and missing occurrence timestamps fail closed',()=>{
 assert.throws(()=>validateRetrievalResponse({results:[],total_clusters:0}));
 const r=response([fixture()]);delete (r.episodes[0].moments[0].occurrences[0] as any).cue_start_seconds;
 assert.throws(()=>validateRetrievalResponse(r));
});
test('API errors never fall back to old fragment search',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response('{}',{status:503});};
 try{await assert.rejects(()=>searchTranscript('Keiko'));assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test('related evidence uses the target occurrence cue, not the moment start',()=>{
 const e=fixture('Vacunas y pandemia.','Vacunas');
 const m=e.moments[0];const target=m.evidenceTokens!.find(t=>t.key==='pandemia')!;
 target.startSeconds=14.2;target.wordStartSeconds=14.4;
 const branch=buildEvidenceBranch('Vacunas',response([e]));
 assert(branch.nodes.every(n=>n.kind==='term'));
 const edge=branch.edges.find(e=>e.target==='term:pandemia')!;
 assert(edge);assert.equal(edge.evidence[0].seconds,14.2);assert.equal(edge.evidence[0].occurrence.cue_start_seconds,14.2);
 assert.equal(m.occurrences[0].cue_start_seconds,12.34);
});
test('episode titles and unsupported terms never become relationships',()=>{
 const e=fixture('Vacunas.','Vacunas');e.title='Pandemia y ensayo clínico';
 assert.deepEqual(buildEvidenceBranch('Vacunas',response([e])),{nodes:[],edges:[]});
 assert.equal(buildCommonPaths('Vacunas','Keiko',response([e])).length,0);
});
test('paths require both concepts in the same moment context and keep source occurrences',()=>{
 const e=fixture('Vacunas con Keiko.','Vacunas');
 const paths=buildCommonPaths('Vacunas','Keiko',response([e]));
 assert.equal(paths.length,1);assert(paths[0].nodes.every(n=>n.kind==='term'));
 assert.equal(paths[0].edges[0].evidence[0].occurrence.matchedText,'Keiko.');
 assert.equal(resultEvidence(e,e.moments[0])[0].seconds,12.34);
});
