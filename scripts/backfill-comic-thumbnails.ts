import nextEnv from "@next/env";
import {createClient} from "@supabase/supabase-js";
import {createHash} from "node:crypto";
import {comicAssetPath,comicThumbnailPath} from "../src/lib/comic-publication";
import {comicThumbnail} from "../src/lib/comic-thumbnail";
nextEnv.loadEnvConfig(process.cwd(),false,{info(){},error(){}});
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
const apply=process.argv.includes("--apply"),result={checked:0,existing:0,created:0,originalBytes:0,thumbnailBytes:0};
const {data:assets,error}=await client.from("comic_assets").select("path,bytes,hash");if(error)throw Error("Cannot read image registry");
for(const asset of assets??[]){
 if(!comicAssetPath(asset.path))throw Error("Invalid registered asset path");
 result.checked++;
 const path=comicThumbnailPath(asset.path),folder=path.slice(0,path.lastIndexOf("/")),name=path.slice(path.lastIndexOf("/")+1);
 const {data:list,error:lookup}=await client.storage.from("comic-assets").list(folder,{search:name,limit:2});if(lookup)throw Error("Cannot check thumbnail");
 if(list?.some(i=>i.name===name)){result.existing++;continue;}
 if(!apply)continue;
 const {data:file,error:download}=await client.storage.from("comic-assets").download(asset.path);if(download||!file)throw Error("Cannot read original image");
 const bytes=Buffer.from(await file.arrayBuffer());
 if(bytes.length!==asset.bytes||createHash("sha256").update(bytes).digest("hex")!==asset.hash)throw Error("Original image checksum mismatch; no image changed");
 const thumbnail=await comicThumbnail(bytes),{error:upload}=await client.storage.from("comic-assets").upload(path,thumbnail,{contentType:"image/webp",upsert:false});
 if(upload&&Number(upload.statusCode)!==409)throw Error("Thumbnail upload failed");
 result.created++;result.originalBytes+=bytes.length;result.thumbnailBytes+=thumbnail.length;
}
console.log(JSON.stringify({...result,apply}));
