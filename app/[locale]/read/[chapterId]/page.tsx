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
    getBook(true, locale),
    savedReaderSettings(),
  ]);
  if (!book.chapters.some((c) => c.id === chapterId)) notFound();
  // shortcut: preload this short book; use chapter prefetch if an edition grows to several MB.
  return (
    <Reader
      book={book}
      locale={locale}
      chapterId={chapterId}
      initialSettings={initialSettings}
    />
  );
}
