export const SECRET_CLICK_COUNT=6;
export const SECRET_CLICK_WINDOW_MS=3000;
/** Only a fresh burst unlocks the clip; ordinary clicks keep showing phrases. */
export function registerMascotClick(previous:readonly number[],now:number){
 const clicks=[...previous.filter(time=>now-time>=0&&now-time<=SECRET_CLICK_WINDOW_MS),now];
 const triggered=clicks.length>=SECRET_CLICK_COUNT;
 return {clicks:triggered?[]:clicks,triggered};
}
