import type { Item } from './types';

/**
 * Silhouette of an outfit, derived from the fit tag of the main pieces.
 * Fit is a 3-value tag the user sets when adding an item: slim / regular / loose.
 * A missing fit on any main piece gives no silhouette (null) and the score stays neutral.
 */

export type FitValue = 'slim' | 'regular' | 'loose';
export type SilhouetteType = 'fitted' | 'regular' | 'relaxed' | 'oversized' | 'contrast';

const FIT_NUMBER: Record<FitValue, number> = { slim: -1, regular: 0, loose: 1 };

export function parseFit(value: unknown): FitValue | null {
  return value === 'slim' || value === 'regular' || value === 'loose' ? value : null;
}

/**
 * top + bottom, or a single dress (pass the dress as `bottom` and null as `top`).
 */
export function classifySilhouette(top: Item | null, bottom: Item | null): SilhouetteType | null {
  const b = parseFit(bottom?.fit);
  if (!top) {
    // single piece (dress)
    if (b === 'slim') return 'fitted';
    if (b === 'regular') return 'regular';
    if (b === 'loose') return 'relaxed';
    return null;
  }
  const t = parseFit(top.fit);
  if (!t || !b) return null;

  const x = FIT_NUMBER[t];
  const y = FIT_NUMBER[b];
  if (x * y === -1) return 'contrast'; // loose on one half, slim on the other
  if (x === 1 && y === 1) return 'oversized';
  if (x === 0 && y === 0) return 'regular';
  if (x === 1 || y === 1) return 'relaxed'; // one loose, the other regular
  return 'fitted'; // slim with slim or regular
}

/** Neutral score used when the silhouette is unknown (a fit tag is missing). */
export const SILHOUETTE_UNKNOWN_SCORE = 0.6;
