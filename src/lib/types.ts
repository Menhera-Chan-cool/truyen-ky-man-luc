export type Locale = "vi" | "en";
export type Edition = {
  title: string;
  html: string;
  revision: number;
  kind: "text" | "illustration" | "pdf";
  pdfPath?: string;
};
export type Chapter = { id: string; order: number; vi?: Edition; en?: Edition };
export type BookMeta = {
  title: string;
  summary: string;
  frontCover: string;
  backCover?: string;
  headingFont?: string;
};
export type Book = {
  id: "truyen-ky-man-luc";
  author: string;
  meta: Record<Locale, BookMeta>;
  chapters: Chapter[];
  revision: number;
};
export type ImportChapter = {
  id: string;
  title: string;
  html: string;
  kind: "text" | "illustration" | "pdf";
  pdfBytes?: Uint8Array;
  pdfPath?: string;
  sourcePath?: string;
  order?: number;
};
export type Member = {
  user_id: string;
  email: string;
  role: "owner" | "editor";
  active: boolean;
};
export type Annotation = {
  id: string;
  chapterId: string;
  locale: Locale;
  revision: number;
  start: number;
  end: number;
  text: string;
  image?: string;
  color: string;
  note: string;
  createdAt: number;
  pdfPage?: number;
  pdfZoom?: number;
};
export type Progress = {
  chapterId: string;
  ratio: number;
  revision: number;
  page: number;
  anchor?: number;
  pdfPage?: number;
  pdfZoom?: number;
};
export type PdfPosition = { page: number; zoom: number };
export type ListeningProgress = {
  locale: Locale;
  chapterId: string;
  revision: number;
  offset: number;
  completed: boolean;
  pdfPage?: number;
};
export type ReaderSettings = {
  layout: "ebook" | "book";
  theme: string;
  font: string;
  fontSize: number;
  lineHeight: number;
  width: number;
  align: string;
  mode: "scroll" | "single" | "double";
  background: string;
  foreground: string;
  accent: string;
  rate: number;
  shortPauses: boolean;
  autoNext: boolean;
  voice: string;
  scrollSpeed: number;
};
export const defaultSettings: ReaderSettings = {
  layout: "ebook",
  theme: "sepia",
  font: "Literata",
  fontSize: 20,
  lineHeight: 1.9,
  width: 780,
  align: "original",
  mode: "scroll",
  background: "#f5f0e5",
  foreground: "#302b23",
  accent: "#8d342b",
  rate: 1,
  shortPauses: true,
  autoNext: false,
  voice: "",
  scrollSpeed: 28,
};
export const isLocale = (value: string): value is Locale =>
  value === "vi" || value === "en";
