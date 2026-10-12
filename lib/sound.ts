"use client";

/** Tiny synthesized sound effects, so there are no audio files to ship. */

let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = typeof localStorage !== "undefined" && localStorage.getItem("blackjak:muted") === "1";
} catch {}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem("blackjak:muted", m ? "1" : "0");
  } catch {}
}

function ac() {
  if (muted || typeof window === "undefined") return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.05, delay = 0, slide = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.08, delay = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
  const src = a.createBufferSource();
  const f = a.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 1800;
  const g = a.createGain();
  g.gain.value = vol;
  src.buffer = buf;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  deal: () => noise(0.09, 0.12),
  flip: () => {
    noise(0.05, 0.08);
    tone(900, 0.05, "triangle", 0.03);
  },
  chip: () => {
    tone(1800, 0.06, "sine", 0.05);
    tone(2400, 0.08, "sine", 0.04, 0.03);
  },
  click: () => tone(520, 0.05, "square", 0.03, 0, 1.4),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, "square", 0.04, i * 0.08)),
  blackjack: () =>
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.22, "square", 0.045, i * 0.07)),
  lose: () => tone(300, 0.45, "sawtooth", 0.035, 0, 0.4),
  push: () => tone(440, 0.2, "triangle", 0.05),
  tick: () => tone(1200, 0.03, "square", 0.02),
};
