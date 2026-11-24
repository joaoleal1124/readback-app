"use client";
/**
 * Radio background noise played with the Web Audio API while the ATC voice speaks.
 * The browser's speech synthesis can't be routed through Web Audio, so the noise
 * runs alongside it: band-limited hiss, squelch clicks at start and end, and at
 * higher levels the voice itself fades in and out.
 */

export const NOISE_LEVELS = [0, 1, 2, 3] as const;
export type NoiseLevel = (typeof NOISE_LEVELS)[number];

const HISS = [0, 0.035, 0.08, 0.15];
/** Lowest voice volume for each level; each phrase gets a random volume between this and 1. */
export const VOICE_FLOOR = [1, 1, 0.8, 0.55];

let ctx: AudioContext | null = null;
let current: { src: AudioBufferSourceNode; gain: GainNode; crackle?: number } | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function whiteNoise(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** A short burst of noise, like a squelch opening or closing. */
function click(c: AudioContext, level: NoiseLevel) {
  const src = c.createBufferSource();
  src.buffer = whiteNoise(c, 0.08);
  const g = c.createGain();
  g.gain.setValueAtTime(Math.min(0.35, HISS[level] * 3), c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
  src.connect(g).connect(c.destination);
  src.start();
}

/** Unlocks audio while we are still inside the click that asked for speech. */
export function primeAudio() {
  audio();
}

export function startNoise(level: NoiseLevel) {
  stopNoise(level, false);
  if (!level) return;
  const c = audio();
  if (!c) return;
  click(c, level);
  const src = c.createBufferSource();
  src.buffer = whiteNoise(c, 2);
  src.loop = true;
  // radio voice band
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 300;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 3200;
  const gain = c.createGain();
  gain.gain.value = HISS[level];
  src.connect(hp).connect(lp).connect(gain).connect(c.destination);
  src.start();
  // strong noise: the hiss surges now and then
  const crackle =
    level >= 2
      ? window.setInterval(() => {
          const t = c.currentTime;
          gain.gain.setTargetAtTime(HISS[level] * (0.6 + Math.random() * 1.2), t, 0.05);
        }, 350)
      : undefined;
  current = { src, gain, crackle };
}

export function stopNoise(level: NoiseLevel, withClick = true) {
  if (!current) return;
  const { src, crackle } = current;
  current = null;
  if (crackle) window.clearInterval(crackle);
  try {
    src.stop();
  } catch {}
  const c = audio();
  if (c && withClick && level) click(c, level);
}
