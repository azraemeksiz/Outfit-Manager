import { describe, expect, it } from 'vitest';
import { extractPalette, hexToLab, deltaE, labToHex, rgbToLab } from './colorExtraction';

type Px = [number, number, number, number];

/** Deterministic noise in -amp..amp so tests do not depend on Math.random. */
const noise = (x: number, y: number, amp: number) => {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (n - Math.floor(n) - 0.5) * 2 * amp;
};

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/** Builds an RGBA image from a per-pixel function. */
function image(w: number, h: number, fn: (x: number, y: number) => Px): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = fn(x, y);
      const i = (y * w + x) * 4;
      data[i] = clamp(r);
      data[i + 1] = clamp(g);
      data[i + 2] = clamp(b);
      data[i + 3] = a;
    }
  }
  return data;
}

const RED: [number, number, number] = [214, 40, 40];
const BLUE: [number, number, number] = [40, 40, 214];
const WHITE: [number, number, number] = [245, 245, 245];
const BLACK: [number, number, number] = [16, 16, 16];
const BEIGE: [number, number, number] = [217, 195, 160];
const NAVY: [number, number, number] = [31, 42, 68];

const near = (hex: string, rgb: [number, number, number], tolerance = 12) =>
  deltaE(hexToLab(hex), rgbToLab(...rgb)) <= tolerance;

const W = 120;
const H = 140;
/** The garment occupies the middle of the picture, the rest is background. */
const inGarment = (x: number, y: number) => x > 20 && x < W - 20 && y > 15 && y < H - 15;

describe('Lab helpers', () => {
  it('round-trips a colour through Lab', () => {
    const lab = rgbToLab(...RED);
    expect(deltaE(hexToLab(labToHex(lab)), lab)).toBeLessThan(1.5);
  });

  it('black and white are far apart, similar colours are close', () => {
    expect(deltaE(rgbToLab(...BLACK), rgbToLab(...WHITE))).toBeGreaterThan(80);
    expect(deltaE(rgbToLab(...RED), rgbToLab(210, 45, 45))).toBeLessThan(5);
  });
});

describe('extractPalette: solid garments', () => {
  it('a plain red top on a white background gives red as the main colour', () => {
    const data = image(W, H, (x, y) =>
      inGarment(x, y)
        ? [RED[0] + noise(x, y, 14), RED[1] + noise(y, x, 10), RED[2] + noise(x + y, y, 10), 255]
        : [250 + noise(x, y, 3), 250 + noise(y, x, 3), 250 + noise(x, x, 3), 255]
    );
    const r = extractPalette(data, W, H);
    expect(r.background).toBe('plain');
    expect(near(r.palette[0].hex, RED)).toBe(true);
    expect(r.palette[0].share).toBeGreaterThan(0.85);
    expect(r.suggestPatterned).toBe(false);
  });

  it('shading and shadow on a solid piece stay one colour', () => {
    const data = image(W, H, (x, y) =>
      inGarment(x, y)
        ? [BEIGE[0] - (y - 15) * 0.5 + noise(x, y, 6), BEIGE[1] - (y - 15) * 0.5, BEIGE[2] - (y - 15) * 0.5, 255]
        : [30, 90, 40, 255]
    );
    const r = extractPalette(data, W, H);
    expect(r.palette.length).toBe(1);
    expect(near(r.palette[0].hex, BEIGE, 20)).toBe(true);
  });

  it('a cut-out photo (transparent background) only looks at the garment', () => {
    const data = image(W, H, (x, y) => (inGarment(x, y) ? [...NAVY, 255] : [255, 255, 255, 0]));
    const r = extractPalette(data, W, H);
    expect(r.background).toBe('transparent');
    expect(r.palette).toHaveLength(1);
    expect(near(r.palette[0].hex, NAVY)).toBe(true);
  });
});

