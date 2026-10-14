import { describe, expect, it } from 'vitest';
import { classifyColor, classifyHarmony, classifyTone, itemColors, scoreOutfitColor } from './colorHarmony';
import type { Item } from './types';

const item = (selected_color: string | null, over: Partial<Item> = {}): Item => ({
  id: 1,
  name: 'x',
  category: 'top',
  selected_color,
  ...over
});

describe('classifyColor', () => {
  it('treats black, white and grey as neutral', () => {
    for (const hex of ['#000000', '#ffffff', '#808080', '#e8e8e8']) {
      expect(classifyColor(hex)?.kind).toBe('neutral');
    }
  });

  it('treats navy, beige, brown and denim blue as near-neutral', () => {
    for (const hex of ['#1f2a44', '#d9c3a0', '#5a3a22', '#4a6fa5']) {
      expect(classifyColor(hex)?.kind).toBe('neutral');
    }
  });

  it('treats saturated colours as chromatic', () => {
    for (const hex of ['#d62828', '#28d6d6', '#28d628', '#f28c28']) {
      expect(classifyColor(hex)?.kind).toBe('chromatic');
    }
  });

  it('accepts 8-digit hex (alpha is ignored) and 3-digit hex without #', () => {
    expect(classifyColor('#d62828ff')?.kind).toBe('chromatic');
    expect(classifyColor('#d62828ff')?.h).toBeCloseTo(classifyColor('#d62828')!.h);
    expect(classifyColor('f00')?.kind).toBe('chromatic');
  });

  it('accepts 3-digit hex and rejects garbage', () => {
    expect(classifyColor('#f00')?.kind).toBe('chromatic');
    expect(classifyColor('red')).toBeNull();
    expect(classifyColor('#12')).toBeNull();
  });
});

describe('classifyHarmony', () => {
  it('returns null when there is no usable colour', () => {
    expect(classifyHarmony([])).toBeNull();
    expect(classifyHarmony(['nope'])).toBeNull();
  });

  it('all neutrals -> neutral (black+white, navy+beige, denim+white)', () => {
    expect(classifyHarmony(['#000000', '#ffffff'])).toBe('neutral');
    expect(classifyHarmony(['#1f2a44', '#d9c3a0'])).toBe('neutral');
    expect(classifyHarmony(['#4a6fa5', '#ffffff'])).toBe('neutral');
  });

  it('one chromatic colour among neutrals -> accent', () => {
    expect(classifyHarmony(['#000000', '#ffffff', '#d62828'])).toBe('accent');
    expect(classifyHarmony(['#808080', '#28d628'])).toBe('accent');
  });

  it('two chromatic colours of one hue -> monochrome', () => {
    expect(classifyHarmony(['#d62828', '#7a1010'])).toBe('monochrome');
  });

  it('hues within 60 degrees -> analogous', () => {
    expect(classifyHarmony(['#d62828', '#f28c28'])).toBe('analogous');
  });

  it('opposite hues -> complementary', () => {
    expect(classifyHarmony(['#d62828', '#28d6d6'])).toBe('complementary');
  });

  it('two hues about 120 degrees apart -> mixed', () => {
    expect(classifyHarmony(['#d62828', '#28d628'])).toBe('mixed');
  });

  it('three unrelated hues -> clash', () => {
    expect(classifyHarmony(['#d62828', '#28d628', '#2828d6'])).toBe('clash');
  });

  it('handles hues that wrap around 0/360 as one family', () => {
    expect(classifyHarmony(['#d62828', '#d628a0'])).toBe('analogous');
  });
});

describe('classifyTone', () => {
  it('no chromatic colour -> none', () => {
    expect(classifyTone(['#000000', '#ffffff', '#4a6fa5'])).toBe('none');
  });

  it('pastel and muted colours are soft', () => {
    expect(classifyTone(['#f4a6c0'])).toBe('soft'); // pastel pink
    expect(classifyTone(['#a8c5b5', '#ffffff'])).toBe('soft'); // pastel mint + white
    expect(classifyTone(['#9a7b8a'])).toBe('soft'); // muted mauve
  });

  it('saturated mid-tone colours are vivid', () => {
    expect(classifyTone(['#d62828'])).toBe('vivid');
    expect(classifyTone(['#28d6d6', '#f2c12e'])).toBe('vivid');
  });

  it('a mix of soft and vivid chromatic colours is mixed', () => {
    expect(classifyTone(['#f4a6c0', '#d62828'])).toBe('mixed');
  });
});

