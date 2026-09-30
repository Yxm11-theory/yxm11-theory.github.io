// Seeded random numbers. The generator state lives in the game state so saves resume exactly
// and the same seed + scenario always produces the same market, whatever the player does.

/** Turn any seed text or number into a 32-bit integer (FNV-1a). */
export function hashSeed(seed) {
  const s = String(seed);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function random(state) {
  let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function gaussian(state) {
  let u = 0;
  while (u === 0) u = random(state);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random(state));
}
export const between = (s, a, b) => a + (b - a) * random(s);
export const pick = (s, arr) => arr[Math.floor(random(s) * arr.length)];
export const chance = (s, p) => random(s) < p;
