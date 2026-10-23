import { notFound } from "next/navigation";
import { getBook, savedReaderSettings } from "../../../../src/lib/server";
import { isLocale } from "../../../../src/lib/types";
import Reader from "../../../../src/components/Reader";
export const dynamic = "force-dynamic";
export default async function ReaderPage({
  params,
}: {
  params: Promise<{ locale: string; chapterId: string }>;
}) {
  const { locale, chapterId } = await params;
  if (!isLocale(locale)) notFound();
  const [book, initialSettings] = await Promise.all([
    getBook(),
    savedReaderSettings(),
  ]);
  if (!book.chapters.some((c) => c.id === chapterId)) notFound();
  // shortcut: preload this short book; use chapter prefetch if an edition grows to several MB.
  const readerBook = {
    ...book,
    chapters: book.chapters.map((c) => ({
      ...c,
      vi: c.vi
        ? {
            ...c.vi,
            html: locale === "vi" ? c.vi.html : "",
          }
        : undefined,
      en: c.en
        ? {
            ...c.en,
            html: locale === "en" ? c.en.html : "",
          }
        : undefined,
    })),
  };
  return (
    <Reader
      book={readerBook}
      locale={locale}
      chapterId={chapterId}
      initialSettings={initialSettings}
    />
  );
}
