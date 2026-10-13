import { describe, expect, it } from 'vitest';
import { computeScore, generateOutfitCombinations, filterItems } from './recommender';
import type { RecommenderContext } from './recommender';
import type { Item } from './types';

let nextId = 1;
const item = (over: Partial<Item> & Pick<Item, 'category'>): Item => ({
  id: nextId++,
  name: `${over.category}-${nextId}`,
  status: 'Clean',
  seasons: ['all-season'],
  occasions: [],
  is_patterned: false,
  selected_color: '#808080',
  ...over
});

const ctxAt = (temperature: number | null, over: Partial<RecommenderContext> = {}): RecommenderContext => ({
  occasion: '',
  temperature,
  coldThreshold: 15,
  heatThreshold: 25,
  userProfile: { patternAffinity: 0.5, colorAffinities: [] },
  wornHistory: [],
  now: new Date('2026-09-23T12:00:00').getTime(),
  ...over
});

const suggest = (items: Item[], ctx: RecommenderContext) =>
  generateOutfitCombinations(filterItems(items, ctx), ctx);

describe('recommender scenarios', () => {
  it('does not suggest winter pieces at 30°C', () => {
    const winterTop = item({ category: 'top', seasons: ['winter'] });
    const bottom = item({ category: 'bottom', seasons: ['summer'] });
    const result = suggest([winterTop, bottom], ctxAt(30));
    const used = result.flatMap((s) => s.items.map((i) => i.id));
    expect(used).not.toContain(winterTop.id);
  });

  it('does not add a lone winter coat at 22°C', () => {
    const top = item({ category: 'top' });
    const bottom = item({ category: 'bottom' });
    const coat = item({ category: 'outerwear', seasons: ['winter'] });
    const result = suggest([top, bottom, coat], ctxAt(22));
    expect(result.length).toBeGreaterThan(0);
    for (const s of result) expect(s.items.map((i) => i.id)).not.toContain(coat.id);
  });

  describe('hard weather filters', () => {
    const usedIds = (items: Item[], ctx: RecommenderContext) =>
      suggest(items, ctx).flatMap((s) => s.items.map((i) => i.id));

    it('never adds outerwear when it is hot', () => {
      const coat = item({ category: 'outerwear', seasons: ['summer'] });
      const ids = usedIds([item({ category: 'top' }), item({ category: 'bottom' }), coat], ctxAt(30));
      expect(ids).not.toContain(coat.id);
    });

    it('never adds outerwear when the temperature is unknown', () => {
      const coat = item({ category: 'outerwear', seasons: ['spring-fall'] });
      const ids = usedIds([item({ category: 'top' }), item({ category: 'bottom' }), coat], ctxAt(null));
      expect(ids).not.toContain(coat.id);
    });

    it('allows a spring-fall jacket in mild weather', () => {
      const jacket = item({ category: 'outerwear', seasons: ['spring-fall'] });
      const ids = usedIds([item({ category: 'top' }), item({ category: 'bottom' }), jacket], ctxAt(20));
      expect(ids).toContain(jacket.id);
    });

    it('allows a winter coat when it is cold', () => {
      const coat = item({ category: 'outerwear', seasons: ['winter'] });
      const ids = usedIds([item({ category: 'top' }), item({ category: 'bottom' }), coat], ctxAt(5));
      expect(ids).toContain(coat.id);
    });

    it('drops summer-only clothes when it is cold', () => {
      const tank = item({ category: 'top', seasons: ['summer'] });
      const warmTop = item({ category: 'top', seasons: ['winter'] });
      const ids = usedIds([tank, warmTop, item({ category: 'bottom' })], ctxAt(5));
      expect(ids).not.toContain(tank.id);
      expect(ids).toContain(warmTop.id);
    });

    it('keeps multi-season pieces that also fit the weather', () => {
      const top = item({ category: 'top', seasons: ['winter', 'summer'] });
      const ids = usedIds([top, item({ category: 'bottom' })], ctxAt(30));
      expect(ids).toContain(top.id);
    });

    it('does not filter by weather for Indoor', () => {
      const winterTop = item({ category: 'top', seasons: ['winter'] });
      const ids = usedIds([winterTop, item({ category: 'bottom' })], ctxAt(30, { occasion: 'Indoor' }));
      expect(ids).toContain(winterTop.id);
    });
  });

  it('scores black + white at least as high as a contrasting pair (no style selected)', () => {
    const ctx = ctxAt(20);
    const blackTop = item({ category: 'top', selected_color: '#000000' });
    const whiteBottom = item({ category: 'bottom', selected_color: '#ffffff' });
    const redTop = item({ category: 'top', selected_color: '#d62828' });
    const tealBottom = item({ category: 'bottom', selected_color: '#28d6d6' });
    const neutral = computeScore(ctx, blackTop, whiteBottom, null, null);
    const contrast = computeScore(ctx, redTop, tealBottom, null, null);
    expect(neutral.total).toBeGreaterThanOrEqual(contrast.total);
  });

  it('still produces a suggestion with a single pair of trousers', () => {
    const tops = [item({ category: 'top' }), item({ category: 'top' })];
    const bottom = item({ category: 'bottom' });
    const result = suggest([...tops, bottom], ctxAt(20));
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns an empty result when nothing is available (everything dirty)', () => {
    expect(suggest([], ctxAt(20))).toEqual([]);
  });

  it.todo('returns an explanatory reason when the result is empty (needs result shape from Stage 5)');
});
