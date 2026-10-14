import { scoreOutfitColor } from './colorHarmony';
import { colorScoresForStyle, patternScoreForStyle, toneScoresForStyle } from './styles';
import type { StyleId } from './styles';
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
  /** Style picked for today; null/undefined = no style (neutral colour table). */
  style?: StyleId | null;
  /** Highest temperature (°C) where a light jacket is still added; defaults to coldThreshold + LIGHT_OUTERWEAR_BUFFER. */
  lightOuterwearMax?: number | null;
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

/** Degrees above the cold threshold where a light jacket is still worth adding. */
export const LIGHT_OUTERWEAR_BUFFER = 5;

export type OuterwearMode = 'none' | 'light' | 'required';

/**
 * The single place that decides whether an outfit gets outerwear:
 * below the cold threshold -> required; from there up to the user's light jacket
 * limit (default: cold + LIGHT_OUTERWEAR_BUFFER, never past the heat threshold)
 * -> a light jacket; otherwise none.
 * Unknown temperature and Indoor never get outerwear.
 */
export function outerwearMode(ctx: RecommenderContext): OuterwearMode {
  if (ctx.occasion === 'Indoor' || ctx.temperature === null) return 'none';
  if (ctx.temperature < ctx.coldThreshold) return 'required';
  const lightLimit = Math.min(
    ctx.lightOuterwearMax ?? ctx.coldThreshold + LIGHT_OUTERWEAR_BUFFER,
    ctx.heatThreshold
  );
  return ctx.temperature <= lightLimit ? 'light' : 'none';
}

/**
 * Hard weather filter: removes pieces that are wrong for the temperature
 * (scoring never gets to see them). Untagged / all-season pieces always pass.
 * Indoor skips weather entirely, matching scoreWeatherNorm.
 */
export function fitsWeather(item: Item, ctx: RecommenderContext): boolean {
  if (item.category === 'outerwear') {
    const mode = outerwearMode(ctx);
    if (mode === 'none') return false;
    const seasons = item.seasons || [];
    if (seasons.length === 0 || seasons.includes('all-season')) return true;
    // required (cold): anything warm enough; light (cool): a winter-only coat is too heavy.
    return mode === 'required'
      ? seasons.includes('winter') || seasons.includes('spring-fall')
      : seasons.includes('summer') || seasons.includes('spring-fall');
  }

  if (ctx.occasion === 'Indoor') return true;

  const hot = ctx.temperature !== null && ctx.temperature > ctx.heatThreshold;
  const cold = ctx.temperature !== null && ctx.temperature < ctx.coldThreshold;

  const seasons = item.seasons || [];
  if (seasons.length === 0 || seasons.includes('all-season')) return true;
  const suitsWarm = seasons.includes('summer') || seasons.includes('spring-fall');
  const suitsCool = seasons.includes('winter') || seasons.includes('spring-fall');

  if (hot) return suitsWarm;
  if (cold) return suitsCool;
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

/**
 * Freshness by days since a piece was last worn: [up to N days, score].
 * Long-unworn pieces are favoured; a piece worn recently is kept out for a few days
 * and is back in play after about a week. Values are starting points to be tuned.
 */
export const FRESHNESS_STEPS: [number, number][] = [
  [2, 0.0], // today, yesterday, the day before
  [6, 0.2],
  [13, 0.6], // about a week later: a favourite can return
  [29, 0.85]
];
/** Never worn: high but below long-unworn, so new pieces get tried without crowding out forgotten ones. */
export const FRESHNESS_NEVER_WORN = 0.8;

export function scoreHistoryNorm(item: Item, ctx: RecommenderContext): number {
  if (!item.last_worn_date) return FRESHNESS_NEVER_WORN;
  // Dates are whole days: compare at local noon so the time of day never shifts the bucket.
  const worn = new Date(item.last_worn_date + 'T12:00:00').getTime();
  const days = Math.floor((nowOf(ctx) - worn) / DAY_MS);
  if (Number.isNaN(days)) return FRESHNESS_NEVER_WORN;
  for (const [maxDays, score] of FRESHNESS_STEPS) {
    if (days <= maxDays) return score;
  }
  return 1.0;
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
  const colorResult = scoreOutfitColor(allItems, colorScoresForStyle(ctx.style), toneScoresForStyle(ctx.style));
  const c = Math.min(1.0, colorResult.score + affinityBonus);

  // A selected style decides the pattern tolerance; without one the old rule applies.
  const p = ctx.style
    ? patternScoreForStyle(ctx.style, allItems.filter((i) => i.is_patterned).length)
    : isDress
      ? 0.75
      : scorePatternNorm(top, bottom, ctx);

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
    colorHarmony: colorResult.harmony
  };
}

/** Highest score wins; on a tie the first item in the list stays (deterministic). */
function pickBest(list: Item[], score: (item: Item) => number): Item | null {
  if (!list.length) return null;
  let best = list[0];
  let bestScore = score(best);
  for (const x of list.slice(1)) {
    const s = score(x);
    if (s > bestScore) {
      best = x;
      bestScore = s;
    }
  }
  return best;
}

