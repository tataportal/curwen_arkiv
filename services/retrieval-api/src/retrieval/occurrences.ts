import type {SearchOccurrence,SearchQuery,SpeechTimeline} from './model';
import {speechText} from './timeline';
/** Exact entity aliases; generic multiword terms also allow bounded ordered proximity.
 * Every intervening word is retained in matchedText. No semantic expansion or stemming.
 */
export function findOccurrences(timeline:SpeechTimeline,query:SearchQuery):SearchOccurrence[] {
  const occurrences:SearchOccurrence[]=[],tokens=timeline.tokens;
  for(let i=0;i<tokens.length;i++) {
    let alias=query.aliases.find(a=>a.words.every((w,j)=>tokens[i+j]?.key===w
      &&(j===0||tokens[i+j].wordStartSeconds-tokens[i+j-1].wordStartSeconds<=3)));
    let end=alias?i+alias.words.length:i,matchType:'phrase'|'proximity'='phrase';
    if(!alias&&!query.canonicalQuery) {
      const candidate=query.aliases[0];
      if(candidate?.words.length>1&&tokens[i].key===candidate.words[0]) {
        let word=1;
        for(let cursor=i+1;cursor<Math.min(tokens.length,i+candidate.words.length+4);cursor++) {
          if(/[.!?;]/.test(tokens[cursor-1].text)||tokens[cursor].wordStartSeconds-tokens[i].wordStartSeconds>5)break;
          if(tokens[cursor].key===candidate.words[word])word++;
          if(word===candidate.words.length){alias=candidate;end=cursor+1;matchType='proximity';break;}
        }
      }
    }
    if(!alias)continue;
    const span=tokens.slice(i,end),first=span[0];
    occurrences.push({occurrenceId:`${timeline.videoId}:${i}:${end-i}`,videoId:timeline.videoId,
      cueId:first.cueId,cueIds:[...new Set(span.map(t=>t.cueId))],cue_start_seconds:first.startSeconds,timestamp:first.startSeconds,
      endSeconds:Math.max(...span.map(t=>t.endSeconds)),wordStartSeconds:first.wordStartSeconds,
      matchedText:speechText(span),matchedAlias:alias.text,canonicalEntity:query.canonicalQuery,matchType,
      tokenStart:i,tokenEnd:end});
    // A full name and its nested short alias at the same location are ONE occurrence.
    i=end-1;
  }
  return occurrences;
}
