import { describe, expect, it } from 'vitest';
import { paletteForItem, paletteToSave, togglePatterned } from './palette';

describe('paletteForItem (loading an item into the form)', () => {
  it('a solid item shows only its main colour', () => {
    expect(paletteForItem('#d9c3a0', ['#d9c3a0', '#d62828', '#28d628'], false)).toEqual(['#d9c3a0']);
  });

  it('a patterned item shows its main colour first, then the rest of its palette, up to three', () => {
    expect(paletteForItem('#28d628', ['#d62828', '#28d628', '#ffffff', '#101010'], true)).toEqual([
      '#28d628',
      '#d62828',
      '#ffffff'
    ]);
  });

  it('falls back safely when data is missing', () => {
    expect(paletteForItem(null, null, false)).toEqual(['#3b82f6']);
    expect(paletteForItem('#d62828', null, true)).toEqual(['#d62828']);
    expect(paletteForItem(null, ['#d62828', '#28d628'], true)).toEqual(['#d62828', '#28d628']);
  });
});

describe('togglePatterned (the Patterned / Solid button)', () => {
  const detected = ['#d62828', '#28d628', '#2828d6'];

  it('turning Patterned on fills the palette from the photo colours, keeping the chosen main colour first', () => {
    expect(togglePatterned(['#101010'], true, detected)).toEqual(['#101010', '#d62828', '#28d628']);
  });

  it('turning Patterned on without photo colours keeps the single colour', () => {
    expect(togglePatterned(['#101010'], true, [])).toEqual(['#101010']);
  });

  it('does not overwrite a palette the user already made', () => {
    expect(togglePatterned(['#101010', '#f2c12e'], true, detected)).toEqual(['#101010', '#f2c12e']);
  });

  it('turning Patterned off keeps only the main colour', () => {
    expect(togglePatterned(['#101010', '#f2c12e', '#d62828'], false, detected)).toEqual(['#101010']);
  });
});

describe('paletteToSave (what goes into the database)', () => {
  it('a solid item saves its main colour and no palette', () => {
    expect(paletteToSave(['#101010', '#d62828'], false)).toEqual({ selected_color: '#101010', colors: null });
  });

  it('a patterned item with several colours saves them all, the first one as main', () => {
    expect(paletteToSave(['#101010', '#d62828', '#28d628'], true)).toEqual({
      selected_color: '#101010',
      colors: ['#101010', '#d62828', '#28d628']
    });
  });

  it('a patterned item with one colour saves no palette', () => {
    expect(paletteToSave(['#101010'], true)).toEqual({ selected_color: '#101010', colors: null });
  });

  it('never saves more than three colours or invalid hex values', () => {
    const saved = paletteToSave(['#101010', 'nope', '#d62828', '#28d628', '#2828d6'], true);
    expect(saved.colors).toEqual(['#101010', '#d62828', '#28d628']);
  });
});
