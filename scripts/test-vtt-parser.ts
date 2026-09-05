import { parseAndChunkVTT, cleanVTTLine, deduplicateRollingText } from '../src/lib/vtt-parser';
import { formatTimestamp } from '../src/lib/utils';
import { generateDeterministicChunkId } from '../src/lib/chunk-id';

console.log('Testing WebVTT parser & deduplication...');

const sampleVTT = `WEBVTT
Kind: captions
Language: es

00:00:01.000 --> 00:00:03.500
hola amigos de el diario de

00:00:03.500 --> 00:00:05.200
hola amigos de el diario de
curwen bienvenidos a un nuevo

00:00:05.200 --> 00:00:08.500
curwen bienvenidos a un nuevo
episodio el día de hoy vamos a hablar

00:00:08.500 --> 00:00:12.000
episodio el día de hoy vamos a hablar
sobre el caso de minería ilegal en pataz

00:00:12.000 --> 00:00:15.800
sobre el caso de minería ilegal en pataz
y cómo involucra al congreso de la república

00:00:15.800 --> 00:00:20.000
y cómo involucra al congreso de la república
y las decisiones que se han tomado en las comisiones

00:00:20.000 --> 00:00:25.000
y las decisiones que se han tomado en las comisiones
durante las últimas semanas en el parlamento

00:00:25.000 --> 00:00:32.000
durante las últimas semanas en el parlamento
además revisaremos la denuncia contra patricia benavides
`;

const chunks = parseAndChunkVTT(sampleVTT, 15, 35);

console.log(`Parsed ${chunks.length} chunks:`);
chunks.forEach((chunk, i) => {
  const id = generateDeterministicChunkId('T9ojaSxdyGw', chunk.start_seconds, chunk.end_seconds);
  console.log(`\nChunk #${i + 1} [${formatTimestamp(chunk.start_seconds)} - ${formatTimestamp(chunk.end_seconds)}] (ID: ${id})`);
  console.log(`Text: "${chunk.text}"`);
});

// Test idempotency: re-generating ID
const id1 = generateDeterministicChunkId('T9ojaSxdyGw', chunks[0].start_seconds, chunks[0].end_seconds);
const id2 = generateDeterministicChunkId('T9ojaSxdyGw', chunks[0].start_seconds, chunks[0].end_seconds);
console.log('\nIdempotency check (id1 === id2):', id1 === id2, id1);

// Test text deduplication
const checkDedupe = !chunks[0].text.includes('hola amigos de el diario de hola amigos');
console.log('Deduplication successful (no repeated phrases):', checkDedupe);

if (!checkDedupe || id1 !== id2) {
  console.error('FAILED VTT test');
  process.exit(1);
} else {
  console.log('ALL VTT TESTS PASSED!');
}
