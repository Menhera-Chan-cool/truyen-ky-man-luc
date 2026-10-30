import { notFound } from "next/navigation";
import seed from "../../../../src/data/book.json";
import { isLocale } from "../../../../src/lib/types";
import ComicReader from "../../../../src/components/ComicReader";
import {configured,getBook,requireEditor} from "../../../../src/lib/server";
import {publicComic,comicHead} from "../../../../src/lib/comic-server";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
export const dynamic="force-dynamic";
export const metadata = {
  title: "Truyện tranh · Truyền kỳ mạn lục",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,searchParams,
}: {
  params: Promise<{ locale: string; chapterId: string }>;
  searchParams:Promise<{preview?:string}>;
}) {
  const { locale, chapterId } = await params;
  if (!isLocale(locale)) notFound();
  const connected=configured();
  const [book,published]=connected?await Promise.all([getBook(false),publicComic(chapterId)]):[seed,undefined];
  const preview=connected&&(await searchParams).preview==="draft";
  let shared=published;
  let chapters=book.chapters.map(c=>({id:c.id,title:c[locale]?.title??(locale==="vi"?"Phần chưa có tiêu đề":"Untitled section")}));
  for(const entry of published?.summaries??[]) if(!chapters.some(c=>c.id===entry.id))chapters.push({id:entry.id,title:entry.title});
  if(preview) {
    const request=new Request("https://reader.internal/",{headers:await headers()});
    let editor;
    try {editor=await requireEditor(request);}catch{redirect(`/admin/comic?chapter=${chapterId}&lang=${locale}`);}
    const [head,privateChapters]=await Promise.all([comicHead(editor.client,chapterId),editor.client.from("chapters").select("id,sort_order").eq("archived",false).order("sort_order")]);
    if(privateChapters.error) throw Error("Cannot load private chapter index");
    chapters=(privateChapters.data??[]).map(c=>({id:c.id,title:c.id===chapterId?head.draft?.title??chapters.find(p=>p.id===c.id)?.title??c.id:chapters.find(p=>p.id===c.id)?.title??c.id}));
    shared={edition:head.draft,summaries:shared!.summaries};
  }
  if(!chapters.some(c=>c.id===chapterId))notFound();
  return (
    <ComicReader
      key={`${locale}:${chapterId}`}
      locale={locale}
      chapterId={chapterId}
      shared={shared}
      preview={preview}
      book={{
        title: book.meta[locale].title,
        author: book.author,
        chapters,
      }}
    />
  );
}
