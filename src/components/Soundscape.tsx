"use client";
import { useEffect, useRef, useState } from "react";
import { CloudRain, Wind, Play, Pause, Upload, Volume2 } from "lucide-react";
import { Panel } from "./Ui";
import { tx } from "../lib/content";
import type { Locale } from "../lib/types";
type Noise = "white" | "pink" | "brown" | "rain";
export default function Soundscape({
  open,
  onClose,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  locale: Locale;
}) {
  const context = useRef<AudioContext | null>(null),
    master = useRef<GainNode | null>(null),
    sources = useRef(new Map<Noise, AudioBufferSourceNode>()),
    custom = useRef<HTMLAudioElement | null>(null);
  const epoch = useRef(0),
    pending = useRef(new Map<Noise, symbol>());
  const [active, setActive] = useState<Noise[]>([]),
    [volume, setVolume] = useState(0.35),
    [error, setError] = useState(""),
    [fileName, setFileName] = useState("");
  const L = (vi: string, en: string) => tx(locale, vi, en);
  useEffect(
    () => () => {
      epoch.current++;
      pending.current.clear();
      sources.current.forEach((s) => {
        try {
          s.stop();
          s.disconnect();
        } catch {}
      });
      void context.current?.close().catch(() => {});
      if (custom.current) {
        custom.current.pause();
        URL.revokeObjectURL(custom.current.src);
      }
    },
    [],
  );
  useEffect(() => {
    if (master.current) master.current.gain.value = volume;
    if (custom.current) custom.current.volume = volume;
  }, [volume]);
  async function toggle(kind: Noise) {
    const generation = epoch.current,
      token = Symbol(kind);
    if (pending.current.has(kind)) {
      pending.current.delete(kind);
      return;
    }
    try {
      if (sources.current.has(kind)) {
        sources.current.get(kind)!.stop();
        sources.current.get(kind)!.disconnect();
        sources.current.delete(kind);
      } else {
        pending.current.set(kind, token);
        if (!context.current) {
          context.current = new AudioContext();
          master.current = context.current.createGain();
          master.current.gain.value = volume;
          master.current.connect(context.current.destination);
        }
        const ctx = context.current;
        await ctx.resume();
        if (generation !== epoch.current || pending.current.get(kind) !== token)
          return;
        const buffer = ctx.createBuffer(2, ctx.sampleRate * 6, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const samples = buffer.getChannelData(ch);
          let brown = 0,
            b0 = 0,
            b1 = 0,
            b2 = 0;
          for (let i = 0; i < samples.length; i++) {
            const white = Math.random() * 2 - 1;
            if (kind === "brown") {
              brown = (brown + 0.02 * white) / 1.02;
              samples[i] = brown * 3.5;
            } else if (kind === "pink") {
              b0 = 0.99765 * b0 + white * 0.099046;
              b1 = 0.963 * b1 + white * 0.2965164;
              b2 = 0.57 * b2 + white * 1.0526913;
              samples[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
            } else
              samples[i] =
                white *
                (kind === "rain"
                  ? 0.2 + 0.1 * Math.sin((i / ctx.sampleRate) * 2)
                  : 0.22);
          }
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(master.current!);
        source.start();
        sources.current.set(kind, source);
      }
      setActive([...sources.current.keys()]);
      setError("");
    } catch {
      if (generation === epoch.current && pending.current.get(kind) === token)
        setError(
          L(
            "Không thể phát âm thanh trên trình duyệt này.",
            "Audio playback is unavailable in this browser.",
          ),
        );
    } finally {
      if (pending.current.get(kind) === token) pending.current.delete(kind);
    }
  }
  function stopAll() {
    epoch.current++;
    pending.current.clear();
    sources.current.forEach((s) => {
      try {
        s.stop();
        s.disconnect();
      } catch {}
    });
    sources.current.clear();
    setActive([]);
    custom.current?.pause();
  }
  async function preset(types: Noise[]) {
    stopAll();
    const generation = epoch.current;
    for (const type of types) {
      if (generation !== epoch.current) return;
      await toggle(type);
    }
  }
  async function ownFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setError(L("Hãy chọn file âm thanh.", "Choose an audio file."));
      return;
    }
    if (custom.current) {
      custom.current.pause();
      URL.revokeObjectURL(custom.current.src);
    }
    const generation = epoch.current;
    custom.current = new Audio(URL.createObjectURL(file));
    const audio = custom.current;
    custom.current.loop = true;
    custom.current.volume = volume;
    setFileName(file.name);
    try {
      await custom.current.play();
      if (generation !== epoch.current || custom.current !== audio)
        audio.pause();
    } catch {
      if (generation === epoch.current && custom.current === audio)
        setError(
          L(
            "Không phát được file âm thanh này.",
            "This audio file could not be played.",
          ),
        );
    }
  }
  if (!open) return null;
  return (
    <Panel
      title={L("Âm thanh môi trường", "Ambient sounds")}
      onClose={onClose}
      closeLabel={L("Đóng", "Close")}
    >
      <p className="muted">
        {L(
          "Phối âm thanh cho khoảng đọc của bạn.",
          "Make a little room for reading.",
        )}
      </p>
      <label className="field-group range-label">
        <span>
          <Volume2 size={15} /> {L("Âm lượng", "Volume")}
        </span>
        <output>{Math.round(volume * 100)}%</output>
        <input
          type="range"
          min="0"
          max="1"
          step=".01"
          value={volume}
          onChange={(e) => setVolume(+e.target.value)}
        />
      </label>
      <div className="sound-presets">
        <button onClick={() => preset(["pink"])}>Pink Focus</button>
        <button onClick={() => preset(["brown", "rain"])}>Brown Cozy</button>
        <button onClick={stopAll}>{L("Dừng tất cả", "Stop all")}</button>
      </div>
      <div className="sound-list">
        {(["white", "pink", "brown", "rain"] as Noise[]).map((kind, i) => {
          const Icon = kind === "rain" ? CloudRain : Wind;
          return (
            <button
              key={kind}
              onClick={() => toggle(kind)}
              aria-pressed={active.includes(kind)}
            >
              <Icon size={21} />
              <span>
                {
                  [
                    L("Nhiễu trắng", "White noise"),
                    L("Nhiễu hồng · Tập trung", "Pink noise · Focus"),
                    L("Nhiễu nâu · Ấm áp", "Brown noise · Cozy"),
                    L("Mưa", "Rain"),
                  ][i]
                }
              </span>
              {active.includes(kind) ? <Pause size={16} /> : <Play size={16} />}
            </button>
          );
        })}
      </div>
      <label className="file-button">
        <Upload size={16} />
        {L("Chọn âm thanh trên thiết bị", "Choose audio from this device")}
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => ownFile(e.target.files?.[0])}
        />
      </label>
      {fileName && (
        <div className="custom-audio">
          <span>{fileName}</span>
          <button
            onClick={() =>
              custom.current?.paused
                ? custom.current.play()
                : custom.current?.pause()
            }
          >
            {L("Phát / Tạm dừng", "Play / Pause")}
          </button>
        </div>
      )}
      <p className="tiny muted">
        {L(
          "Âm thanh riêng chỉ phát trên thiết bị, không tải lên máy chủ.",
          "Your audio stays on this device and is never uploaded.",
        )}
      </p>
      {error && <p role="alert">{error}</p>}
    </Panel>
  );
}
