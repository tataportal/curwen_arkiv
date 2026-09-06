import dotenv from 'dotenv';
import { searchTranscript } from '../src/lib/search';
dotenv.config({ path: ['.env.local', '.env'], quiet: true });
async function main() {
  for (const query of ['Keiko', 'minería ilegal', 'Patricia Benavides']) {
    const result = await searchTranscript(query);
    console.log(JSON.stringify({ query, total_occurrences: result.totalOccurrences,
      total_clusters: result.totalMoments, returned: result.episodes.length, page: result.page }));
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
