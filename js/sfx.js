/* ¡Chucuchú! – sound effects (CC0 recordings from freesound.org, see README) */
const FILES = ['toot', 'whistle', 'chug', 'correct', 'wrong', 'powerup', 'pop', 'fanfare', 'applause', 'tick', 'click', 'boing', 'squeak', 'bell', 'pew', 'minigun'];
const LEVELS = [0, 0.35, 0.7, 1];
let ctx = null;
let master = null;
let level = 2;
const buffers = {};

export function init() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = LEVELS[level];
  master.connect(ctx.destination);
  FILES.forEach(async name => {
    try {
      const res = await fetch(`sfx/${name}.mp3`);
      buffers[name] = await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {}
  });
}

export function play(name, { vol = 1, rate = 1 } = {}) {
  if (!ctx || !level || !buffers[name]) return null;
  const src = ctx.createBufferSource();
  src.buffer = buffers[name];
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(g).connect(master);
  src.start();
  return { src, g };
}

export function stop(h, t = 0.25) {
  if (!h || !ctx) return;
  const now = ctx.currentTime;
  h.g.gain.setTargetAtTime(0, now, t / 3);
  try { h.src.stop(now + t + 0.05); } catch {}
}

export function setLevel(l) {
  level = l;
  if (master) master.gain.value = LEVELS[l];
}
