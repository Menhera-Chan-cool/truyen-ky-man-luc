import {validateFont} from "./reader-extras";
export const FZ_HEADING_FONT="00000000-0000-4000-8000-000000000002";
export type HeadingFont={id:string;label:string;path:string;format:string;bytes:number;hash:string;archived:boolean;created_at:string};
export const validHeadingFontId=(value:unknown):value is string=>typeof value==="string"&&(value==="default"||/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value));
export const headingFontId=(value:unknown)=>validHeadingFontId(value)?value:"default";
export const headingFontFamily=(value:unknown)=>headingFontId(value)==="default"?'"Literata Variable", Georgia, serif':`"TKML Heading ${headingFontId(value)}", "Literata Variable", Georgia, serif`;
export function fontFileInfo(name:string,bytes:Uint8Array){
 const format=validateFont(name,bytes,bytes.byteLength),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const invalid=()=>{throw Error("Invalid font container");};
 if(format==="ttf"||format==="otf"){
  if(bytes.length<12)invalid();const count=v.getUint16(4);if(!count||count>256||12+count*16>bytes.length)invalid();
  const tables=new Set<string>();
  for(let i=0;i<count;i++){const at=12+i*16,tag=new TextDecoder().decode(bytes.slice(at,at+4)),offset=v.getUint32(at+8),length=v.getUint32(at+12);if(offset<12+count*16||offset+length>bytes.length)invalid();tables.add(tag);
   if(tag==="OS/2"&&length>=10&&(v.getUint16(offset+8)&0x202))throw Error("This font restricts outline embedding");
  }
  if(!tables.has("cmap")||!tables.has("name"))invalid();
 }else{
  const header=format==="woff2"?48:44;if(bytes.length<header||v.getUint32(8)!==bytes.length||!v.getUint16(12)||v.getUint16(12)>256||v.getUint32(16)>30*1024*1024)invalid();
  if(format==="woff"){
   const count=v.getUint16(12);if(header+count*20>bytes.length)invalid();for(let i=0;i<count;i++){const at=header+i*20;if(v.getUint32(at+4)+v.getUint32(at+8)>bytes.length)invalid();}
  }
 }
 return {format,mime:`font/${format}`};
}
