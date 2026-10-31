import nextEnv from "@next/env";
import {createClient} from "@supabase/supabase-js";
import {readFile} from "node:fs/promises";
import {createHash,randomUUID} from "node:crypto";
import assert from "node:assert/strict";
import {FZ_HEADING_FONT,fontFileInfo} from "../src/lib/heading-fonts";
nextEnv.loadEnvConfig(process.cwd(),false,{info(){},error(){}});
const source=process.argv[2];if(!source)throw Error("Pass the supplied font file path");
const bytes=await readFile(source),info=fontFileInfo(source,bytes),hash=createHash("sha256").update(bytes).digest("hex");
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,headers:{...Object.fromEntries(new Headers(init?.headers)),Connection:"close"},signal:AbortSignal.timeout(20000)})}});
const {data:existing,error:lookup}=await client.from("heading_fonts").select("id,hash,archived").eq("id",FZ_HEADING_FONT).maybeSingle();if(lookup)throw Error("Apply the heading-font migration first");
if(existing){assert.equal(existing.hash,hash,"The registered FZ font differs from the supplied source");console.log(JSON.stringify({alreadyRegistered:true,id:existing.id,archived:existing.archived}));}
else{
 const {data:owner,error}=await client.from("members").select("user_id").eq("role","owner").eq("active",true).limit(1).single();if(error||!owner)throw Error("Configure an owner first");
 const path=`${owner.user_id}/${randomUUID()}.${info.format}`,{error:upload}=await client.storage.from("heading-fonts").upload(path,new Blob([bytes],{type:info.mime}),{contentType:info.mime,upsert:false});if(upload)throw Error("Font upload failed: "+upload.message);
 const {data:stored,error:download}=await client.storage.from("heading-fonts").download(path);if(download||!stored)throw Error("Cannot verify uploaded font");
 assert.equal(createHash("sha256").update(new Uint8Array(await stored.arrayBuffer())).digest("hex"),hash,"Uploaded font checksum mismatch");
 const {error:insert}=await client.from("heading_fonts").insert({id:FZ_HEADING_FONT,label:"FZ Thư Pháp Tiểu Tự",path,format:info.format,bytes:bytes.length,hash,created_by:owner.user_id});if(insert)throw Error("Cannot register supplied font");
 console.log(JSON.stringify({registered:true,id:FZ_HEADING_FONT,bytes:bytes.length,hash,sourceUnchanged:true}));
}