describe('extractPalette: neutrals are real colours now', () => {
  it('a white shirt is white, not "nothing found"', () => {
    const data = image(W, H, (x, y) => (inGarment(x, y) ? [...WHITE, 255] : [90, 140, 200, 255]));
    const r = extractPalette(data, W, H);
    expect(r.palette.length).toBeGreaterThan(0);
    expect(near(r.palette[0].hex, WHITE)).toBe(true);
  });

  it('a black top is black', () => {
    const data = image(W, H, (x, y) => (inGarment(x, y) ? [...BLACK, 255] : [235, 235, 235, 255]));
    const r = extractPalette(data, W, H);
    expect(near(r.palette[0].hex, BLACK)).toBe(true);
  });

  it('black and white stripes give both colours and suggest "patterned"', () => {
    const data = image(W, H, (x, y) => (inGarment(x, y) ? [...(Math.floor(y / 8) % 2 === 0 ? BLACK : WHITE), 255] : [200, 160, 120, 255]));
    const r = extractPalette(data, W, H);
    const hexes = r.palette.map((p) => p.hex);
    expect(hexes.some((h) => near(h, BLACK))).toBe(true);
    expect(hexes.some((h) => near(h, WHITE))).toBe(true);
    expect(r.suggestPatterned).toBe(true);
  });

  it('a white shirt on a white background is still found (no background removal that eats the garment)', () => {
    const data = image(W, H, (x, y) => (inGarment(x, y) ? [...WHITE, 255] : [250, 250, 250, 255]));
    const r = extractPalette(data, W, H);
    expect(r.palette.length).toBeGreaterThan(0);
    expect(near(r.palette[0].hex, WHITE, 15)).toBe(true);
  });
});

describe('extractPalette: multi-colour garments', () => {
  // A plain background that differs from every colour of the print (a white print on a white
  // background cannot be told apart from the background: photograph on a contrasting surface).
  const printed = (x: number, y: number): Px => {
    if (!inGarment(x, y)) return [120, 200, 120, 255];
    const band = Math.floor((x + y) / 14) % 4;
    if (band === 0 || band === 1) return [...RED, 255];
    if (band === 2) return [...BLUE, 255];
    return [...WHITE, 255];
  };

  it('finds three colours with shares that roughly match the print', () => {
    const r = extractPalette(image(W, H, printed), W, H);
    expect(r.palette.length).toBe(3);
    expect(near(r.palette[0].hex, RED)).toBe(true);
    expect(r.palette[0].share).toBeGreaterThan(0.4);
    expect(r.palette.some((p) => near(p.hex, BLUE))).toBe(true);
    expect(r.palette.some((p) => near(p.hex, WHITE))).toBe(true);
    expect(r.suggestPatterned).toBe(true);
  });

  it('shares sum to 1 and are sorted from the biggest to the smallest', () => {
    const r = extractPalette(image(W, H, printed), W, H);
    expect(r.palette.reduce((s, p) => s + p.share, 0)).toBeCloseTo(1, 5);
    for (let i = 1; i < r.palette.length; i++) expect(r.palette[i].share).toBeLessThanOrEqual(r.palette[i - 1].share);
  });

  it('a tiny logo does not turn a solid top into a multi-colour one', () => {
    const data = image(W, H, (x, y) => {
      if (!inGarment(x, y)) return [255, 255, 255, 255];
      if (x > 50 && x < 60 && y > 40 && y < 48) return [...BLUE, 255];
      return [...RED, 255];
    });
    const r = extractPalette(data, W, H);
    expect(r.suggestPatterned).toBe(false);
    expect(near(r.palette[0].hex, RED)).toBe(true);
  });

  it('never returns more colours than asked for', () => {
    const rainbow = image(W, H, (x, y) => {
      if (!inGarment(x, y)) return [255, 255, 255, 255];
      const palette: Px[] = [[...RED, 255], [...BLUE, 255], [20, 200, 20, 255], [240, 200, 20, 255], [160, 40, 200, 255], [20, 200, 200, 255]];
      return palette[Math.floor(x / 10) % palette.length];
    });
    const r = extractPalette(rainbow, W, H, { maxColors: 4 });
    expect(r.palette.length).toBeLessThanOrEqual(4);
  });
});

