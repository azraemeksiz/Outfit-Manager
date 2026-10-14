import { scoreOutfitColor } from './colorHarmony';
import { classifySilhouette } from './silhouette';
import { colorScoresForStyle, patternScoreForStyle, silhouetteScoreForStyle, toneScoresForStyle } from './styles';
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

type CanonicalSeason = 'summer' | 'winter' | 'spring-fall' | 'all-season';

const SEASON_ALIASES: Record<string, CanonicalSeason> = {
  summer: 'summer',
  yaz: 'summer',
  yazlik: 'summer',
  winter: 'winter',
  kis: 'winter',
  kislik: 'winter',
  'spring-fall': 'spring-fall',
  'spring/fall': 'spring-fall',
  spring: 'spring-fall',
  fall: 'spring-fall',
  autumn: 'spring-fall',
  ilkbahar: 'spring-fall',
  sonbahar: 'spring-fall',
  mevsimlik: 'spring-fall',
  'all-season': 'all-season',
  'all season': 'all-season',
  all: 'all-season',
  'tum sezon': 'all-season'
};

/** Canonical season tags of a piece: case, accents and common Turkish/English variants are folded; unknown values are dropped. */
export function normalizeSeasons(item: Item): CanonicalSeason[] {
  const out = new Set<CanonicalSeason>();
  for (const raw of item.seasons ?? []) {
    const key = String(raw)
      .trim()
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ş/g, 's')
      .replace(/ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g');
    const canonical = SEASON_ALIASES[key];
    if (canonical) out.add(canonical);
  }
  return [...out];
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
    const seasons = normalizeSeasons(item);
    if (seasons.length === 0 || seasons.includes('all-season')) return true;
    // required (cold): anything warm enough; light (cool): a winter-only coat is too heavy.
    return mode === 'required'
      ? seasons.includes('winter') || seasons.includes('spring-fall')
      : seasons.includes('summer') || seasons.includes('spring-fall');
  }

  if (ctx.occasion === 'Indoor') return true;

  const hot = ctx.temperature !== null && ctx.temperature > ctx.heatThreshold;
  const cold = ctx.temperature !== null && ctx.temperature < ctx.coldThreshold;

  const seasons = normalizeSeasons(item);
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
  const seasons = normalizeSeasons(item);
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
  // Mild weather (between the thresholds).
  if (hasSpringFall) return 1.0;
  if (hasSummer && hasWinter) return 0.7; // covers both ends, like all-season
  // A one-ended piece is penalised softly where it is far from its end, fading towards its end:
  // summer-only goes from MILD_FAR to MILD_NEAR as it warms up, winter-only the other way round.
  const span = ctx.heatThreshold - ctx.coldThreshold;
  const frac = span > 0 ? Math.min(Math.max((ctx.temperature - ctx.coldThreshold) / span, 0), 1) : 0.5;
  if (hasSummer) return MILD_FAR + (MILD_NEAR - MILD_FAR) * frac;
  if (hasWinter) return MILD_FAR + (MILD_NEAR - MILD_FAR) * (1 - frac);
  return 0.5;
}

/** Mild-weather score of a one-ended (summer-only / winter-only) piece at the far end of the range and at its own end. */
export const MILD_FAR = 0.35;
export const MILD_NEAR = 0.9;

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
    if (Number.isNaN(entryTime)) continue; // malformed date: ignore the entry
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
  // Malformed or future dates cannot be a real "last worn" day: treat the piece as never worn.
  if (Number.isNaN(days) || days < 0) return FRESHNESS_NEVER_WORN;
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

  // Silhouette only counts when a style is selected; then it takes points from colour, pattern and freshness.
  const silhouetteType = classifySilhouette(isDress ? null : top, bottom);
  const s = ctx.style ? silhouetteScoreForStyle(ctx.style, silhouetteType) : 0;
  const max = maxPointsFor(ctx);

  const weather = Math.round(w * max.weather);
  const color = Math.round(c * max.color);
  const pattern = Math.round(p * max.pattern);
  const silhouette = Math.round(s * max.silhouette);
  const history = Math.round(h * max.history);
  // An explicit occasion tag on the main pieces is rewarded; untagged pieces are neutral, never banned.
  const occasion = Math.round((ctx.occasion ? scoreOccasionNorm(coreItems, ctx.occasion) : 0) * max.occasion);
  return {
    total: weather + color + pattern + silhouette + history + occasion,
    weather,
    color,
    pattern,
    silhouette,
    history,
    occasion,
    combinationStatus,
    colorHarmony: colorResult.harmony,
    silhouetteType,
    max
  };
}

