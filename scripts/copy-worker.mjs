import { copyFile, mkdir } from "node:fs/promises";
await mkdir("public", { recursive: true });
await copyFile(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "public/pdf.worker.min.mjs",
);
await mkdir("public/vendor", { recursive: true });
await copyFile(
  "node_modules/page-flip/dist/js/page-flip.browser.js",
  "public/vendor/page-flip-2.0.7.js",
);
await copyFile(
  "node_modules/page-flip/LICENSE",
  "public/vendor/page-flip.LICENSE",
);
