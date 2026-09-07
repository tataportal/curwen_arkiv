import {demoConnections,type DemoMoment} from './commercial-demo';
export type DemoGraphNode={id:string;label:string;x:number;y:number;depth:number;items:DemoMoment[];expanded:boolean;path:string[]};
export type DemoGraphEdge={from:string;to:string;momentIds:string[]};
export type DemoGraph={nodes:DemoGraphNode[];edges:DemoGraphEdge[]};
const topicId=(label:string)=>'topic:'+label;

export function initialDemoGraph(label:string,items:DemoMoment[]):DemoGraph {
 const connections=demoConnections(items).filter(n=>n.label!==label).slice(0,8);
 const nodes:DemoGraphNode[]=[{id:'root',label,x:0,y:0,depth:0,items,expanded:false,path:[label]}];
 const edges:DemoGraphEdge[]=[];
 connections.forEach((n,i)=>{const angle=-Math.PI/2+i*2*Math.PI/connections.length;
  nodes.push({id:topicId(n.label),label:n.label,x:Math.cos(angle)*365,y:Math.sin(angle)*240,depth:1,items:n.items,expanded:false,path:[label,n.label]});
  edges.push({from:'root',to:topicId(n.label),momentIds:n.items.map(m=>m.id)});
 });
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