describe('scoreOutfitColor with a tone table', () => {
  const tones = { none: 0.2, soft: 1, vivid: 0.2, mixed: 0.2 };

  it('blends the tone score into the colour score only when a tone table is given', () => {
    const soft = [item('#f4a6c0'), item('#ffffff')];
    const withTone = scoreOutfitColor(soft, {}, tones);
    const without = scoreOutfitColor(soft);
    expect(withTone.tone).toBe('soft');
    expect(withTone.score).not.toBe(without.score);
    expect(without.tone).toBe('soft');
  });

  it('prefers the tone the table likes', () => {
    const soft = scoreOutfitColor([item('#f4a6c0'), item('#ffffff')], {}, tones);
    const vivid = scoreOutfitColor([item('#d62828'), item('#ffffff')], {}, tones);
    expect(soft.score).toBeGreaterThan(vivid.score);
  });
});

describe('scoreOutfitColor', () => {
  it('scores neutral outfits at least as high as complementary ones', () => {
    const neutral = scoreOutfitColor([item('#000000'), item('#ffffff')]);
    const complementary = scoreOutfitColor([item('#d62828'), item('#28d6d6')]);
    expect(neutral.score).toBeGreaterThanOrEqual(complementary.score);
  });

  it('scores a clashing outfit clearly lower than a harmonious one', () => {
    const clash = scoreOutfitColor([item('#d62828'), item('#28d628'), item('#2828d6')]);
    const calm = scoreOutfitColor([item('#1f2a44'), item('#d9c3a0'), item('#ffffff')]);
    expect(calm.score - clash.score).toBeGreaterThan(0.3);
  });

  it('uses every piece, not only the top and bottom', () => {
    const withoutShoes = scoreOutfitColor([item('#000000'), item('#ffffff')]);
    const withLoudShoes = scoreOutfitColor([item('#000000'), item('#ffffff'), item('#d62828'), item('#28d628')]);
    expect(withLoudShoes.score).toBeLessThan(withoutShoes.score);
  });

  it('uses all colours of a patterned item: a loud print scores lower than a plain piece', () => {
    const busy = item('#000000', { is_patterned: true, colors: ['#000000', '#d62828', '#28d628'] });
    const plain = item('#000000');
    expect(scoreOutfitColor([busy, item('#ffffff')]).score).toBeLessThan(scoreOutfitColor([plain, item('#ffffff')]).score);
  });

  it('rewards picking a colour up from the print', () => {
    const print = item('#d62828', { is_patterned: true, colors: ['#d62828', '#ffffff', '#28d628'] });
    const redPants = item('#d62828', { category: 'bottom' });
    const orangePants = item('#f28c28', { category: 'bottom' });
    expect(scoreOutfitColor([print, redPants]).score).toBeGreaterThan(scoreOutfitColor([print, orangePants]).score);
  });

  it('counts a patterned item at most three colours and ignores duplicates', () => {
    const print = item('#d62828', { is_patterned: true, colors: ['#d62828', '#d62828', '#ffffff', '#28d628', '#2828d6'] });
    const three = item('#d62828', { is_patterned: true, colors: ['#d62828', '#ffffff', '#28d628'] });
    expect(scoreOutfitColor([print]).harmony).toBe(scoreOutfitColor([three]).harmony);
  });

  it('a solid item only counts its main colour: stray photo colours do not make it multi-colour', () => {
    const solidWithNoise = item('#d9c3a0', { is_patterned: false, colors: ['#d9c3a0', '#d62828', '#28d628'] });
    const solid = item('#d9c3a0');
    expect(itemColors(solidWithNoise)).toEqual(['#d9c3a0']);
    expect(scoreOutfitColor([solidWithNoise, item('#101010')]).score).toBe(scoreOutfitColor([solid, item('#101010')]).score);
  });

  it('a patterned item without a palette falls back to its main colour', () => {
    expect(itemColors(item('#d62828', { is_patterned: true, colors: null }))).toEqual(['#d62828']);
  });

  it('a patterned item puts its main colour first', () => {
    const print = item('#28d628', { is_patterned: true, colors: ['#d62828', '#28d628', '#ffffff'] });
    expect(itemColors(print)).toEqual(['#28d628', '#d62828', '#ffffff']);
  });

  it('is neutral (0.5) and has no harmony when nothing has a colour', () => {
    const r = scoreOutfitColor([item(null), item(null)]);
    expect(r.score).toBe(0.5);
    expect(r.harmony).toBeNull();
  });

  it('accepts a custom score table (for per-style preferences later)', () => {
    const r = scoreOutfitColor([item('#d62828'), item('#28d6d6')], { complementary: 1 });
    expect(r.score).toBe(1);
  });
});
