import type {
  CalendarEntry,
  CombinationStatus,
  Item,
  ScoreBreakdown,
  Suggestion,
  UserStyleProfile
} from './types';

/** Everything the algorithm needs from the outside world (page state). */
export interface RecommenderContext {
  occasion: string;
  temperature: number | null;
  coldThreshold: number;
  heatThreshold: number;
  userProfile: UserStyleProfile;
  wornHistory: CalendarEntry[];
  /** Current time in ms; injectable so tests are deterministic. */
  now?: number;
}

const DAY_MS = 86400000;
const nowOf = (ctx: RecommenderContext) => ctx.now ?? Date.now();

export function buildUserStyleProfile(history: CalendarEntry[]): UserStyleProfile {
  const allItems = history.flatMap((e) => e.outfits?.item_list || []);
  if (!allItems.length) return { patternAffinity: 0.5, colorAffinities: [] };
  const patternCount = allItems.filter((i) => i.is_patterned).length;
  const colorMap: Record<string, number> = {};
  for (const item of allItems) {
    if (item.selected_color) colorMap[item.selected_color] = (colorMap[item.selected_color] || 0) + 1;
  }
  const colorAffinities = Object.entries(colorMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([color]) => color);
  return { patternAffinity: patternCount / allItems.length, colorAffinities };
}

const WEATHER_FILTERED = new Set(['top', 'bottom', 'dress', 'outerwear']);

/**
 * Hard weather filter: removes pieces that are wrong for the temperature
 * (scoring never gets to see them). Untagged / all-season pieces always pass.
 * Indoor skips weather entirely, matching scoreWeatherNorm.
 */
export function fitsWeather(item: Item, ctx: RecommenderContext): boolean {
  if (ctx.occasion === 'Indoor') return true;
  if (!WEATHER_FILTERED.has(item.category)) return true;

  const hot = ctx.temperature !== null && ctx.temperature > ctx.heatThreshold;
  const cold = ctx.temperature !== null && ctx.temperature < ctx.coldThreshold;

  // Outerwear: needs a known, non-hot temperature.
  if (item.category === 'outerwear' && (ctx.temperature === null || hot)) return false;

  const seasons = item.seasons || [];
  if (seasons.length === 0 || seasons.includes('all-season')) return true;
  const suitsWarm = seasons.includes('summer') || seasons.includes('spring-fall');
  const suitsCool = seasons.includes('winter') || seasons.includes('spring-fall');

  if (hot) return suitsWarm;
  if (cold) return suitsCool;
  // Mild: a coat tagged only winter is too heavy; everything else is fine.
  if (item.category === 'outerwear') return suitsWarm;
  return true;
}

export function filterItems(allItems: Item[], ctx: RecommenderContext): Item[] {
  return allItems.filter((item) => {
    if (ctx.occasion && item.occasions && item.occasions.length > 0) {
      if (!item.occasions.includes(ctx.occasion)) return false;
    }
    return fitsWeather(item, ctx);
  });
}

export function scoreWeatherNorm(item: Item, ctx: RecommenderContext): number {
  if (ctx.occasion === 'Indoor') return 0.5;
  if (ctx.temperature === null) return 0.5;
  const seasons = item.seasons || [];
  if (seasons.length === 0 || seasons.includes('all-season')) return 0.7;
  const hot = ctx.temperature > ctx.heatThreshold;
  const cold = ctx.temperature < ctx.coldThreshold;
  const hasSummer = seasons.includes('summer');
  const hasWinter = seasons.includes('winter');
  const hasSpringFall = seasons.includes('spring-fall');
  if (hot) {
    if (hasSummer) return 1.0;
    if (hasSpringFall) return 0.6;
    if (hasWinter) return 0.0;
  }
  if (cold) {
    if (hasWinter) return 1.0;
    if (hasSpringFall) return 0.4;
    if (hasSummer) return 0.0;
  }
  if (hasSpringFall) return 1.0;
  if (hasWinter || hasSummer) return 0.7;
  return 0.5;
}

export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

