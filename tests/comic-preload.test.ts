import {it,expect,vi} from "vitest";
import {preloadComicImages,selectComicPreloads} from "../src/lib/comic-preload";
it("uses native image requests with bounded concurrency and cancels queued work on navigation",async()=>{
  const images:MockImage[]=[],requests:string[]=[];
  class MockImage {
    onload:(()=>void)|null=null;onerror:(()=>void)|null=null;cancelled=false;
    constructor(){images.push(this);}
    set src(value:string){requests.push(value);}
    removeAttribute(){this.cancelled=true;}
  }
  const fetch=vi.fn();vi.stubGlobal("Image",MockImage);vi.stubGlobal("fetch",fetch);
  try {
    const stop=preloadComicImages(["a","b","c","d","e"]);
    expect(requests).toEqual(["a","b","c"]);
    images[0].onload!();await Promise.resolve();
    expect(requests).toEqual(["a","b","c","d"]);
    stop();await Promise.resolve();
    expect(requests).toHaveLength(4);expect(fetch).not.toHaveBeenCalled();
    expect(images.slice(1).every(i=>i.cancelled&&i.onload===null&&i.onerror===null)).toBe(true);
  }finally{vi.unstubAllGlobals();}
});

it("bounds speculative image bytes for slow networks and explicit All",()=>{
 expect(selectComicPreloads).toBeTypeOf("function");const pages=Array.from({length:8},(_,n)=>({bytes:3*1024*1024,id:String(n)}));
 expect(selectComicPreloads(pages,0,"some",{})).toEqual([1,2]);expect(selectComicPreloads(pages,0,"all",{})).toEqual([1,2]);
 expect(selectComicPreloads(pages,0,"all",{saveData:true})).toEqual([]);expect(selectComicPreloads(pages,0,"all",{effectiveType:"2g"})).toEqual([]);expect(selectComicPreloads(pages,0,"all",{effectiveType:"3g"})).toEqual([]);
 expect(selectComicPreloads(pages.map(p=>({...p,bytes:400000})),0,"all",{effectiveType:"3g"})).toEqual([1]);
});

it("does not request completed images or duplicate queue entries",()=>{
 const urls:string[]=[];class Image{onload:unknown;onerror:unknown;set src(url:string){urls.push(url);}removeAttribute(){}}
 vi.stubGlobal("Image",Image);try{const stop=preloadComicImages(["a","a","b","b"],new Set(["a"]));expect(urls).toEqual(["b"]);stop();}finally{vi.unstubAllGlobals();}
});

it("shares in-flight reservations and frees them when canceled",()=>{
 const urls:string[]=[];class Image{onload:unknown;onerror:unknown;set src(url:string){urls.push(url);}removeAttribute(){}}
 vi.stubGlobal("Image",Image);try{const loaded=new Set<string>(),pending=new Set<string>();const stop=preloadComicImages(["a","b"],loaded,pending),second=preloadComicImages(["a","b"],loaded,pending);expect(urls).toEqual(["a","b"]);stop();second();expect(pending.size).toBe(0);}finally{vi.unstubAllGlobals();}
});
