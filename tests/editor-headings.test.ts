// @vitest-environment jsdom
import React, {act} from "react";
import {createRoot} from "react-dom/client";
import {it, expect, vi} from "vitest";
import RichEditor from "../src/components/RichEditor";

it("opens legacy headings in the real editor without changing the saved draft on mount", async()=>{
 vi.stubGlobal("React",React);Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const host=document.createElement("div");document.body.append(host);
 const root=createRoot(host),onChange=vi.fn(),onError=vi.fn();
 try{
  await act(async()=>root.render(React.createElement(RichEditor,{
   html:'<p><strong>Critique</strong><br>Keep the prose.</p><p><strong>Notes</strong></p><p>(1) Keep this note.</p>',
   locale:"en",headingFont:"6d80f149-7e5f-4a6d-bf3c-b62b68bb80fc",onChange,onError,
  })));
  expect([...host.querySelectorAll(".tiptap h3")].map(h=>h.textContent)).toEqual(["Critique","Notes"]);
  expect(host.querySelector(".tiptap p")?.textContent).toBe("Keep the prose.");
  expect(host.querySelector("[data-heading-font]")?.getAttribute("data-heading-font")).toBe("6d80f149-7e5f-4a6d-bf3c-b62b68bb80fc");
  expect(onChange).not.toHaveBeenCalled();expect(onError).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
