"use client";
import {useEffect,useRef,useState} from "react";
import {Plus,Trash2,LoaderCircle} from "lucide-react";
import type {BookMeta,Locale} from "../lib/types";
import {browserClient,adminRequest} from "../lib/supabase";
import {FZ_HEADING_FONT,fontFileInfo,headingFontId,type HeadingFont} from "../lib/heading-fonts";
import HeadingFontFaces,{headingFontStyle} from "./HeadingFontFaces";
import {validateFont} from "../lib/reader-extras";
export default function HeadingFonts({locale,meta,published,disabled,onChange,onBusyChange}:{locale:Locale;meta:Record<Locale,BookMeta>;published:Record<Locale,BookMeta>;disabled:boolean;onChange:(m:Record<Locale,BookMeta>)=>void;onBusyChange:(busy:boolean)=>void}){
 const L=(vi:string,en:string)=>locale==="vi"?vi:en,[fonts,setFonts]=useState<HeadingFont[]>([]),[loading,setLoading]=useState(true),[working,setWorking]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const file=useRef<HTMLInputElement>(null),pending=useRef<{file:File;id:string;path:string}|undefined>(undefined);
 async function load(){const rows=await adminRequest("heading-fonts",undefined,"GET");setFonts(rows.sort((a:HeadingFont,b:HeadingFont)=>a.id===FZ_HEADING_FONT?-1:b.id===FZ_HEADING_FONT?1:a.created_at.localeCompare(b.created_at)));}
 useEffect(()=>{let active=true;adminRequest("heading-fonts",undefined,"GET").then(rows=>{if(active)setFonts(rows.sort((a:HeadingFont,b:HeadingFont)=>a.id===FZ_HEADING_FONT?-1:b.id===FZ_HEADING_FONT?1:a.created_at.localeCompare(b.created_at)));}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 const inUse=(id:string)=>(["vi","en"] as const).some(l=>meta[l].headingFont===id||published[l].headingFont===id);
 async function add(source:File){
  if(pending.current?.file!==source)pending.current=undefined;
  setWorking(true);onBusyChange(true);setError("");setMessage("");
  try{
   validateFont(source.name,new Uint8Array(await source.slice(0,4).arrayBuffer()),source.size);
   const bytes=new Uint8Array(await source.arrayBuffer()),info=fontFileInfo(source.name,bytes);await new FontFace("HeadingUploadValidation",bytes).load();
   const client=browserClient(),{data:{user},error:authError}=await client.auth.getUser();if(authError||!user)throw Error(L("Hãy đăng nhập lại.","Please sign in again."));
   let upload=pending.current;if(upload?.file!==source){const id=crypto.randomUUID();upload={file:source,id,path:`${user.id}/${id}.${info.format}`};pending.current=upload;}
   const {error:uploadError}=await client.storage.from("heading-fonts").upload(upload.path,new Blob([source],{type:info.mime}),{contentType:info.mime,upsert:false});
   if(uploadError&&Number(uploadError.statusCode)!==409)throw Error(uploadError.message);
   await adminRequest("heading-fonts",{action:"register",id:upload.id,path:upload.path,label:source.name.replace(/\.[^.]+$/,"").replace(/[\x00-\x1f]/g,"").trim().slice(0,120)});
   pending.current=undefined;await load();setMessage(L("Đã thêm phông. Chọn cho VI hoặc EN rồi lưu nháp / xuất bản.","Font added. Choose it for VI or EN, then save/publish."));
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setWorking(false);onBusyChange(false);}
 }
 async function remove(font:HeadingFont){
  if(!window.confirm(L(`Xóa “${font.label}” khỏi danh sách phông heading?`,`Remove “${font.label}” from heading fonts?`)))return;
  setWorking(true);onBusyChange(true);setError("");setMessage("");
  try{await adminRequest("heading-fonts",{action:"remove",id:font.id});await load();setMessage(L("Đã xóa phông khỏi danh sách.","Font removed from the list."));}catch(e){setError(e instanceof Error&&/in use/i.test(e.message)?L("Phông vẫn đang dùng ở bản nháp hoặc bản công khai. Chọn phông khác và lưu / xuất bản trước khi xóa.","This font is used by a saved draft or public edition. Choose another font and save/publish before removing it."):e instanceof Error?e.message:String(e));}finally{setWorking(false);onBusyChange(false);}
 }
 const busy=disabled||working||loading;
 return <section className="heading-font-settings" aria-label={L("Phông heading","Heading fonts")}>
  <HeadingFontFaces ids={[meta.vi.headingFont,meta.en.headingFont]}/>
  <div className="heading-font-actions"><div><h2>{L("Phông heading","Heading fonts")}</h2><p className="tiny muted">{L("Dùng cho tiêu đề chương và heading trong nội dung. VI / EN chọn riêng; lưu nháp rồi xuất bản để áp dụng cho người đọc.","For chapter titles and content headings. Choose separately for VI/EN; save and publish to apply to readers.")}</p></div>
   <button className="secondary-button" disabled={busy} onClick={()=>file.current?.click()}>{working?<LoaderCircle size={16} className="cc-spin"/>:<Plus size={16}/>} {L("Thêm phông heading","Add heading font")}</button>
   <input ref={file} type="file" hidden accept=".ttf,.otf,.woff,.woff2" aria-label={L("Tệp phông heading","Heading font file")} onChange={e=>{const source=e.target.files?.[0];e.target.value="";if(source)void add(source);}}/>
  </div>
  <p className="tiny muted">{L("TTF, OTF, WOFF, WOFF2 · tối đa 3 MB/phông. Phông mặc định luôn được giữ.","TTF, OTF, WOFF, WOFF2 · up to 3 MB/font. The default font is always kept.")}</p>
  <div className="heading-font-choices">{(["vi","en"] as const).map(l=><div key={l}><label className="field-group">{L(`Phông heading ${l.toUpperCase()}`,`${l.toUpperCase()} heading font`)}<select aria-label={L(`Phông heading ${l.toUpperCase()}`,`${l.toUpperCase()} heading font`)} disabled={busy} value={headingFontId(meta[l].headingFont)} onChange={e=>onChange({...meta,[l]:{...meta[l],headingFont:e.target.value}})}><option value="default">{L("1. Mặc định (hiện tại)","1. Default (current)")}</option>{fonts.map((f,n)=><option key={f.id} value={f.id}>{n+2}. {f.label}</option>)}</select></label><div className="heading-font-sample" data-heading-font={headingFontId(meta[l].headingFont)} style={headingFontStyle(meta[l].headingFont)}><h3>{l==="vi"?"Chương 1: Truyền kỳ mạn lục":"Chapter 1: Records of Strange Tales"}</h3></div></div>)}</div>
  {fonts.map(font=><div className="heading-font-row" key={font.id}><span>{font.label}</span><button className="text-button" disabled={busy||inUse(font.id)} aria-label={L(`Xóa phông ${font.label}`,`Remove font ${font.label}`)} onClick={()=>remove(font)}><Trash2 size={14}/>{L("Xóa phông","Remove font")}</button>{inUse(font.id)&&<small>{L("Đang dùng ở bản nháp hoặc bản xuất bản","Used by a draft or public edition")}</small>}</div>)}
  {loading&&<p role="status">{L("Đang tải danh sách phông…","Loading fonts…")}</p>}{error&&<p role="alert">{error} {pending.current&&<button className="text-button" disabled={working} onClick={()=>{if(pending.current)void add(pending.current.file);}}>{L("Thử thêm phông lại","Retry adding font")}</button>}<button className="text-button" disabled={working} onClick={()=>{setLoading(true);setError("");void load().catch(e=>setError(e.message)).finally(()=>setLoading(false));}}>{L("Thử tải danh sách lại","Reload fonts")}</button></p>}{message&&<p role="status">{message}</p>}
 </section>;
}
