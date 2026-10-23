import type { Metadata } from "next";
import { headers } from "next/headers";
import Tooltips from "../src/components/Tooltips";
import "@fontsource-variable/literata";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource-variable/lora";
import "@fontsource-variable/merriweather";
import "@fontsource-variable/inter";
import "@fontsource-variable/roboto";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource/opendyslexic/400.css";
import "pdfjs-dist/web/pdf_viewer.css";
import "./globals.css";
import { savedReaderSettings } from "../src/lib/server";
import { readerPalette, themes } from "../src/lib/reader";
export const metadata: Metadata = {
  title: "Truyền kỳ mạn lục · Nguyễn Dữ",
  description:
    "Đọc Truyền kỳ mạn lục bằng tiếng Việt và tiếng Anh. Read Records of Strange Tales in Vietnamese and English.",
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = (await headers()).get("x-book-locale") === "en" ? "en" : "vi";
  const palette =
    (await headers()).get("x-book-surface") === "admin"
      ? themes.sepia
      : readerPalette(await savedReaderSettings());
  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        style={{ background: palette.background, color: palette.foreground }}
      >
        {children}
        <Tooltips />
      </body>
    </html>
  );
}
