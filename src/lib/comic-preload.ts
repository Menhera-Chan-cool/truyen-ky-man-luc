export type ComicConnection={saveData?:boolean;effectiveType?:string;downlink?:number};
export function selectComicPreloads(pages:readonly {bytes:number}[],current:number,preload:"some"|"all",connection:ComicConnection={}){
 if(connection.saveData||["slow-2g","2g"].includes(connection.effectiveType??""))return [];
 const slow=connection.effectiveType==="3g"||(connection.downlink!==undefined&&connection.downlink<1.5),limit=slow?1:preload==="all"?pages.length:2,budget=slow?1024*1024:8*1024*1024,result:number[]=[];
 let used=0;
 for(let n=current+1;n<pages.length&&result.length<limit;n++){const bytes=pages[n].bytes;if(!Number.isFinite(bytes)||bytes<1||used+bytes>budget)break;used+=bytes;result.push(n);}
 return result;
}
export const comicReadingUrl=(path:string,original=false)=>!original&&path.startsWith("/api/comic/assets/")?path+"?view=read":path;
export function preloadComicImages(urls: string[], loaded=new Set<string>(), inflight=new Set<string>()) {
  let active = true;
  const queue = [...new Set(urls)].filter(url=>!loaded.has(url)&&!inflight.has(url)), pending = new Map<HTMLImageElement, () => void>();
  for(const url of queue)inflight.add(url);
  async function worker() {
    while (active && queue.length) {
      await new Promise<void>((resolve) => {
        // Native image loading follows private Storage redirects without fetch/CORS requirements.
        const url=queue.shift()!,image = new Image();
        const finish = () => {
          image.onload = image.onerror = null;
          pending.delete(image);inflight.delete(url);
          resolve();
        };
        pending.set(image, finish);
        image.onload = ()=>{loaded.add(url);finish();};
        image.onerror = finish;
        image.src = url;
      });
    }
  }
  for (let n = 0; n < 3; n++) void worker();
  return () => {
    active = false;
    for(const url of queue)inflight.delete(url);
    for (const [image, finish] of [...pending]) {
      finish();
      image.removeAttribute("src");
    }
  };
}
