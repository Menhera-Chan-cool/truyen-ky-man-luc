"use client";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { Component, Suspense, useEffect, useRef, useState, useId, useLayoutEffect, type ReactNode } from "react";
export class ModuleBoundary extends Component<
  { locale: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    const vi = this.props.locale === "vi";
    if (this.state.failed)
      return (
        <div role="alert" className="module-loading">
          <p>
            {vi
              ? "Không tải được công cụ. Hãy tải lại trang để thử lại."
              : "The tool could not load. Reload the page to retry."}
          </p>
          <button
            className="secondary-button"
            onClick={() => window.location.reload()}
          >
            {vi ? "Tải lại" : "Reload"}
          </button>
        </div>
      );
    return (
      <Suspense
        fallback={
          <div className="module-loading" role="status">
            {vi ? "Đang tải công cụ…" : "Loading tool…"}
          </div>
        }
      >
        {this.props.children}
      </Suspense>
    );
  }
}
export function IconButton({
  icon: Icon,
  label,
  active,
  children,
  ...props
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  children?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "active" : ""}`}
      data-tooltip={label}
      aria-label={label}
      aria-pressed={active}
      {...props}
    >
      <Icon size={19} strokeWidth={1.6} />
      {children}
    </button>
  );
}
export function Panel({
  title,
  onClose,
  children,
  closeLabel = "Close",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    const panel = ref.current?.closest(".reader-panel");
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("dialog")) return;
      if (e.key === "Escape" && !e.isComposing) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      if (
        document.activeElement === document.body ||
        panel?.contains(document.activeElement)
      )
        old?.focus();
    };
  }, [onClose]);
  return (
    <section className="reader-panel" aria-label={title}>
      <div ref={ref} tabIndex={-1} className="panel-heading">
        <h2>{title}</h2>
        <IconButton icon={X} label={closeLabel} onClick={onClose} />
      </div>
      {children}
    </section>
  );
}
export function LanguageLinks({locale,chapterId,admin=false,disabled=false,comic=false,onNavigate}: {
  locale:string;chapterId?:string;admin?:boolean;disabled?:boolean;comic?:boolean;onNavigate?:()=>boolean;
}) {
  const [open,setOpen]=useState<"vi"|"en"|null>(null),id=useId();
  const nav=useRef<HTMLElement>(null),popup=useRef<HTMLDivElement>(null),buttons=useRef<Record<string,HTMLButtonElement|null>>({});
  const closing=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),focusFirst=useRef(false),pointer=useRef("");
  const clearClose=()=>clearTimeout(closing.current);
  const show=(lang:"vi"|"en")=>{clearClose();if(!disabled)setOpen(lang);};
  useEffect(()=>()=>clearTimeout(closing.current),[]);
  useEffect(()=>{if(disabled)setOpen(null);},[disabled]);
  useEffect(()=>{
    if(!open)return;
    const outside=(e:Event)=>{if(e.target instanceof Node&&!nav.current?.contains(e.target))setOpen(null);};
    const close=()=>setOpen(null);
    document.addEventListener("pointerdown",outside);document.addEventListener("focusin",outside);
    window.addEventListener("blur",close);window.addEventListener("resize",close);document.addEventListener("scroll",close,true);
    return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("focusin",outside);window.removeEventListener("blur",close);window.removeEventListener("resize",close);document.removeEventListener("scroll",close,true);};
  },[open]);
  useLayoutEffect(()=>{
    const menu=popup.current,button=open&&buttons.current[open];if(!menu||!button)return;
    if(!menu.matches(":popover-open"))menu.showPopover();
    const rect=button.getBoundingClientRect(),box=menu.getBoundingClientRect();
    menu.style.left=Math.max(8,Math.min(innerWidth-box.width-8,rect.right-box.width))+"px";
    menu.style.top=(rect.bottom+box.height+5<innerHeight?rect.bottom+5:Math.max(8,rect.top-box.height-5))+"px";
    if(focusFirst.current){focusFirst.current=false;menu.querySelector<HTMLAnchorElement>('a[aria-current],a')?.focus({preventScroll:true});}
  },[open]);
  const href=(lang:string,mode:"novel"|"comic")=>admin
    ? mode==="comic"?`/admin/comic?lang=${lang}&chapter=${chapterId??"chapter-1"}`: `/admin?lang=${lang}${chapterId?"&chapter="+chapterId:""}`
    : mode==="comic"?`/${lang}/comic/${chapterId??"chapter-1"}`: `/${lang}${chapterId?"/read/"+chapterId:""}`;
  return <nav ref={nav} className="language-switch edition-switch" data-edition-open={!!open}
    aria-label={admin?(locale==="vi"?"Ngôn ngữ & bản biên tập":"Language and editing edition"):(locale==="vi"?"Phiên bản đọc":"Reading edition")}
    onPointerEnter={clearClose} onPointerLeave={e=>{if(e.pointerType==="mouse")closing.current=setTimeout(()=>setOpen(null),120);}}
    onKeyDown={e=>{if(e.key==="Escape"&&open){e.preventDefault();e.stopPropagation();const button=buttons.current[open];setOpen(null);button?.focus({preventScroll:true});}}}>
    {(["vi","en"] as const).map((lang,n)=><span className="edition-language" key={lang}>
      {n>0&&<span className="edition-divider" aria-hidden="true"/>}
      <button ref={el=>{buttons.current[lang]=el;}} type="button" id={id+lang} className="edition-trigger"
        aria-label={lang==="vi"?"Tiếng Việt":"English"} aria-haspopup="menu" aria-expanded={open===lang} aria-controls={open===lang?id+"menu":undefined}
        aria-current={locale===lang?"page":undefined} disabled={disabled}
        onPointerDown={e=>{pointer.current=e.pointerType;}} onPointerEnter={e=>{if(e.pointerType==="mouse")show(lang);}}
        onClick={e=>{focusFirst.current=e.detail===0;clearClose();setOpen(old=>(e.detail===0||pointer.current==="touch")&&old===lang?null:lang);}}
        onKeyDown={e=>{if(e.key==="ArrowDown"){e.preventDefault();focusFirst.current=true;if(open===lang)popup.current?.querySelector<HTMLAnchorElement>("a")?.focus();else show(lang);}}}>
        {lang.toUpperCase()}
      </button>
    </span>)}
    {open&&<div ref={popup} id={id+"menu"} popover="manual" className="edition-options" role="menu" aria-labelledby={id+open}
      onPointerEnter={clearClose} onKeyDown={e=>{
        const items=[...e.currentTarget.querySelectorAll<HTMLAnchorElement>("a")],at=items.indexOf(document.activeElement as HTMLAnchorElement);
        if(["ArrowDown","ArrowUp","Home","End"].includes(e.key)){e.preventDefault();items[e.key==="Home"?0:e.key==="End"?items.length-1:(at+(e.key==="ArrowDown"?1:-1)+items.length)%items.length]?.focus({preventScroll:true});}
      }}>
      {(["novel","comic"] as const).map(mode=><a key={mode} role="menuitem" href={href(open,mode)} hrefLang={open} lang={open}
        aria-current={locale===open&&(comic?mode==="comic":mode==="novel")?"page":undefined}
        onClick={e=>{if(disabled||onNavigate?.()===false){e.preventDefault();return;}window.speechSynthesis?.cancel();setOpen(null);}}>
        {mode==="novel"?"Novel":open==="vi"?"TT":"Comic"}
      </a>)}
    </div>}
  </nav>;
}
