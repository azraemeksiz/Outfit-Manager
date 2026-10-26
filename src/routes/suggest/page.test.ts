// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import Page from './+page.svelte';

/**
 * Characterisation tests for the Suggest page: they describe what the page does today so that
 * moving its markup into components cannot change the behaviour. Supabase, location and the
 * weather request are replaced by small fakes.
 */

const fake = vi.hoisted(() => ({
  items: [] as Record<string, unknown>[],
  inserts: [] as { table: string; rows: Record<string, unknown>[] }[],
  outfitError: null as { message: string } | null
}));

vi.mock('$lib/supabase', () => {
  const query = (table: string) => {
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      gte: () => q,
      single: () =>
        Promise.resolve({
          data: table === 'profiles' ? { cold_threshold_pref: 15, heat_threshold_pref: 25, light_outerwear_max_pref: null } : null
        }),
      insert: (rows: Record<string, unknown>[]) => {
        fake.inserts.push({ table, rows });
        const result =
          table === 'outfits'
            ? { data: fake.outfitError ? null : { id: 99 }, error: fake.outfitError }
            : { data: null, error: null };
        const promise = Promise.resolve(result) as Promise<unknown> & { select?: () => unknown };
        promise.select = () => ({ single: () => Promise.resolve(result) });
        return promise;
      },
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve({ data: table === 'items' ? fake.items : table === 'calendar_entries' ? [] : null }).then(resolve, reject)
    };
    return q;
  };
  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
      from: query
    }
  };
});

const piece = (id: number, over: Record<string, unknown>) => ({
  id,
  name: `piece ${id}`,
  status: 'Clean',
  photo_url: null,
  seasons: [],
  occasions: [],
  ...over
});

let app: ReturnType<typeof mount> | null = null;

const buttonWith = (text: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;
const press = async (text: string) => {
  const b = buttonWith(text);
  expect(b, `button "${text}"`).toBeTruthy();
  b.click();
  await tick();
};
const pageText = () => document.body.textContent?.replace(/\s+/g, ' ') ?? '';
const waitForText = (text: string | RegExp) =>
  vi.waitFor(() => (typeof text === 'string' ? expect(pageText()).toContain(text) : expect(pageText()).toMatch(text)));

async function open() {
  app = mount(Page, { target: document.body });
  await waitForText('20°C');
}

beforeEach(() => {
  fake.inserts = [];
  fake.outfitError = null;
  fake.items = [
    piece(1, { name: 'grey tee', category: 'top', selected_color: '#808080', occasions: ['Casual'] }),
    piece(2, { name: 'black jeans', category: 'bottom', selected_color: '#101010', occasions: ['Casual'] })
  ];
  vi.stubGlobal('navigator', {
    geolocation: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: 1, longitude: 1 } }) }
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ json: async () => ({ hourly: { apparent_temperature: Array(24).fill(20) } }) }))
  );
});

afterEach(() => {
  if (app) unmount(app);
  app = null;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('Suggest page: weather', () => {
  it('shows the forecast temperature as feels-like and mild', async () => {
    await open();
    expect(pageText()).toContain('20°C');
    expect(pageText()).toContain('feels like');
    expect(pageText()).toContain('Mild');
  });

  it('a manual temperature replaces the real weather until it is reset', async () => {
    await open();
    const range = document.querySelector('input[type="range"]') as HTMLInputElement;
    range.value = '5';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    expect(pageText()).toContain('5°C');
    expect(pageText()).toContain('manual');
    expect(pageText()).toContain('Cold');
    await press('Use real weather');
    expect(pageText()).toContain('20°C');
  });

  it('tells the user when the forecast cannot be fetched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      })
    );
    app = mount(Page, { target: document.body });
    await waitForText('Could not fetch weather data.');
    expect(pageText()).toContain('Try again');
  });
});

