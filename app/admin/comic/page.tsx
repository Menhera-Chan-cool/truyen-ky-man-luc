import Admin from "../../../src/components/Admin";
import {configured} from "../../../src/lib/server";
import {redirect} from "next/navigation";
export const dynamic="force-dynamic";
export const metadata={title:"Biên tập truyện tranh · Truyền kỳ mạn lục",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{chapter?:string;lang?:string}>}) {
  const p=await searchParams,locale=p.lang==="en"?"en":"vi";
  if(!configured()) redirect(`/admin?lang=${locale}`);
  return <Admin locale={locale} comicChapter={p.chapter&&/^[a-z0-9-]{1,80}$/.test(p.chapter)?p.chapter:"chapter-1"}/>;
}
