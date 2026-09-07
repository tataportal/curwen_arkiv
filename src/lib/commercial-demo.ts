import data from '@/data/commercial-demo.json';
import topicData from '@/data/commercial-topic-evidence.json';
import type {SearchOccurrence,SpeechSentence} from './retrieval/model';
export const PEOPLE=[{id:'keiko',name:'Keiko',fullName:'Keiko Fujimori',aliases:['keiko','keiko fujimori']},{id:'rla',name:'RLA',fullName:'Rafael López Aliaga',aliases:['rla','rafael lopez aliaga','lopez aliaga','porky']},{id:'chibolin',name:'Chibolín',fullName:'Andrés Hurtado',aliases:['chibolin','chivolin','andres hurtado']},{id:'magaly',name:'Magaly',fullName:'Magaly Medina',aliases:['magaly','magali','magaly medina','magali medina']}] as const;
export type TopicEvidence={label:string;quote:string;anchorType:'concept-mention'|'supporting-quote';occurrence:SearchOccurrence;excerpt:string;excerptCueIds:string[];context:SpeechSentence[];sourceHash:string};
export type DemoMoment={selectedEvidence?:TopicEvidence;id:string;person:string;title:string;summary:string;quote:string;topics:{label:string;quote:string}[];episode:{videoId:string;title:string;publishedAt:string|null};occurrence:SearchOccurrence;context:SpeechSentence[];sourceMomentId:string;review:{status:string}};
export const DEMO_MOMENTS=data.moments as DemoMoment[];
export const normalizeDemo=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function demoSearch(person:string,query:string){
 const words=normalizeDemo(query).split(' ').filter(Boolean);
 return DEMO_MOMENTS.filter(m=>{
  if(person!=='all'&&m.person!==person)return false;
  const p=PEOPLE.find(p=>p.id===m.person)!;
  const haystack=normalizeDemo([p.name,p.fullName,...p.aliases,m.title,m.summary,...m.topics.map(t=>t.label),...m.context.map(c=>c.text)].join(' '));
  const tokens=new Set(haystack.split(' '));
  return words.every(word=>tokens.has(word));
 });
}
export function demoGroups(moments:DemoMoment[]){
 const groups=new Map<string,DemoMoment[]>();
 for(const m of moments)groups.set(m.episode.videoId,[...(groups.get(m.episode.videoId)??[]),m]);
 return [...groups.values()].sort((a,b)=>(b[0].episode.publishedAt??'').localeCompare(a[0].episode.publishedAt??'')).map(group=>group.sort((a,b)=>demoOccurrence(a).cue_start_seconds-demoOccurrence(b).cue_start_seconds));
}
/** Stable Peru dates for static HTML and hydration; date-only metadata stays literal. */
export function demoDate(value:string|null){
 if(!value)return 'Fecha no disponible';
 const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(value);
 const instant=new Date(value).getTime();if(!Number.isFinite(instant))return 'Fecha no disponible';
 const [year,month,day]=(dateOnly?value:new Date(instant-5*60*60*1000).toISOString().slice(0,10)).split('-');
 const months=['ene','feb','mar','abr','may','jun','jul','ago','set','oct','nov','dic'];
 return `${Number(day)} ${months[Number(month)-1]}. ${year}`;
}

/** Every visible edge is backed by a reviewed quotation in these selected moments. */
export function demoConnections(moments:DemoMoment[]){
 const labels=[...new Set(moments.flatMap(m=>m.topics.map(t=>t.label)))];
 return labels.map(label=>({label,items:moments.filter(m=>m.topics.some(t=>t.label===label))}))
  .sort((a,b)=>b.items.length-a.items.length||a.label.localeCompare(b.label,'es'));
}

const TOPIC_EVIDENCE=topicData.moments as Record<string,Record<string,TopicEvidence>>;
/** Preserve moment identity and its original person occurrence; select a separate source anchor. */
export function focusDemoMoment(moment:DemoMoment,label?:string):DemoMoment {
 const {selectedEvidence:_,...base}=moment;
 if(!label||!moment.topics.some(t=>t.label===label))return base;
 const evidence=TOPIC_EVIDENCE[moment.id]?.[label];
 if(!evidence)throw new Error('Missing verified topic evidence: '+moment.id+' / '+label);
 return {...base,selectedEvidence:evidence};
}
export const demoOccurrence=(moment:DemoMoment)=>moment.selectedEvidence?.occurrence??moment.occurrence;
