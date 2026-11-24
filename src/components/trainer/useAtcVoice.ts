"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toPhrases } from "@/lib/engine/speech";
import { VOICE_FLOOR, primeAudio, startNoise, stopNoise, type NoiseLevel } from "./radioNoise";

const vlang = (v: SpeechSynthesisVoice) => (v.lang || "").replace("_", "-").toLowerCase();

/** Prefers natural/cloud voices over compact ones. */
function quality(v: SpeechSynthesisVoice) {
  let q = 0;
  if (/natural|neural|premium|enhanced|online/i.test(v.name)) q += 4;
  if (/google/i.test(v.name)) q += 3;
  if (/siri|daniel|samantha|karen|moira|serena/i.test(v.name)) q += 2;
  if (!v.localService) q += 1;
  if (/compact|espeak/i.test(v.name)) q -= 3;
  return q;
}

export function bestVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const L = lang.toLowerCase();
  const pre = L.split("-")[0];
  const exact = voices.filter((v) => vlang(v) === L);
  const same = voices.filter((v) => vlang(v) === pre || vlang(v).startsWith(`${pre}-`));
  const pool = exact.length ? exact : same;
  return pool.length ? [...pool].sort((a, b) => quality(b) - quality(a))[0] : null;
}

/** Speaks ATC transmissions with the best voice for the wanted accent. */
export function useAtcVoice() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [supported, setSupported] = useState(true);
  const noise = useRef<NoiseLevel>(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability check
      setSupported(false);
      return;
    }
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const pick = useCallback(
    (lang: string) => bestVoice(voices, lang) ?? bestVoice(voices, "en-GB") ?? bestVoice(voices, "en"),
    [voices],
  );

  const speak = useCallback(
    (text: string, lang: string, slow: boolean) => {
      if (!supported) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      stopNoise(noise.current, false);
      const v = pick(lang);
      const level = noise.current;
      if (level) primeAudio();
      const parts = toPhrases(text);
      parts.forEach((part, i) => {
        const u = new SpeechSynthesisUtterance(part);
        u.volume = VOICE_FLOOR[level] + Math.random() * (1 - VOICE_FLOOR[level]);
        if (level && i === 0) u.onstart = () => startNoise(level);
        if (level && i === parts.length - 1) {
          u.onend = () => stopNoise(level);
          u.onerror = () => stopNoise(level, false);
        }
        if (v) {
          u.voice = v;
          u.lang = v.lang;
        } else u.lang = "en-GB";
        u.rate = slow ? 0.72 : 0.92;
        synth.speak(u);
      });
    },
    [pick, supported],
  );

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    stopNoise(noise.current, false);
  }, [supported]);

  const setNoise = useCallback((level: NoiseLevel) => {
    noise.current = level;
  }, []);

  return { supported, voices, pick, speak, stop, setNoise, hasVoiceFor: (lang: string) => !voices.length || !!bestVoice(voices, lang) };
}
