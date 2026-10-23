import { PDFDocument } from "pdf-lib";
export async function slicePdf(bytes: Uint8Array, from: number, to: number) {
  const source = await PDFDocument.load(bytes);
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 1 ||
    to < from ||
    to > source.getPageCount()
  )
    throw new Error("Invalid PDF page range");
  const result = await PDFDocument.create();
  const pages = await result.copyPages(
    source,
    Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i),
  );
  pages.forEach((page) => result.addPage(page));
  return result.save();
}
