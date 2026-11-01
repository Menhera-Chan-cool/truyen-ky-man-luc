"use client";
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from "react";
const KEY="tkml-comic-controls";
let tabVisibility:boolean|undefined;
export function useComicControls(panelOpen:boolean){
 const [visible,setVisible]=useState(true),[ready,setReady]=useState(false),current=useRef(true),panel=useRef(panelOpen),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),deadline=useRef(0);
 panel.current=panelOpen;
 const remember=useCallback((value:boolean)=>{current.current=value;tabVisibility=value;setVisible(value);try{sessionStorage.setItem(KEY,value?"visible":"hidden");}catch{}},[]);
 const arm=useCallback(()=>{
  clearTimeout(timer.current);if(!current.current||panel.current||document.hidden)return;
  const left=deadline.current-Date.now();if(left<=0){remember(false);return;}
  timer.current=setTimeout(()=>remember(false),left);
 },[remember]);
 const show=useCallback(()=>{remember(true);deadline.current=Date.now()+10000;arm();},[remember,arm]);
 const toggle=useCallback(()=>{if(current.current){clearTimeout(timer.current);remember(false);}else show();},[show,remember]);
 const activity=useCallback(()=>{if(current.current){deadline.current=Date.now()+10000;arm();}},[arm]);
 useLayoutEffect(()=>{
  let saved=tabVisibility;try{saved??=sessionStorage.getItem(KEY)!=="hidden";}catch{saved??=true;}
  remember(saved);setReady(true);deadline.current=Date.now()+10000;arm();
  const resume=()=>arm(),pause=()=>clearTimeout(timer.current);
  const visibility=()=>document.hidden?pause():resume();
  document.addEventListener("visibilitychange",visibility);window.addEventListener("focus",resume);window.addEventListener("pageshow",resume);window.addEventListener("pagehide",pause);
  return()=>{pause();document.removeEventListener("visibilitychange",visibility);window.removeEventListener("focus",resume);window.removeEventListener("pageshow",resume);window.removeEventListener("pagehide",pause);};
 },[arm,remember]);
 useEffect(()=>{if(panelOpen)clearTimeout(timer.current);else activity();},[panelOpen,activity]);
 return {visible,ready,show,toggle,activity};
}
