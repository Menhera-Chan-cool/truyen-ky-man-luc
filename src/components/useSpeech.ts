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
type Segment = { text: string; offset?: number };
function segments(
  root: HTMLElement | null,
  text?: string,
  start?: number,
  shortPauses = true,
): Segment[] {
  const result: Segment[] = [];
  const append = (value: string, offset?: number) => {
    let at = 0;
    for (const part of speechSegments(value, shortPauses)) {
      const found = value.indexOf(part, at);
      result.push({
        text: part,
        offset: offset === undefined ? undefined : offset + found,
      });
      at = found + part.length;
    }
  };
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
  const from = start ?? 0,
    to = text === undefined ? total : from + text.length;
  for (const el of root.querySelectorAll(selector)) {
    if (el.parentElement?.closest(selector)) continue;
    const first = document
      .createTreeWalker(el, NodeFilter.SHOW_TEXT)
      .nextNode();
    if (!first) continue;
    const offset = positions.get(first) ?? 0,
      value = el.textContent ?? "";
    const a = Math.max(0, from - offset),
      b = Math.min(value.length, to - offset);
    if (a < b) append(value.slice(a, b), offset + a);
  }
  if (!result.length && text) append(text, start);
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
) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    [playing, setPlaying] = useState(false),
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
  });
  config.current = { locale, rate, voiceName, onError, onFollow, shortPauses };
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
  }, [root]);
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
      )
        current.current.boundary = Math.max(
          0,
          Math.min(item.text.length - 1, e.charIndex),
        );
    };
    u.onstart = () => {
      if (gen !== generation.current || !running.current) return;
      clearHighlight();
      if (item.offset !== undefined && root.current) {
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
      if (gen !== generation.current || !running.current) return;
      current.current = null;
      index.current++;
      setTimeout(() => launch.current(gen), 0);
    };
    u.onerror = (e) => {
      if (
        gen !== generation.current ||
        !running.current ||
        e.error === "interrupted" ||
        e.error === "canceled"
      )
        return;
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
    const active = current.current;
    if (active) {
      const cut = active.boundary;
      queue.current[index.current] = {
        text: active.segment.text.slice(cut),
        offset:
          active.segment.offset === undefined
            ? undefined
            : active.segment.offset + cut,
      };
    }
    const gen = ++generation.current;
    current.current = null;
    window.speechSynthesis.cancel();
    launch.current(gen);
  }, [rate, voiceName, shortPauses]);
  useEffect(() => {
    stop();
  }, [locale, stop]);
  function speak(text?: string, start?: number) {
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
    queue.current = segments(root.current, text, start, shortPauses);
    if (!queue.current.length) return;
    index.current = 0;
    running.current = true;
    setPlaying(true);
    launch.current(++generation.current);
  }
  return { voices, playing, supported, speak, stop, refreshVoices };
}
