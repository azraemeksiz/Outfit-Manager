import type { HarmonyType } from './colorHarmony';

export type Category = 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'accessory';
export type Season = 'summer' | 'winter' | 'spring-fall' | 'all-season';
export type ItemStatus = 'Clean' | 'Dirty';

export interface Item {
  id: number;
  name: string;
  category: Category | string;
  status?: ItemStatus | string;
  selected_color?: string | null;
  colors?: string[] | null;
  seasons?: (Season | string)[] | null;
  occasions?: string[] | null;
  is_patterned?: boolean | null;
  photo_url?: string | null;
  last_worn_date?: string | null;
  recent_repeat_date?: string | null;
}

/** Item snapshot stored inside outfits.item_list */
export type OutfitItem = Pick<
  Item,
  'id' | 'name' | 'category' | 'selected_color' | 'photo_url' | 'is_patterned'
>;

export interface Outfit {
  id?: number;
  name: string;
  item_list: OutfitItem[];
}

export interface CalendarEntry {
  date: string;
  is_worn?: boolean;
  outfit_id?: number;
  outfits?: { item_list: OutfitItem[] } | null;
}

export type CombinationStatus = 'recent_repeat' | 'co_occurrence' | 'none';

export interface ScoreBreakdown {
  total: number;
  weather: number;
  color: number;
  pattern: number;
  history: number;
  combinationStatus: CombinationStatus;
  /** Harmony type of the outfit's colours (null when no piece has a colour). */
  colorHarmony: HarmonyType | null;
}

export interface Suggestion {
  items: Item[];
  score: number;
  scoreBreakdown: ScoreBreakdown;
  type: 'top+bottom' | 'dress';
  /** True when it is cold enough to need outerwear but no suitable piece is available. */
  outerwearMissing?: boolean;
}

export interface UserStyleProfile {
  patternAffinity: number;
  colorAffinities: string[];
}
