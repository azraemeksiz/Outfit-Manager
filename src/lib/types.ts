import type { HarmonyType } from './colorHarmony';
import type { SilhouetteType } from './silhouette';

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
  /** slim / regular / loose; null = not tagged. */
  fit?: string | null;
  photo_url?: string | null;
  last_worn_date?: string | null;
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
  /** Silhouette points from the fit tags; 0 when no style is selected. */
  silhouette: number;
  history: number;
  combinationStatus: CombinationStatus;
  /** Harmony type of the outfit's colours (null when no piece has a colour). */
  colorHarmony: HarmonyType | null;
  /** Silhouette of top + bottom (or the dress); null when a fit tag is missing. */
  silhouetteType: SilhouetteType | null;
  /** Maximum points of each criterion for this outfit (they always sum to 100). */
  max: { weather: number; color: number; pattern: number; silhouette: number; history: number };
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
