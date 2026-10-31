export function readStatus(error: unknown): number {
  if (!error || typeof error !== "object") return 0;
  const e=error as {status?:unknown;statusCode?:unknown};
  return Number(e.status??e.statusCode)||0;
}
export const readFetch=(signal:AbortSignal):typeof fetch=>(input,init)=>
  fetch(input,{...init,signal:init?.signal?AbortSignal.any([signal,init.signal]):signal});
export async function publicRead<T extends {error:unknown;status?:number}>(read:(signal:AbortSignal)=>PromiseLike<T>):Promise<T>{
  for(let attempt=0;attempt<2;attempt++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try {
      const result=await read(controller.signal),status=result.status??readStatus(result.error);
      if(!result.error||attempt===1||!(status===0||status===429||status>=500))return result;
    }catch(error){
      if(attempt===1||!(error instanceof TypeError||controller.signal.aborted))throw error;
    }finally{clearTimeout(timer);}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw Error("Read service unavailable");
}
export function missingStorageObject(error:unknown){
  if(readStatus(error)===404)return true;
  if(!error||typeof error!=="object")return false;
  const e=error as {code?:string;message?:string};
  return ["NoSuchKey","not_found"].includes(e.code??"")||e.message==="Object not found";
}