/** Picks the piece that fits the already chosen pieces best: colour harmony first, weather as a weighted extra. */
function pickComplement(candidates: Item[], base: Item[], ctx: RecommenderContext, weatherWeight: number): Item | null {
  return pickBest(
    candidates,
    (c) =>
      scoreOutfitColor([...base, c], colorScoresForStyle(ctx.style), toneScoresForStyle(ctx.style)).score +
      weatherWeight * scoreWeatherNorm(c, ctx)
  );
}

export function generateOutfitCombinations(
  filtered: Item[],
  ctx: RecommenderContext,
  limit: number = DEFAULT_RESULT_LIMIT
): Suggestion[] {
  const tops = filtered.filter((i) => i.category === 'top');
  const bottoms = filtered.filter((i) => i.category === 'bottom');
  const dresses = filtered.filter((i) => i.category === 'dress');
  const outerwear = filtered.filter((i) => i.category === 'outerwear');
  const shoes = filtered.filter((i) => i.category === 'shoes');
  const accessories = filtered.filter((i) => i.category === 'accessory');
  const combinations: Suggestion[] = [];
  const needsOuterwear = outerwearMode(ctx) === 'required';

  for (const top of tops) {
    for (const bottom of bottoms) {
      const bestOuterwear = pickComplement(outerwear, [top, bottom], ctx, 0.5);
      const bestShoes = pickComplement(shoes, [top, bottom, bestOuterwear].filter((i): i is Item => !!i), ctx, 0.5);
      const bestAccessory = pickComplement(
        accessories,
        [top, bottom, bestOuterwear, bestShoes].filter((i): i is Item => !!i),
        ctx,
        0
      );

      const scoreData = computeScore(ctx, top, bottom, bestOuterwear, bestShoes, bestAccessory);
      if (scoreData.total >= 30) {
        combinations.push({
          items: [top, bottom, bestOuterwear, bestShoes, bestAccessory].filter((i): i is Item => !!i),
          score: scoreData.total,
          scoreBreakdown: scoreData,
          type: 'top+bottom',
          outerwearMissing: needsOuterwear && !bestOuterwear
        });
      }
    }
  }

  for (const dress of dresses) {
    const bestOuterwear = pickComplement(outerwear, [dress], ctx, 0.5);
    const bestShoes = pickComplement(shoes, [dress, bestOuterwear].filter((i): i is Item => !!i), ctx, 0.5);
    const bestAccessory = pickComplement(
      accessories,
      [dress, bestOuterwear, bestShoes].filter((i): i is Item => !!i),
      ctx,
      0
    );

    const scoreData = computeScore(ctx, null, dress, bestOuterwear, bestShoes, bestAccessory, true);
    if (scoreData.total >= 30) {
      combinations.push({
        items: [dress, bestOuterwear, bestShoes, bestAccessory].filter((i): i is Item => !!i),
        score: scoreData.total,
        scoreBreakdown: scoreData,
        type: 'dress',
        outerwearMissing: needsOuterwear && !bestOuterwear
      });
    }
  }

  return selectDiverse(combinations, limit);
}

/** How many suggestions are returned by default. */
export const DEFAULT_RESULT_LIMIT = 10;
/** Points taken off a suggestion for every time one of its main pieces was already picked. */
export const REPEAT_PENALTY = 10;

const CORE_CATEGORIES = new Set(['top', 'bottom', 'dress']);

/**
 * Greedy diverse selection: always take the best remaining suggestion, but subtract
 * REPEAT_PENALTY for each earlier use of any of its top/bottom/dress pieces.
 * A piece is never banned, so a small wardrobe still gets a full list.
 * Returned suggestions keep their real score.
 */
function selectDiverse(combinations: Suggestion[], limit: number): Suggestion[] {
  // Equal total scores are common (scores are whole numbers): break ties by freshness, then colour.
  const remaining = [...combinations].sort(
    (a, b) =>
      b.score - a.score ||
      b.scoreBreakdown.history - a.scoreBreakdown.history ||
      b.scoreBreakdown.color - a.scoreBreakdown.color
  );
  const uses = new Map<number, number>();
  const picked: Suggestion[] = [];

  while (picked.length < limit && remaining.length) {
    let bestIndex = 0;
    let bestAdjusted = -Infinity;
    remaining.forEach((combo, index) => {
      let adjusted = combo.score;
      for (const piece of combo.items) {
        if (CORE_CATEGORIES.has(piece.category)) adjusted -= REPEAT_PENALTY * (uses.get(piece.id) ?? 0);
      }
      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestIndex = index;
      }
    });
    const [chosen] = remaining.splice(bestIndex, 1);
    picked.push(chosen);
    for (const piece of chosen.items) {
      if (CORE_CATEGORIES.has(piece.category)) uses.set(piece.id, (uses.get(piece.id) ?? 0) + 1);
    }
  }
  return picked;
}
