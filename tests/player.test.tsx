import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import YouTubeEmbed from '../src/components/YouTubeEmbed';

test('player survives state/prop renders; repeat seek works; video switch/unmount destroy once',async()=>{
  let created=0,destroyed=0;const seeks:number[]=[];let options:any;
  const fake={destroy(){destroyed++;},seekTo(s:number){seeks.push(s);},playVideo(){},getCurrentTime(){return 17;}};
  const priorWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),priorDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  Object.defineProperty(globalThis,'window',{value:{YT:{Player:class {constructor(_el:any,opts:any){created++;options=opts;return fake;}}}},configurable:true});
  Object.defineProperty(globalThis,'document',{value:{createElement:()=>({})},configurable:true});
  let tree:ReactTestRenderer|undefined;
  try {
    await act(async()=>{tree=create(<YouTubeEmbed youtubeId="abcdefghijk" initialSeconds={5}/>,{createNodeMock:()=>({replaceChildren(){},querySelector(){return null;}})});});
    await act(async()=>{options.events.onReady({target:fake});});
    assert.equal(created,1);assert.equal(destroyed,0);assert.deepEqual(seeks,[5]);
    await act(async()=>{tree!.update(<YouTubeEmbed youtubeId="abcdefghijk" seekToSeconds={23} seekRequestId={1}/>);});
    await act(async()=>{tree!.update(<YouTubeEmbed youtubeId="abcdefghijk" seekToSeconds={23} seekRequestId={2}/>);});
    assert.equal(created,1);assert.equal(destroyed,0);assert.deepEqual(seeks,[5,23,23]);
    await act(async()=>{tree!.update(<YouTubeEmbed youtubeId="12345678901" initialSeconds={10}/>);});
    assert.equal(created,2);assert.equal(destroyed,1);
    await act(async()=>{tree!.unmount();});tree=undefined;assert.equal(destroyed,2);
  } finally {
    if(tree)await act(async()=>tree!.unmount());
    if(priorWindow)Object.defineProperty(globalThis,'window',priorWindow);else Reflect.deleteProperty(globalThis,'window');
    if(priorDocument)Object.defineProperty(globalThis,'document',priorDocument);else Reflect.deleteProperty(globalThis,'document');
  }
});

import VideoPreview from '../src/components/VideoPreview';
test('preview mutes before loading the exact 8-second range and destroys on switch/close',async()=>{
 const calls:string[]=[];const loads:any[]=[];let options:any;let time=100;let tick:(()=>void)|undefined;let destroyed=0;
 const fake={destroy(){destroyed++;},seekTo(s:number){time=s;},playVideo(){},pauseVideo(){calls.push('pause');},mute(){calls.push('mute');},getCurrentTime(){return time;},loadVideoById(o:any){calls.push('load');loads.push(o);}};
 const saved=Object.fromEntries(['window','document','setInterval','clearInterval'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 Object.defineProperty(globalThis,'window',{value:{location:{origin:'https://example.test'},matchMedia:()=>({matches:false}),YT:{Player:class {constructor(_el:any,opts:any){options=opts;return fake;}}}},configurable:true});
 Object.defineProperty(globalThis,'document',{value:{hidden:false,createElement:()=>({}),addEventListener(){},removeEventListener(){}},configurable:true});
 Object.defineProperty(globalThis,'setInterval',{value:(cb:()=>void)=>{tick=cb;return 1;},configurable:true});
 Object.defineProperty(globalThis,'clearInterval',{value:()=>{},configurable:true});
 let tree:ReactTestRenderer|undefined;
 try {
   await act(async()=>{tree=create(<VideoPreview youtubeId="abcdefghijk" seconds={1424.44} title="Evidence"/>,{createNodeMock:()=>({replaceChildren(){},querySelector(){return null;}})});});
   await act(async()=>{options.events.onReady({target:fake});});
   assert.deepEqual(calls.slice(0,2),['mute','load']);
   assert.deepEqual(loads[0],{videoId:'abcdefghijk',startSeconds:1424.44,endSeconds:1432.44});
   assert.equal(options.playerVars.controls,0);assert.equal(options.playerVars.playsinline,1);
   time=1432.5;await act(async()=>tick!());assert(calls.includes('pause'));
   assert.equal(tree!.root.findByProps({className:'video-preview'}).props['data-preview-state'],'ended');
   await act(async()=>{tree!.update(<VideoPreview youtubeId="12345678901" seconds={23.2} title="Other"/>);});
   assert.equal(destroyed,1);
   await act(async()=>tree!.unmount());tree=undefined;assert.equal(destroyed,2);
 } finally {
   if(tree)await act(async()=>tree!.unmount());
   for(const [key,descriptor]of Object.entries(saved)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
 }
});
