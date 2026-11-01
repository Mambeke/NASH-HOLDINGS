// Deterministic seeded random utilities so the demo dataset is identical on every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function poisson(rng, lambda) {
  if (lambda <= 0) return 0;
  if (lambda > 30) {
    // normal approximation
    const u = Math.max(1e-9, rng()), v = rng();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return Math.max(0, Math.round(lambda + z * Math.sqrt(lambda)));
  }
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}
export function normal(rng) {
  const u = Math.max(1e-9, rng()), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function pickWeighted(rng, weights) {
  let total = 0;
  for (const w of weights) total += w;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return weights.length - 1;
}
export function buildCdf(weights) {
  const cdf = new Float64Array(weights.length);
  let t = 0;
  for (let i = 0; i < weights.length; i++) { t += weights[i]; cdf[i] = t; }
  for (let i = 0; i < cdf.length; i++) cdf[i] /= t;
  return cdf;
}
export function cdfPick(cdf, r) {
  let lo = 0, hi = cdf.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] >= r) hi = mid; else lo = mid + 1; }
  return lo;
}
