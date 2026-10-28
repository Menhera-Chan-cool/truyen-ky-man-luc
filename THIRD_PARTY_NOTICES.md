# References and third-party software

The editing workflow was informed by EPUB-Forge and the reading workflow by Novel-Hub, both by AzenKain / Kain. The web application uses a separate Next.js/Supabase implementation. Reference binaries and their test workspaces are not included in the web deployment.

- EPUB-Forge: https://github.com/AzenKain/EPUB-Forge — MIT
- Novel-Hub: https://github.com/AzenKain/Novel-Hub — MIT

MIT License

Copyright (c) 2026 Kain

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Runtime packages and exact versions are recorded in package.json and package-lock.json. Fontsource distributes Literata under SIL Open Font License 1.1 and Be Vietnam Pro under SIL Open Font License 1.1; their license files remain in the installed font packages. The original book cover and supplied texts are user-provided content, not software licensed by these repositories.

Additional self-hosted reading fonts: Lora, Merriweather, Inter, Roboto, JetBrains Mono and OpenDyslexic, distributed through Fontsource under SIL Open Font License 1.1. Copies of their licenses are in `licenses/`. Font assets are served by this application, without a Google Fonts browser request. OpenDyslexic uses Be Vietnam Pro as a glyph fallback where needed.

StPageFlip / page-flip 2.0.7 — Copyright (c) 2020 Nodlik, MIT License. https://github.com/Nodlik/StPageFlip . The unmodified browser distribution is self-hosted at public/vendor/page-flip-2.0.7.js; its full license is public/vendor/page-flip.LICENSE. Used only for inert physical page-turn snapshots; book content and assets are not copied from Hanhtrangso.
