"use client";

import type { ChangeEvent, ReactElement } from "react";
import { cloneElement } from "react";
import { MicButton, useVoiceDictation } from "./VoiceInput";
import { cn } from "@/lib/utils";

interface NativeFieldProps {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  className?: string;
  [k: string]: unknown;
}

/**
 * Wraps any controlled input/textarea with a mic button.
 * Dictated text appends to the current value. Renders nothing extra
 * when the browser has no speech recognition.
 *
 *   <VoiceField value={t} onText={setT} multiline>
 *     <textarea onKeyDown={...} className="..." />
 *   </VoiceField>
 */
export function VoiceField({
  value,
  onText,
  children,
  multiline = false,
  micSize = 30,
  className,
}: {
  value: string;
  onText: (v: string) => void;
  children: ReactElement<NativeFieldProps>;
  multiline?: boolean;
  micSize?: number;
  className?: string;
}) {
  const voice = useVoiceDictation((text) => {
    onText(value ? `${value.replace(/\s+$/, "")} ${text}` : text);
  });

  return (
    <span className={cn("relative block", className)}>
      {cloneElement(children, {
        value,
        onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onText(e.target.value),
        className: `${children.props.className ?? ""}${voice.supported ? (multiline ? " pb-9" : " pr-11") : ""}`,
      } as Partial<NativeFieldProps>)}
      {voice.supported && (
        <span className={cn("absolute", multiline ? "right-2 bottom-2" : "top-1/2 right-1.5 -translate-y-1/2")}>
          <MicButton voice={voice} size={micSize} />
        </span>
      )}
      {voice.listening && voice.interim && !multiline && (
        <span className="glass absolute top-full right-0 z-10 mt-1 max-w-full truncate rounded-xl px-2.5 py-1 text-[11px]">
          “{voice.interim}…”
        </span>
      )}
      {voice.error && (
        <span className="absolute top-full right-0 z-10 mt-1 rounded-xl border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-200">
          {voice.error}
        </span>
      )}
    </span>
  );
}
