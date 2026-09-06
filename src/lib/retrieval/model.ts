/** Retrieval layers are deliberately separate. A source cue is never an index chunk. */
export const RETRIEVAL_VERSION = 'cue-retrieval-1';
export interface RawCue {
  readonly videoId: string; readonly cueId: string; readonly index: number;
  readonly startSeconds: number; readonly endSeconds: number;
  readonly rawText: string; readonly settings: string;
}
export interface SpeechToken {
  text: string; key: string; cueId: string;
  startSeconds: number; endSeconds: number; wordStartSeconds: number;
  explicitTime: boolean;
}
export interface CleanCue {
  videoId: string; cueId: string; startSeconds: number; endSeconds: number;
  rawText: string; cleanText: string; markers: string[]; removedOverlapTokens: number;
}
export interface SpeechSentence {
  text: string; startSeconds: number; endSeconds: number;
  tokenStart: number; tokenEnd: number; cueIds: string[];
}
export interface SpeechTimeline {
  version: string; videoId: string; rawCues: readonly RawCue[];
  cleanCues: CleanCue[]; tokens: SpeechToken[]; sentences: SpeechSentence[];
}
export interface SearchQuery {
  original: string; normalized: string; canonicalQuery: string | null;
  aliases: {text: string; normalized: string; words: string[]}[];
}
export interface SearchOccurrence {
  occurrenceId: string; videoId: string; cueId: string; cueIds: string[];
  cue_start_seconds: number; timestamp: number; endSeconds: number; wordStartSeconds: number;
  matchedText: string; matchedAlias: string; canonicalEntity: string | null;
  matchType: 'phrase' | 'proximity';
  tokenStart: number; tokenEnd: number;
}
export interface DiscussionMoment {
  momentId: string; videoId: string; startSeconds: number; endSeconds: number;
  lastOccurrenceSeconds: number; occurrenceCount: number; matchingCueCount: number;
  excerpt: string; excerptStartSeconds: number; excerptCueIds: string[];
  context: SpeechSentence[]; contextStartSeconds: number; contextEndSeconds: number;
  relevanceScore: number; scoreComponents: Record<string, number>;
  youtubeUrl: string; occurrences: SearchOccurrence[];
  evidenceTokens?: SpeechToken[]; evidenceTokenOffset?: number;
}
export interface RetrievalEpisode {
  videoId: string; title: string; publishedAt: string | null;
  relevanceScore: number; moments: DiscussionMoment[];
}
export interface RetrievalResponse {
  version: string; snapshotId: string; query: string; normalizedQuery: string;
  canonicalQuery: string | null; expandedTerms: string[];
  totalEpisodes: number; totalMoments: number; totalOccurrences: number;
  page: number; pageSize: number; paginationUnit: 'episode'; episodes: RetrievalEpisode[];
  diagnostics: {longMomentThresholdSeconds:number;totalLongMoments:number;longMoments:LongMomentWarning[]};
}
export interface LongMomentWarning {
  momentId:string;videoId:string;episodeTitle:string;startSeconds:number;endSeconds:number;
  durationSeconds:number;occurrenceCount:number;youtubeUrl:string;
}
export interface EpisodeMetadata {videoId: string; title: string; publishedAt: string | null}
export interface RetrievalConfig {gapSeconds: number; beforeSeconds: number; afterSeconds: number; excerptMaxChars: number}
export const DEFAULT_CONFIG: RetrievalConfig = {gapSeconds:45,beforeSeconds:20,afterSeconds:15,excerptMaxChars:500};
