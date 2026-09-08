"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Web Speech API has vendor-prefixed + non-standard types
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition as RecognitionCtor) ?? (w.webkitSpeechRecognition as RecognitionCtor) ?? null;
}

// Only one mic session at a time across the whole OS
let activeStop: (() => void) | null = null;

export interface VoiceState {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  toggle: () => void;
}

/** Browser-native dictation. Final transcripts are delivered via onFinal. No keys, no network. */
export function useVoiceDictation(onFinal: (text: string) => void): VoiceState {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => {
      try {
        recRef.current?.abort();
      } catch {}
      recRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    if (recRef.current) {
      stop();
      return;
    }
    // stop any other field's session first
    activeStop?.();
    setError(null);
    setInterim("");
    const rec = new Ctor();
    rec.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const transcript = r[0]?.transcript ?? "";
        if (r.isFinal) {
          const clean = transcript.trim();
          if (clean) finalRef.current(clean);
        } else {
          interimText += transcript;
        }
      }
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        setError("Mic blocked — allow microphone access, then try again.");
      } else if (e?.error && e.error !== "no-speech" && e.error !== "aborted") {
        setError("Voice input hiccup — try again.");
      }
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      setInterim("");
      if (activeStop === stopRef.current) activeStop = null;
    };
    const stopRef = { current: () => {} };
    stopRef.current = () => {
      try {
        rec.stop();
      } catch {}
    };
    try {
      rec.start();
      recRef.current = rec;
      activeStop = stopRef.current;
      setListening(true);
    } catch {
      recRef.current = null;
      setListening(false);
    }
  }, [stop]);

  // keep activeStop pointing at our live stopper
  useEffect(() => {
    if (listening) activeStop = stop;
  }, [listening, stop]);

  return { supported, listening, interim, error, toggle };
}

export function MicButton({
  voice,
  size = 34,
  title = "Dictate with your voice",
}: {
  voice: VoiceState;
  size?: number;
  title?: string;
}) {
  if (!voice.supported) return null;
  return (
    <span className="relative inline-flex shrink-0 flex-col items-center">
      <button
        type="button"
        onClick={voice.toggle}
        aria-pressed={voice.listening}
        aria-label={voice.listening ? "Stop dictation" : title}
        title={voice.listening ? "Stop — tap again" : voice.error ?? title}
        className={cn(
          "relative flex items-center justify-center rounded-full border transition hover:scale-110",
          voice.listening
            ? "border-red-400/70 bg-red-500/25 text-red-200"
            : "border-white/15 bg-white/8 opacity-70 hover:opacity-100"
        )}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {voice.listening && (
          <span className="absolute inset-0 animate-ping rounded-full bg-red-500/30" style={{ animationDuration: "1.2s" }} />
        )}
        <span className="relative flex items-center gap-[2.5px]">
          {voice.listening ? (
            [0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-[2.5px] rounded-full bg-current"
                style={{ height: 6 + ((i * 5) % 9), animation: `typing-bounce 0.9s ${i * 0.12}s infinite` }}
              />
            ))
          ) : (
            <>🎙</>
          )}
        </span>
      </button>
      {voice.listening && voice.interim && (
        <span className="glass absolute bottom-full mb-1.5 max-w-[220px] truncate rounded-xl px-2.5 py-1 text-[11px] whitespace-nowrap">
          “{voice.interim}…”
        </span>
      )}
    </span>
  );
}
