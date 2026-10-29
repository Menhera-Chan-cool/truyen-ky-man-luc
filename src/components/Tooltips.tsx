"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export default function Tooltips() {
  const tooltipId = useId();
  const [tip, setTip] = useState<{
    label: string;
    x: number;
    y: number;
    footnote: boolean;
    pinned: boolean;
  } | null>(null);
  const bubble = useRef<HTMLDivElement>(null),
    anchor = useRef<HTMLElement | null>(null);
  const pinned = useRef(false),
    close = useRef(() => {});
  useEffect(() => {
    const element = anchor.current;
    if (!tip || !element) return;
    if (element.dataset.tooltip !== tip.label)
      setTip((old) =>
        element.dataset.tooltip && old
          ? { ...old, label: element.dataset.tooltip }
          : null,
      );
    const observer = new MutationObserver(() => {
      const label = element.dataset.tooltip;
      setTip((old) => (label && old ? { ...old, label } : null));
    });
    observer.observe(element, {
      attributes: true,
      attributeFilter: ["data-tooltip"],
    });
    return () => observer.disconnect();
  }, [tip?.x, tip?.y]);
  useLayoutEffect(() => {
    if (!tip || !bubble.current || !anchor.current) return;
    const rect = anchor.current.getBoundingClientRect(),
      box = bubble.current.getBoundingClientRect();
    const theme = getComputedStyle(anchor.current);
    bubble.current.style.setProperty(
      "--note-bg",
      theme.getPropertyValue("--reader-bg"),
    );
    bubble.current.style.setProperty(
      "--note-fg",
      theme.getPropertyValue("--reader-fg"),
    );
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
    let noteTouch: {
      element: HTMLElement;
      id: number;
      x: number;
      y: number;
      time: number;
      wasOpen: boolean;
    } | null = null;
    let handledNote: HTMLElement | null = null,
      handledUntil = 0;
    const clear = () => {
      clearTimeout(opening);
      clearTimeout(closing);
    };
    const dismiss = () => {
      clear();
      if (anchor.current?.getAttribute("aria-describedby") === tooltipId)
        anchor.current.removeAttribute("aria-describedby");
      anchor.current = null;
      pinned.current = false;
      setTip(null);
    };
    close.current = () => {
      const element = anchor.current;
      dismiss();
      touch = true;
      element?.focus({ preventScroll: true });
    };
    const show = (
      target: EventTarget | null,
      immediate = false,
      pin = false,
    ) => {
      const element =
        target instanceof Element
          ? target.closest<HTMLElement>("[data-tooltip]")
          : null;
      if (!element || element.matches(":disabled") || !element.dataset.tooltip)
        return;
      clear();
      if (anchor.current === element && pinned.current === pin) return;
      const display = () => {
        const rect = element.getBoundingClientRect();
        if (anchor.current?.getAttribute("aria-describedby") === tooltipId)
          anchor.current.removeAttribute("aria-describedby");
        anchor.current = element;
        pinned.current = pin;
        if (element.dataset.footnote)
          element.setAttribute("aria-describedby", tooltipId);
        setTip({
          label: element.dataset.tooltip!,
          x: rect.left + rect.width / 2,
          y: rect.bottom + 8,
          footnote: element.dataset.footnote === "true",
          pinned: pin,
        });
      };
      if (anchor.current || immediate) display();
      else opening = setTimeout(display, 160);
    };
    const over = (e: PointerEvent) => {
      if (e.target instanceof Node && bubble.current?.contains(e.target)) {
        clearTimeout(closing);
        return;
      }
      if (!pinned.current && e.pointerType !== "touch") show(e.target);
    };
    const out = (e: PointerEvent) => {
      if (pinned.current) return;
      if (
        e.relatedTarget instanceof Node &&
        bubble.current?.contains(e.relatedTarget)
      )
        return;
      if (e.target instanceof Node && bubble.current?.contains(e.target)) {
        closing = setTimeout(dismiss, 80);
        return;
      }
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
      if (!touch && !pinned.current) show(e.target, true);
    };
    const blur = () => {
      if (!pinned.current) dismiss();
    };
    const down = (e: PointerEvent) => {
      touch = e.pointerType === "touch";
      noteTouch = null;
      if (e.target instanceof Node && bubble.current?.contains(e.target))
        return;
      const element =
        e.target instanceof Element
          ? e.target.closest<HTMLElement>('[data-footnote="true"]')
          : null;
      if (touch && e.isPrimary && element) {
        noteTouch = {
          element,
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          time: e.timeStamp,
          wasOpen: pinned.current && anchor.current === element,
        };
      }
      if (touch || pinned.current) {
        if (!noteTouch?.wasOpen) dismiss();
      }
    };
    const up = (e: PointerEvent) => {
      const start = noteTouch;
      noteTouch = null;
      if (!start || start.id !== e.pointerId) return;
      handledNote = start.element;
      handledUntil = performance.now() + 700;
      if (
        Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12 ||
        e.timeStamp - start.time > 600 ||
        window.getSelection()?.isCollapsed === false ||
        !(e.target instanceof Node && start.element.contains(e.target))
      )
        return;
      e.preventDefault();
      if (start.wasOpen) dismiss();
      else show(start.element, true, true);
    };
    const cancelTouch = () => {
      noteTouch = null;
    };
    const click = (e: MouseEvent) => {
      const element =
        e.target instanceof Element
          ? e.target.closest<HTMLElement>('[data-footnote="true"]')
          : null;
      if (
        !element ||
        (!touch && !matchMedia("(hover: none) and (pointer: coarse)").matches)
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      if (
        (e as PointerEvent).pointerType !== "mouse" &&
        e.detail !== 0 &&
        handledNote === element &&
        performance.now() < handledUntil
      )
        return;
      show(element, true, true);
    };
    const key = (e: KeyboardEvent) => {
      touch = false;
      if (["Escape", "ArrowLeft", "ArrowRight"].includes(e.key)) dismiss();
    };
    const scroll = (e: Event) => {
      if (!(e.target instanceof Node && bubble.current?.contains(e.target)))
        dismiss();
    };
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", blur);
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", cancelTouch);
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("popstate", dismiss);
    return () => {
      clear();
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", blur);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancelTouch);
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("popstate", dismiss);
    };
  }, [tooltipId]);
  return tip ? (
    <div
      ref={bubble}
      id={tooltipId}
      role={tip.pinned ? "dialog" : "tooltip"}
      aria-label={
        tip.pinned
          ? document.documentElement.lang === "vi"
            ? "Chú thích"
            : "Footnote"
          : undefined
      }
      className={`app-tooltip${tip.footnote ? " footnote-tooltip" : ""}${tip.pinned ? " is-pinned" : ""}`}
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.pinned && (
        <button
          className="footnote-preview-close"
          aria-label={
            document.documentElement.lang === "vi"
              ? "Đóng chú thích"
              : "Close footnote"
          }
          onClick={() => close.current()}
        >
          <X size={18} />
        </button>
      )}
      {tip.label}
    </div>
  ) : null;
}
