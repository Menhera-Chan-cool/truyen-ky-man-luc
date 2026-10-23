import { notFound } from "next/navigation";
import { getBook, savedReaderSettings } from "../../src/lib/server";
import { readerPalette, contrastText } from "../../src/lib/reader";
import { isLocale } from "../../src/lib/types";
import BookDetail from "../../src/components/BookDetail";
export const dynamic = "force-dynamic";
export default async function BookPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [book, settings] = await Promise.all([
    getBook(false),
    savedReaderSettings(),
  ]);
  return (
    <BookDetail
      initialDark={
        contrastText(readerPalette(settings).background) === "#ffffff"
      }
      book={{
        ...book,
        chapters: book.chapters.map((c) => ({
          ...c,
          vi: c.vi ? { ...c.vi, html: "" } : undefined,
          en: c.en ? { ...c.en, html: "" } : undefined,
        })),
      }}
      locale={locale}
    />
  );
}
