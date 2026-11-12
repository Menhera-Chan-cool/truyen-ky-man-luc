// @vitest-environment jsdom
import {it,expect} from "vitest";
import {extractAlignmentText} from "../src/lib/novel-text";
import {cleanHtml} from "../src/lib/sanitize";
import {decorateFootnotes} from "../src/lib/footnotes";

it("keeps exactly the Reader DOM text including inline text, entities, emoji and br",()=>{
 const html='<p>Hồ <strong>Tông</strong> Thốc 😀 &amp; bạn.<br>Ý tiếp theo.</p><p>Câu nữa.</p>';
 const root=document.createElement('article');root.innerHTML=cleanHtml(html);
 const result=extractAlignmentText(html,'vi');
 expect(result.text).toBe(root.textContent);expect(result.text).not.toContain('\n');
 for(const s of result.sentences)expect(result.text.slice(s.start,s.end)).toBe(s.quote);
 expect(result.sentences.map(s=>s.text).join(' ')).toContain('Ý tiếp theo.');
});
it("joins prose fragmented across paragraphs without joining narrative, critique or notes",()=>{
 const result=extractAlignmentText('<p>Một câu</p><p>bị chia giữa dòng.</p><p>Lời bình:</p><p>Bình luận.</p><p>Chú thích:</p><p>(1) Chú giải.</p>','vi');
 expect(result.sentences.map(s=>[s.section,s.text])).toEqual([['story','Một câu bị chia giữa dòng.'],['critique','Bình luận.'],['notes','(1) Chú giải.']]);
});
it("keeps reader offsets while masking inline note numbers in the model input",()=>{
 const html='<p>Nhân vật (1) xuất hiện.</p><p>Chú thích:</p><p>(1) Một chú thích.</p>';
 const result=extractAlignmentText(html,'vi'),root=document.createElement('article');root.innerHTML=cleanHtml(html);decorateFootnotes(root,'vi','chapter-1');
 expect(result.text).toBe(root.textContent);expect(result.sentences[0].text).not.toContain('(1)');
 expect(result.sentences[0].quote).toContain('(1)');
});
it("maps model characters back to source UTF-16 positions after artificial block separators",()=>{
 const result=extractAlignmentText('<p>A 😀</p><p>từ e\u0301 ở đây.</p>','vi');const s=result.sentences[0];
 expect(s.text).toBe('A 😀 từ e\u0301 ở đây.');
 const i=s.text.indexOf('từ');expect(result.text.slice(s.starts[i],s.ends[i+1])).toBe('từ');
 const e=s.text.indexOf('😀');expect(result.text.slice(s.starts[e],s.ends[e+1])).toBe('😀');
});
it('records structural breaks for readable excerpts without adding characters to anchors',()=>{
 const result=extractAlignmentText('<p>Một.<br>Hai.</p><p>Ba.</p>','vi');
 expect(result.text).toBe('Một.Hai.Ba.');expect(result.breaks).toEqual([4,8]);
});
