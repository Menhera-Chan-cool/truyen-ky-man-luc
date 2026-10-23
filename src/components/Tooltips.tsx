"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export default function Tooltips() {
  const [tip, setTip] = useState<{
    label: string;
    x: number;
    y: number;
  } | null>(null);
  const bubble = useRef<HTMLDivElement>(null),
    anchor = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!tip || !bubble.current || !anchor.current) return;
    const rect = anchor.current.getBoundingClientRect(),
      box = bubble.current.getBoundingClientRect();
    bubble.current.style.left =
      Math.max(
        8 + box.width / 2,
        Math.min(innerWidth - 8 - box.width / 2, rect.left + rect.width / 2),
      ) + "px";
    bubble.current.style.top =
      (rect.bottom + box.height + 12 < innerHeight
        ? rect.bottom + 8
        : Math.max(8, rect.top - box.height - 8)) + "px";
  }, [tip]);
  useEffect(() => {
    let opening: ReturnType<typeof setTimeout>,
      closing: ReturnType<typeof setTimeout>,
      touch = false;
    const clear = () => {
      clearTimeout(opening);
      clearTimeout(closing);
    };
    const dismiss = () => {
      clear();
      anchor.current = null;
      setTip(null);
    };
    const show = (target: EventTarget | null, immediate = false) => {
      const element =
        target instanceof Element
          ? target.closest<HTMLElement>("[data-tooltip]")
          : null;
      if (!element || element.matches(":disabled") || !element.dataset.tooltip)
        return;
      clear();
      if (anchor.current === element) return;
      const display = () => {
        const rect = element.getBoundingClientRect();
        anchor.current = element;
        setTip({
          label: element.dataset.tooltip!,
          x: rect.left + rect.width / 2,
          y: rect.bottom + 8,
        });
      };
      if (anchor.current || immediate) display();
      else opening = setTimeout(display, 160);
    };
    const over = (e: PointerEvent) => {
      if (e.pointerType !== "touch") show(e.target);
    };
    const out = (e: PointerEvent) => {
      const from =
        e.target instanceof Element ? e.target.closest("[data-tooltip]") : null;
      const to =
        e.relatedTarget instanceof Element
          ? e.relatedTarget.closest("[data-tooltip]")
          : null;
      if (from && from !== to) {
        clearTimeout(opening);
        closing = setTimeout(dismiss, 80);
      }
    };
    const focus = (e: FocusEvent) => {
      if (!touch) show(e.target, true);
    };
    const down = (e: PointerEvent) => {
      touch = e.pointerType === "touch";
      if (touch) dismiss();
    };
    const key = (e: KeyboardEvent) => {
      touch = false;
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", dismiss);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      clear();
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", dismiss);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, []);
  return tip ? (
    <div
      ref={bubble}
      role="tooltip"
      className="app-tooltip"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.label}
    </div>
  ) : null;
}
