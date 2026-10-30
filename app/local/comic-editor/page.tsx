import seed from "../../../src/data/book.json";
import ComicEditor from "../../../src/components/ComicEditor";
import {configured} from "../../../src/lib/server";
import {redirect} from "next/navigation";
export const metadata = {
  title: "Biên tập truyện tranh · Local",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ chapter?: string; lang?: string }>;
}) {
  const params = await searchParams,
    locale = params.lang === "en" ? "en" : "vi",
    chapterId = seed.chapters.some((c) => c.id === params.chapter)
      ? params.chapter!
      : "chapter-1";
  if(configured()) redirect(`/admin/comic?chapter=${chapterId}&lang=${locale}`);
  return (
    <ComicEditor
      key={`${locale}:${chapterId}`}
      locale={locale}
      chapterId={chapterId}
      book={{
        title: seed.meta[locale].title,
        author: seed.author,
        chapters: seed.chapters.map((c) => ({
          id: c.id,
          title:
            c[locale]?.title ??
            (locale === "vi" ? "Phần chưa có tiêu đề" : "Untitled section"),
        })),
      }}
    />
  );
}