export function compareHexColors(hex1: string, hex2: string): number {
  try {
    const [h1, s1, l1] = hexToHsl(hex1);
    const [h2, s2, l2] = hexToHsl(hex2);
    const isNeutral = (s: number, l: number) => s < 15 || l < 15 || l > 85;
    if (isNeutral(s1, l1) || isNeutral(s2, l2)) return 0.7;
    const diff = Math.abs(h1 - h2);
    const hueDiff = Math.min(diff, 360 - diff);
    if (hueDiff >= 150 && hueDiff <= 210) return 1.0;
    if (hueDiff <= 15 && Math.abs(s1 - s2) < 20) return 0.85;
    if (hueDiff >= 110 && hueDiff <= 130) return 0.75;
    if (hueDiff > 45 && hueDiff <= 60) return 0.65;
    if (hueDiff >= 15 && hueDiff <= 45 && s1 > 40 && s2 > 40) return 0.1;
    return 0.5;
  } catch { return 0.5; }
}

export function scoreColorNorm(item1: Item | null, item2: Item | null): number {
  const colors1: string[] = item1?.colors?.length ? item1.colors : (item1?.selected_color ? [item1.selected_color] : []);
  const colors2: string[] = item2?.colors?.length ? item2.colors : (item2?.selected_color ? [item2.selected_color] : []);
  if (!colors1.length || !colors2.length) return 0.5;
  let best = 0;
  for (const c1 of colors1) {
    for (const c2 of colors2) {
      const s = compareHexColors(c1, c2);
      if (s > best) best = s;
    }
  }
  return best;
}

export function scorePatternNorm(item1: Item | null, item2: Item | null, ctx: RecommenderContext): number {
  if (!item1 || !item2) return 0.75;
  if (item1.is_patterned && item2.is_patterned)
    return 0.3 + ctx.userProfile.patternAffinity * 0.4;
  if (item1.is_patterned || item2.is_patterned) return 1.0;
  return 0.65 + (1 - ctx.userProfile.patternAffinity) * 0.2;
}

export function scoreColorAffinityBonus(outfitItems: Item[], ctx: RecommenderContext): number {
  if (!ctx.userProfile.colorAffinities.length) return 0;
  const matches = outfitItems.filter((i) => i.selected_color && ctx.userProfile.colorAffinities.includes(i.selected_color)).length;
  return Math.min(matches * 0.12, 0.3);
}

export function scoreShoeColorNorm(shoes: Item | null, bottom: Item | null, top: Item | null): number {
  if (!shoes?.selected_color) return 0.6;
  try {
    const [, , lSh] = hexToHsl(shoes.selected_color);
    if (lSh < 15 || lSh > 85) return 0.85;
    const ref = bottom || top;
    if (!ref?.selected_color) return 0.6;
    const [h1, , l1] = hexToHsl(shoes.selected_color);
    const [h2, , l2] = hexToHsl(ref.selected_color);
    if (l1 < 15 || l1 > 85 || l2 < 15 || l2 > 85) return 0.8;
    const hueDiff = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
    if (hueDiff <= 20) return 0.9;
    if (hueDiff >= 150 && hueDiff <= 210) return 0.8;
    if (hueDiff > 20 && hueDiff <= 60) return 0.45;
    return 0.65;
  } catch { return 0.6; }
}

export function scoreAccessoryColorNorm(
  accessory: Item | null,
  top: Item | null,
  bottom: Item | null
): { score: number; note: string } {
  if (!accessory?.selected_color) return { score: 0.6, note: '' };
  try {
    const [h, s, l] = hexToHsl(accessory.selected_color);
    if (s < 20 || l < 15 || l > 85) return { score: 0.75, note: '' };
    const isSilver = l > 65 && s < 25;
    const isGold = h >= 35 && h <= 65 && s > 25 && l > 35 && l < 78;
    const outfitHues = [top, bottom]
      .filter((i): i is Item => !!i?.selected_color)
      .map((i) => hexToHsl(i.selected_color as string)[0]);
    if (!outfitHues.length) return { score: 0.7, note: '' };
    const avgHue = outfitHues.reduce((a, b) => a + b, 0) / outfitHues.length;
    const isWarm = avgHue <= 60 || avgHue >= 300;
    const isCool = avgHue >= 120 && avgHue <= 270;
    if (isGold && isWarm) return { score: 1.0, note: '✨ Gold match' };
    if (isSilver && isCool) return { score: 1.0, note: '🪙 Silver match' };
    if (isGold && isCool) return { score: 0.45, note: '' };
    if (isSilver && isWarm) return { score: 0.45, note: '' };
    return { score: 0.7, note: '' };
  } catch { return { score: 0.6, note: '' }; }
}

