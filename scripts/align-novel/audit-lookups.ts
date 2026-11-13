import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

type Span = { start: number; end: number };
type Edition = { text: string; revision?: number; words?: Span[]; breaks?: number[] };
type Issue = Partial<Span> & { reason: string };
const lexical = /[\p{L}\p{M}\p{N}]+(?:[’'-][\p{L}\p{M}\p{N}]+)*/gu;
const head = /^[\p{L}\p{M}\p{N}’'-]/u, tail = /[\p{L}\p{M}\p{N}’'-]$/u;

export function enumerateWords(e: Edition) {
  if (typeof e?.text !== "string") throw Error("Missing edition text");
  const words: Span[] = [], issues: Issue[] = [], text = e.text;
  const safe = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= text.length &&
    !(n > 0 && /[\uD800-\uDBFF]/.test(text[n - 1]) && /[\uDC00-\uDFFF]/.test(text[n] ?? ""));
  const breaks = new Set([0, text.length]);
  for (const n of e.breaks ?? []) {
    if (safe(n)) breaks.add(n); else issues.push({ start: n, reason: "invalid-structural-break" });
  }
  const cuts = [...breaks].sort((a, b) => a - b);
  if (!e.words) {
    for (let i = 1; i < cuts.length; i++) for (const m of text.slice(cuts[i - 1], cuts[i]).matchAll(lexical)) {
      const start = cuts[i - 1] + m.index; words.push({ start, end: start + m[0].length });
    }
  } else {
    if (!Array.isArray(e.words)) throw Error("Invalid reader word list");
    let previousEnd = 0;
    for (const w of e.words) {
      if (!w || !safe(w.start) || !safe(w.end) || w.end <= w.start || w.start < previousEnd ||
        (!breaks.has(w.start) && tail.test(text.slice(0, w.start)) && head.test(text.slice(w.start))) ||
        (!breaks.has(w.end) && tail.test(text.slice(0, w.end)) && head.test(text.slice(w.end)))) {
        issues.push({ ...w, reason: "invalid-word-segment" }); continue;
      }
      previousEnd = w.end;
      const inner = cuts.filter(n => n > w.start && n < w.end), points = [w.start, ...inner, w.end];
      if (inner.length) issues.push({ ...w, reason: "crosses-structural-break" });
      for (let i = 1; i < points.length; i++) {
        let start = points[i - 1], end = points[i];
        while (start < end && /\s/u.test(text[start])) start++;
        while (end > start && /\s/u.test(text[end - 1])) end--;
        if (/[\p{L}\p{N}]/u.test(text.slice(start, end))) words.push({ start, end });
      }
    }
  }
  return { words, issues };
}

export async function auditLookups(options: { from: number; to: number; input: string; output: string; resolver: string }) {
  const { from, to } = options;
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 1 || to < from) throw Error("Invalid chapter range");
  const input = path.resolve(options.input), output = path.resolve(options.output), resolver = path.resolve(options.resolver);
  const relative = path.relative(input, output);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) throw Error("Output must be outside input");
  const { lookupArtifact } = await import(pathToFileURL(resolver).href);
  if (typeof lookupArtifact !== "function") throw Error("Trusted local resolver must export lookupArtifact");
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.mkdir(output); // A new directory prevents overwriting any prior audit.
  const file = await fs.open(path.join(output, "all-word-lookups.jsonl"), "wx");
  const summary = { resolver, from, to, totalWordOccurrences: 0, errors: 0, segmentationIssues: 0,
    statuses: {} as Record<string, number>, byChapter: {} as Record<string, unknown>,
    semanticLimit: "Mechanical consumer probes only; no semantic verdicts or accuracy estimate. Invalid segments are flagged and skipped; cross-block spans are split." };
  let batch: string[] = [];
  const flush = async () => { if (batch.length) { await file.writeFile(batch.join("\n") + "\n"); batch = []; } };
  try {
    for (let n = from; n <= to; n++) {
      const a = JSON.parse(await fs.readFile(path.join(input, `chapter-${n}.json`), "utf8"));
      if (a.chapterId !== `chapter-${n}` || !Array.isArray(a.groups)) throw Error(`Invalid chapter ${n}`);
      const chapter: Record<string, unknown> = {}; summary.byChapter[n] = chapter;
      for (const locale of ["vi", "en"] as const) {
        const edition: Edition = a.editions[locale], { words, issues } = enumerateWords(edition);
        const statuses: Record<string, number> = {};
        chapter[locale] = { occurrences: words.length, statuses, segmentationIssues: issues.length, issues };
        summary.segmentationIssues += issues.length;
        for (const span of words) {
          const source = { ...span, quote: edition.text.slice(span.start, span.end) };
          let result;
          try {
            const r = await lookupArtifact(a, { chapterId: a.chapterId, locale, revision: edition.revision, ...span, text: source.quote });
            result = { status: r.status, passages: r.passages.map((p: any) => ({
              source: { start: p.source.start, end: p.source.end }, target: { start: p.target.start, end: p.target.end },
              highlights: p.highlights.map((h: Span) => ({ ...h, quote: a.editions[r.targetLocale].text.slice(h.start, h.end) })),
            })) };
          } catch (error) { result = { status: "error", error: String(error) }; summary.errors++; }
          batch.push(JSON.stringify({ chapterId: a.chapterId, locale, source, ...result }));
          statuses[result.status] = (statuses[result.status] ?? 0) + 1;
          summary.statuses[result.status] = (summary.statuses[result.status] ?? 0) + 1;
          summary.totalWordOccurrences++;
          if (batch.length >= 1000) await flush();
        }
      }
    }
    await flush();
  } finally { await file.close(); }
  await fs.writeFile(path.join(output, "summary.json"), JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: Object.fromEntries(["from", "to", "input", "output", "resolver"].map(k => [k, { type: "string" as const }])) });
  if (Object.values(values).length !== 5) throw Error("Usage: audit-lookups.ts --from N --to N --input DIR --output NEW_DIR --resolver TRUSTED_LOCAL_FILE");
  auditLookups({ from: Number(values.from), to: Number(values.to), input: values.input!, output: values.output!, resolver: values.resolver! })
    .then(summary => console.log(JSON.stringify(summary))).catch(error => { console.error(String(error)); process.exitCode = 1; });
}
