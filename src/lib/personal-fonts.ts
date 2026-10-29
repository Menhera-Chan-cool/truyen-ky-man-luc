"use client";
import { useEffect, useState } from "react";
import {
  readPreference,
  writePreference,
  deletePreference,
  preferenceKeys,
} from "./db";
import { validateFont } from "./reader-extras";
export type PersonalFont = { id: string; name: string; file: Blob };
export async function listFonts() {
  const keys = await preferenceKeys(),
    result: PersonalFont[] = [];
  for (const key of keys.filter(
    (k) => typeof k === "string" && /^font:[0-9a-f-]{36}$/.test(k),
  )) {
    const value = await readPreference<PersonalFont>(String(key));
    if (value && value.file instanceof Blob && typeof value.name === "string")
      result.push(value);
  }
  return result;
}
export async function importFont(file: File) {
  validateFont(
    file.name,
    new Uint8Array(await file.slice(0, 4).arrayBuffer()),
    file.size,
  );
  if ((await listFonts()).length >= 8)
    throw Error("Keep at most 8 personal fonts");
  await new FontFace("ReaderFontValidation", await file.arrayBuffer()).load();
  const cleanName = file.name.replace(/[\x00-\x1f]/g, "");
  const font = {
    id: "font:" + crypto.randomUUID(),
    name:
      cleanName.length > 80
        ? cleanName.slice(0, 72) + "." + file.name.split(".").at(-1)
        : cleanName,
    file: new Blob([file]),
  };
  await writePreference(font.id, font);
  return font;
}
export const removeFont = (id: string) => deletePreference(id);
export function usePersonalFont(
  id: string,
  onError: (message: string) => void,
) {
  const [family, setFamily] = useState<string>();
  useEffect(() => {
    setFamily(undefined);
    if (!/^font:[0-9a-f-]{36}$/.test(id)) return;
    let cancelled = false,
      url = "",
      style: HTMLStyleElement | undefined;
    void readPreference<PersonalFont>(id)
      .then(async (saved) => {
        if (!saved || !(saved.file instanceof Blob))
          throw Error("Personal font is not available on this device");
        validateFont(
          saved.name,
          new Uint8Array(await saved.file.slice(0, 4).arrayBuffer()),
          saved.file.size,
        );
        if (cancelled) return;
        url = URL.createObjectURL(saved.file);
        style = document.createElement("style");
        style.textContent = `@font-face{font-family:ReaderPersonal;src:url("${url}");font-display:swap}`;
        document.head.append(style);
        await document.fonts.load("20px ReaderPersonal");
        if (!cancelled) setFamily("ReaderPersonal");
      })
      .catch((e) => {
        if (!cancelled) onError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      style?.remove();
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return family;
}
