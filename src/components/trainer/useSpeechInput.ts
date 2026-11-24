"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typing for the Web Speech API recognition interface (Chrome, Edge, Safari). */
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechInputStatus = "idle" | "listening" | "denied" | "unsupported" | "error";

/** Turns the student's spoken readback into text, in English. */
export function useSpeechInput(onFinal: (text: string) => void, onEnd: () => void) {
  const [status, setStatus] = useState<SpeechInputStatus>("idle");
  const [partial, setPartial] = useState("");
  const rec = useRef<Recognition | null>(null);
  const finalCb = useRef(onFinal);
  const endCb = useRef(onEnd);
  useEffect(() => {
    finalCb.current = onFinal;
    endCb.current = onEnd;
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability check
    if (!getCtor()) setStatus("unsupported");
    return () => rec.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-GB";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalCb.current(res[0].transcript);
        else interim += res[0].transcript;
      }
      setPartial(interim);
    };
    r.onerror = (e) => setStatus(e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied" : "error");
    r.onend = () => {
      setPartial("");
      setStatus((s) => (s === "listening" ? "idle" : s));
      rec.current = null;
      endCb.current();
    };
    rec.current = r;
    setStatus("listening");
    r.start();
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);

  return { status, partial, start, stop, listening: status === "listening" };
}