export function checkCombinationHistory(
  topId: number,
  bottomId: number,
  ctx: RecommenderContext
): CombinationStatus {
  if (!ctx.wornHistory.length) return 'none';
  const now = nowOf(ctx);
  const sevenDaysAgo = now - 7 * DAY_MS;
  const sixMonthsAgo = now - 180 * DAY_MS;
  let foundInSixMonths = false;

  for (const entry of ctx.wornHistory) {
    const entryTime = new Date(entry.date + 'T12:00:00').getTime();
    if (entryTime < sixMonthsAgo) continue;
    const ids: number[] = (entry.outfits?.item_list || []).map((i) => i.id);
    if (ids.includes(topId) && ids.includes(bottomId)) {
      if (entryTime >= sevenDaysAgo) return 'recent_repeat';
      foundInSixMonths = true;
    }
  }
  return foundInSixMonths ? 'co_occurrence' : 'none';
}

export function scoreHistoryNorm(item: Item, ctx: RecommenderContext): number {
  const now = nowOf(ctx);
  if (item.recent_repeat_date) {
    const d = (now - new Date(item.recent_repeat_date).getTime()) / DAY_MS;
    if (d <= 7) return 0.0;
  }
  if (item.last_worn_date) {
    const d = (now - new Date(item.last_worn_date).getTime()) / DAY_MS;
    if (d <= 7) return 0.1;
    if (d <= 30) return 1.0;
    if (d <= 60) return 0.7;
    return 0.4;
  }
  return 0.6;
}

export function computeScore(
  ctx: RecommenderContext,
  top: Item | null,
  bottom: Item | null,
  outerwear: Item | null,
  shoes: Item | null,
  accessory: Item | null = null,
  isDress = false
): ScoreBreakdown {
  const allItems = [top, bottom, outerwear, shoes, accessory].filter((i): i is Item => !!i);
  const coreItems = (isDress ? [bottom] : [top, bottom]).filter((i): i is Item => !!i);

  const w = allItems.length
    ? allItems.reduce((s, item) => s + scoreWeatherNorm(item, ctx), 0) / allItems.length
    : 0.5;

  const affinityBonus = scoreColorAffinityBonus(allItems, ctx);
  const topBottomColor = isDress ? 0.5 : scoreColorNorm(top, bottom);
  const shoeColor = scoreShoeColorNorm(shoes, bottom, top);
  const accResult = scoreAccessoryColorNorm(accessory, top, bottom);

  let c: number;
  if (shoes && accessory) {
    c = topBottomColor * 0.6 + shoeColor * 0.3 + accResult.score * 0.1;
  } else if (shoes) {
    c = topBottomColor * 0.7 + shoeColor * 0.3;
  } else if (accessory) {
    c = topBottomColor * 0.9 + accResult.score * 0.1;
  } else {
    c = topBottomColor;
  }
  c = Math.min(1.0, c + affinityBonus);

  const p = isDress ? 0.75 : scorePatternNorm(top, bottom, ctx);

  let h = coreItems.length
    ? coreItems.reduce((s, item) => s + scoreHistoryNorm(item, ctx), 0) / coreItems.length
    : 0.6;

  let combinationStatus: CombinationStatus = 'none';
  if (!isDress && top && bottom) {
    combinationStatus = checkCombinationHistory(top.id, bottom.id, ctx);
    if (combinationStatus === 'recent_repeat') {
      h = 0.0;
    } else if (combinationStatus === 'co_occurrence') {
      h = Math.min(1.0, h + 0.3);
    }
  }

  const weather = Math.round(w * 40);
  const color = Math.round(c * 30);
  const pattern = Math.round(p * 15);
  const history = Math.round(h * 15);
  return {
    total: weather + color + pattern + history,
    weather,
    color,
    pattern,
    history,
    combinationStatus,
    accessoryNote: accResult.note
  };
}

