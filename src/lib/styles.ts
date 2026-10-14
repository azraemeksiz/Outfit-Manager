import type { HarmonyType, ToneType } from './colorHarmony';

/**
 * Style profiles. A style never bans anything: it only changes how much each aspect is liked
 * (soft preference). Adding a style = adding one row to STYLES.
 *
 * Three aspects differ per style:
 * - colorScores: how much each colour harmony type is liked,
 * - toneScores: soft (pastel/muted) vs vivid colours,
 * - patternScores: tolerance for patterned pieces (index = number of patterned pieces: 0, 1, 2 or more).
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
}

export const STYLES: StyleProfile[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    emoji: '🤍',
    colorScores: { neutral: 1.0, accent: 0.9, monochrome: 0.95, analogous: 0.6, complementary: 0.4, mixed: 0.25, clash: 0.1 },
    toneScores: { none: 1.0, soft: 0.8, vivid: 0.35, mixed: 0.25 },
    patternScores: [1.0, 0.5, 0.1]
  },
  {
    id: 'streetwear',
    label: 'Streetwear',
    emoji: '🧢',
    colorScores: { neutral: 0.8, accent: 0.9, monochrome: 0.8, analogous: 0.75, complementary: 0.85, mixed: 0.65, clash: 0.45 },
    toneScores: { none: 0.7, soft: 0.45, vivid: 0.95, mixed: 0.6 },
    patternScores: [0.75, 0.95, 0.5]
  },
  {
    id: 'girl-casual',
    label: 'Girl casual',
    emoji: '🎀',
    colorScores: { neutral: 0.75, accent: 0.9, monochrome: 0.9, analogous: 0.9, complementary: 0.65, mixed: 0.55, clash: 0.25 },
    toneScores: { none: 0.6, soft: 1.0, vivid: 0.4, mixed: 0.55 },
    patternScores: [0.7, 1.0, 0.45]
  },
  {
    id: 'sporty',
    label: 'Sporty',
    emoji: '👟',
    colorScores: { neutral: 0.7, accent: 0.9, monochrome: 0.8, analogous: 0.75, complementary: 0.95, mixed: 0.7, clash: 0.4 },
    toneScores: { none: 0.6, soft: 0.4, vivid: 1.0, mixed: 0.7 },
    patternScores: [0.9, 0.7, 0.3]
  },
  {
    id: 'maximalist',
    label: 'Maximalist',
    emoji: '🌈',
    colorScores: { neutral: 0.5, accent: 0.65, monochrome: 0.6, analogous: 0.8, complementary: 1.0, mixed: 0.9, clash: 0.8 },
    toneScores: { none: 0.4, soft: 0.7, vivid: 0.9, mixed: 1.0 },
    patternScores: [0.4, 0.9, 1.0]
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

/** Pattern score for an outfit with `count` patterned pieces under the given style. */
export function patternScoreForStyle(id: StyleId, count: number): number {
  const table = getStyle(id)?.patternScores ?? [1, 1, 1];
  return table[Math.min(Math.max(count, 0), 2)];
}
