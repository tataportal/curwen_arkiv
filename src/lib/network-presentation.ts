import type {DemoGraphNode} from './commercial-network';
/** Visual depth is independent of the two-level retrieval/exploration limit. */
export function nodePlane(node:DemoGraphNode){
 if(node.depth===0)return 'anchor';
 if(node.items.length>1)return 'foreground';
 const seed=[...node.label].reduce((sum,c)=>sum+c.charCodeAt(0),0);
 return seed%3===0?'foreground':seed%3===1?'middle':'background';
}
export function nodeTypeSize(node:DemoGraphNode){
 return ({anchor:32,foreground:22,middle:17,background:15} as const)[nodePlane(node)];
}
export function connectionPath(a:{x:number;y:number},b:{x:number;y:number},key:string){
 const seed=[...key].reduce((sum,c)=>sum+c.charCodeAt(0),0),dx=b.x-a.x,dy=b.y-a.y;
 const distance=Math.max(1,Math.hypot(dx,dy)),bend=(seed%2?-1:1)*Math.min(42,distance*.09);
 return `M ${a.x} ${a.y} Q ${(a.x+b.x)/2-dy/distance*bend} ${(a.y+b.y)/2+dx/distance*bend} ${b.x} ${b.y}`;
}

/** Pinhole projection: visual z controls foreshortening, not evidence hierarchy. */
export function projectNode(node:DemoGraphNode,seconds=0){
 if(node.depth===0)return {x:0,y:0,k:1};
 const plane=nodePlane(node),z=({foreground:100,middle:-60,background:-220,anchor:0} as const)[plane];
 const drift=node.depth?Math.sin(seconds/7+node.x*.01)*8:0;
 const x=node.x+drift,y=node.y+Math.cos(seconds/9+node.y*.01)*5;
 const yaw=-.22,pitch=.12;
 const rotatedX=x*Math.cos(yaw)+z*Math.sin(yaw);
 const rotatedZ=z*Math.cos(yaw)-x*Math.sin(yaw);
 const rotatedY=y*Math.cos(pitch)-rotatedZ*Math.sin(pitch);
 const finalZ=rotatedZ*Math.cos(pitch)+y*Math.sin(pitch);
 const k=1100/(1100-finalZ);
 return {x:rotatedX*k,y:rotatedY*k,k};
}
