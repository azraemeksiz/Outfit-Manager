import type { HarmonyType } from './colorHarmony';

/**
 * Style profiles. A style never bans anything: it only changes how much each colour
 * harmony type is liked (soft preference). Adding a style = adding one row to STYLES.
 *
 * The numbers are starting values (0..1) chosen from the typical look of each style;
 * they are to be validated with the user test, not treated as ground truth.
 */

export type StyleId = 'minimal' | 'streetwear' | 'girl-casual' | 'sporty' | 'maximalist';

export interface StyleProfile {
  id: StyleId;
  label: string;
  emoji: string;
  /** How much this style likes each colour harmony type. */
  colorScores: Record<HarmonyType, number>;
}

export const STYLES: StyleProfile[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    emoji: '🤍',
    colorScores: { neutral: 1.0, accent: 0.9, monochrome: 0.95, analogous: 0.6, complementary: 0.4, mixed: 0.25, clash: 0.1 }
  },
  {
    id: 'streetwear',
    label: 'Streetwear',
    emoji: '🧢',
    colorScores: { neutral: 0.8, accent: 0.9, monochrome: 0.8, analogous: 0.75, complementary: 0.85, mixed: 0.65, clash: 0.45 }
  },
  {
    id: 'girl-casual',
    label: 'Girl casual',
    emoji: '🎀',
    colorScores: { neutral: 0.75, accent: 0.9, monochrome: 0.9, analogous: 0.9, complementary: 0.65, mixed: 0.55, clash: 0.25 }
  },
  {
    id: 'sporty',
    label: 'Sporty',
    emoji: '👟',
    colorScores: { neutral: 0.7, accent: 0.9, monochrome: 0.8, analogous: 0.75, complementary: 0.95, mixed: 0.7, clash: 0.4 }
  },
  {
    id: 'maximalist',
    label: 'Maximalist',
    emoji: '🌈',
    colorScores: { neutral: 0.5, accent: 0.65, monochrome: 0.6, analogous: 0.8, complementary: 1.0, mixed: 0.9, clash: 0.8 }
  }
];

export function getStyle(id: StyleId | null | undefined): StyleProfile | null {
  return STYLES.find((s) => s.id === id) ?? null;
}

/** Score table to pass to scoreOutfitColor; empty (= neutral default table) when no style is selected. */
export function colorScoresForStyle(id: StyleId | null | undefined): Partial<Record<HarmonyType, number>> {
  return getStyle(id)?.colorScores ?? {};
}
