export async function requestDeadline<T>(run:(signal:AbortSignal)=>PromiseLike<T>,ms=15000,caller?:AbortSignal):Promise<T>{
 caller?.throwIfAborted();
 const controller=new AbortController(),cancel=()=>controller.abort(caller?.reason);
 let timer:ReturnType<typeof setTimeout>|undefined,onAbort:()=>void=()=>{};
 caller?.addEventListener("abort",cancel,{once:true});
 try{
  const stopped=new Promise<never>((_,reject)=>{onAbort=()=>reject(controller.signal.reason);controller.signal.addEventListener("abort",onAbort,{once:true});});
  timer=setTimeout(()=>{const error=new Error("Hết thời gian chờ / Request timed out. Giữ phần đang sửa, kiểm tra mạng rồi thử lại.");error.name="TimeoutError";controller.abort(error);},ms);
  return await Promise.race([Promise.resolve().then(()=>{controller.signal.throwIfAborted();return run(controller.signal);}),stopped]);
 }finally{clearTimeout(timer);caller?.removeEventListener("abort",cancel);controller.signal.removeEventListener("abort",onAbort);}
}
export const uncertainRequest=(error:unknown)=>error instanceof TypeError||error instanceof SyntaxError||(error instanceof Error&&["TimeoutError","AbortError"].includes(error.name))||Number((error as {status?:number})?.status)>=500;
