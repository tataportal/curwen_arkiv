import {lexical} from './query';
import {RETRIEVAL_VERSION,type RawCue,type SpeechToken,type SpeechTimeline,type SpeechSentence} from './model';

const timestamp='(?:\\d{2,}:)?\\d{2}:\\d{2}\\.\\d{3}';
function seconds(s:string) {
  const parts=s.split(':');
  if(Number(parts.at(-1))>=60||Number(parts.at(-2))>=60)throw new Error('Invalid VTT clock value');
  return Math.round(parts.reduce((n,v)=>n*60+Number(v),0)*1000)/1000;
}
/** Lossless cue payloads, including rolling duplicates, markup, whitespace and settings. */
export function parseRawVTT(videoId:string,source:string):RawCue[] {
  const text=source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  if(!/^WEBVTT(?:\s|$)/.test(text)) throw new Error('Missing WEBVTT header');
  const cues:RawCue[]=[];
  for(const block of text.split(/\n\n+/)) {
    if(/^(?:WEBVTT|NOTE|STYLE|REGION)(?:\s|$)/.test(block)) continue;
    if(!block.trim()) continue;
    const lines=block.split('\n'),at=lines.findIndex(l=>l.includes('-->'));
    const match=lines[at]?.match(new RegExp(`^(${timestamp})\\s+-->\\s+(${timestamp})(.*)$`));
    if(!match) throw new Error('Malformed VTT cue');
    const start=seconds(match[1]),end=seconds(match[2]);
    if(end<=start||start<(cues.at(-1)?.startSeconds??0)) throw new Error('Invalid VTT interval');
    cues.push(Object.freeze({videoId,cueId:`${videoId}:${cues.length}`,index:cues.length,
      startSeconds:start,endSeconds:end,rawText:lines.slice(at+1).join('\n'),settings:match[3].trim()}));
  }
  if(!cues.length) throw new Error('No source cues');
  return cues;
}
function decode(text:string) {
  return text.replace(/&(?:nbsp|amp|quot|apos|lt|gt);/gi,m=>({'&nbsp;':' ','&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'}[m.toLowerCase()]||m))
    .replace(/&#(x[\da-f]+|\d+);/gi,(m,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code<=0x10ffff?String.fromCodePoint(code):m;});
}
const stage=/\[(?:\s*(?:tos|tose|carraspeo|suspiro|suspiros|resoplido|respiraci[oó]n|m[uú]sica|music|aplausos|applause|risas|risa|laughter|silencio|inaudible|__+)[^\]]*)\]/gi;
export function cleanCaption(text:string,markers:string[]=[]):string {
  return decode(text.replace(/<[^>]*>/g,''))
    .replace(stage,m=>{markers.push(m);return ' ';})
    .replace(/<[^>]*>/g,'').replace(/>>+/g,' ')
    .replace(/\b(?:align|position|line|size|vertical):[^\s]+/g,' ')
    .replace(/([,;:!?])\1+/g,'$1').replace(/\.{2,}/g,'…')
    .replace(/\s+([,.;:!?])/g,'$1').replace(/\s+/g,' ').trim();
}
function cueTokens(cue:RawCue,markers:string[]):SpeechToken[] {
  let time=cue.startSeconds,explicit=false;
  const result:SpeechToken[]=[];
  for(const part of cue.rawText.split(new RegExp(`(<${timestamp}>)`))) {
    if(new RegExp(`^<${timestamp}>$`).test(part)) {
      time=seconds(part.slice(1,-1)); explicit=true;
      if(time<cue.startSeconds||time>cue.endSeconds+.021) throw new Error(`Invalid inline timing in ${cue.cueId}`);
      continue;
    }
    const cleaned=cleanCaption(part,markers);
    const matches=[...cleaned.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu)];
    for(let i=0;i<matches.length;i++) {
      const m=matches[i],start=i===0?0:m.index!,end=matches[i+1]?.index??cleaned.length;
      result.push({text:cleaned.slice(start,end).trim(),key:lexical(m[0]),cueId:cue.cueId,
        startSeconds:cue.startSeconds,endSeconds:cue.endSeconds,wordStartSeconds:time,explicitTime:explicit});
    }
    // Preserve punctuation emitted in a markup piece without lexical tokens.
    if(!matches.length&&cleaned&&result.length) result.at(-1)!.text+=cleaned;
  }
  return result;
}
/** KMP longest suffix/prefix, linear time; no word-count cap. */
export function longestOverlap(previous:readonly string[],current:readonly string[]):number {
  if(!current.length) return 0;
  const sequence=[...current,'\u0000',...previous];
  const prefix=new Array<number>(sequence.length).fill(0);
  for(let i=1;i<sequence.length;i++) {
    let j=prefix[i-1]; while(j>0&&sequence[i]!==sequence[j]) j=prefix[j-1];
    if(sequence[i]===sequence[j]) j++; prefix[i]=j;
  }
  return Math.min(prefix.at(-1)!,current.length);
}
export function speechText(tokens:readonly SpeechToken[]):string {
  return tokens.map(t=>t.text).join(' ').replace(/\s+([,.;:!?])/g,'$1').replace(/([¿¡])\s+/g,'$1').trim();
}
export function buildTimeline(videoId:string,rawCues:readonly RawCue[]):SpeechTimeline {
  const tokens:SpeechToken[]=[],cleanCues:SpeechTimeline['cleanCues']=[];
  let previous:SpeechToken[]=[],previousCue:RawCue|undefined;
  // Inline timing and tiny retained display cues are evidence of YouTube rolling captions.
  const rolling=rawCues.some(c=>new RegExp(`<${timestamp}>`).test(c.rawText)||c.endSeconds-c.startSeconds<=.021);
  for(const cue of rawCues) {
    if(cue.videoId!==videoId) throw new Error('Mixed video timeline');
    const markers:string[]=[],current=cueTokens(cue,markers);
    const contiguous=previousCue&&cue.startSeconds<=previousCue.endSeconds+.05;
    let overlap=contiguous?longestOverlap(previous.map(t=>t.key),current.map(t=>t.key)):0;
    if(overlap) {
      const matchedPrevious=previous.slice(-overlap);
      // Newly timed speech is not a replay, even if all the words repeat.
      if(current.slice(0,overlap).some((t,i)=>t.explicitTime&&t.wordStartSeconds>matchedPrevious[i].wordStartSeconds+.05)) overlap=0;
      if(!rolling&&cue.startSeconds>=previousCue!.endSeconds&&overlap===current.length) overlap=0;
    }
    const fresh=current.slice(overlap);
    tokens.push(...fresh);
    cleanCues.push({videoId,cueId:cue.cueId,startSeconds:cue.startSeconds,endSeconds:cue.endSeconds,
      rawText:cue.rawText,cleanText:speechText(fresh),markers,removedOverlapTokens:overlap});
    previous=current; previousCue=cue;
  }
  return {version:RETRIEVAL_VERSION,videoId,rawCues,cleanCues,tokens,sentences:segmentSpeech(tokens)};
}
export function segmentSpeech(tokens:SpeechToken[]):SpeechSentence[] {
  if(!tokens.length) return [];
  const text=tokens.map(t=>t.text).join(' '),segmenter=new Intl.Segmenter('es',{granularity:'sentence'});
  const ends=[...segmenter.segment(text)].map(s=>s.index+s.segment.length);
  const sentences:SpeechSentence[]=[];
  let from=0,chars=0,offset=0,boundary=0;
  const flush=(to:number)=>{
    if(to<=from)return;
    const slice=tokens.slice(from,to);
    sentences.push({text:speechText(slice),startSeconds:slice[0].startSeconds,
      endSeconds:Math.max(...slice.map(t=>t.endSeconds)),tokenStart:from,tokenEnd:to,
      cueIds:[...new Set(slice.map(t=>t.cueId))]});
    from=to;chars=0;
  };
  for(let i=0;i<tokens.length;i++) {
    // Untimed punctuation-poor ASR is split into readable spans, never rewritten.
    if(i>from&&(chars+tokens[i].text.length>360||tokens[i].startSeconds-tokens[from].startSeconds>12
      ||tokens[i].startSeconds-tokens[i-1].endSeconds>2.5)) flush(i);
    chars+=tokens[i].text.length+1;offset+=tokens[i].text.length+1;
    if(offset>=ends[boundary]) {flush(i+1);while(offset>=ends[boundary])boundary++;}
  }
  flush(tokens.length);return sentences;
}
