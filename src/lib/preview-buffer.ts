export const PREVIEW_BUFFER_PX=28;
export const PREVIEW_LEAVE_DELAY_MS=700;
export type PreviewBounds={left:number;top:number;right:number;bottom:number};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
/** Expanded node/card bounds plus a narrow bridge through their gap; no invisible hit targets. */
export function insidePreviewBuffer(x:number,y:number,anchor:PreviewBounds,card:PreviewBounds,padding=PREVIEW_BUFFER_PX){
 const inside=(r:PreviewBounds)=>x>=r.left-padding&&x<=r.right+padding&&y>=r.top-padding&&y<=r.bottom+padding;
 if(inside(anchor)||inside(card))return true;
 const ax=(anchor.left+anchor.right)/2,ay=(anchor.top+anchor.bottom)/2;
 const bx=clamp(ax,card.left,card.right),by=clamp(ay,card.top,card.bottom);
 const dx=bx-ax,dy=by-ay,length=dx*dx+dy*dy;
 const t=length?clamp(((x-ax)*dx+(y-ay)*dy)/length,0,1):0;
 return Math.hypot(x-(ax+t*dx),y-(ay+t*dy))<=padding;
}
