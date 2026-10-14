import { MAX_COLORS_PER_ITEM } from './colorHarmony';

/**
 * Palette rules shared by the add and edit forms.
 * An item has one to four colours, the first one being the biggest in the photo.
 * All of them take part in the colour theory.
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
export function paletteForItem(selected: string | null | undefined, colors: string[] | null | undefined): string[] {
  const all = unique([selected, ...(colors ?? [])].filter(isHex)).slice(0, MAX_COLORS_PER_ITEM);
  return all.length ? all : [DEFAULT_COLOR];
}

/** Values to store: `colors` is only saved when there is more than one colour. */
export function paletteToSave(palette: string[]): { selected_color: string; colors: string[] | null } {
  const valid = unique(palette.filter(isHex).map((c) => c.toLowerCase())).slice(0, MAX_COLORS_PER_ITEM);
  const first = valid[0] ?? DEFAULT_COLOR;
  return { selected_color: first, colors: valid.length > 1 ? valid : null };
}
