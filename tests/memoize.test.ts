import {it,expect,vi} from "vitest";
import {memoizeFor} from "../src/lib/public-read";
it("shares one load inside the window, reloads after it and never keeps a failure",async()=>{
 vi.useFakeTimers();
 try{
  const load=vi.fn().mockResolvedValue("book"),get=memoizeFor(1000,load);
  await Promise.all([get(),get()]);expect(load).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1001);await get();expect(load).toHaveBeenCalledTimes(2);
  load.mockRejectedValueOnce(new Error("down"));get.reset();await expect(get()).rejects.toThrow("down");
  await expect(get()).resolves.toBe("book");expect(load).toHaveBeenCalledTimes(4);
 }finally{vi.useRealTimers();}
});
