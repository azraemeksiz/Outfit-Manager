/**
 * Colour extraction from a photo: finds the 1-4 real colours of a garment.
 *
 * Pipeline: sample pixels -> drop the background (transparent cut-out, or a plain uniform one) ->
 * k-means in CIE Lab (perceptual space) -> merge clusters that are only shades of one another ->
 * drop tiny clusters (logos, stitching) -> shares.
 * Neutrals (black, white, grey, beige, navy) are real colours and are kept.
 */

export type Lab = [number, number, number];

export interface PaletteColor {
  hex: string;
  /** Share of the garment pixels, 0..1; the shares of a palette sum to 1. */
  share: number;
}

export interface ExtractionResult {
  /** Biggest colour first. */
  palette: PaletteColor[];
  background: 'transparent' | 'plain' | 'none';
  /** The garment looks multi-coloured: a second colour covers a real part of it. */
  suggestPatterned: boolean;
}

export interface ExtractionOptions {
  /** Number of k-means clusters before merging (default 5). */
  k?: number;
  /** At most this many colours are returned (default 4). */
  maxColors?: number;
}

const SAMPLE_TARGET = 6000;
const BORDER = 0.06; // outer band used to look for a plain background
const BORDER_UNIFORM = 0.85; // share of border pixels that must agree
const BORDER_TOLERANCE = 14; // ΔE inside which border pixels "agree"
const BACKGROUND_REMOVAL = 18; // ΔE from the background colour that is dropped
const MIN_GARMENT_SHARE = 0.05; // below this the "background" was probably the garment itself
const TRANSPARENT_SHARE = 0.05;
const INIT_SEPARATION = 25; // ΔE between initial centroids
const MERGE_DISTANCE = 16; // ΔE under which two clusters are one colour
const SHADE_AB = 12; // same hue ...
const SHADE_L = 30; // ... and only lighter/darker: a shade of the same colour
const SOLID_SHARE = 0.8; // one colour covering this much of the garment = a single-colour piece
const MIN_SHARE = 0.08; // in a multi-colour piece, smaller colours are logos/noise
const PATTERNED_SECOND_SHARE = 0.2;

// ---------- colour maths ----------

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const fromLinear = (v: number) => {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
};

