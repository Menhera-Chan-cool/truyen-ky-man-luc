import type {makeAlignmentInput} from './input';
import type {Locale} from '../../src/lib/types';
import {alignmentUnits,type AlignmentArtifact,type TextSpan} from '../../src/lib/novel-lookup';
import {alignmentStructure} from '../../src/lib/novel-lookup-structure';
import type {PoetryHint} from '../../src/lib/novel-poetry-structure';

export type ContextUnit=TextSpan&{section:'story'|'critique'|'notes';noteId?:string;text:string;quote:string;starts:number[];ends:number[]};
export type ContextInput=ReturnType<typeof makeAlignmentInput>&{units:Record<Locale,ContextUnit[]>;structures:Record<Locale,ReturnType<typeof alignmentStructure>&{poems:PoetryHint[]}>};

export function makeContextInput(input:ReturnType<typeof makeAlignmentInput>):ContextInput{
 const artifact:AlignmentArtifact={...input,schema:1,codec:input.editions.vi.codec,algorithm:'context-input',createdAt:'',groups:[]};
 const structure=(locale:Locale)=>{const s=alignmentStructure(artifact,locale);return {...s,poems:(input.editions[locale].poems??[]).filter(p=>![...s.notes,...s.originals,...s.headings.map(h=>h.span)].some(n=>p.start<n.end&&p.end>n.start))};};
 const structures={vi:structure('vi'),en:structure('en')};
 const prepare=(locale:Locale):ContextUnit[]=>{
  const e=input.editions[locale],s=structures[locale];
  const noteStart=Math.min(e.text.length,...s.notes.map(n=>n.start),...s.headings.filter(h=>h.kind==='notes').map(h=>h.span.start));
  const critique=s.headings.find(h=>h.kind==='critique'&&h.span.start<noteStart);
  const scopes:(TextSpan&{section:ContextUnit['section'];noteId?:string})[]=[
   {section:'story',start:0,end:critique?.span.start??noteStart},
   ...(critique?[{section:'critique' as const,start:critique.span.end,end:noteStart}]:[]),
   ...s.notes.map(n=>({section:'notes' as const,start:n.start,end:n.end,noteId:n.id})),
  ];
  const excluded=[...s.headings.map(h=>h.span),...s.originals];
  return scopes.flatMap(scope=>alignmentUnits(e,scope,locale,scope.section==='notes',true)
   .filter(span=>!excluded.some(p=>span.start<p.end&&span.end>p.start))
   .map(span=>{
    const quote=e.text.slice(span.start,span.end),text=scope.section==='notes'?quote:quote.replace(/\(\d{1,3}\)/g,m=>' '.repeat(m.length));
    return {...span,section:scope.section,noteId:scope.noteId,quote,text,starts:Array.from({length:text.length},(_,i)=>span.start+i),ends:Array.from({length:text.length},(_,i)=>span.start+i+1)};
   }));
 };
 return {...input,units:{vi:prepare('vi'),en:prepare('en')},structures};
}
