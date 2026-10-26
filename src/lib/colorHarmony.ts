import type { Item } from './types';

/**
 * Outfit-level colour scoring. One model for every piece of the outfit:
 * 1. each piece contributes its colours (main colour + the rest of its palette, up to 3),
 * 2. colours are split into neutrals (incl. near-neutrals: navy, beige, brown, denim) and chromatic ones,
 * 3. the chromatic hues decide the outfit's harmony type,
 * 4. a score table maps the type to a 0..1 score.
 *
 * The score table is a parameter so later stages can pass a per-style table.
 */

export type HarmonyType =
  | 'neutral' // only neutrals
  | 'accent' // neutrals + exactly one chromatic colour
  | 'monochrome' // two or more chromatic colours of the same hue family
  | 'analogous' // hues within 60 degrees of each other
  | 'complementary' // two hue families roughly opposite (>= 150 degrees)
  | 'mixed' // two hue families in between (60..150 degrees)
  | 'clash'; // three or more unrelated hue families

/** Baseline when no style is selected: harmonious types are close, clashing is clearly worse. */
export const DEFAULT_HARMONY_SCORES: Record<HarmonyType, number> = {
  neutral: 0.9,
  accent: 0.9,
  monochrome: 0.85,
  analogous: 0.85,
  complementary: 0.8,
  mixed: 0.6,
  clash: 0.35
};

/** Hues closer than this (degrees) belong to the same family. */
const SAME_FAMILY_DEG = 20;
/** Hue span (degrees) that still counts as analogous. */
const ANALOGOUS_SPAN_DEG = 60;
/** Distance (degrees) from which two families count as complementary. */
const COMPLEMENTARY_DEG = 150;

export interface ParsedColor {
  h: number;
  s: number;
  l: number;
  kind: 'neutral' | 'chromatic';
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex.trim());
  if (!m) return null;
  let v = m[1];
  if (v.length === 3) v = v.split('').map((c) => c + c).join('');
  if (v.length === 8) v = v.slice(0, 6); // #rrggbbaa: the alpha channel is ignored
  return [parseInt(v.slice(0, 2), 16) / 255, parseInt(v.slice(2, 4), 16) / 255, parseInt(v.slice(4, 6), 16) / 255];
}

export function hexToHsl(hex: string): [number, number, number] | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

const between = (x: number, lo: number, hi: number) => x >= lo && x <= hi;

const classifyCache = new Map<string, ParsedColor | null>();
const CLASSIFY_CACHE_LIMIT = 5000;

/** Neutral = achromatic (black/white/grey) or a near-neutral that works like one. Results are cached per hex string. */
export function classifyColor(hex: string): ParsedColor | null {
  if (classifyCache.has(hex)) return classifyCache.get(hex) ?? null;
  const result = classifyColorUncached(hex);
  if (classifyCache.size >= CLASSIFY_CACHE_LIMIT) classifyCache.clear();
  classifyCache.set(hex, result);
  return result;
}

function classifyColorUncached(hex: string): ParsedColor | null {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  const [h, s, l] = hsl;

  const achromatic = s < 12 || l < 12 || l > 93;
  const navy = between(h, 200, 260) && l < 28;
  const beige = between(h, 20, 55) && s <= 50 && l >= 65;
  const brown = between(h, 10, 45) && l < 35 && s <= 70;
  const denim = between(h, 195, 230) && between(s, 25, 65) && between(l, 30, 60);

  return { h, s, l, kind: achromatic || navy || beige || brown || denim ? 'neutral' : 'chromatic' };
}

const circDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

/** Groups hues into families: neighbours closer than SAME_FAMILY_DEG are one family (wraps around 360). */
function hueFamilies(hues: number[]): number[][] {
  const sorted = [...hues].sort((a, b) => a - b);
  const groups: number[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] <= SAME_FAMILY_DEG) groups[groups.length - 1].push(sorted[i]);
    else groups.push([sorted[i]]);
  }
  if (groups.length > 1) {
    const first = groups[0];
    const last = groups[groups.length - 1];
    if (first[0] + 360 - last[last.length - 1] <= SAME_FAMILY_DEG) {
      groups[0] = [...last, ...first];
      groups.pop();
    }
  }
  return groups;
}

/** Smallest arc (degrees) that contains every hue. */
function hueSpan(hues: number[]): number {
  const sorted = [...hues].sort((a, b) => a - b);
  let largestGap = sorted[0] + 360 - sorted[sorted.length - 1];
  for (let i = 1; i < sorted.length; i++) largestGap = Math.max(largestGap, sorted[i] - sorted[i - 1]);
  return 360 - largestGap;
}

