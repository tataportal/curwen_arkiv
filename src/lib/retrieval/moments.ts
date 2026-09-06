import {DEFAULT_CONFIG,type DiscussionMoment,type SearchOccurrence,type SearchQuery,type SpeechTimeline,type RetrievalConfig} from './model';
import {lexical} from './query';
import {speechText} from './timeline';

export function retrievalConfig(config:Partial<RetrievalConfig>={}):RetrievalConfig {
  const c={...DEFAULT_CONFIG,...config};
  if(!Number.isFinite(c.gapSeconds)||c.gapSeconds<0||c.gapSeconds>300
    ||!Number.isFinite(c.beforeSeconds)||c.beforeSeconds<0||c.beforeSeconds>60
    ||!Number.isFinite(c.afterSeconds)||c.afterSeconds<0||c.afterSeconds>60
    ||!Number.isInteger(c.excerptMaxChars)||c.excerptMaxChars<80||c.excerptMaxChars>500) throw new RangeError('Invalid retrieval configuration');
  return c;
}
export function clusterOccurrences(occurrences:SearchOccurrence[],config:Partial<RetrievalConfig>={}):SearchOccurrence[][] {
  const c=retrievalConfig(config),groups:SearchOccurrence[][]=[];
  const sorted=[...new Map(occurrences.map(o=>[o.occurrenceId,o])).values()]
    .sort((a,b)=>a.videoId.localeCompare(b.videoId)||a.timestamp-b.timestamp||a.tokenStart-b.tokenStart);
  for(const occurrence of sorted) {
    const group=groups.at(-1),last=group?.at(-1);
    const nearby=last&&occurrence.timestamp-last.timestamp<=c.gapSeconds;
    const contextsOverlap=last&&occurrence.timestamp-c.beforeSeconds<=last.endSeconds+c.afterSeconds;
    if(last&&last.videoId===occurrence.videoId&&(nearby||contextsOverlap)) group!.push(occurrence);
    else groups.push([occurrence]);
  }
  return groups;
}
function occurrenceStrength(o:SearchOccurrence,query:SearchQuery) {
  return (lexical(o.matchedText)===query.normalized?2:0)
    +(query.canonicalQuery&&lexical(o.matchedText)===lexical(query.canonicalQuery)?3:0)
    +Math.min(o.tokenEnd-o.tokenStart,4)*.25;
}
function excerptFor(timeline:SpeechTimeline,occurrences:SearchOccurrence[],query:SearchQuery,maxChars:number) {
  const strongest=[...occurrences].sort((a,b)=>occurrenceStrength(b,query)-occurrenceStrength(a,query)||a.timestamp-b.timestamp||a.tokenStart-b.tokenStart)[0];
  const index=timeline.sentences.findIndex(s=>s.tokenStart<=strongest.tokenStart&&s.tokenEnd>strongest.tokenStart);
  const selected=[timeline.sentences[index]];
  // Shortest faithful span that includes the complete alias, even over sentence boundaries.
  for(let i=index+1;i<timeline.sentences.length&&selected.at(-1)!.tokenEnd<strongest.tokenEnd;i++)selected.push(timeline.sentences[i]);
  let start=selected[0].tokenStart,end=selected.at(-1)!.tokenEnd;
  for(let count=selected.length;count<4;count++) {
    if(speechText(timeline.tokens.slice(start,end)).length>=200)break;
    const next=timeline.sentences.find(s=>s.tokenStart===end);
    if(!next||next.startSeconds-timeline.tokens[end-1].endSeconds>2.5
      ||speechText(timeline.tokens.slice(start,next.tokenEnd)).length>maxChars)break;
    end=next.tokenEnd;
  }
  // Oversized sentences are clipped around the match on token boundaries, with ellipses.
  while(speechText(timeline.tokens.slice(start,end)).length>maxChars-4) {
    if(end>strongest.tokenEnd&&(end-strongest.tokenEnd>=strongest.tokenStart-start||start===strongest.tokenStart))end--;
    else if(start<strongest.tokenStart)start++;
    else break;
  }
  const text=speechText(timeline.tokens.slice(start,end));
  const prefix=start>selected[0].tokenStart||(start>0&&!/[.!?…]["'»”)]*$/.test(timeline.tokens[start-1].text))?'… ':'';
  const suffix=end<timeline.tokens.length&&!/[.!?…]["'»”)]*$/.test(text)?' …':'';
  // Extremely long lexical tokens cannot be split without fabricating words.
  if(prefix.length+text.length+suffix.length>maxChars) throw new Error('Evidence token exceeds excerpt bound');
  return {text:prefix+text+suffix,startSeconds:timeline.tokens[start].startSeconds,
    cueIds:[...new Set(timeline.tokens.slice(start,end).map(t=>t.cueId))]};
}
export function createMoments(timeline:SpeechTimeline,query:SearchQuery,occurrences:SearchOccurrence[],config:Partial<RetrievalConfig>={}):DiscussionMoment[] {
  const c=retrievalConfig(config);
  return clusterOccurrences(occurrences,c).map(group=>{
    const first=group[0],last=group.at(-1)!;
    const endSeconds=Math.max(...group.map(o=>o.endSeconds));
    const contextStart=Math.max(0,first.timestamp-c.beforeSeconds),contextEnd=endSeconds+c.afterSeconds;
    const context=timeline.sentences.filter(s=>s.endSeconds>contextStart&&s.startSeconds<contextEnd);
    const excerpt=excerptFor(timeline,group,query,c.excerptMaxChars);
    // Measure repetition in a bounded evidence sample, not vocabulary growth over
    // a long conversation (which would unfairly penalize ordinary long speech).
    const words=lexical(excerpt.text).split(' '),distinct=new Set(words).size;
    const matchingCueCount=new Set(group.map(o=>o.cueId)).size;
    // Saturating lexical score. Repetition cannot keep increasing rank indefinitely.
    const scoreComponents={
      exactPhrase:group.some(o=>(' '+lexical(o.matchedText)+' ').includes(' '+query.normalized+' '))?4:0,
      canonicalAlias:query.canonicalQuery&&group.some(o=>lexical(o.matchedText)===lexical(query.canonicalQuery!))?3:0,
      queryCoverage:2, wordProximity:Math.max(...group.map(o=>o.matchType==='phrase'?1:Math.max(0,1-(o.tokenEnd-o.tokenStart-query.aliases[0].words.length)/5))),
      matchingCues:Math.log2(1+Math.min(matchingCueCount,8))*.25,
      density:Math.min(group.length/Math.max(1,last.timestamp-first.timestamp)*15,1)*.5,
      lexicalDiversity:Math.min(distinct/Math.max(words.length,1)*4,1)*1.5,
      repetitionPenalty:words.length>=12&&distinct/words.length<.2?-2:0,
    };
    return {momentId:`${timeline.version}:${first.occurrenceId}`,videoId:timeline.videoId,
      startSeconds:first.timestamp,endSeconds,lastOccurrenceSeconds:last.timestamp,occurrenceCount:group.length,matchingCueCount,
      excerpt:excerpt.text,excerptStartSeconds:excerpt.startSeconds,excerptCueIds:excerpt.cueIds,
      evidenceTokens:timeline.tokens.slice(context[0]?.tokenStart??first.tokenStart,context.at(-1)?.tokenEnd??last.tokenEnd),evidenceTokenOffset:context[0]?.tokenStart??first.tokenStart,
      context,contextStartSeconds:context[0]?.startSeconds??contextStart,contextEndSeconds:context.at(-1)?.endSeconds??contextEnd,
      relevanceScore:Number(Object.values(scoreComponents).reduce((a,b)=>a+b,0).toFixed(6)),scoreComponents,
      youtubeUrl:`https://www.youtube.com/watch?v=${encodeURIComponent(timeline.videoId)}&t=${first.timestamp}s`,occurrences:group};
  });
}
