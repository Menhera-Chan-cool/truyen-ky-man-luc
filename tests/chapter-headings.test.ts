import {it,expect} from "vitest";
import {parse} from "node-html-parser";
import {cleanHtml} from "../src/lib/sanitize";

it("recognizes the book's standalone section labels without changing their text",()=>{
 const html='<p id="critique"><strong>Critique</strong></p><p>Alas, unchanged.</p><p>Lời bình:</p><p>Chú thích:</p><p><strong>Notes</strong></p>';
 const result=cleanHtml(html),root=parse(result);
 expect(root.querySelectorAll("h3").map(h=>h.textContent)).toEqual(["Critique","Lời bình:","Chú thích:","Notes"]);
 expect(root.querySelector("#critique")?.rawTagName).toBe("h3");expect(root.textContent).toBe(parse(html).textContent);
 expect(cleanHtml(result)).toBe(result);
});
it("separates a heading from its opening paragraph and preserves body formatting and IDs",()=>{
 const html='<p id="intro"><strong>Critique</strong> <br>Alas! <em id="original-body">Keep this.</em></p>';
 const root=parse(cleanHtml(html));
 expect(root.querySelector("h3")?.textContent).toBe("Critique ");
 expect(root.querySelector("p")?.innerHTML).toBe('Alas! <em id="original-body">Keep this.</em>');
 expect(root.querySelectorAll("#intro")).toHaveLength(1);expect(root.querySelectorAll("#original-body")).toHaveLength(1);
 expect(root.textContent).toBe(parse(html.replace("<br>","")).textContent);
});
it("handles a Word heading whose line breaks are nested in a bold run",()=>{
 const html='<p><strong id="notes">Notes<br><br>(*) Original title: <em>X</em>.</strong></p>';
 const root=parse(cleanHtml(html));
 expect(root.querySelector("h3")?.textContent).toBe("Notes");
 expect(root.querySelector("p strong em")?.textContent).toBe("X");expect(root.querySelectorAll("#notes")).toHaveLength(1);
 expect(root.textContent).toBe(parse(html.replace("<br>","")).textContent);
});
it("leaves prose, list entries, quotations, images and unknown headings alone",()=>{
 const html='<p>A critique of the story.</p><ul><li><p>Notes</p></li></ul><blockquote><p>Critique</p></blockquote><p>Notes <img src="/book/cover.jpg"></p><p><strong>Another label</strong><br>Body</p>';
 const root=parse(cleanHtml(html));expect(root.querySelectorAll("h3")).toHaveLength(0);expect(root.querySelectorAll("img")).toHaveLength(1);
});
it("retains all six safe heading levels while removing scripts and unsafe links",()=>{
 const root=parse(cleanHtml('<h5>Five</h5><h6>Six</h6><script>alert(1)</script><p><a href="javascript:alert(1)">Link</a></p>'));
 expect(root.querySelector("h5")?.textContent).toBe("Five");expect(root.querySelector("h6")?.textContent).toBe("Six");
 expect(root.querySelector("script")).toBeNull();expect(root.querySelector("a")?.hasAttribute("href")).toBe(false);
});