function familyCenter(group: number[]): number {
  const x = group.reduce((a, h) => a + Math.cos((h * Math.PI) / 180), 0);
  const y = group.reduce((a, h) => a + Math.sin((h * Math.PI) / 180), 0);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Harmony type for a set of hex colours, or null when none of them is a usable colour. */
export function classifyHarmony(hexes: string[]): HarmonyType | null {
  const colors = hexes.map(classifyColor).filter((c): c is ParsedColor => c !== null);
  if (!colors.length) return null;

  const chromatic = colors.filter((c) => c.kind === 'chromatic');
  if (!chromatic.length) return 'neutral';

  const hues = chromatic.map((c) => c.h);
  const families = hueFamilies(hues);

  if (families.length === 1) return chromatic.length === 1 ? 'accent' : 'monochrome';
  if (hueSpan(hues) <= ANALOGOUS_SPAN_DEG) return 'analogous';
  if (families.length >= 3) return 'clash';
  const [a, b] = families.map(familyCenter);
  return circDist(a, b) >= COMPLEMENTARY_DEG ? 'complementary' : 'mixed';
}

/** Character of the chromatic colours: soft (pastel/muted), vivid (saturated mid-tones), a mix, or none (all neutral). */
export type ToneType = 'none' | 'soft' | 'vivid' | 'mixed';

/** Share of the colour score that comes from the tone table (only when a style provides one). */
export const TONE_WEIGHT = 0.35;

/** A chromatic colour is soft when it is light (pastel) or low in saturation (muted). */
function isSoft(c: ParsedColor): boolean {
  return c.l >= 72 || c.s < 40;
}

export function classifyTone(hexes: string[]): ToneType {
  const chromatic = hexes
    .map(classifyColor)
    .filter((c): c is ParsedColor => c !== null && c.kind === 'chromatic');
  if (!chromatic.length) return 'none';
  const soft = chromatic.filter(isSoft).length;
  if (soft === chromatic.length) return 'soft';
  if (soft === 0) return 'vivid';
  return 'mixed';
}

export interface OutfitColorResult {
  score: number;
  harmony: HarmonyType | null;
  tone: ToneType | null;
}

/** A piece contributes at most this many colours to the outfit. */
export const MAX_COLORS_PER_ITEM = 4;

/**
 * The colours a piece contributes: all the colours found in its photo (the biggest first),
 * without duplicates, at most MAX_COLORS_PER_ITEM. Shades of one colour are already merged
 * when the colours are detected, so a plain piece has one colour and a printed one has several.
 */
export function itemColors(item: Item): string[] {
  const all = [item.selected_color, ...(item.colors ?? [])].filter((c): c is string => !!c);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const c of all) {
    const key = c.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }
  return unique.slice(0, MAX_COLORS_PER_ITEM);
}

/** A piece whose own chromatic colours span this many hue families is a statement piece. */
const STATEMENT_FAMILIES = 3;

/**
 * A multi-coloured piece (colour-block hoodie, loud print): its own colours already span three or more
 * unrelated hue families. Near-neutrals (camouflage greens/browns, denim) never count as a family.
 */
export function isStatementPiece(item: Item): boolean {
  const hues = itemColors(item)
    .map(classifyColor)
    .filter((c): c is ParsedColor => c !== null && c.kind === 'chromatic')
    .map((c) => c.h);
  return hues.length >= STATEMENT_FAMILIES && hueFamilies(hues).length >= STATEMENT_FAMILIES;
}

const chromaticHues = (hexes: string[]): number[] =>
  hexes
    .map(classifyColor)
    .filter((c): c is ParsedColor => c !== null && c.kind === 'chromatic')
    .map((c) => c.h);

/**
 * One statement piece with the rest of the outfit: calm ('accent') when the other pieces are neutral or
 * pick up a colour of the print (same hue family), a clash when one of them brings a colour the print lacks.
 */
function statementHarmony(statement: Item, others: Item[]): HarmonyType {
  const printHues = chromaticHues(itemColors(statement));
  const otherHues = chromaticHues(others.flatMap(itemColors));
  const pickedUp = otherHues.every((h) => printHues.some((p) => circDist(h, p) <= SAME_FAMILY_DEG));
  return pickedUp ? 'accent' : 'clash';
}

/**
 * Scores the colour harmony of all pieces together (0..1).
 * All colours of every piece count. One multi-coloured statement piece does not turn the outfit into a clash
 * by itself: the others must be neutral or pick up one of its colours. Two statement pieces are a clash.
 * No usable colour -> neutral 0.5 with harmony null.
 */
export function scoreOutfitColor(
  items: Item[],
  scores: Partial<Record<HarmonyType, number>> = {},
  toneScores?: Partial<Record<ToneType, number>>
): OutfitColorResult {
  const statements = items.filter(isStatementPiece);
  const hexes = items.flatMap(itemColors);
  const harmony =
    statements.length >= 2
      ? 'clash'
      : statements.length === 1
        ? statementHarmony(statements[0], items.filter((i) => i !== statements[0]))
        : classifyHarmony(hexes);
  if (!harmony) return { score: 0.5, harmony: null, tone: null };
  const tone = classifyTone(hexes);
  const harmonyScore = scores[harmony] ?? DEFAULT_HARMONY_SCORES[harmony];
  const toneScore = toneScores?.[tone];
  const score = toneScore === undefined ? harmonyScore : harmonyScore * (1 - TONE_WEIGHT) + toneScore * TONE_WEIGHT;
  return { score, harmony, tone };
}
