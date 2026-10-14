import { describe, expect, it } from 'vitest';
import { STYLES, colorScoresForStyle, getStyle, patternScoreForStyle } from './styles';
import { DEFAULT_HARMONY_SCORES, scoreOutfitColor } from './colorHarmony';
import type { HarmonyType } from './colorHarmony';
import type { Item } from './types';

const HARMONY_TYPES = Object.keys(DEFAULT_HARMONY_SCORES) as HarmonyType[];

const piece = (color: string): Item => ({ id: 1, name: 'x', category: 'top', selected_color: color });

const neutral = [piece('#000000'), piece('#ffffff')];
const complementary = [piece('#d62828'), piece('#28d6d6')];
const clash = [piece('#d62828'), piece('#28d628'), piece('#2828d6')];

describe('style tables', () => {
  it('defines the five styles with unique ids', () => {
    expect(STYLES.map((s) => s.id)).toEqual(['minimal', 'streetwear', 'girl-casual', 'sporty', 'maximalist']);
  });

  it('gives every style a score in 0..1 for every harmony type', () => {
    for (const style of STYLES) {
      for (const type of HARMONY_TYPES) {
        const v = style.colorScores[type];
        expect(v, `${style.id}/${type}`).toBeGreaterThanOrEqual(0);
        expect(v, `${style.id}/${type}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('no style bans anything: every harmony type keeps a score above 0', () => {
    for (const style of STYLES) for (const type of HARMONY_TYPES) expect(style.colorScores[type]).toBeGreaterThan(0);
  });

  it('gives every style a tone table and a pattern table, all values in 0..1 and above 0', () => {
    for (const style of STYLES) {
      for (const v of Object.values(style.toneScores)) {
        expect(v, style.id).toBeGreaterThan(0);
        expect(v, style.id).toBeLessThanOrEqual(1);
      }
      expect(style.patternScores).toHaveLength(3);
      for (const v of style.patternScores) {
        expect(v, style.id).toBeGreaterThan(0);
        expect(v, style.id).toBeLessThanOrEqual(1);
      }
    }
  });

  it('pattern tolerance differs: minimal dislikes patterns, maximalist likes them', () => {
    const minimal = getStyle('minimal')!;
    const maximalist = getStyle('maximalist')!;
    expect(patternScoreForStyle('minimal', 0)).toBeGreaterThan(patternScoreForStyle('minimal', 2));
    expect(patternScoreForStyle('maximalist', 2)).toBeGreaterThan(patternScoreForStyle('maximalist', 0));
    expect(minimal.patternScores[2]).toBeLessThan(maximalist.patternScores[2]);
  });

  it('counts of 3 or more patterned pieces use the same score as 2', () => {
    expect(patternScoreForStyle('sporty', 5)).toBe(patternScoreForStyle('sporty', 2));
  });

  it('tone preference differs: girl casual likes soft, sporty and streetwear like vivid', () => {
    expect(getStyle('girl-casual')!.toneScores.soft).toBeGreaterThan(getStyle('girl-casual')!.toneScores.vivid);
    expect(getStyle('sporty')!.toneScores.vivid).toBeGreaterThan(getStyle('sporty')!.toneScores.soft);
    expect(getStyle('streetwear')!.toneScores.vivid).toBeGreaterThan(getStyle('streetwear')!.toneScores.soft);
  });

  it('gives every style a silhouette table, all five types, values in (0, 1]', () => {
    for (const style of STYLES) {
      expect(Object.keys(style.silhouetteScores).sort()).toEqual(['contrast', 'fitted', 'oversized', 'regular', 'relaxed']);
      for (const v of Object.values(style.silhouetteScores)) {
        expect(v, style.id).toBeGreaterThan(0);
        expect(v, style.id).toBeLessThanOrEqual(1);
      }
    }
  });

  it('silhouette preference differs: streetwear likes oversized, girl casual likes fitted, minimal likes regular', () => {
    expect(getStyle('streetwear')!.silhouetteScores.oversized).toBeGreaterThan(getStyle('streetwear')!.silhouetteScores.fitted);
    expect(getStyle('girl-casual')!.silhouetteScores.fitted).toBeGreaterThan(getStyle('girl-casual')!.silhouetteScores.oversized);
    const m = getStyle('minimal')!.silhouetteScores;
    expect(m.regular).toBeGreaterThanOrEqual(Math.max(...Object.values(m)));
  });

  it('streetwear accepts regular fits too: only fitted is clearly disliked', () => {
    const s = getStyle('streetwear')!.silhouetteScores;
    expect(s.regular).toBeGreaterThanOrEqual(0.75);
    expect(s.oversized).toBeGreaterThan(s.regular);
    expect(s.fitted).toBeLessThan(s.regular);
  });

  it('maximalist: unrelated colours score highest, all-neutral lowest', () => {
    const c = getStyle('maximalist')!.colorScores;
    expect(c.clash).toBe(Math.max(...Object.values(c)));
    expect(c.neutral).toBe(Math.min(...Object.values(c)));
    expect(c.clash).toBeGreaterThan(c.complementary);
  });

  it('maximalist: silhouettes are nearly equal, looser ones slightly ahead', () => {
    const s = getStyle('maximalist')!.silhouetteScores;
    const values = Object.values(s);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(0.2);
    expect(s.oversized).toBeGreaterThan(s.fitted);
    expect(s.relaxed).toBeGreaterThan(s.regular);
  });

  it('sporty gives neutrals a real place: close to its best colour types', () => {
    const s = getStyle('sporty')!;
    expect(s.colorScores.neutral).toBeGreaterThanOrEqual(0.8);
    expect(s.toneScores.none).toBeGreaterThanOrEqual(0.8);
    expect(s.toneScores.vivid).toBeGreaterThan(s.toneScores.none);
  });

  it('no style scores any silhouette, tone or pattern value below 0.1 or any colour type below 0.1', () => {
    for (const style of STYLES) {
      const all = [
        ...Object.values(style.colorScores),
        ...Object.values(style.toneScores),
        ...style.patternScores,
        ...Object.values(style.silhouetteScores)
      ];
      expect(Math.min(...all), style.id).toBeGreaterThanOrEqual(0.1);
    }
  });

  it('returns no table (neutral default) when no style is selected', () => {
    expect(colorScoresForStyle(null)).toEqual({});
    expect(colorScoresForStyle(undefined)).toEqual({});
    expect(getStyle(null)).toBeNull();
  });
});

describe('style-dependent colour scoring', () => {
  const score = (items: Item[], style: Parameters<typeof colorScoresForStyle>[0]) =>
    scoreOutfitColor(items, colorScoresForStyle(style)).score;

  it('minimal prefers neutral over clashing by a wide margin', () => {
    expect(score(neutral, 'minimal') - score(clash, 'minimal')).toBeGreaterThan(0.6);
  });

  it('maximalist prefers colourful over all-neutral', () => {
    expect(score(complementary, 'maximalist')).toBeGreaterThan(score(neutral, 'maximalist'));
  });

  it('the same clashing outfit scores higher for maximalist than for minimal', () => {
    expect(score(clash, 'maximalist')).toBeGreaterThan(score(clash, 'minimal'));
  });

  it('without a style the default table is used', () => {
    expect(score(neutral, null)).toBe(DEFAULT_HARMONY_SCORES.neutral);
  });
});
