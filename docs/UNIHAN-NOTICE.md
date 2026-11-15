# Unihan data in `src/data/sino-pinyin.json`

`src/data/sino-pinyin.json` maps each Sino-Vietnamese syllable to the pinyin syllables (tones removed) of the characters it reads. It is derived from the Unicode Han Database:

- Source: <https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip>, file `Unihan_Readings.txt` (Unicode 18.0.0, dated 2026-07-31), fields `kVietnamese` and `kMandarin` of the same character.
- Built by `scripts/align-novel/build_sino_pinyin.py`; the Unihan files themselves are not kept in the repository.
- Used by `src/lib/sino-names.ts` to match a Chinese name in its Vietnamese reading ("Chương Hàm") with its pinyin form ("Zhang Han").
- Coverage is partial: `kVietnamese` lists 8,307 characters, and 3,114 readings made it into the map. Common readings such as "hoành", "dị" and "hy" are missing, so some names cannot be matched.

The Unicode data files and derived data are used under the Unicode License v3; the copyright and permission notice is in `docs/UNICODE-LICENSE-V3.txt` (Copyright © 1991-2026 Unicode, Inc.).
