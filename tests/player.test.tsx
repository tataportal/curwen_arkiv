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
    await act(async()=>{tree=create(<YouTubeEmbed youtubeId="abcdefghijk" initialSeconds={5}/>,{createNodeMock:()=>({replaceChildren(){}})});});
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