describe('Suggest page: occasion and style', () => {
  it('offers every occasion and every style', async () => {
    await open();
    for (const label of ['Any', 'Casual', 'Sport', 'Indoor', 'Party', 'Formal', 'Minimal', 'Streetwear', 'Girl casual', 'Sporty', 'Maximalist']) {
      expect(pageText(), label).toContain(label);
    }
  });

  it('fades styles that rarely suit the occasion, but they stay selectable', async () => {
    await open();
    await press('Formal');
    expect(buttonWith('Streetwear').className).toContain('opacity-40');
    expect(buttonWith('Minimal').className).not.toContain('opacity-40');
    await press('Streetwear');
    expect(buttonWith('Streetwear').className).toContain('bg-pink-500');
    expect(buttonWith('Streetwear').className).not.toContain('opacity-40');
    expect(pageText()).toContain('does not usually suit Formal');
  });

  it('shows no hint when the style suits the occasion', async () => {
    await open();
    await press('Casual');
    await press('Streetwear');
    expect(pageText()).not.toContain('does not usually suit');
  });
});

describe('Suggest page: generating', () => {
  it('lists outfits with a score and a score breakdown', async () => {
    await open();
    await press('GENERATE OUTFIT');
    await waitForText('Outfit 1');
    for (const part of ['/100', 'Weather', 'Color', 'Pattern', 'Freshness', 'grey tee', 'black jeans']) {
      expect(pageText(), part).toContain(part);
    }
  });

  it('shows the real maximum of the weather points: 40 normally, 30 when an occasion takes 10', async () => {
    await open();
    await press('GENERATE OUTFIT');
    await waitForText(/Weather \d+\/40/);

    await press('Casual');
    await press('GENERATE OUTFIT');
    await waitForText(/Weather \d+\/30/);
    expect(pageText()).toMatch(/Casual \d+\/10/);
  });

  it('shows the fit chip only when a style is chosen', async () => {
    await open();
    await press('GENERATE OUTFIT');
    await waitForText('Outfit 1');
    expect(pageText()).not.toContain('Fit ');
    await press('Streetwear');
    await press('GENERATE OUTFIT');
    await waitForText(/Fit \d+\/15/);
  });

  it('explains an empty result when every piece is tagged for another occasion', async () => {
    await open();
    await press('Party');
    await press('GENERATE OUTFIT');
    await waitForText('No suitable outfits found.');
    expect(pageText()).toContain('tagged for other occasions');
  });
});

describe('Suggest page: add to calendar', () => {
  async function generateAndOpenModal() {
    await open();
    await press('GENERATE OUTFIT');
    await waitForText('Outfit 1');
    await press('Add to Calendar');
    await waitForText('Pick a date');
  }

  it('opens a date picker for the chosen outfit, defaulting to today', async () => {
    await generateAndOpenModal();
    const date = document.querySelector('input[type="date"]') as HTMLInputElement;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(date.value).toBe(today);
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  });

  it('closes without saving', async () => {
    await generateAndOpenModal();
    await press('✕');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(fake.inserts).toHaveLength(0);
  });

  it('saves the outfit, then the calendar entry, and shows the saved link', async () => {
    await generateAndOpenModal();
    await press('Save to Calendar');
    await waitForText('Saved to Calendar');

    expect(fake.inserts.map((i) => i.table)).toEqual(['outfits', 'calendar_entries']);
    const outfit = fake.inserts[0].rows[0] as { user_id: string; name: string; item_list: { id: number }[] };
    expect(outfit.user_id).toBe('u1');
    expect(outfit.name).toMatch(/^Suggested Outfit/);
    expect(outfit.item_list.map((i) => i.id).sort()).toEqual([1, 2]);
    expect(fake.inserts[1].rows[0]).toMatchObject({ user_id: 'u1', outfit_id: 99, is_worn: false });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('a[href="/calendar"]')).toBeTruthy();
  });

  it('shows the error and saves no calendar entry when the outfit cannot be saved', async () => {
    fake.outfitError = { message: 'boom' };
    await generateAndOpenModal();
    await press('Save to Calendar');
    await waitForText('boom');
    expect(fake.inserts.map((i) => i.table)).toEqual(['outfits']);
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  });
});
