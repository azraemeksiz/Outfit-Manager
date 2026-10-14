import { describe, expect, it } from 'vitest';
import { scoreHistoryNorm } from './recommender';
import type { RecommenderContext } from './recommender';
import type { Item } from './types';

const NOW = new Date('2026-10-14T12:00:00').getTime();
const ctx: RecommenderContext = {
  occasion: '',
  temperature: 20,
  coldThreshold: 15,
  heatThreshold: 25,
  userProfile: { patternAffinity: 0.5, colorAffinities: [] },
  wornHistory: [],
  now: NOW
};

const daysAgo = (n: number) => {
  const d = new Date(NOW - n * 86400000);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const wornDaysAgo = (n: number | null): Item => ({
  id: 1,
  name: 'x',
  category: 'top',
  last_worn_date: n === null ? null : daysAgo(n)
});

const fresh = (n: number | null) => scoreHistoryNorm(wornDaysAgo(n), ctx);

describe('freshness: long-unworn pieces come first, favourites return after about a week', () => {
  it('a piece worn today or yesterday is almost excluded', () => {
    expect(fresh(0)).toBe(0);
    expect(fresh(1)).toBe(0);
    expect(fresh(2)).toBe(0);
  });

  it('is monotonic: the longer since last worn, the higher the score', () => {
    const days = [0, 1, 3, 5, 7, 10, 14, 20, 30, 60, 120];
    const scores = days.map(fresh);
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
  });

  it('a piece worn a week ago is back in play (mid score or better)', () => {
    expect(fresh(7)).toBeGreaterThanOrEqual(0.5);
  });

  it('a piece unworn for 3 months beats one worn a month ago (the old curve had this reversed)', () => {
    expect(fresh(90)).toBeGreaterThan(fresh(14));
    expect(fresh(90)).toBeGreaterThanOrEqual(fresh(30));
  });

  it('long-unworn pieces get the top score', () => {
    expect(fresh(60)).toBe(1);
  });

  it('a never-worn piece scores high but below a long-unworn one, so new pieces get tried', () => {
    expect(fresh(null)).toBeGreaterThanOrEqual(0.7);
    expect(fresh(null)).toBeLessThan(fresh(60));
  });

  it('ignores the removed recent_repeat_date field', () => {
    const item = { ...wornDaysAgo(60), recent_repeat_date: daysAgo(1) } as Item;
    expect(scoreHistoryNorm(item, ctx)).toBe(1);
  });

  it('ignores a future date (it cannot have been worn yet): scored like never worn', () => {
    const item: Item = { id: 1, name: 'x', category: 'top', last_worn_date: daysAgo(-3) };
    expect(scoreHistoryNorm(item, ctx)).toBe(fresh(null));
  });

  it('ignores a malformed date instead of producing NaN', () => {
    const item: Item = { id: 1, name: 'x', category: 'top', last_worn_date: 'not-a-date' };
    expect(scoreHistoryNorm(item, ctx)).toBe(fresh(null));
  });
});
