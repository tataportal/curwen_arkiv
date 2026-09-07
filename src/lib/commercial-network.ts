import {demoConnections,type DemoMoment} from './commercial-demo';
export type DemoGraphNode={id:string;label:string;x:number;y:number;depth:number;items:DemoMoment[];expanded:boolean;path:string[]};
export type DemoGraphEdge={from:string;to:string;momentIds:string[]};
export type DemoGraph={nodes:DemoGraphNode[];edges:DemoGraphEdge[]};
const topicId=(label:string)=>'topic:'+label;

export function initialDemoGraph(label:string,items:DemoMoment[]):DemoGraph {
 const connections=demoConnections(items).filter(n=>n.label!==label).slice(0,8);
 const nodes:DemoGraphNode[]=[{id:'root',label,x:0,y:0,depth:0,items,expanded:false,path:[label]}];
 const edges:DemoGraphEdge[]=[];
 // Place concepts that share evidence in neighbouring pockets, not equal-angle spokes.
 const remaining=new Set(connections.map((_,i)=>i)),order:number[]=[];
 while(remaining.size){
  const queue=[remaining.values().next().value!];remaining.delete(queue[0]);
  while(queue.length){const index=queue.shift()!;order.push(index);
   for(const other of remaining)if(connections[index].items.some(m=>connections[other].items.some(n=>n.id===m.id))){remaining.delete(other);queue.push(other);}
  }
 }
 const pockets=[[-370,-135],[-250,-240],[130,-245],[360,-115],[235,100],[420,230],[-55,235],[-350,150]];
 order.forEach((index,slot)=>{const n=connections[index],seed=[...n.label].reduce((v,c)=>v+c.charCodeAt(0),0),point=pockets[slot];
  nodes.push({id:topicId(n.label),label:n.label,x:point[0]+seed%31-15,y:point[1]+seed%23-11,depth:1,items:n.items,expanded:false,path:[label,n.label]});
  edges.push({from:'root',to:topicId(n.label),momentIds:n.items.map(m=>m.id)});
 });
 // Lateral links are co-mentions in the exact same curated moment, never inferred facts.
 for(let i=1;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
  const shared=nodes[i].items.filter(m=>nodes[j].items.some(n=>n.id===m.id));
  if(shared.length)edges.push({from:nodes[i].id,to:nodes[j].id,momentIds:shared.map(m=>m.id)});
 }
 return {nodes,edges};
}

/** Add shared-moment associations without replacing the root or moving existing nodes. */
export function expandDemoGraph(graph:DemoGraph,id:string,scope:DemoMoment[]):DemoGraph {
 const parent=graph.nodes.find(n=>n.id===id);if(!parent||parent.expanded||parent.depth>=2)return graph;
 const nodes=graph.nodes.map(n=>({...n,expanded:n.id===id||n.expanded})),edges=[...graph.edges];
 const neighbours=demoConnections(parent.items).filter(n=>n.label!==parent.label&&n.label!==graph.nodes[0].label);
 const direction=parent.depth?Math.atan2(parent.y,parent.x):-Math.PI/2;
 neighbours.forEach((association,i)=>{
  const targetId=topicId(association.label);
  if(!nodes.some(n=>n.id===targetId)){
   let x=0,y=0;
   // Choose an outward position with room for a label; retain every prior coordinate.
   for(let attempt=0;attempt<60;attempt++){
    const spread=(i-(neighbours.length-1)/2)*.55+(attempt%7-3)*.18;
    const distance=220+Math.floor(attempt/7)*65;
    x=parent.x+Math.cos(direction+spread)*distance;
    y=parent.y+Math.sin(direction+spread)*distance*.8;
    if(nodes.every(n=>Math.abs(n.x-x)>190||Math.abs(n.y-y)>100))break;
   }
   nodes.push({id:targetId,label:association.label,x,y,depth:parent.depth+1,items:association.items,expanded:false,path:[...parent.path,association.label]});
  }
  const duplicate=edges.some(e=>(e.from===id&&e.to===targetId)||(e.to===id&&e.from===targetId));
  if(!duplicate)edges.push({from:id,to:targetId,momentIds:association.items.map(m=>m.id)});
 });
 return {nodes,edges};
}
