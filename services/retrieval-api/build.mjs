import {build} from 'esbuild';
import {mkdir,cp} from 'node:fs/promises';
await mkdir('dist/server',{recursive:true});
await build({entryPoints:['src/worker.ts'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
await cp('data','dist/client/data',{recursive:true});
