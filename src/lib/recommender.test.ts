import { describe, expect, it } from 'vitest';
import {
  checkCombinationHistory,
  computeScore,
  diagnoseEmpty,
  filterItems,
  fitsWeather,
  generateOutfitCombinations,
  scoreWeatherNorm
} from './recommender';
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

const suggest = (items: Item[], ctx: RecommenderContext, limit?: number) =>
  generateOutfitCombinations(filterItems(items, ctx), ctx, limit);

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

    it('accessories are not part of the suggestions at all (belts, jewellery, bags have no model yet)', () => {
      const scarf = item({ category: 'accessory', seasons: ['winter'] });
      const bag = item({ category: 'accessory', seasons: [] });
      const dress = item({ category: 'dress' });
      for (const t of [5, 20, 30]) {
        const result = suggest([item({ category: 'top' }), item({ category: 'bottom' }), dress, scarf, bag], ctxAt(t));
        expect(result.length).toBeGreaterThan(0);
        for (const s of result) {
          expect(s.items.some((i) => i.category === 'accessory')).toBe(false);
        }
      }
    });

    it('a wardrobe of only accessories gives no outfit, and says why', () => {
      const bag = item({ category: 'accessory' });
      expect(suggest([bag], ctxAt(20))).toEqual([]);
      expect(diagnoseEmpty([bag], ctxAt(20)).reason).toBe('missing-category');
    });

    it('does not filter by weather for Indoor', () => {
      const winterTop = item({ category: 'top', seasons: ['winter'] });
      const ids = usedIds([winterTop, item({ category: 'bottom' })], ctxAt(30, { occasion: 'Indoor' }));
      expect(ids).toContain(winterTop.id);
    });
  });

  describe('mild weather: pieces from the wrong end of the season range are penalised softly', () => {
    const weather = (seasons: string[], t: number) =>
      scoreWeatherNorm(item({ category: 'top', seasons }), ctxAt(t)); // cold 15, heat 25

    it('summer-only pieces score below all-season ones just above the cold threshold', () => {
      expect(weather(['summer'], 16)).toBeLessThan(weather(['all-season'], 16));
    });

    it('winter-only pieces score below all-season ones just below the heat threshold', () => {
      expect(weather(['winter'], 24)).toBeLessThan(weather(['all-season'], 24));
    });

    it('the penalty fades towards the matching end: summer gets better as it warms up', () => {
      expect(weather(['summer'], 24)).toBeGreaterThan(weather(['summer'], 16));
      expect(weather(['winter'], 16)).toBeGreaterThan(weather(['winter'], 24));
    });

    it('spring-fall pieces stay at the top in the whole mild range, tags with both ends count as all-season', () => {
      for (const t of [15, 18, 22, 25]) expect(weather(['spring-fall'], t)).toBe(1);
      expect(weather(['summer', 'winter'], 20)).toBe(weather(['all-season'], 20));
    });

    it('does not ban: a summer-only piece is still suggested at 16°C when it is all there is', () => {
      const shorts = item({ category: 'bottom', seasons: ['summer'] });
      expect(suggest([item({ category: 'top' }), shorts], ctxAt(16)).length).toBe(1);
    });

    it('prefers all-season trousers over shorts at 16°C', () => {
      const shorts = item({ category: 'bottom', seasons: ['summer'], selected_color: '#808080' });
      const jeans = item({ category: 'bottom', seasons: ['all-season'], selected_color: '#808080' });
      const top = item({ category: 'top', selected_color: '#808080' });
      expect(suggest([top, shorts, jeans], ctxAt(16))[0].items.map((i) => i.id)).toContain(jeans.id);
    });
  });

  describe('side pieces (outerwear, shoes)', () => {
    const grid = (n: number) => ({
      tops: Array.from({ length: n }, () => item({ category: 'top', selected_color: '#808080' })),
      bottoms: Array.from({ length: n }, () => item({ category: 'bottom', selected_color: '#101010' }))
    });
    const idsOf = (list: { items: Item[] }[], category: string) =>
      list.map((s) => s.items.find((i) => i.category === category)?.id);

    it('rotates equally good shoes across the suggestions instead of repeating one pair', () => {
      const { tops, bottoms } = grid(3);
      const shoes = [1, 2, 3].map(() => item({ category: 'shoes', selected_color: '#808080' }));
      const result = suggest([...tops, ...bottoms, ...shoes], ctxAt(20), 6);
      expect(new Set(idsOf(result, 'shoes')).size).toBeGreaterThanOrEqual(2);
    });

    it('rotates equally good coats when it is cold', () => {
      const { tops, bottoms } = grid(3);
      const coats = [1, 2].map(() => item({ category: 'outerwear', seasons: ['winter'], selected_color: '#808080' }));
      const result = suggest([...tops, ...bottoms, ...coats], ctxAt(5), 6);
      expect(new Set(idsOf(result, 'outerwear')).size).toBe(2);
      for (const s of result) expect(s.outerwearMissing).toBeFalsy();
    });

    it('still uses the only pair of shoes everywhere', () => {
      const { tops, bottoms } = grid(2);
      const shoes = item({ category: 'shoes', selected_color: '#808080' });
      const result = suggest([...tops, ...bottoms, shoes], ctxAt(20), 4);
      expect(idsOf(result, 'shoes').every((id) => id === shoes.id)).toBe(true);
    });

    it('rotation never swaps in a clashing pair when a harmonious one is available', () => {
      const { tops, bottoms } = grid(3);
      const good = [1, 2].map(() => item({ category: 'shoes', selected_color: '#808080' }));
      const loud = item({
        category: 'shoes',
        selected_color: '#d62828',
        is_patterned: true,
        colors: ['#d62828', '#28d628', '#2828d6']
      });
      const result = suggest([...tops, ...bottoms, ...good, loud], ctxAt(20), 6);
      expect(idsOf(result, 'shoes')).not.toContain(loud.id);
    });

    it('scores stay consistent after rotation (breakdown matches the final pieces)', () => {
      const { tops, bottoms } = grid(3);
      const shoes = [1, 2, 3].map(() => item({ category: 'shoes', selected_color: '#808080' }));
      for (const s of suggest([...tops, ...bottoms, ...shoes], ctxAt(20), 6)) {
        const [top, bottom, , sh] = [
          s.items.find((i) => i.category === 'top')!,
          s.items.find((i) => i.category === 'bottom')!,
          null,
          s.items.find((i) => i.category === 'shoes') ?? null
        ];
        expect(computeScore(ctxAt(20), top, bottom, null, sh).total).toBe(s.score);
      }
    });
  });

  describe('season tags are normalised', () => {
    const pass = (seasons: string[], t: number) => fitsWeather(item({ category: 'top', seasons }), ctxAt(t));

    it('capitalised English values work', () => {
      expect(pass(['Summer'], 30)).toBe(true);
      expect(pass(['Winter'], 30)).toBe(false);
      expect(pass(['Autumn'], 30)).toBe(true);
    });

    it('Turkish values work', () => {
      expect(pass(['yaz'], 30)).toBe(true);
      expect(pass(['kış'], 30)).toBe(false);
      expect(pass(['kış'], 5)).toBe(true);
    });

    it('unknown values are ignored: the piece is treated as untagged', () => {
      expect(pass(['whatever'], 30)).toBe(true);
      expect(pass(['whatever'], 5)).toBe(true);
    });
  });

  describe('occasion: an explicit match is rewarded, never required', () => {
    const base = (over: Partial<Item>) => item({ category: 'top', selected_color: '#101010', ...over });

    it('a piece tagged for the selected occasion outranks an untagged one with the same look', () => {
      const tagged = base({ occasions: ['Formal'] });
      const untagged = base({ occasions: [] });
      const bottom = item({ category: 'bottom', selected_color: '#ffffff', occasions: ['Formal'] });
      const result = suggest([untagged, tagged, bottom], ctxAt(20, { occasion: 'Formal' }));
      expect(result.length).toBe(2);
      expect(result[0].items.map((i) => i.id)).toContain(tagged.id);
      expect(result[0].score).toBeGreaterThan(result[1].score);
    });

    it('untagged pieces are still allowed (soft preference, no ban)', () => {
      const untagged = base({ occasions: [] });
      const bottom = item({ category: 'bottom', occasions: [] });
      expect(suggest([untagged, bottom], ctxAt(20, { occasion: 'Formal' })).length).toBe(1);
    });

    it('without an occasion there is no occasion criterion', () => {
      const b = computeScore(ctxAt(20), base({}), item({ category: 'bottom' }), null, null);
      expect(b.max.occasion).toBe(0);
      expect(b.occasion).toBe(0);
    });

    it('with an occasion the criteria still sum to 100', () => {
      const b = computeScore(ctxAt(20, { occasion: 'Casual' }), base({ occasions: ['Casual'] }), item({ category: 'bottom' }), null, null);
      const m = b.max;
      expect(m.weather + m.color + m.pattern + m.silhouette + m.history + m.occasion).toBe(100);
      expect(m.occasion).toBeGreaterThan(0);
    });

    it('with a style and an occasion the criteria also sum to 100', () => {
      const b = computeScore(ctxAt(20, { occasion: 'Casual', style: 'minimal' }), base({}), item({ category: 'bottom' }), null, null);
      const m = b.max;
      expect(m.weather + m.color + m.pattern + m.silhouette + m.history + m.occasion).toBe(100);
    });
  });

  describe('explaining an empty result', () => {
    const diagnose = (items: Item[], ctx: RecommenderContext) => diagnoseEmpty(items, ctx);

    it('no clean items at all', () => {
      expect(diagnose([], ctxAt(20)).reason).toBe('no-items');
    });

    it('everything is tagged for another occasion', () => {
      const items = [
        item({ category: 'top', occasions: ['Sport'] }),
        item({ category: 'bottom', occasions: ['Sport'] })
      ];
      const d = diagnose(items, ctxAt(20, { occasion: 'Formal' }));
      expect(d.reason).toBe('occasion');
      expect(d.message).toContain('Formal');
    });

    it('the weather removes the only pieces', () => {
      const items = [item({ category: 'top', seasons: ['winter'] }), item({ category: 'bottom', seasons: ['winter'] })];
      const d = diagnose(items, ctxAt(30));
      expect(d.reason).toBe('weather');
      expect(d.message).toContain('30');
    });

    it('a basic category is missing', () => {
      const d = diagnose([item({ category: 'top' })], ctxAt(20));
      expect(d.reason).toBe('missing-category');
      expect(d.message.toLowerCase()).toContain('bottom');
    });

    it('a diagnosis is only meaningful when the result is empty: a normal wardrobe is not explained away', () => {
      const items = [item({ category: 'top' }), item({ category: 'bottom' })];
      expect(suggest(items, ctxAt(20)).length).toBe(1);
      expect(diagnose(items, ctxAt(20)).reason).toBe('unknown');
    });
  });

  describe('robustness', () => {
    it('skips a worn-history entry with a malformed date instead of counting it', () => {
      const entry = { date: 'garbage', is_worn: true, outfits: { item_list: [{ id: 1 }, { id: 2 }] } };
      const status = checkCombinationHistory(1, 2, ctxAt(20, { wornHistory: [entry as any] }));
      expect(status).toBe('none');
    });

    it('chooses the same pieces whatever the wardrobe order (ties go to the lowest id)', () => {
      const top = item({ category: 'top' });
      const bottom = item({ category: 'bottom' });
      const shoesA = item({ category: 'shoes', selected_color: '#808080' });
      const shoesB = item({ category: 'shoes', selected_color: '#808080' });
      const pick = (list: Item[]) => suggest(list, ctxAt(20))[0].items.find((i) => i.category === 'shoes')!.id;
      expect(pick([top, bottom, shoesA, shoesB])).toBe(pick([shoesB, shoesA, bottom, top]));
      expect(pick([top, bottom, shoesA, shoesB])).toBe(Math.min(shoesA.id, shoesB.id));
    });

    it('returns the same top list whatever the wardrobe order', () => {
      const wardrobe = [1, 2, 3].flatMap(() => [item({ category: 'top' }), item({ category: 'bottom' })]);
      const ids = (list: Item[]) => suggest(list, ctxAt(20)).map((s) => s.items.map((i) => i.id).join('-'));
      expect(ids(wardrobe)).toEqual(ids([...wardrobe].reverse()));
    });
  });

  describe('diverse selection (no repeated piece unless needed)', () => {
    const coreIds = (s: { items: Item[] }) =>
      s.items.filter((i) => ['top', 'bottom', 'dress'].includes(i.category)).map((i) => i.id);

    it('does not repeat the same bottom in the first suggestions when alternatives exist', () => {
      const tops = [1, 2, 3, 4].map(() => item({ category: 'top' }));
      const bottoms = [1, 2, 3].map(() => item({ category: 'bottom' }));
      const result = suggest([...tops, ...bottoms], ctxAt(20), 3);
      expect(result).toHaveLength(3);
      const usedBottoms = result.map((s) => s.items.find((i) => i.category === 'bottom')!.id);
      expect(new Set(usedBottoms).size).toBe(3);
    });

    it('still gives several suggestions with only one bottom', () => {
      const tops = [1, 2, 3, 4].map(() => item({ category: 'top' }));
      const result = suggest([...tops, item({ category: 'bottom' })], ctxAt(20), 4);
      expect(result).toHaveLength(4);
      expect(new Set(result.map((s) => s.items.find((i) => i.category === 'top')!.id)).size).toBe(4);
    });

    it('returns up to 10 suggestions by default', () => {
      const tops = Array.from({ length: 5 }, () => item({ category: 'top' }));
      const bottoms = Array.from({ length: 5 }, () => item({ category: 'bottom' }));
      expect(suggest([...tops, ...bottoms], ctxAt(20)).length).toBe(10);
    });

    it('never returns the same top+bottom pair twice', () => {
      const result = suggest([item({ category: 'top' }), item({ category: 'top' }), item({ category: 'bottom' })], ctxAt(20), 10);
      const keys = result.map((s) => coreIds(s).join('-'));
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('prefers the better outfit when penalties are equal', () => {
      const good = item({ category: 'top', selected_color: '#000000' });
      const loud = item({ category: 'top', selected_color: '#d62828' });
      const bottom = item({ category: 'bottom', selected_color: '#ffffff' });
      const result = suggest([good, loud, bottom], ctxAt(20), 2);
      expect(result).toHaveLength(2);
      expect(result[0].scoreBreakdown.total).toBeGreaterThanOrEqual(result[1].scoreBreakdown.total);
    });
  });

  describe('daily style', () => {
    const neutralOutfit = () => [
      item({ category: 'top', selected_color: '#000000' }),
      item({ category: 'bottom', selected_color: '#ffffff' })
    ];
    const loudOutfit = () => [
      item({ category: 'top', selected_color: '#d62828' }),
      item({ category: 'bottom', selected_color: '#28d6d6' })
    ];
    const total = (items: Item[], style: RecommenderContext['style']) => {
      const [top, bottom] = items;
      return computeScore(ctxAt(20, { style }), top, bottom, null, null).total;
    };

    it('minimal ranks an all-neutral outfit above a loud one', () => {
      expect(total(neutralOutfit(), 'minimal')).toBeGreaterThan(total(loudOutfit(), 'minimal'));
    });

    it('maximalist ranks a loud outfit above an all-neutral one', () => {
      expect(total(loudOutfit(), 'maximalist')).toBeGreaterThan(total(neutralOutfit(), 'maximalist'));
    });

    it('selecting no style behaves like before (neutral not below complementary)', () => {
      expect(total(neutralOutfit(), null)).toBeGreaterThanOrEqual(total(loudOutfit(), null));
    });

    it('pattern tolerance follows the style: minimal prefers solids, maximalist prefers a print', () => {
      const solid = item({ category: 'top', selected_color: '#101010' });
      const print = item({ category: 'top', selected_color: '#101010', is_patterned: true });
      const bottom = item({ category: 'bottom', selected_color: '#ffffff' });
      const total = (top: Item, style: RecommenderContext['style']) =>
        computeScore(ctxAt(20, { style }), top, bottom, null, null).total;
      expect(total(solid, 'minimal')).toBeGreaterThan(total(print, 'minimal'));
      expect(total(print, 'maximalist')).toBeGreaterThan(total(solid, 'maximalist'));
    });

    it('without a style the old pattern rule is unchanged (one print beats two solids)', () => {
      const solid = item({ category: 'top', selected_color: '#101010' });
      const print = item({ category: 'top', selected_color: '#101010', is_patterned: true });
      const bottom = item({ category: 'bottom', selected_color: '#ffffff' });
      const total = (top: Item) => computeScore(ctxAt(20), top, bottom, null, null).total;
      expect(total(print)).toBeGreaterThanOrEqual(total(solid));
    });

    describe('silhouette (fit)', () => {
      const fitted = (topFit: string | null, bottomFit: string | null) => ({
        top: item({ category: 'top', selected_color: '#101010', fit: topFit }),
        bottom: item({ category: 'bottom', selected_color: '#ffffff', fit: bottomFit })
      });
      const total = (p: { top: Item; bottom: Item }, style: RecommenderContext['style']) =>
        computeScore(ctxAt(20, { style }), p.top, p.bottom, null, null).total;

      it('streetwear prefers loose over slim; girl casual prefers fitted over oversized', () => {
        expect(total(fitted('loose', 'loose'), 'streetwear')).toBeGreaterThan(total(fitted('slim', 'slim'), 'streetwear'));
        expect(total(fitted('slim', 'slim'), 'girl-casual')).toBeGreaterThan(total(fitted('loose', 'loose'), 'girl-casual'));
      });

      it('fit is ignored when no style is selected', () => {
        expect(total(fitted('loose', 'loose'), null)).toBe(total(fitted('slim', 'slim'), null));
      });

      it('missing fits are neutral: they are never the best or the worst for a style', () => {
        const unknown = total(fitted(null, null), 'streetwear');
        expect(unknown).toBeLessThan(total(fitted('loose', 'loose'), 'streetwear'));
        expect(unknown).toBeGreaterThan(total(fitted('slim', 'slim'), 'streetwear'));
      });

      it('reports the silhouette type and the maxima of the criteria in the breakdown', () => {
        const p = fitted('loose', 'slim');
        const b = computeScore(ctxAt(20, { style: 'streetwear' }), p.top, p.bottom, null, null);
        expect(b.silhouetteType).toBe('contrast');
        expect(b.max.weather + b.max.color + b.max.pattern + b.max.silhouette + b.max.history + b.max.occasion).toBe(100);
        const none = computeScore(ctxAt(20), p.top, p.bottom, null, null);
        expect(none.max.silhouette).toBe(0);
        expect(none.max.weather + none.max.color + none.max.pattern + none.max.history + none.max.occasion).toBe(100);
      });

      it('a style never removes an outfit because of its fit', () => {
        const items = [fitted('loose', 'loose').top, fitted('loose', 'loose').bottom];
        expect(suggest(items, ctxAt(20, { style: 'minimal' })).length).toBe(1);
      });
    });

    it('never filters anything out: a loud outfit is still suggested for minimal', () => {
      const result = suggest(loudOutfit(), ctxAt(20, { style: 'minimal' }));
      expect(result.length).toBeGreaterThan(0);
    });

    it('picks shoes that fit the selected style', () => {
      const top = item({ category: 'top', selected_color: '#000000' });
      const bottom = item({ category: 'bottom', selected_color: '#ffffff' });
      const redShoes = item({ category: 'shoes', selected_color: '#d62828' });
      const greyShoes = item({ category: 'shoes', selected_color: '#808080' });
      const ids = (style: RecommenderContext['style']) =>
        suggest([top, bottom, redShoes, greyShoes], ctxAt(20, { style })).flatMap((s) => s.items.map((i) => i.id));
      expect(ids('minimal')).toContain(greyShoes.id);
      expect(ids('maximalist')).toContain(redShoes.id);
    });
  });

  describe('colour-aware piece selection', () => {
    const outfit = () => [
      item({ category: 'top', selected_color: '#000000' }),
      item({ category: 'bottom', selected_color: '#808080' })
    ];

    it('picks neutral shoes over clashing ones for the same weather score', () => {
      const redTop = item({ category: 'top', selected_color: '#d62828' });
      const greyBottom = item({ category: 'bottom', selected_color: '#808080' });
      const green = item({ category: 'shoes', selected_color: '#28d628' });
      const black = item({ category: 'shoes', selected_color: '#101010' });
      const ids = suggest([redTop, greyBottom, green, black], ctxAt(20)).flatMap((s) => s.items.map((i) => i.id));
      expect(ids).toContain(black.id);
      expect(ids).not.toContain(green.id);
    });

    it('reports the harmony type in the score breakdown', () => {
      const [top, bottom] = outfit();
      expect(computeScore(ctxAt(20), top, bottom, null, null).colorHarmony).toBe('neutral');
    });

    it('scores dresses with the same colour model (clashing shoes lower the score)', () => {
      const dress = item({ category: 'dress', selected_color: '#d62828' });
      const calm = computeScore(ctxAt(20), null, dress, null, item({ category: 'shoes', selected_color: '#101010' }), true);
      const loud = computeScore(ctxAt(20), null, dress, null, item({ category: 'shoes', selected_color: '#28d628' }), true);
      expect(calm.total).toBeGreaterThan(loud.total);
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

});
