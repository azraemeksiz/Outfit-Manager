import { describe, expect, it } from 'vitest';
import { STYLES, getStyle, styleOccasionHint } from './styles';

const OCCASIONS = ['Casual', 'Sport', 'Indoor', 'Party', 'Formal'];

describe('style x occasion hint', () => {
  it('every style has a verdict for every occasion', () => {
    for (const style of STYLES) {
      for (const occasion of OCCASIONS) {
        expect(['good', 'ok', 'poor'], `${style.id}/${occasion}`).toContain(styleOccasionHint(style.id, occasion).fit);
      }
    }
  });

  it('flags the combinations that feel wrong', () => {
    expect(styleOccasionHint('sporty', 'Party').fit).toBe('poor');
    expect(styleOccasionHint('sporty', 'Formal').fit).toBe('poor');
    expect(styleOccasionHint('maximalist', 'Sport').fit).toBe('poor');
    expect(styleOccasionHint('streetwear', 'Formal').fit).toBe('poor');
  });

  it('recognises the combinations that suit each other', () => {
    expect(styleOccasionHint('sporty', 'Sport').fit).toBe('good');
    expect(styleOccasionHint('maximalist', 'Party').fit).toBe('good');
    expect(styleOccasionHint('minimal', 'Formal').fit).toBe('good');
    expect(styleOccasionHint('streetwear', 'Casual').fit).toBe('good');
  });

  it('is neutral without an occasion or without a style, and never blocks anything', () => {
    expect(styleOccasionHint('sporty', '').fit).toBe('ok');
    expect(styleOccasionHint(null, 'Party').fit).toBe('ok');
    expect(styleOccasionHint('sporty', 'SomethingElse').fit).toBe('ok');
  });

  it('a poor fit comes with a short human message naming both', () => {
    const h = styleOccasionHint('sporty', 'Party');
    expect(h.message).toContain(getStyle('sporty')!.label);
    expect(h.message).toContain('Party');
  });

  it('only a small share of combinations is flagged as poor', () => {
    let poor = 0;
    for (const s of STYLES) for (const o of OCCASIONS) if (styleOccasionHint(s.id, o).fit === 'poor') poor++;
    expect(poor).toBeLessThanOrEqual(8);
  });
});
