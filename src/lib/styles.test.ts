import { describe, expect, it } from 'vitest';
import { STYLES, colorScoresForStyle, getStyle } from './styles';
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
