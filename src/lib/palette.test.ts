import { describe, expect, it } from 'vitest';
import { paletteForItem, paletteToSave } from './palette';

describe('paletteForItem (loading an item into the form)', () => {
  it('shows the saved colours, the first one first, without duplicates', () => {
    expect(paletteForItem('#28d628', ['#d62828', '#28d628', '#ffffff'])).toEqual(['#28d628', '#d62828', '#ffffff']);
  });

  it('shows up to four colours', () => {
    expect(paletteForItem('#101010', ['#d62828', '#28d628', '#ffffff', '#2828d6', '#f2c12e'])).toHaveLength(4);
  });

  it('a single-colour item has a single colour', () => {
    expect(paletteForItem('#d9c3a0', null)).toEqual(['#d9c3a0']);
  });

  it('falls back safely when data is missing', () => {
    expect(paletteForItem(null, null)).toEqual(['#3b82f6']);
    expect(paletteForItem(null, ['#d62828', '#28d628'])).toEqual(['#d62828', '#28d628']);
    expect(paletteForItem('nope', ['bad'])).toEqual(['#3b82f6']);
  });
});

describe('paletteToSave (what goes into the database)', () => {
  it('one colour: it is the item colour and there is no palette', () => {
    expect(paletteToSave(['#101010'])).toEqual({ selected_color: '#101010', colors: null });
  });

  it('several colours: all are saved, the first one is the item colour', () => {
    expect(paletteToSave(['#101010', '#d62828', '#28d628'])).toEqual({
      selected_color: '#101010',
      colors: ['#101010', '#d62828', '#28d628']
    });
  });

  it('never saves more than four colours, duplicates or invalid values', () => {
    const saved = paletteToSave(['#101010', 'nope', '#d62828', '#D62828', '#28d628', '#2828d6', '#f2c12e']);
    expect(saved.colors).toEqual(['#101010', '#d62828', '#28d628', '#2828d6']);
  });

  it('an empty palette falls back to a default colour', () => {
    expect(paletteToSave([])).toEqual({ selected_color: '#3b82f6', colors: null });
  });
});
