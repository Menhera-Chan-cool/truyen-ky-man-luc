"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { rangeFromOffsets, speechSegments, speechText } from "../lib/reader";
import type { Locale } from "../lib/types";
import { footnoteSpeechText } from "../lib/footnotes";
type Segment = { text: string; offset?: number; plain?: boolean };
function segments(
  root: HTMLElement | null,
  text?: string,
  start?: number,
  shortPauses = true,
  plain = false,
): Segment[] {
  const result: Segment[] = [];
  const append = (value: string, offset?: number) => {
    let at = 0;
    for (const part of speechSegments(value, shortPauses)) {
      const found = value.indexOf(part, at);
      result.push({
        text: part,
        offset: offset === undefined ? undefined : offset + found,
        ...(plain ? { plain: true } : {}),
      });
      at = found + part.length;
    }
  };
  if (plain) {
    if (text) append(text.slice(start ?? 0), start ?? 0);
    return result;
  }
  if (!root || (text !== undefined && start === undefined)) {
    if (text) append(text);
    return result;
  }
  const positions = new Map<Node, number>();
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null,
    total = 0;
  while ((node = walk.nextNode())) {
    positions.set(node, total);
    total += node.textContent?.length ?? 0;
  }
  const selector = "h2,h3,p,li:not(:has(p)),figcaption";
  const spoken = footnoteSpeechText(root);
  const from = start ?? 0,
    to = text === undefined ? total : from + text.length;
  for (const el of root.querySelectorAll(selector)) {
    if (el.parentElement?.closest(selector)) continue;
    const first = document
      .createTreeWalker(el, NodeFilter.SHOW_TEXT)
      .nextNode();
    if (!first) continue;
    const offset = positions.get(first) ?? 0,
      value = spoken.slice(offset, offset + (el.textContent?.length ?? 0));
    const a = Math.max(0, from - offset),
      b = Math.min(value.length, to - offset);
    if (a < b) append(value.slice(a, b), offset + a);
  }
  if (!result.length && text) append(spoken.slice(from, to), start);
  return result;
}
export function useSpeech(
  root: RefObject<HTMLElement | null>,
  locale: Locale,
  rate: number,
  voiceName: string,
  onError: (s: string) => void,
  onFollow?: (offset: number) => void,
  shortPauses = true,
  onCheckpoint?: (offset: number, completed: boolean, plain: boolean) => void,
) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    [playing, setPlaying] = useState(false),
    [paused, setPaused] = useState(false),
    [supported, setSupported] = useState(false);
  const generation = useRef(0),
    queue = useRef<Segment[]>([]),
    index = useRef(0),
    running = useRef(false);
  const current = useRef<{
    utterance: SpeechSynthesisUtterance;
    segment: Segment;
    boundary: number;
  } | null>(null);
  const config = useRef({
    locale,
    rate,
    voiceName,
    onError,
    onFollow,
    shortPauses,
    onCheckpoint,
  });
  config.current = {
    locale,
    rate,
    voiceName,
    onError,
    onFollow,
    shortPauses,
    onCheckpoint,
  };
  const refreshVoices = useCallback(() => {
    if (!("speechSynthesis" in window)) return [];
    const list = window.speechSynthesis
      .getVoices()
      .filter((v) => /^(vi|en)([-_]|$)/i.test(v.lang));
    setVoices(list);
    return list;
  }, []);
  function clearHighlight() {
    root.current
      ?.querySelectorAll(".speaking")
      .forEach((el) => el.classList.remove("speaking"));
  }
  const stop = useCallback(() => {
    generation.current++;
    running.current = false;
    queue.current = [];
    index.current = 0;
    current.current = null;
    window.speechSynthesis?.cancel();
    root.current
      ?.querySelectorAll(".speaking")
      .forEach((el) => el.classList.remove("speaking"));
    setPlaying(false);
    setPaused(false);
  }, [root]);
  function rememberCurrent() {
    const active = current.current;
    if (active) {
      const cut = active.boundary;
      queue.current[index.current] = {
        ...active.segment,
        text: active.segment.text.slice(cut),
        offset:
          active.segment.offset === undefined
            ? undefined
            : active.segment.offset + cut,
      };
    }
    current.current = null;
  }
  function pause() {
    if (!running.current) return;
    generation.current++;
    running.current = false;
    rememberCurrent();
    window.speechSynthesis.cancel();
    clearHighlight();
    setPlaying(false);
    setPaused(index.current < queue.current.length);
  }
  const launch = useRef<(gen: number) => void>(() => {});
  launch.current = (gen) => {
    if (gen !== generation.current || !running.current) return;
    const item = queue.current[index.current];
    if (!item) {
      stop();
      return;
    }
    const c = config.current,
      u = new SpeechSynthesisUtterance(speechText(item.text, c.shortPauses));
    const available = window.speechSynthesis
      .getVoices()
      .filter((v) => v.lang.toLowerCase().startsWith(c.locale));
    u.lang = c.locale === "vi" ? "vi-VN" : "en-US";
    u.rate = c.rate;
    const voice = available.find((v) => v.name === c.voiceName) ?? available[0];
    if (voice) u.voice = voice;
    current.current = { utterance: u, segment: item, boundary: 0 };
    u.onboundary = (e) => {
      if (
        gen === generation.current &&
        current.current?.utterance === u &&
        Number.isInteger(e.charIndex)
      ) {
        current.current.boundary = Math.max(
          0,
          Math.min(item.text.length - 1, e.charIndex),
        );
        if (item.offset !== undefined)
          c.onCheckpoint?.(
            item.offset + current.current.boundary,
            false,
            !!item.plain,
          );
      }
    };
    u.onstart = () => {
      if (
        gen !== generation.current ||
        !running.current ||
        current.current?.utterance !== u
      )
        return;
      clearHighlight();
      if (item.offset !== undefined)
        c.onCheckpoint?.(item.offset, false, !!item.plain);
      if (item.offset !== undefined && !item.plain && root.current) {
        const range = rangeFromOffsets(
          root.current,
          item.offset,
          item.offset + 1,
        );
        const el = range?.startContainer.parentElement?.closest(
          "p,li,h2,h3,figcaption",
        );
        el?.classList.add("speaking");
        if (c.onFollow) c.onFollow(item.offset);
        else
          el?.scrollIntoView({
            block: "center",
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
          });
      }
    };
    u.onend = () => {
      if (
        gen !== generation.current ||
        !running.current ||
        current.current?.utterance !== u
      )
        return;
      current.current = null;
      index.current++;
      if (index.current === queue.current.length && item.offset !== undefined)
        c.onCheckpoint?.(item.offset + item.text.length, true, !!item.plain);
      setTimeout(() => launch.current(gen), 0);
    };
    u.onerror = (e) => {
      if (
        gen !== generation.current ||
        !running.current ||
        current.current?.utterance !== u
      )
        return;
      if (e.error === "interrupted" || e.error === "canceled") {
        pause();
        c.onError(
          c.locale === "vi"
            ? "Giọng đọc bị ngắt. Bấm Tiếp tục đọc để nghe tiếp."
            : "Speech was interrupted. Choose Resume reading to continue.",
        );
        return;
      }
      stop();
      const unavailable =
        e.error === "language-unavailable" || e.error === "voice-unavailable";
      c.onError(
        unavailable
          ? c.locale === "vi"
            ? "Thiết bị không có giọng đọc cho ngôn ngữ này. Hãy cài dữ liệu giọng đọc rồi làm mới danh sách."
            : "No device voice is available for this language. Install voice data, then refresh the list."
          : c.locale === "vi"
            ? "Không phát được giọng đọc. Hãy thử giọng khác."
            : "Unable to play this voice. Please try another voice.",
      );
    };
    window.speechSynthesis.speak(u);
  };
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    setSupported(true);
    refreshVoices();
    const timers = [250, 1000, 2500].map((delay) =>
      setTimeout(refreshVoices, delay),
    );
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    window.addEventListener("focus", refreshVoices);
    window.addEventListener("pageshow", refreshVoices);
    return () => {
      generation.current++;
      running.current = false;
      window.speechSynthesis.cancel();
      timers.forEach(clearTimeout);
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        refreshVoices,
      );
      window.removeEventListener("focus", refreshVoices);
      window.removeEventListener("pageshow", refreshVoices);
    };
  }, [refreshVoices]);
  useEffect(() => {
    if (!running.current) return;
    rememberCurrent();
    const gen = ++generation.current;
    window.speechSynthesis.cancel();
    launch.current(gen);
  }, [rate, voiceName, shortPauses]);
  useEffect(() => {
    stop();
  }, [locale, stop]);
  function resume() {
    if (running.current || index.current >= queue.current.length) return;
    running.current = true;
    setPaused(false);
    setPlaying(true);
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    launch.current(++generation.current);
  }
  function speak(text?: string, start?: number, plain = false) {
    stop();
    if (!("speechSynthesis" in window)) {
      onError(
        locale === "vi"
          ? "Trình duyệt này không hỗ trợ đọc giọng nói."
          : "This browser does not support speech synthesis.",
      );
      return;
    }
    refreshVoices();
    queue.current = segments(root.current, text, start, shortPauses, plain);
    if (!queue.current.length) return;
    index.current = 0;
    running.current = true;
    setPlaying(true);
    launch.current(++generation.current);
  }
  return {
    voices,
    playing,
    paused,
    supported,
    speak,
    pause,
    resume,
    stop,
    refreshVoices,
  };
}
