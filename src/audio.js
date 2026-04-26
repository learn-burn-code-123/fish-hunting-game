// Lightweight, asset-free sound effects via the Web Audio API.
// We generate cheerful chomps and gentle bubble pops on the fly so the game
// has zero binary dependencies (per spec §8).

let ctx = null;
let masterGain = null;

function ensureCtx() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  // Browsers require a user gesture to start AudioContext.
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
}

export function playChomp(pointBoost = 0) {
  const c = ensureCtx();
  if (!c) return;
  const now = c.currentTime;

  // A descending blip: 600Hz -> 200Hz over 0.1s, plus a brighter "snap" tone
  // for higher-point fish.
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(620 + pointBoost * 30, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.35, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.2);

  // Sparkle for rainbow / gold
  if (pointBoost >= 5) {
    const o2 = c.createOscillator();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(900, now);
    o2.frequency.exponentialRampToValueAtTime(1600, now + 0.15);
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.0001, now);
    g2.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    o2.connect(g2).connect(masterGain);
    o2.start(now);
    o2.stop(now + 0.27);
  }
}

export function playBump() {
  const c = ensureCtx();
  if (!c) return;
  const now = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, now);
  o.frequency.exponentialRampToValueAtTime(80, now + 0.12);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
  o.connect(g).connect(masterGain);
  o.start(now);
  o.stop(now + 0.18);
}
