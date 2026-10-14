import { describe, expect, it } from 'vitest';
import { checkCombinationHistory, filterItems, generateOutfitCombinations } from './recommender';
import type { RecommenderContext } from './recommender';
import { STYLES } from './styles';
import type { CalendarEntry, Item } from './types';

const colors = ['#101010', '#f5f5f5', '#d62828', '#f2c12e', '#1f2a44', '#f4a6c0', '#a8c5b5', '#4a6fa5', '#28a050', '#d9c3a0', '#7a3fb0', '#8a2a2a'];

const wardrobe = (n: number): Item[] => {
  const items: Item[] = [];
  let id = 1;
  const cats: [string, number][] = [['top', 0.35], ['bottom', 0.25], ['shoes', 0.1], ['outerwear', 0.1], ['accessory', 0.1], ['dress', 0.1]];
  for (const [cat, share] of cats) {
    for (let i = 0; i < Math.round(n * share); i++) {
      id++;
      items.push({
        id,
        name: cat + i,
        category: cat,
        selected_color: colors[(id * 7) % colors.length],
        seasons: ['all-season'],
        occasions: [],
        is_patterned: id % 5 === 0,
        fit: ['slim', 'regular', 'loose'][id % 3],
        last_worn_date: id % 4 === 0 ? '2026-09-01' : null,
        status: 'Clean'
      });
    }
  }
  return items;
};

const ctx = (over: Partial<RecommenderContext> = {}): RecommenderContext => ({
  occasion: '',
  temperature: 12,
  coldThreshold: 15,
  heatThreshold: 25,
  style: 'streetwear',
  userProfile: { patternAffinity: 0.5, colorAffinities: [] },
  wornHistory: [],
  now: new Date('2026-10-14T12:00:00').getTime(),
  ...over
});

const run = (items: Item[], c: RecommenderContext) => generateOutfitCombinations(filterItems(items, c), c);

describe('performance', () => {
  it('a 300-item wardrobe answers in under 1.5 seconds', () => {
    const items = wardrobe(300);
    const t0 = performance.now();
    run(items, ctx());
    expect(performance.now() - t0).toBeLessThan(1500);
  }, 20000);

  it('a 600-item wardrobe answers in under 3 seconds', () => {
    const items = wardrobe(600);
    const t0 = performance.now();
    run(items, ctx());
    expect(performance.now() - t0).toBeLessThan(3000);
  }, 30000);

  it('a long worn history does not slow it down', () => {
    const items = wardrobe(300);
    const history: CalendarEntry[] = Array.from({ length: 180 }, (_, d) => ({
      date: new Date(new Date('2026-10-14T12:00:00').getTime() - (d + 8) * 86400000).toISOString().slice(0, 10),
      is_worn: true,
      outfits: { item_list: [{ id: 2 + d }, { id: 140 + d }, { id: 260 + d }] as any }
    }));
    const t0 = performance.now();
    run(items, ctx({ wornHistory: history }));
    expect(performance.now() - t0).toBeLessThan(2500);
  }, 30000);
});

describe('speed-ups keep the results', () => {
  it('a mid-size wardrobe gives the same ranking as before pruning kicks in (below the pruning limit)', () => {
    const items = wardrobe(60);
    const a = run(items, ctx());
    const b = run([...items].reverse(), ctx());
    expect(a.map((s) => s.items.map((i) => i.id).join('-'))).toEqual(b.map((s) => s.items.map((i) => i.id).join('-')));
  });

  it('the best suggestion of a large wardrobe equals the best of the unpruned search', () => {
    const items = wardrobe(300);
    const pruned = run(items, ctx());
    const exact = generateOutfitCombinations(filterItems(items, ctx()), ctx(), 10, { pairLimit: Infinity });
    expect(pruned[0].score).toBe(exact[0].score);
    // the pruned list is a good approximation: at least 8 of the exact top 10 outfits survive
    const key = (s: { items: Item[] }) => s.items.map((i) => i.id).sort((x, y) => x - y).join('-');
    const exactKeys = new Set(exact.map(key));
    expect(pruned.filter((s) => exactKeys.has(key(s))).length).toBeGreaterThanOrEqual(8);
  }, 60000);

  it('every style still works on a large wardrobe', () => {
    const items = wardrobe(200);
    for (const s of STYLES) expect(run(items, ctx({ style: s.id })).length).toBe(10);
  }, 30000);

  it('history lookups give the same status as the plain check', () => {
    const entry: CalendarEntry = {
      date: '2026-10-12',
      is_worn: true,
      outfits: { item_list: [{ id: 1 }, { id: 2 }] as any }
    };
    const older: CalendarEntry = {
      date: '2026-08-01',
      is_worn: true,
      outfits: { item_list: [{ id: 3 }, { id: 4 }] as any }
    };
    const c = ctx({ wornHistory: [entry, older] });
    expect(checkCombinationHistory(1, 2, c)).toBe('recent_repeat');
    expect(checkCombinationHistory(2, 1, c)).toBe('recent_repeat');
    expect(checkCombinationHistory(3, 4, c)).toBe('co_occurrence');
    expect(checkCombinationHistory(1, 3, c)).toBe('none');
  });
});
