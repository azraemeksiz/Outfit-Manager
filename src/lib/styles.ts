import type { HarmonyType, ToneType } from './colorHarmony';
import { SILHOUETTE_UNKNOWN_SCORE } from './silhouette';
import type { SilhouetteType } from './silhouette';

/**
 * Style profiles. A style never bans anything: it only changes how much each aspect is liked
 * (soft preference). Adding a style = adding one row to STYLES.
 *
 * Four aspects differ per style:
 * - colorScores: how much each colour harmony type is liked,
 * - toneScores: soft (pastel/muted) vs vivid colours,
 * - patternScores: tolerance for patterned pieces (index = number of patterned pieces: 0, 1, 2 or more),
 * - silhouetteScores: how much each silhouette (from the fit tags) is liked.
 *
 * The numbers are starting values (0..1) chosen from the typical look of each style;
 * they are to be validated with the user test, not treated as ground truth.
 */

export type StyleId = 'minimal' | 'streetwear' | 'girl-casual' | 'sporty' | 'maximalist';

export interface StyleProfile {
  id: StyleId;
  label: string;
  emoji: string;
  colorScores: Record<HarmonyType, number>;
  toneScores: Record<ToneType, number>;
  /** Score for 0, 1, and 2-or-more patterned pieces in the outfit. */
  patternScores: [number, number, number];
  silhouetteScores: Record<SilhouetteType, number>;
}

export const STYLES: StyleProfile[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    emoji: '🤍',
    colorScores: { neutral: 1.0, accent: 0.9, monochrome: 0.95, analogous: 0.65, complementary: 0.5, mixed: 0.35, clash: 0.2 },
    toneScores: { none: 1.0, soft: 0.8, vivid: 0.45, mixed: 0.35 },
    patternScores: [1.0, 0.6, 0.25],
    silhouetteScores: { regular: 1.0, fitted: 0.85, relaxed: 0.8, contrast: 0.65, oversized: 0.6 }
  },
  {
    id: 'streetwear',
    label: 'Streetwear',
    emoji: '🧢',
    colorScores: { neutral: 0.8, accent: 0.9, monochrome: 0.8, analogous: 0.75, complementary: 0.85, mixed: 0.65, clash: 0.45 },
    toneScores: { none: 0.7, soft: 0.45, vivid: 0.95, mixed: 0.6 },
    patternScores: [0.75, 0.95, 0.5],
    silhouetteScores: { oversized: 1.0, relaxed: 0.95, contrast: 0.8, regular: 0.8, fitted: 0.4 }
  },
  {
    id: 'girl-casual',
    label: 'Girl casual',
    emoji: '🎀',
    colorScores: { neutral: 0.75, accent: 0.9, monochrome: 0.9, analogous: 0.9, complementary: 0.7, mixed: 0.6, clash: 0.35 },
    toneScores: { none: 0.6, soft: 1.0, vivid: 0.5, mixed: 0.55 },
    patternScores: [0.7, 1.0, 0.5],
    silhouetteScores: { fitted: 0.9, regular: 0.85, contrast: 0.85, relaxed: 0.65, oversized: 0.55 }
  },
  {
    id: 'sporty',
    label: 'Sporty',
    emoji: '👟',
    // Neutrals (black/white/grey) are a core part of sportswear, so they score well too.
    colorScores: { neutral: 0.85, accent: 0.9, monochrome: 0.8, analogous: 0.75, complementary: 0.95, mixed: 0.7, clash: 0.45 },
    toneScores: { none: 0.8, soft: 0.45, vivid: 1.0, mixed: 0.7 },
    patternScores: [0.9, 0.75, 0.4],
    silhouetteScores: { regular: 0.9, fitted: 0.85, relaxed: 0.85, oversized: 0.6, contrast: 0.6 }
  },
  {
    id: 'maximalist',
    label: 'Maximalist',
    emoji: '🌈',
    // Unrelated, even absurd colour combinations score highest; all-neutral is the least liked.
    colorScores: { neutral: 0.45, accent: 0.6, monochrome: 0.55, analogous: 0.75, complementary: 0.9, mixed: 0.95, clash: 1.0 },
    toneScores: { none: 0.4, soft: 0.7, vivid: 0.9, mixed: 1.0 },
    patternScores: [0.4, 0.9, 1.0],
    // Nearly flat: every silhouette is fine, looser pieces are only slightly ahead.
    silhouetteScores: { oversized: 0.95, contrast: 0.95, relaxed: 0.9, regular: 0.85, fitted: 0.8 }
  }
];

export function getStyle(id: StyleId | null | undefined): StyleProfile | null {
  return STYLES.find((s) => s.id === id) ?? null;
}

/** Score table to pass to scoreOutfitColor; empty (= neutral default table) when no style is selected. */
export function colorScoresForStyle(id: StyleId | null | undefined): Partial<Record<HarmonyType, number>> {
  return getStyle(id)?.colorScores ?? {};
}

/** Tone table for scoreOutfitColor; undefined when no style is selected (tone is then ignored). */
export function toneScoresForStyle(id: StyleId | null | undefined): Record<ToneType, number> | undefined {
  return getStyle(id)?.toneScores;
}

export type OccasionFit = 'good' | 'ok' | 'poor';

/**
 * How well a style usually suits an occasion. Only a hint for the UI: it never changes the score
 * and never hides an outfit (a style never bans anything). Missing entries mean 'ok'.
 */
const STYLE_OCCASION_FIT: Record<StyleId, Partial<Record<string, OccasionFit>>> = {
  minimal: { Casual: 'good', Sport: 'poor', Indoor: 'good', Party: 'ok', Formal: 'good' },
  streetwear: { Casual: 'good', Sport: 'good', Indoor: 'good', Party: 'ok', Formal: 'poor' },
  'girl-casual': { Casual: 'good', Sport: 'ok', Indoor: 'good', Party: 'good', Formal: 'ok' },
  sporty: { Casual: 'good', Sport: 'good', Indoor: 'good', Party: 'poor', Formal: 'poor' },
  maximalist: { Casual: 'ok', Sport: 'poor', Indoor: 'good', Party: 'good', Formal: 'poor' }
};

export function styleOccasionHint(
  id: StyleId | null | undefined,
  occasion: string
): { fit: OccasionFit; message: string } {
  const style = getStyle(id);
  const fit = (style && STYLE_OCCASION_FIT[style.id][occasion]) || 'ok';
  const message =
    style && fit === 'poor'
      ? `${style.label} does not usually suit ${occasion}. You still get the best matches, it only changes the order.`
      : '';
  return { fit, message };
}

/** Silhouette score under a style; neutral when the silhouette is unknown (a fit tag is missing). */
export function silhouetteScoreForStyle(id: StyleId, type: SilhouetteType | null): number {
  if (!type) return SILHOUETTE_UNKNOWN_SCORE;
  return getStyle(id)?.silhouetteScores[type] ?? SILHOUETTE_UNKNOWN_SCORE;
}

/** Pattern score for an outfit with `count` patterned pieces under the given style. */
export function patternScoreForStyle(id: StyleId, count: number): number {
  const table = getStyle(id)?.patternScores ?? [1, 1, 1];
  return table[Math.min(Math.max(count, 0), 2)];
}
