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

    describe('outerwear decision (cold threshold 15, heat 25)', () => {
      const base = () => [item({ category: 'top' }), item({ category: 'bottom' })];

      it('does not add an all-season coat at 24°C', () => {
        const coat = item({ category: 'outerwear', seasons: ['all-season'] });
        expect(usedIds([...base(), coat], ctxAt(24))).not.toContain(coat.id);
      });

      it('adds a light jacket just above the cold threshold', () => {
        const jacket = item({ category: 'outerwear', seasons: ['spring-fall'] });
        expect(usedIds([...base(), jacket], ctxAt(17))).toContain(jacket.id);
      });

      it('does not add a winter-only coat just above the cold threshold', () => {
        const coat = item({ category: 'outerwear', seasons: ['winter'] });
        expect(usedIds([...base(), coat], ctxAt(17))).not.toContain(coat.id);
      });

      it('uses the user-chosen light jacket limit instead of the default', () => {
        const jacket = item({ category: 'outerwear', seasons: ['spring-fall'] });
        // default limit is cold+5 = 20: no jacket at 22°C
        expect(usedIds([...base(), jacket], ctxAt(22))).not.toContain(jacket.id);
        // user raises the limit to 23°C: jacket appears at 22°C
        expect(usedIds([...base(), jacket], ctxAt(22, { lightOuterwearMax: 23 }))).toContain(jacket.id);
        // user lowers it to 16°C: no jacket at 18°C
        expect(usedIds([...base(), jacket], ctxAt(18, { lightOuterwearMax: 16 }))).not.toContain(jacket.id);
      });

      it('never adds a light jacket above the heat threshold even if the limit is set higher', () => {
        const jacket = item({ category: 'outerwear', seasons: ['spring-fall'] });
        expect(usedIds([...base(), jacket], ctxAt(28, { lightOuterwearMax: 35 }))).not.toContain(jacket.id);
      });

      it('requires outerwear below the cold threshold: every suggestion includes one', () => {
        const coat = item({ category: 'outerwear', seasons: ['winter'] });
        const result = suggest([...base(), coat], ctxAt(10));
        expect(result.length).toBeGreaterThan(0);
        for (const s of result) {
          expect(s.items.map((i) => i.id)).toContain(coat.id);
          expect(s.outerwearMissing).toBeFalsy();
        }
      });

      it('flags outerwearMissing when it is cold and there is no suitable coat', () => {
        const summerJacket = item({ category: 'outerwear', seasons: ['summer'] });
        const result = suggest([...base(), summerJacket], ctxAt(5));
        expect(result.length).toBeGreaterThan(0);
        for (const s of result) expect(s.outerwearMissing).toBe(true);
      });

      it('never adds outerwear for Indoor, with top+bottom or a dress', () => {
        const coat = item({ category: 'outerwear', seasons: ['all-season'] });
        const dress = item({ category: 'dress' });
        const ids = usedIds([...base(), dress, coat], ctxAt(5, { occasion: 'Indoor' }));
        expect(ids).not.toContain(coat.id);
      });

      it('applies the same rule to dresses (no coat in the heat, coat in the cold)', () => {
        const coat = item({ category: 'outerwear', seasons: ['winter'] });
        const dress = item({ category: 'dress' });
        expect(usedIds([dress, coat], ctxAt(30))).not.toContain(coat.id);
        expect(usedIds([dress, coat], ctxAt(5))).toContain(coat.id);
      });
    });

    it('drops winter boots when it is hot but keeps all-season sneakers', () => {
      const boots = item({ category: 'shoes', seasons: ['winter'] });
      const sneakers = item({ category: 'shoes', seasons: ['all-season'] });
      const ids = usedIds([item({ category: 'top' }), item({ category: 'bottom' }), boots, sneakers], ctxAt(30));
      expect(ids).not.toContain(boots.id);
      expect(ids).toContain(sneakers.id);
    });

    it('leaves the outfit without shoes rather than adding winter boots in the heat', () => {
      const boots = item({ category: 'shoes', seasons: ['winter'] });
      const result = suggest([item({ category: 'top' }), item({ category: 'bottom' }), boots], ctxAt(30));
      expect(result.length).toBeGreaterThan(0);
      expect(result.flatMap((s) => s.items.map((i) => i.id))).not.toContain(boots.id);
    });

    it('drops summer sandals when it is cold', () => {
      const sandals = item({ category: 'shoes', seasons: ['summer'] });
      const boots = item({ category: 'shoes', seasons: ['winter'] });
      const ids = usedIds([item({ category: 'top' }), item({ category: 'bottom' }), sandals, boots], ctxAt(5));
      expect(ids).not.toContain(sandals.id);
      expect(ids).toContain(boots.id);
    });

    it('drops a winter scarf (accessory) when it is hot', () => {
      const scarf = item({ category: 'accessory', seasons: ['winter'] });
      const bag = item({ category: 'accessory', seasons: [] });
      const ids = usedIds([item({ category: 'top' }), item({ category: 'bottom' }), scarf, bag], ctxAt(30));
      expect(ids).not.toContain(scarf.id);
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
