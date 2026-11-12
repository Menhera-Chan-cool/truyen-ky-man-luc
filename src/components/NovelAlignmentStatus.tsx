"use client";
import {useEffect,useState} from 'react';
import {adminRequest} from '../lib/supabase';
import type {Locale} from '../lib/types';
export default function NovelAlignmentStatus({chapterId,locale}:{chapterId:string;locale:Locale}){
 const [status,setStatus]=useState<{state:string;available?:boolean}|null>(null),[error,setError]=useState(false),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0);
 const L=(vi:string,en:string)=>locale==='vi'?vi:en;
 useEffect(()=>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  const load=()=>{if(document.hidden){timer=setTimeout(load,60000);return;}
   void adminRequest('novel-alignment?chapterId='+encodeURIComponent(chapterId),undefined,'GET',controller.signal).then(data=>{if(!controller.signal.aborted){setStatus(data);setError(false);}}).catch(()=>{if(!controller.signal.aborted)setError(true);}).finally(()=>{if(!controller.signal.aborted)timer=setTimeout(load,60000);});
  };load();return()=>{controller.abort();clearTimeout(timer);};
 },[chapterId,attempt]);
 const message=error?L('Chưa tải được trạng thái đối ứng.','Unable to load alignment status.'):!status?L('Đang kiểm tra dữ liệu tra VI↔EN…','Checking VI↔EN lookup data…'):status.available?L('Bản công khai đã có dữ liệu tra VI↔EN.','The published editions have VI↔EN lookup data.'):status.state==='missing'?L('Cần xuất bản cả hai bản Novel văn bản để tạo dữ liệu đối ứng.','Publish both text Novel editions to prepare counterpart data.'):status.state==='failed'?L('Chưa tạo được dữ liệu đối ứng. Bạn có thể cho hệ thống thử lại.','Alignment could not be prepared. You can queue another attempt.'):status.state==='running'?L('Hệ thống đang ghép hai bản công khai.','The two published editions are being aligned.'):L('Đang chờ lượt xử lý theo lịch GitHub Actions.','Waiting for the scheduled GitHub Actions worker.');
 return <div className="novel-alignment-status"><p role="status">{message}</p><button className="secondary-button" disabled={busy||status?.state==='missing'||status?.state==='running'} onClick={async()=>{
  if(error){setAttempt(a=>a+1);return;}setBusy(true);try{await adminRequest('novel-alignment',{chapterId});setStatus({state:'pending',available:status?.available});setAttempt(a=>a+1);}catch{setError(true);}finally{setBusy(false);}
 }}>{error?L('Tải lại trạng thái','Reload status'):busy?L('Đang xếp lịch…','Queueing…'):L('Tạo lại dữ liệu đối ứng','Rebuild counterpart data')}</button></div>;
}
