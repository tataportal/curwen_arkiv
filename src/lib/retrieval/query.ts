import type {SearchQuery} from './model';
export function lexical(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es')
    .replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}
// Editorial, explicit search expansion only. Never applied to source evidence.
export const SEARCH_ALIASES = [
  {canonical:'Keiko Fujimori',aliases:['Keiko','Keiko Fujimori','Fujimori Higuchi']},
  {canonical:'Rafael López Aliaga',aliases:['RLA','López Aliaga','Rafael López Aliaga']},
  {canonical:'Patricia Benavides',aliases:['Patricia Benavides']},
] as const;
export function normalizeQuery(original: string): SearchQuery {
  if(original.length>500) throw new RangeError('La búsqueda es demasiado larga.');
  const normalized=lexical(original);
  const entity=SEARCH_ALIASES.find(e=>e.aliases.some(a=>lexical(a)===normalized));
  const terms=entity?[...entity.aliases]:normalized?[original.trim()]:[];
  return {original:original.trim(),normalized,canonicalQuery:entity?.canonical??null,
    aliases:terms.map(text=>({text,normalized:lexical(text),words:lexical(text).split(' ')}))
      .sort((a,b)=>b.words.length-a.words.length||a.normalized.localeCompare(b.normalized))};
}
