import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import nextEnv from "@next/env";
import {createClient} from "@supabase/supabase-js";
import {extractAlignmentText} from "../../src/lib/novel-text";
import type {Book} from "../../src/lib/types";
import {makeContextInput} from './context-input';

const [directory,...selected]=process.argv.slice(2);
if(!directory)throw Error("Usage: tsx scripts/align-novel/prepare.ts OUTPUT_DIR [chapter-1 chapter-18]");
nextEnv.loadEnvConfig(process.cwd(),false,{info(){},error(){}});
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
const response=await fetch("https://truyen-ky-man-luc.vercel.app/api/book",{signal:AbortSignal.timeout(20000)});
if(!response.ok)throw Error("Published book unavailable");
const book=await response.json() as Book;
const heads=await client.from("chapter_editions").select("chapter_id,locale,published_id");if(heads.error)throw Error(heads.error.message);
const ids=heads.data.map(h=>h.published_id).filter(Boolean);
const versions=await client.from("chapter_versions").select("id,chapter_id,locale,revision").in("id",ids);if(versions.error)throw Error(versions.error.message);
await fs.mkdir(directory,{recursive:true});
for(const chapter of book.chapters){
 if(selected.length&&!selected.includes(chapter.id))continue;
 if(!chapter.vi||!chapter.en||chapter.vi.kind!=="text"||chapter.en.kind!=="text")continue;
 const editions=Object.fromEntries((["vi","en"] as const).map(locale=>{
  const edition=chapter[locale]!,head=heads.data.find(h=>h.chapter_id===chapter.id&&h.locale===locale),version=versions.data.find(v=>v.id===head?.published_id);
  if(!version||version.revision!==edition.revision)throw Error("Publication changed during snapshot: "+chapter.id+"/"+locale);
  const extracted=extractAlignmentText(edition.html,locale);
  return [locale,{...extracted,revision:edition.revision,versionId:version.id,hash:createHash("sha256").update(extracted.text).digest("hex")}];
 }));
 const contextual=makeContextInput({chapterId:chapter.id,editions} as Parameters<typeof makeContextInput>[0]);
 await fs.writeFile(path.join(directory,chapter.id+".input.json"),JSON.stringify(contextual));
 console.log(JSON.stringify({chapter:chapter.id,sentences:Object.fromEntries(Object.entries(editions).map(([l,e])=>[l,e.sentences.length]))}));
}
