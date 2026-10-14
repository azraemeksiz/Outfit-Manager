import { describe, expect, it } from 'vitest';
import { classifySilhouette, parseFit } from './silhouette';
import type { Item } from './types';

const piece = (category: string, fit?: string | null): Item => ({ id: 1, name: 'x', category, fit });

describe('parseFit', () => {
  it('accepts the three fit values and rejects everything else', () => {
    expect(parseFit('slim')).toBe('slim');
    expect(parseFit('regular')).toBe('regular');
    expect(parseFit('loose')).toBe('loose');
    expect(parseFit('baggy')).toBeNull();
    expect(parseFit(null)).toBeNull();
    expect(parseFit(undefined)).toBeNull();
  });
});

describe('classifySilhouette (top + bottom)', () => {
  const sil = (t: string | null, b: string | null) => classifySilhouette(piece('top', t), piece('bottom', b));

  it('regular + regular -> regular', () => expect(sil('regular', 'regular')).toBe('regular'));
  it('slim + slim, slim + regular -> fitted', () => {
    expect(sil('slim', 'slim')).toBe('fitted');
    expect(sil('slim', 'regular')).toBe('fitted');
    expect(sil('regular', 'slim')).toBe('fitted');
  });
  it('loose + loose -> oversized', () => expect(sil('loose', 'loose')).toBe('oversized'));
  it('one loose + one regular -> relaxed', () => {
    expect(sil('loose', 'regular')).toBe('relaxed');
    expect(sil('regular', 'loose')).toBe('relaxed');
  });
  it('loose on one half and slim on the other -> contrast', () => {
    expect(sil('loose', 'slim')).toBe('contrast');
    expect(sil('slim', 'loose')).toBe('contrast');
  });
  it('is null when a fit is missing, so the score stays neutral', () => {
    expect(sil(null, 'loose')).toBeNull();
    expect(sil('slim', null)).toBeNull();
    expect(sil(null, null)).toBeNull();
  });
});

describe('classifySilhouette (dress)', () => {
  const dress = (fit: string | null) => classifySilhouette(null, piece('dress', fit));
  it('maps the dress fit to a single silhouette', () => {
    expect(dress('slim')).toBe('fitted');
    expect(dress('regular')).toBe('regular');
    expect(dress('loose')).toBe('relaxed');
    expect(dress(null)).toBeNull();
  });
});
