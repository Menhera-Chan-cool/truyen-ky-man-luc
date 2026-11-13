import { afterEach, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { enumerateWords, auditLookups } from "../scripts/align-novel/audit-lookups";

const directories: string[] = [];
afterEach(async () => { for (const dir of directories.splice(0)) {
  if(path.dirname(path.resolve(dir))!==path.resolve(os.tmpdir())||!path.basename(dir).startsWith('novel-audit-'))throw Error('Unexpected test cleanup path');
  await fs.rm(dir, { recursive: true, force: true });
} });

it("keeps structural block joins out of English words and retains UTF-16 offsets", () => {
  expect(enumerateWords({ text: "😀CritiqueAlas king's well-born", breaks: [10] }).words).toEqual([
    { start: 2, end: 10 }, { start: 10, end: 14 }, { start: 15, end: 21 }, { start: 22, end: 31 },
  ]);
});

it("preserves valid reader compounds and reports a stored word crossing a block break", () => {
  const result = enumerateWords({ text: "tốt bụngAlas", words: [{ start: 0, end: 12 }], breaks: [8] });
  expect(result.words).toEqual([{ start: 0, end: 8 }, { start: 8, end: 12 }]);
  expect(result.issues.map(i => i.reason)).toEqual(["crosses-structural-break"]);
});

it("reports invalid or overlapping stored segments instead of querying partial or corrupt words", () => {
  const result = enumerateWords({ text: "hello world", words: [
    { start: 0, end: 5 }, { start: 0, end: 5 }, { start: 6, end: 8 }, { start: -1, end: 99 },
  ] });
  expect(result.words).toEqual([{ start: 0, end: 5 }]);
  expect(result.issues).toHaveLength(3);
});

it("loads an explicit local resolver, writes consumer rows and refuses existing outputs", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "novel-audit-")); directories.push(dir);
  const input = path.join(dir, "input"), output = path.join(dir, "output"), resolver = path.join(dir, "resolver.mjs");
  await fs.mkdir(input);
  await fs.writeFile(resolver, `export function lookupArtifact(a,r){return {status:'context-only',targetLocale:r.locale==='vi'?'en':'vi',passages:[]}}`);
  await fs.writeFile(path.join(input, "chapter-1.json"), JSON.stringify({ chapterId: "chapter-1", groups: [], editions: {
    vi: { text: "Một người", revision: 1, words: [{ start: 0, end: 3 }, { start: 4, end: 9 }] },
    en: { text: "CritiqueAlas", revision: 2, breaks: [8] },
  } }));
  const options = { from: 1, to: 1, input, output, resolver };
  const summary = await auditLookups(options);
  expect(summary.totalWordOccurrences).toBe(4);
  expect(summary.statuses).toEqual({ "context-only": 4 });
  const rows = (await fs.readFile(path.join(output, "all-word-lookups.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line));
  expect(rows.map(r => r.source.quote)).toEqual(["Một", "người", "Critique", "Alas"]);
  expect(rows.every(r => r.status === "context-only" && r.passages.length === 0)).toBe(true);
  expect(JSON.parse(await fs.readFile(path.join(output, "summary.json"), "utf8"))).toEqual(summary);
  await expect(auditLookups(options)).rejects.toThrow();
  expect((await fs.readFile(path.join(output, "all-word-lookups.jsonl"), "utf8")).trim().split("\n")).toHaveLength(4);
});
