import type {YouTubePlayer} from './youtube-api';
const KEY='curwen-preview-volume';
let volume=100,lastAudible=100,initialized=false;
const listeners=new Set<()=>void>();
function readSaved(){
 if(initialized||typeof window==='undefined')return;
 initialized=true;
 try{const saved=JSON.parse(window.localStorage.getItem(KEY)||'null');
  if(saved&&Number.isFinite(saved.volume)&&saved.volume>=0&&saved.volume<=100){volume=Math.round(saved.volume);lastAudible=Number.isFinite(saved.lastAudible)&&saved.lastAudible>0&&saved.lastAudible<=100?Math.round(saved.lastAudible):100;}
 }catch{/* Storage restrictions do not disable the current session's control. */}
}
export function getPreviewVolume(){readSaved();return volume;}
export function setPreviewVolume(next:number){
 readSaved();if(!Number.isFinite(next))return;
 volume=Math.round(Math.max(0,Math.min(100,next)));if(volume>0)lastAudible=volume;
 try{window.localStorage.setItem(KEY,JSON.stringify({volume,lastAudible}));}catch{}
 for(const listener of listeners)listener();
}
export function togglePreviewSound(){setPreviewVolume(getPreviewVolume()===0?lastAudible:0);}
function storageChanged(event:StorageEvent){if(event.key!==KEY&&event.key!==null)return;initialized=false;volume=100;lastAudible=100;readSaved();for(const listener of listeners)listener();}
export function subscribePreviewVolume(listener:()=>void){
 listeners.add(listener);if(listeners.size===1&&typeof window!=='undefined')window.addEventListener?.('storage',storageChanged);
 return()=>{listeners.delete(listener);if(!listeners.size&&typeof window!=='undefined')window.removeEventListener?.('storage',storageChanged);};
}
export function applyPreviewVolume(player:YouTubePlayer){
 const value=getPreviewVolume();player.setVolume(value);if(value===0)player.mute();else player.unMute();
}