export function rgbToLab(r: number, g: number, b: number): Lab {
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToHex(lab: Lab): string {
  const [L, a, b] = lab;
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const inv = (t: number) => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);
  const X = 0.95047 * inv(fx);
  const Y = inv(fy);
  const Z = 1.08883 * inv(fz);
  const r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  const g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  const bl = 0.0557 * X - 0.204 * Y + 1.057 * Z;
  const hex = (v: number) => fromLinear(Math.max(0, v)).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(bl)}`;
}

export function hexToLab(hex: string): Lab {
  const h = hex.replace('#', '');
  return rgbToLab(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
}

export const deltaE = (p: Lab, q: Lab) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

// ---------- extraction ----------

interface Sample {
  lab: Lab;
  fx: number;
  fy: number;
}

interface Cluster {
  lab: Lab;
  count: number;
}

const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

function nearestIndex(lab: Lab, centroids: Lab[]): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < centroids.length; i++) {
    const d = deltaE(lab, centroids[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Deterministic start: the most common (coarsely binned) colours that are far enough from each other. */
function initialCentroids(pixels: Lab[], k: number): Lab[] {
  const bins = new Map<string, { sum: Lab; count: number }>();
  for (const p of pixels) {
    const key = `${Math.round(p[0] / 8)},${Math.round(p[1] / 8)},${Math.round(p[2] / 8)}`;
    const bin = bins.get(key);
    if (bin) {
      bin.sum[0] += p[0];
      bin.sum[1] += p[1];
      bin.sum[2] += p[2];
      bin.count++;
    } else {
      bins.set(key, { sum: [p[0], p[1], p[2]], count: 1 });
    }
  }
  const ranked = [...bins.entries()].sort((a, b) => b[1].count - a[1].count || (a[0] < b[0] ? -1 : 1));
  const centroids: Lab[] = [];
  for (const [, bin] of ranked) {
    const lab: Lab = [bin.sum[0] / bin.count, bin.sum[1] / bin.count, bin.sum[2] / bin.count];
    if (centroids.every((c) => deltaE(c, lab) > INIT_SEPARATION)) centroids.push(lab);
    if (centroids.length >= k) break;
  }
  return centroids;
}

function kMeans(pixels: Lab[], k: number): Cluster[] {
  let centroids = initialCentroids(pixels, k);
  let assignment = new Int32Array(pixels.length).fill(-1);

  for (let iter = 0; iter < 12; iter++) {
    let changed = false;
    const sums = centroids.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < pixels.length; i++) {
      const c = nearestIndex(pixels[i], centroids);
      if (assignment[i] !== c) {
        assignment[i] = c;
        changed = true;
      }
      sums[c][0] += pixels[i][0];
      sums[c][1] += pixels[i][1];
      sums[c][2] += pixels[i][2];
      sums[c][3]++;
    }
    centroids = centroids.map((old, c): Lab =>
      sums[c][3] > 0 ? [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]] : old
    );
    if (!changed) break;
  }

  const counts = new Array(centroids.length).fill(0);
  for (let i = 0; i < pixels.length; i++) counts[assignment[i]]++;
  return centroids.map((lab, i) => ({ lab, count: counts[i] })).filter((c) => c.count > 0);
}

/** Two clusters are the same colour if they are close, or the same hue in a lighter/darker shade. */
function shouldMerge(a: Lab, b: Lab): boolean {
  if (deltaE(a, b) < MERGE_DISTANCE) return true;
  return Math.abs(a[1] - b[1]) < SHADE_AB && Math.abs(a[2] - b[2]) < SHADE_AB && Math.abs(a[0] - b[0]) < SHADE_L;
}

function mergeClusters(clusters: Cluster[]): Cluster[] {
  const list = clusters.map((c) => ({ lab: [...c.lab] as Lab, count: c.count }));
  for (;;) {
    let bi = -1;
    let bj = -1;
    let best = Infinity;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (!shouldMerge(list[i].lab, list[j].lab)) continue;
        const d = deltaE(list[i].lab, list[j].lab);
        if (d < best) {
          best = d;
          bi = i;
          bj = j;
        }
      }
    }
    if (bi < 0) return list;
    const a = list[bi];
    const b = list[bj];
    const total = a.count + b.count;
    a.lab = [
      (a.lab[0] * a.count + b.lab[0] * b.count) / total,
      (a.lab[1] * a.count + b.lab[1] * b.count) / total,
      (a.lab[2] * a.count + b.lab[2] * b.count) / total
    ];
    a.count = total;
    list.splice(bj, 1);
  }
}

export function extractPalette(
  data: Uint8ClampedArray | ArrayLike<number>,
  width: number,
  height: number,
  options: ExtractionOptions = {}
): ExtractionResult {
  const empty: ExtractionResult = { palette: [], background: 'none', suggestPatterned: false };
  if (!width || !height || data.length < width * height * 4) return empty;

  const k = Math.max(1, options.k ?? 5);
  const maxColors = Math.max(1, options.maxColors ?? 4);

  // 1. sample the picture
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / SAMPLE_TARGET)));
  const opaque: Sample[] = [];
  let sampled = 0;
  let transparent = 0;
  // Every sample is the average of a small block (not a single pixel): noise, texture and JPEG
  // artefacts cancel out, so a plain piece does not split into several colours.
  const block = Math.max(3, Math.min(step, 6));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      sampled++;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      let total = 0;
      const y1 = Math.min(height, y + block);
      const x1 = Math.min(width, x + block);
      for (let yy = y; yy < y1; yy++) {
        for (let xx = x; xx < x1; xx++) {
          total++;
          const i = (yy * width + xx) * 4;
          if (data[i + 3] < 128) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
      }
      if (n === 0 || n < total / 2) {
        transparent++;
        continue;
      }
      opaque.push({ lab: rgbToLab(r / n, g / n, b / n), fx: x / width, fy: y / height });
    }
  }
  if (!opaque.length) return empty;

  // 2. background
  let background: ExtractionResult['background'] = 'none';
  let garment: Sample[] = opaque;
  if (transparent / sampled > TRANSPARENT_SHARE) {
    background = 'transparent';
  } else {
    const border = opaque.filter((s) => s.fx < BORDER || s.fx > 1 - BORDER || s.fy < BORDER || s.fy > 1 - BORDER);
    const bg: Lab | null =
      border.length >= 8
        ? [median(border.map((s) => s.lab[0])), median(border.map((s) => s.lab[1])), median(border.map((s) => s.lab[2]))]
        : null;
    const uniform = bg ? border.filter((s) => deltaE(s.lab, bg) <= BORDER_TOLERANCE).length / border.length >= BORDER_UNIFORM : false;
    if (bg && uniform) {
      const kept = opaque.filter((s) => deltaE(s.lab, bg) >= BACKGROUND_REMOVAL);
      if (kept.length >= opaque.length * MIN_GARMENT_SHARE) {
        garment = kept;
        background = 'plain';
      }
    } else {
      // No clean background: the garment is usually in the middle, the edges are hangers and walls.
      const centre = opaque.filter((s) => s.fx >= 0.1 && s.fx <= 0.9 && s.fy >= 0.1 && s.fy <= 0.9);
      if (centre.length) garment = centre;
    }
  }

  // 3. cluster, merge shades, drop tiny clusters
  const pixels = garment.map((s) => s.lab);
  const merged = mergeClusters(kMeans(pixels, Math.min(k, pixels.length)));
  const total = merged.reduce((s, c) => s + c.count, 0);
  const ranked = [...merged].sort((a, b) => b.count - a.count || (labToHex(a.lab) < labToHex(b.lab) ? -1 : 1));

  // A piece is single-colour when one colour covers most of it: shadows, texture, a small logo
  // or a hanger must not turn it into a multi-colour piece. Only then do the other colours count.
  const isSolid = ranked[0].count / total >= SOLID_SHARE;
  const kept = isSolid ? [ranked[0]] : ranked.filter((c) => c.count / total >= MIN_SHARE).slice(0, maxColors);
  const keptTotal = kept.reduce((s, c) => s + c.count, 0);
  const palette = kept.map((c) => ({ hex: labToHex(c.lab), share: c.count / keptTotal }));

  return {
    palette,
    background,
    suggestPatterned: palette.length >= 2 && palette[1].share >= PATTERNED_SECOND_SHARE
  };
}
