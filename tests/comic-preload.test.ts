import {it,expect,vi} from "vitest";
import {preloadComicImages} from "../src/lib/comic-preload";
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