describe('extractPalette: a single-colour garment gets exactly one colour', () => {
  const redWith = (blueShare: number) =>
    image(W, H, (x, y) => {
      if (!inGarment(x, y)) return [255, 255, 255, 255];
      // a vertical band of blue covering about `blueShare` of the garment width
      const gw = W - 40;
      const inBlue = x - 20 < gw * blueShare;
      return inBlue ? [...BLUE, 255] : [...RED, 255];
    });

  it('heavy texture and noise on a plain piece still gives one colour', () => {
    const data = image(W, H, (x, y) =>
      inGarment(x, y)
        ? [BEIGE[0] + noise(x, y, 28), BEIGE[1] + noise(y, x, 28), BEIGE[2] + noise(x * 3, y * 7, 28), 255]
        : [30, 90, 40, 255]
    );
    const r = extractPalette(data, W, H);
    expect(r.palette).toHaveLength(1);
    expect(r.suggestPatterned).toBe(false);
  });

  it('a small graphic (12%) on a plain piece does not make it multi-colour', () => {
    const r = extractPalette(redWith(0.12), W, H);
    expect(r.palette).toHaveLength(1);
    expect(near(r.palette[0].hex, RED)).toBe(true);
    expect(r.palette[0].share).toBe(1);
    expect(r.suggestPatterned).toBe(false);
  });

  it('a big second colour (30%) makes it a two-colour piece', () => {
    const r = extractPalette(redWith(0.3), W, H);
    expect(r.palette).toHaveLength(2);
    expect(r.suggestPatterned).toBe(true);
  });

  it('a minor colour in a multi-colour piece (under 8%) is dropped', () => {
    const data = image(W, H, (x, y) => {
      if (!inGarment(x, y)) return [255, 255, 255, 255];
      const t = (x - 20) / (W - 40);
      if (t < 0.48) return [...RED, 255];
      if (t < 0.96) return [...BLUE, 255];
      return [20, 200, 20, 255];
    });
    const r = extractPalette(data, W, H);
    expect(r.palette).toHaveLength(2);
  });

  it('four equal colours give four colours', () => {
    const data = image(W, H, (x, y) => {
      if (!inGarment(x, y)) return [255, 255, 255, 255];
      const t = Math.floor(((x - 20) / (W - 40)) * 4);
      const colors: Px[] = [[...RED, 255], [...BLUE, 255], [20, 200, 20, 255], [240, 200, 20, 255]];
      return colors[Math.min(t, 3)];
    });
    expect(extractPalette(data, W, H).palette).toHaveLength(4);
  });
});

describe('extractPalette: robustness', () => {
  it('is deterministic', () => {
    const data = image(W, H, (x, y) => (inGarment(x, y) ? [RED[0] + noise(x, y, 20), RED[1], RED[2], 255] : [255, 255, 255, 255]));
    expect(extractPalette(data, W, H)).toEqual(extractPalette(data, W, H));
  });

  it('a fully transparent or empty image gives an empty palette instead of crashing', () => {
    expect(extractPalette(image(20, 20, () => [0, 0, 0, 0]), 20, 20).palette).toEqual([]);
    expect(extractPalette(new Uint8ClampedArray(0), 0, 0).palette).toEqual([]);
  });

  it('a very small image works', () => {
    const r = extractPalette(image(4, 4, () => [...RED, 255]), 4, 4);
    expect(near(r.palette[0].hex, RED)).toBe(true);
  });

  it('every returned hex is a valid 6-digit hex', () => {
    const data = image(W, H, (x, y) => [x * 2, y * 1.8, (x + y) % 255, 255]);
    for (const p of extractPalette(data, W, H).palette) expect(p.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('is fast on a large photo (1200x1600)', () => {
    const w = 1200;
    const h = 1600;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const left = i % w < w / 2;
      data[i * 4] = left ? 214 : 40;
      data[i * 4 + 1] = 40;
      data[i * 4 + 2] = left ? 40 : 214;
      data[i * 4 + 3] = 255;
    }
    const t0 = performance.now();
    const r = extractPalette(data, w, h);
    expect(performance.now() - t0).toBeLessThan(1500);
    expect(r.palette.length).toBe(2);
  });
});
