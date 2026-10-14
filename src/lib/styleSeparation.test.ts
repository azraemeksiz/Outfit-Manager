import { describe, expect, it } from 'vitest';
import { filterItems, generateOutfitCombinations } from './recommender';
import type { RecommenderContext } from './recommender';
import { STYLES } from './styles';
import type { StyleId } from './styles';
import type { Item } from './types';

/**
 * Regression for "every style suggests the same outfits":
 * on a mixed wardrobe the top-10 lists of different styles must really differ.
 */

let nextId = 1;
const mk = (name: string, category: string, color: string, extra: Partial<Item> = {}): Item => ({
  id: nextId++,
  name,
  category,
  selected_color: color,
  status: 'Clean',
  seasons: ['all-season'],
  occasions: [],
  is_patterned: false,
  ...extra
});

const wardrobe: Item[] = [
  mk('black tee', 'top', '#101010'),
  mk('white tee', 'top', '#f5f5f5'),
  mk('red top', 'top', '#d62828'),
  mk('yellow top', 'top', '#f2c12e'),
  mk('floral top', 'top', '#d62828', { is_patterned: true, colors: ['#d62828', '#28d628', '#f5f5f5'] }),
  mk('stripe shirt', 'top', '#1f2a44', { is_patterned: true }),
  mk('pink top', 'top', '#f4a6c0'),
  mk('mint top', 'top', '#a8c5b5'),
  mk('jeans', 'bottom', '#4a6fa5'),
  mk('black pants', 'bottom', '#101010'),
  mk('green skirt', 'bottom', '#28a050'),
  mk('beige pants', 'bottom', '#d9c3a0'),
  mk('purple pants', 'bottom', '#7a3fb0'),
  mk('plaid skirt', 'bottom', '#8a2a2a', { is_patterned: true }),
  mk('white sneakers', 'shoes', '#f5f5f5'),
  mk('black boots', 'shoes', '#101010'),
  mk('red sneakers', 'shoes', '#d62828')
];

const ctx = (style: StyleId | null): RecommenderContext => ({
  occasion: '',
  temperature: 20,
  coldThreshold: 15,
  heatThreshold: 25,
  style,
  userProfile: { patternAffinity: 0.5, colorAffinities: [] },
  wornHistory: [],
  now: new Date('2026-10-14T12:00:00').getTime()
});

const topTen = (style: StyleId | null) => {
  const c = ctx(style);
  return generateOutfitCombinations(filterItems(wardrobe, c), c, 10).map((s) =>
    s.items
      .filter((i) => i.category === 'top' || i.category === 'bottom')
      .map((i) => i.name)
      .join('+')
  );
};

const overlap = (a: string[], b: string[]) => a.filter((x) => b.includes(x)).length;

describe('styles produce clearly different suggestions', () => {
  const lists = Object.fromEntries(STYLES.map((s) => [s.id, topTen(s.id)])) as Record<StyleId, string[]>;

  it('every pair of styles differs in at least 3 of the 10 outfits', () => {
    for (let i = 0; i < STYLES.length; i++) {
      for (let j = i + 1; j < STYLES.length; j++) {
        const a = STYLES[i].id;
        const b = STYLES[j].id;
        expect(overlap(lists[a], lists[b]), `${a} vs ${b}`).toBeLessThanOrEqual(7);
      }
    }
  });

  it('minimal and maximalist differ in at least half of the outfits', () => {
    expect(overlap(lists.minimal, lists.maximalist)).toBeLessThanOrEqual(5);
  });

  it('minimal avoids patterned pieces more than maximalist', () => {
    const patterned = ['floral top', 'stripe shirt', 'plaid skirt'];
    const count = (l: string[]) => l.filter((o) => patterned.some((p) => o.includes(p))).length;
    expect(count(lists.minimal)).toBeLessThan(count(lists.maximalist));
  });

  it('girl casual leans to soft colours and sporty to vivid ones', () => {
    const soft = ['pink top', 'mint top'];
    const count = (l: string[]) => l.filter((o) => soft.some((p) => o.includes(p))).length;
    expect(count(lists['girl-casual'])).toBeGreaterThan(count(lists.sporty));
  });

  it('no style hides outfits: each style still returns 10 suggestions', () => {
    for (const s of STYLES) expect(lists[s.id]).toHaveLength(10);
  });
});