function pickBest(list: Item[], score: (item: Item) => number): Item | null {
  return list.length ? list.reduce((best, x) => (score(x) >= score(best) ? x : best)) : null;
}

export function generateOutfitCombinations(filtered: Item[], ctx: RecommenderContext): Suggestion[] {
  const tops = filtered.filter((i) => i.category === 'top');
  const bottoms = filtered.filter((i) => i.category === 'bottom');
  const dresses = filtered.filter((i) => i.category === 'dress');
  const outerwear = filtered.filter((i) => i.category === 'outerwear');
  const shoes = filtered.filter((i) => i.category === 'shoes');
  const accessories = filtered.filter((i) => i.category === 'accessory');
  const combinations: Suggestion[] = [];

  for (const top of tops) {
    for (const bottom of bottoms) {
      const bestOuterwearCandidate = pickBest(outerwear, (o) => scoreWeatherNorm(o, ctx));
      const bestOuterwear =
        bestOuterwearCandidate && ctx.temperature !== null && ctx.temperature <= ctx.heatThreshold
          ? bestOuterwearCandidate
          : null;
      const bestShoes = pickBest(shoes, (s) => scoreWeatherNorm(s, ctx));
      const bestAccessory = pickBest(accessories, (a) => scoreAccessoryColorNorm(a, top, bottom).score);

      const scoreData = computeScore(ctx, top, bottom, bestOuterwear, bestShoes, bestAccessory);
      if (scoreData.total >= 30) {
        combinations.push({
          items: [top, bottom, bestOuterwear, bestShoes, bestAccessory].filter((i): i is Item => !!i),
          score: scoreData.total,
          scoreBreakdown: scoreData,
          type: 'top+bottom'
        });
      }
    }
  }

  for (const dress of dresses) {
    const bestOuterwear = pickBest(outerwear, (o) => scoreWeatherNorm(o, ctx));
    const bestShoes = pickBest(shoes, (s) => scoreWeatherNorm(s, ctx));
    const bestAccessory = pickBest(accessories, (a) => scoreAccessoryColorNorm(a, dress, null).score);

    const scoreData = computeScore(ctx, null, dress, bestOuterwear, bestShoes, bestAccessory, true);
    if (scoreData.total >= 30) {
      combinations.push({
        items: [dress, bestOuterwear, bestShoes, bestAccessory].filter((i): i is Item => !!i),
        score: scoreData.total,
        scoreBreakdown: scoreData,
        type: 'dress'
      });
    }
  }

  return combinations
    .sort((a, b) => b.score - a.score)
    .filter((combo, index, arr) => {
      const topId = combo.items.find((i) => i.category === 'top' || i.category === 'dress')?.id;
      const bottomId = combo.items.find((i) => i.category === 'bottom')?.id;
      const key = `${topId}-${bottomId}`;
      return (
        arr.findIndex((c) => {
          const cTopId = c.items.find((i) => i.category === 'top' || i.category === 'dress')?.id;
          const cBottomId = c.items.find((i) => i.category === 'bottom')?.id;
          return `${cTopId}-${cBottomId}` === key;
        }) === index
      );
    })
    .reduce((unique: Suggestion[], combo) => {
      if (unique.length >= 3) return unique;
      const bottomId = combo.items.find((i) => i.category === 'bottom' || i.category === 'dress')?.id;
      const topId = combo.items.find((i) => i.category === 'top')?.id;
      if (unique.some((c) => c.items.find((i) => i.category === 'bottom' || i.category === 'dress')?.id === bottomId)) return unique;
      if (topId && unique.some((c) => c.items.find((i) => i.category === 'top')?.id === topId)) return unique;
      unique.push(combo);
      return unique;
    }, []);
}
