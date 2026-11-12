import {parse, HTMLElement, type Node} from "node-html-parser";
import {cleanHtml} from "./sanitize";
import type {Locale} from "./types";
import {alignmentCodec} from "./novel-lookup";

export {alignmentCodec};
export type AlignmentSection = "story" | "critique" | "notes";
export type AlignmentSentence = {
  section: AlignmentSection;
  start: number;
  end: number;
  quote: string;
  text: string;
  starts: number[];
  ends: number[];
};

export function extractAlignmentText(html: string, locale: Locale) {
  let text = "";
  const breaks=new Set<number>();
  const groups: {section:AlignmentSection;text:string;starts:number[];ends:number[]}[] = [];
  let group = {section:"story" as AlignmentSection,text:"",starts:[] as number[],ends:[] as number[]};
  groups.push(group);
  function add(value:string,start:number,end:number) {
    if (/\s/u.test(value)) {
      if (!group.text || group.text.endsWith(" ")) return;
      value = " ";
    }
    group.text += value;
    group.starts.push(start);
    group.ends.push(end);
  }
  const boundary = () => {breaks.add(text.length);add(" ",text.length,text.length);};
  function walk(node:Node,skip=false) {
    if (node.nodeType === 3) {
      const value = node.textContent, at = text.length;
      text += value;
      if (!skip) for(let i=0;i<value.length;i++) add(value[i],at+i,at+i+1);
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.rawTagName?.toLowerCase() ?? "";
    const block = /^(p|div|section|li|blockquote|figcaption|td|th|h[1-6])$/.test(tag);
    if (block || tag === "br") boundary();
    if (/^h[1-6]$/.test(tag)) {
      const label = node.textContent.trim();
      const section:AlignmentSection|undefined = /^(lời\s+(bình|bàn)|critique)\s*[:：]?$/iu.test(label) ? "critique"
        : /^(chú\s+(thích|giải)|ghi chú|notes|footnotes|endnotes|annotations)\s*[:：]?$/iu.test(label) ? "notes" : undefined;
      if (section) {
        group = {section,text:"",starts:[],ends:[]};groups.push(group);skip = true;
      }
    }
    for (const child of node.childNodes) walk(child,skip);
    if (block) boundary();
  }
  const root = parse(cleanHtml(html));
  for (const node of root.childNodes) walk(node);
  const sentences:AlignmentSentence[] = [];
  for (const g of groups) {
    const input = g.section === "notes" ? g.text : g.text.replace(/\(\d{1,3}\)/g,m=>" ".repeat(m.length));
    for (const part of new Intl.Segmenter(locale,{granularity:"sentence"}).segment(input)) {
      const first = part.segment.search(/\S/u);
      if (first < 0) continue;
      const from = part.index + first, to = part.index + part.segment.trimEnd().length;
      const starts = g.starts.slice(from,to), ends = g.ends.slice(from,to);
      const start = starts[0], end = ends.at(-1)!;
      sentences.push({section:g.section,start,end,quote:text.slice(start,end),text:input.slice(from,to),starts,ends});
    }
  }
  return {codec:alignmentCodec,text,sentences,breaks:[...breaks].filter(p=>p>0&&p<text.length).sort((a,b)=>a-b)};
}
