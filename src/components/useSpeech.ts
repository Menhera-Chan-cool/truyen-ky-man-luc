"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { speechSegments } from "../lib/reader";
import type { Locale } from "../lib/types";
export function useSpeech(
  root: RefObject<HTMLElement | null>,
  locale: Locale,
  rate: number,
  voiceName: string,
  onError: (s: string) => void,
) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    [playing, setPlaying] = useState(false),
    [supported, setSupported] = useState(false);
  const generation = useRef(0);
  const current = useRef<SpeechSynthesisUtterance | null>(null);
  const refreshVoices = useCallback(() => {
    if (!("speechSynthesis" in window)) return [];
    const available = window.speechSynthesis
      .getVoices()
      .filter((v) => /^(vi|en)([-_]|$)/i.test(v.lang));
    setVoices(available);
    return available;
  }, []);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    setSupported(true);
    refreshVoices();
    // Some mobile engines populate voices late without sending voiceschanged.
    const timers = [250, 1000, 2500].map((delay) =>
      setTimeout(refreshVoices, delay),
    );
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    window.addEventListener("focus", refreshVoices);
    window.addEventListener("pageshow", refreshVoices);
    return () => {
      generation.current++;
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
  function stop() {
    generation.current++;
    window.speechSynthesis?.cancel();
    root.current
      ?.querySelectorAll(".speaking")
      .forEach((el) => el.classList.remove("speaking"));
    setPlaying(false);
  }
  function speak(text?: string) {
    stop();
    if (!("speechSynthesis" in window)) {
      onError(
        locale === "vi"
          ? "Trình duyệt này không hỗ trợ đọc giọng nói."
          : "This browser does not support speech synthesis.",
      );
      return;
    }
    const available = refreshVoices();
    const blocks = text
      ? [{ text, element: null }]
      : Array.from(
          root.current?.querySelectorAll(
            "h2,h3,p,li:not(:has(p)),figcaption",
          ) ?? [],
        ).map((element) => ({ text: element.textContent ?? "", element }));
    const queue = blocks.flatMap((block) =>
      speechSegments(block.text).map((text) => ({ ...block, text })),
    );
    if (!queue.length) return;
    const gen = ++generation.current;
    let index = 0;
    setPlaying(true);
    const run = () => {
      if (gen !== generation.current) return;
      if (index >= queue.length) {
        stop();
        return;
      }
      const item = queue[index++];
      const utterance = new SpeechSynthesisUtterance(item.text);
      current.current = utterance;
      utterance.lang = locale === "vi" ? "vi-VN" : "en-US";
      utterance.rate = rate;
      const voice =
        available.find(
          (v) =>
            v.name === voiceName && v.lang.toLowerCase().startsWith(locale),
        ) ?? available.find((v) => v.lang.toLowerCase().startsWith(locale));
      if (voice) utterance.voice = voice;
      utterance.onstart = () => {
        root.current
          ?.querySelectorAll(".speaking")
          .forEach((el) => el.classList.remove("speaking"));
        item.element?.classList.add("speaking");
        item.element?.scrollIntoView({
          block: "center",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        });
      };
      utterance.onend = () => setTimeout(run, 0);
      utterance.onerror = (e) => {
        if (gen !== generation.current) return;
        if (e.error !== "interrupted" && e.error !== "canceled") {
          stop();
          onError(
            e.error === "language-unavailable" ||
              e.error === "voice-unavailable"
              ? locale === "vi"
                ? "Thiết bị không có giọng đọc cho ngôn ngữ này. Hãy cài dữ liệu giọng đọc rồi làm mới danh sách."
                : "No device voice is available for this language. Install voice data, then refresh the list."
              : locale === "vi"
                ? "Không phát được giọng đọc. Hãy thử giọng khác."
                : "Unable to play this voice. Please try another voice.",
          );
        }
      };
      window.speechSynthesis.speak(utterance);
    };
    run();
  }
  return { voices, playing, supported, speak, stop, refreshVoices };
}
