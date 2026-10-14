import { MAX_COLORS_PER_ITEM } from './colorHarmony';

/**
 * Palette rules shared by the add and edit forms.
 * A solid piece has exactly one colour; a patterned piece can have up to MAX_COLORS_PER_ITEM,
 * the first one being the main colour. Only patterned pieces save a palette.
 */

const DEFAULT_COLOR = '#3b82f6';
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

function unique(colors: string[]): string[] {
  const seen = new Set<string>();
  return colors.filter((c) => {
    const key = c.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Palette shown in the form for a saved item. */
export function paletteForItem(selected: string | null | undefined, colors: string[] | null | undefined, patterned: boolean): string[] {
  const main = isHex(selected) ? selected : (colors ?? []).find(isHex) ?? DEFAULT_COLOR;
  if (!patterned) return [main];
  return unique([main, ...(colors ?? []).filter(isHex)]).slice(0, MAX_COLORS_PER_ITEM);
}

/** New palette after the Patterned / Solid button is pressed. `patterned` is the NEW value. */
export function togglePatterned(palette: string[], patterned: boolean, detected: string[]): string[] {
  if (!patterned) return palette.slice(0, 1);
  if (palette.length > 1) return palette; // keep a palette the user already made
  const main = palette[0];
  return unique([main, ...detected.filter(isHex)]).slice(0, MAX_COLORS_PER_ITEM);
}

/** Values to store: `colors` is only saved for a patterned piece with more than one colour. */
export function paletteToSave(palette: string[], patterned: boolean): { selected_color: string; colors: string[] | null } {
  const valid = unique(palette.filter(isHex)).slice(0, MAX_COLORS_PER_ITEM);
  const main = valid[0] ?? DEFAULT_COLOR;
  return { selected_color: main, colors: patterned && valid.length > 1 ? valid : null };
}
