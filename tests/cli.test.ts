import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('CLI defaults to dry-run without credentials and incomplete --write stops before connecting',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'curwen-cli-'));const source=path.join(dir,'raw');fs.mkdirSync(source);
  fs.writeFileSync(path.join(source,'abcdefghijk.info.json'),JSON.stringify({id:'abcdefghijk',title:'Test fixture'}));
  fs.writeFileSync(path.join(source,'abcdefghijk.vtt'),'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\ntexto');
  const before=fs.readFileSync(path.join(source,'abcdefghijk.vtt'));
  const run=(args:string[])=>spawnSync(process.execPath,['--import','tsx','scripts/import-curwen.ts',source,...args],{encoding:'utf8',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_SECRET_KEY:''}});
  try {
    const dry=run(['--expected','1','--report',path.join(dir,'report.json')]);assert.equal(dry.status,0,dry.stderr);
    const r=JSON.parse(dry.stdout);assert.equal(r.mode,'dry-run');assert.equal(r.total_chunks,1);assert.equal(r.ready,true);
    const blocked=run(['--write','--expected','477']);assert.equal(blocked.status,2,blocked.stderr);
    assert.equal(JSON.parse(blocked.stdout).ready,false);assert.equal(JSON.parse(blocked.stdout).episodes_reported,1);
    assert(fs.readFileSync(path.join(source,'abcdefghijk.vtt')).equals(before));
    assert.equal(run(['--dry-run','--write']).status,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