/** Points per criterion (sum 100). Without a style there is no silhouette criterion. */
export const MAX_POINTS_NO_STYLE = { weather: 40, color: 30, pattern: 15, silhouette: 0, history: 15, occasion: 0 };
export const MAX_POINTS_WITH_STYLE = { weather: 40, color: 25, pattern: 10, silhouette: 15, history: 10, occasion: 0 };
/** Points an explicit occasion match is worth; they come out of the weather points, which a hard filter already guards. */
export const OCCASION_POINTS = 10;

export function maxPointsFor(ctx: RecommenderContext) {
  const base = ctx.style ? MAX_POINTS_WITH_STYLE : MAX_POINTS_NO_STYLE;
  return ctx.occasion
    ? { ...base, weather: base.weather - OCCASION_POINTS, occasion: OCCASION_POINTS }
    : { ...base };
}

/** 1 for a piece explicitly tagged with the occasion, 0.5 for an untagged piece (it fits anywhere); averaged over the main pieces. */
export function scoreOccasionNorm(coreItems: Item[], occasion: string): number {
  if (!coreItems.length) return 0.5;
  const sum = coreItems.reduce((s, i) => s + (i.occasions?.includes(occasion) ? 1 : 0.5), 0);
  return sum / coreItems.length;
}

export interface EmptyDiagnosis {
  reason: 'no-items' | 'occasion' | 'weather' | 'missing-category' | 'unknown';
  message: string;
}

const hasOutfitBase = (items: Item[]) =>
  items.some((i) => i.category === 'dress') ||
  (items.some((i) => i.category === 'top') && items.some((i) => i.category === 'bottom'));

/**
 * Explains why no outfit could be built. Call it when generateOutfitCombinations returns nothing;
 * 'unknown' means the pieces are fine and no specific cause was found.
 */
export function diagnoseEmpty(allItems: Item[], ctx: RecommenderContext): EmptyDiagnosis {
  if (!allItems.length) {
    return { reason: 'no-items', message: 'You have no clean items. Add items or finish the laundry.' };
  }

  const byOccasion = allItems.filter(
    (i) => !(ctx.occasion && i.occasions && i.occasions.length > 0 && !i.occasions.includes(ctx.occasion))
  );
  if (!hasOutfitBase(byOccasion) && hasOutfitBase(allItems)) {
    const removed = allItems.length - byOccasion.length;
    return {
      reason: 'occasion',
      message: `${removed} of your ${allItems.length} clean items are tagged for other occasions, so nothing is left for ${ctx.occasion}. Choose "Any" or tag more pieces with ${ctx.occasion}.`
    };
  }

  const byWeather = byOccasion.filter((i) => fitsWeather(i, ctx));
  if (!hasOutfitBase(byWeather) && hasOutfitBase(byOccasion)) {
    const temp = ctx.temperature === null ? 'the current weather' : `${ctx.temperature}°C`;
    return {
      reason: 'weather',
      message: `Your clean pieces are tagged for a different season than ${temp}. Add pieces for this weather or check the season tags.`
    };
  }

  if (!hasOutfitBase(byWeather)) {
    const missing: string[] = [];
    const has = (c: string) => byWeather.some((i) => i.category === c);
    if (!has('dress')) {
      if (!has('top')) missing.push('a top');
      if (!has('bottom')) missing.push('a bottom');
    }
    return {
      reason: 'missing-category',
      message: `An outfit needs a dress or a top and a bottom. You are missing ${missing.join(' and ') || 'basic pieces'} (clean pieces only).`
    };
  }

  return { reason: 'unknown', message: 'No outfit scored high enough. Try another occasion or style.' };
}

/** Highest score wins; on a tie the lowest id wins, so the wardrobe order never matters. */
function pickBest(list: Item[], score: (item: Item) => number): Item | null {
  if (!list.length) return null;
  let best = list[0];
  let bestScore = score(best);
  for (const x of list.slice(1)) {
    const s = score(x);
    if (s > bestScore || (s === bestScore && x.id < best.id)) {
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
        0.5
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
      0.5
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
  const idKey = (s: Suggestion) =>
    s.items
      .map((i) => i.id)
      .sort((x, y) => x - y)
      .map((id) => String(id).padStart(10, '0'))
      .join('-');
  const remaining = [...combinations].sort(
    (a, b) =>
      b.score - a.score ||
      b.scoreBreakdown.history - a.scoreBreakdown.history ||
      b.scoreBreakdown.color - a.scoreBreakdown.color ||
      idKey(a).localeCompare(idKey(b)) // last resort: never depend on the wardrobe order
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
