"use client";
import {useEffect,useState,type ReactNode} from "react";
import {BookOpen} from "lucide-react";
import {Panel} from "./Ui";
import {lookupArtifact,type ComparisonFocus,type LookupRequest,type LookupResult} from "../lib/novel-lookup";
import type {Book} from '../lib/types';

export default function NovelLookup({request,onClose,onCompare,book,offline=false}:{request:LookupRequest;onClose:()=>void;onCompare:(focus?:ComparisonFocus)=>void;book:Book;offline?:boolean}){
  const [result,setResult]=useState<LookupResult|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const [downloaded,setDownloaded]=useState(false);
  const L=(vi:string,en:string)=>request.locale==='vi'?vi:en;
  useEffect(()=>{
    let disposed=false;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
    setResult(null);setError('');setDownloaded(false);
    const local=async()=>{
      const {readDownloadedAlignment}=await import('../lib/offline-alignment');
      const artifact=await readDownloadedAlignment(book,request.chapterId);return artifact?lookupArtifact(artifact,request):undefined;
    };
    void (async()=>{
      if(offline||navigator.onLine===false){
        const data=await local();if(!disposed){setResult(data??{status:'pending',targetLocale:request.locale==='vi'?'en':'vi',passages:[]});setDownloaded(!!data);}return;
      }
      const response=await fetch('/api/novel-lookup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:controller.signal});
      const data=await response.json();if(!response.ok&&response.status!==409)throw Error(response.status===400?'selection':'network');
      if(!Array.isArray(data.passages)||typeof data.status!=='string')throw Error('network');if(!disposed)setResult(data);
    })().catch(async e=>{
      if(disposed)return;
      if(e.message!=='selection'){try{const cached=await local();if(cached&&!disposed){setResult(cached);setDownloaded(true);return;}}catch{}}
      if(!disposed)setError(e.message==='selection'?'selection':'network');
    }).finally(()=>clearTimeout(timeout));
    return()=>{disposed=true;clearTimeout(timeout);controller.abort();};
  },[request,attempt,book,offline]);
  const message=result&&({missing:L('Phần này chưa có bản đối ứng.','This section has no counterpart edition.'),pending:L('Dữ liệu đối ứng của chương chưa sẵn sàng.','Alignment data for this chapter is not ready yet.'),stale:L('Nội dung đã thay đổi. Hãy tải lại bản đọc để tra đúng phiên bản.','The text has changed. Reload this edition to look up the current version.'),unavailable:L('Chưa tìm được phần tương ứng trong bản còn lại.','No corresponding passage was found in the other edition.'),"context-only":L('Chưa tìm được từ tương ứng trực tiếp. Bạn có thể đối chiếu câu bên dưới.','No direct word counterpart was found. Compare the sentence below.') } as Partial<Record<LookupResult['status'],string>>)[result.status];
  function marked(p:LookupResult['passages'][number]){
    const pieces:ReactNode[]=[];
    const cuts=[...new Set([0,p.target.text.length,...(p.target.breaks??[]).map(b=>b-p.target.start),...p.highlights.flatMap(s=>[s.start-p.target.start,s.end-p.target.start])])].filter(pnt=>pnt>=0&&pnt<=p.target.text.length).sort((a,b)=>a-b);
    for(let i=0;i<cuts.length-1;i++){
      const a=cuts[i],b=cuts[i+1],value=p.target.text.slice(a,b);
      const highlighted=p.highlights.some(s=>s.start<=p.target.start+a&&s.end>=p.target.start+b);
      pieces.push(highlighted?<mark key={'m'+i}>{value}</mark>:value);
      if(p.target.breaks?.includes(p.target.start+b))pieces.push(<br key={'b'+i}/>);
    }
    return pieces;
  }
  function compare(){
    const p=result?.passages[0];
    if(!p||!result?.targetRevision){onCompare();return;}
    const source={start:request.start,end:request.end,text:request.text,revision:request.revision};
    const span=p.highlights[0]??p.target;
    const target={...span,text:p.target.text.slice(span.start-p.target.start,span.end-p.target.start),revision:result.targetRevision};
    onCompare(request.locale==='vi'?{vi:source,en:target}:{en:source,vi:target});
  }
  const terms=result?.passages.flatMap(p=>p.highlights.map(s=>{
    const points=[s.start,...(p.target.breaks??[]).filter(b=>b>s.start&&b<s.end),s.end];
    return points.slice(0,-1).map((a,i)=>p.target.text.slice(a-p.target.start,points[i+1]-p.target.start)).join(' ').replace(/\s+/g,' ');
  }))??[];
  return <div className="novel-lookup"><Panel title={L('Tra trong hai bản Novel','Look up in both Novel editions')} onClose={onClose} closeLabel={L('Đóng','Close')}>
    <p className="lookup-direction">{request.locale.toUpperCase()} → {request.locale==='vi'?'EN':'VI'}</p>
    <blockquote className="lookup-source">{request.text}</blockquote>
    {!result&&!error&&<p role="status">{L('Đang tìm phần tương ứng…','Finding the corresponding passage…')}</p>}
    {error&&<div role="alert"><p>{error==='selection'?L('Hãy chọn đoạn ngắn hơn, tối đa 2.000 ký tự và 5 nhóm câu.','Choose a shorter passage, up to 2,000 characters and 5 sentence groups.'):L('Chưa tải được kết quả. Hãy thử lại.','Could not load the result. Please try again.')}</p><button className="secondary-button" onClick={()=>setAttempt(a=>a+1)}>{L('Thử lại','Retry')}</button></div>}
    {result&&<>
      {downloaded&&<p className="tiny muted">{L('Dùng dữ liệu đã tải trên thiết bị','Using data downloaded on this device')}</p>}
      {offline&&result.status==='pending'&&<p>{L('Chưa tải dữ liệu tra của chương này. Hãy cập nhật bản tải khi có mạng.','Lookup data for this chapter has not been downloaded. Update the download when online.')}</p>}
      {message&&<p role="status">{message}</p>}
      {result.passages.length>0&&<>
        <p className="lookup-confidence">{result.status==='uncertain'?L('Chưa chắc chắn · gợi ý tự động','Uncertain · automatic suggestion'):L('Gợi ý đối ứng trong sách','Suggested counterpart in the book')}</p>
        {terms.join(' ').length<=120&&terms.length>0&&<p className="lookup-terms">{[...new Set(terms)].map((t,i)=><span key={i}>{t}</span>)}</p>}
        {result.passages.map((p,i)=><div className="lookup-passage" key={i} lang={result.targetLocale}><p>{marked(p)}</p></div>)}
        <button className="secondary-button" onClick={compare}><BookOpen size={16}/>{L('Mở đối chiếu','Open comparison')}</button>
      </>}
      {!result.passages.length&&result.status!=='missing'&&<button className="secondary-button" onClick={()=>onCompare()}>{L('Đối chiếu cả chương','Compare the whole chapter')}</button>}
    </>}
  </Panel></div>;
}
