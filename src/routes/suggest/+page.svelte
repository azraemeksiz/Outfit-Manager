<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';

  let items: any[] = [];
  let wornHistory: any[] = [];
  let userProfile: { patternAffinity: number; colorAffinities: string[] } = {
    patternAffinity: 0.5,
    colorAffinities: []
  };
  let occasion = '';
  let loading = false;
  let weatherLoading = false;
  let temperature: number | null = null;
  let weatherError = '';
  let suggestions: any[] = [];
  let generated = false;
  let coldThreshold = 15;
  let heatThreshold = 25;
  let locationAsked = false;

  let showCalendarModal = false;
  let activeCalendarSuggestion: any = null;
  let calendarDate = '';
  let savingToCalendar = false;
  let calendarSavedIndex: number | null = null;
  let calendarSaveError = '';

  const occasions = ['Casual', 'Sport', 'Indoor', 'Party', 'Formal', ''];

  async function fetchWeather(lat: number, lon: number) {
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=apparent_temperature&timezone=auto&forecast_days=1`
      );
      const data = await res.json();
      const hour = new Date().getHours();
      temperature = Math.round(data.hourly.apparent_temperature[hour]);
      weatherError = '';
    } catch {
      weatherError = 'Could not fetch weather data.';
    }
    weatherLoading = false;
  }

  async function requestLocation() {
    locationAsked = true;
    weatherLoading = true;
    weatherError = '';

    if (!navigator.geolocation) {
      weatherError = 'Geolocation not supported.';
      weatherLoading = false;
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await fetchWeather(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        weatherError = 'Location access denied.';
        weatherLoading = false;
      },
      { timeout: 10000, enableHighAccuracy: false, maximumAge: 60000 }
    );
  }

  onMount(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('cold_threshold_pref, heat_threshold_pref')
        .eq('id', user.id)
        .single();
      if (profile) {
        coldThreshold = profile.cold_threshold_pref ?? 15;
        heatThreshold = profile.heat_threshold_pref ?? 25;
      }
      const { data } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'Clean');
      if (data) items = data;

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const { data: histData } = await supabase
        .from('calendar_entries')
        .select('date, outfits(item_list)')
        .eq('user_id', user.id)
        .eq('is_worn', true)
        .gte('date', sixMonthsAgo.toISOString().split('T')[0]);
      if (histData) {
        wornHistory = histData;
        userProfile = buildUserStyleProfile(histData);
      }
    }
    requestLocation();
  });

  function buildUserStyleProfile(history: any[]) {
    const allItems = history.flatMap((e: any) => e.outfits?.item_list || []);
    if (!allItems.length) return { patternAffinity: 0.5, colorAffinities: [] as string[] };
    const patternCount = allItems.filter((i: any) => i.is_patterned).length;
    const colorMap: Record<string, number> = {};
    for (const item of allItems) {
      if (item.selected_color) colorMap[item.selected_color] = (colorMap[item.selected_color] || 0) + 1;
    }
    const colorAffinities = Object.entries(colorMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([color]) => color);
    return { patternAffinity: patternCount / allItems.length, colorAffinities };
  }

  function filterItems(allItems: any[]): any[] {
    return allItems.filter(item => {
      if (occasion && item.occasions && item.occasions.length > 0) {
        if (!item.occasions.includes(occasion)) return false;
      }
      return true;
    });
  }

  function scoreWeatherNorm(item: any): number {
    if (occasion === 'Indoor') return 0.5;
    if (temperature === null) return 0.5;
    const seasons = item.seasons || [];
    if (seasons.length === 0 || seasons.includes('all-season')) return 0.7;
    const hot = temperature > heatThreshold;
    const cold = temperature < coldThreshold;
    const hasSummer = seasons.includes('summer');
    const hasWinter = seasons.includes('winter');
    const hasSpringFall = seasons.includes('spring-fall');
    if (hot) {
      if (hasSummer) return 1.0;
      if (hasSpringFall) return 0.6;
      if (hasWinter) return 0.0;
    }
    if (cold) {
      if (hasWinter) return 1.0;
      if (hasSpringFall) return 0.4;
      if (hasSummer) return 0.0;
    }
    if (hasSpringFall) return 1.0;
    if (hasWinter || hasSummer) return 0.7;
    return 0.5;
  }

  function hexToHsl(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return [h * 360, s * 100, l * 100];
  }

  function scoreColorNorm(item1: any, item2: any): number {
    if (!item1?.selected_color || !item2?.selected_color) return 0.5;
    if (item1.is_patterned || item2.is_patterned) return 0.5;
    try {
      const [h1, s1, l1] = hexToHsl(item1.selected_color);
      const [h2, s2, l2] = hexToHsl(item2.selected_color);
      const isNeutral = (s: number, l: number) => s < 15 || l < 15 || l > 85;
      if (isNeutral(s1, l1) || isNeutral(s2, l2)) return 0.7;
      const diff = Math.abs(h1 - h2);
      const hueDiff = Math.min(diff, 360 - diff);
      if (hueDiff >= 150 && hueDiff <= 210) return 1.0;
      if (hueDiff <= 15 && Math.abs(s1 - s2) < 20) return 0.85;
      if (hueDiff >= 110 && hueDiff <= 130) return 0.75;
      if (hueDiff > 45 && hueDiff <= 60) return 0.65;
      if (hueDiff >= 15 && hueDiff <= 45 && s1 > 40 && s2 > 40) return 0.1;
      return 0.5;
    } catch { return 0.5; }
  }

  function scorePatternNorm(item1: any, item2: any): number {
    if (!item1 || !item2) return 0.75;
    if (item1.is_patterned && item2.is_patterned)
      return 0.3 + userProfile.patternAffinity * 0.4;
    if (item1.is_patterned || item2.is_patterned) return 1.0;
    return 0.65 + (1 - userProfile.patternAffinity) * 0.2;
  }

  function scoreColorAffinityBonus(outfitItems: any[]): number {
    if (!userProfile.colorAffinities.length) return 0;
    const matches = outfitItems.filter((i: any) => userProfile.colorAffinities.includes(i.selected_color)).length;
    return Math.min(matches * 0.12, 0.3);
  }

  function scoreShoeColorNorm(shoes: any, bottom: any, top: any): number {
    if (!shoes?.selected_color) return 0.6;
    try {
      const [, , lSh] = hexToHsl(shoes.selected_color);
      if (lSh < 15 || lSh > 85) return 0.85;
      const ref = bottom || top;
      if (!ref?.selected_color) return 0.6;
      const [h1, , l1] = hexToHsl(shoes.selected_color);
      const [h2, , l2] = hexToHsl(ref.selected_color);
      if (l1 < 15 || l1 > 85 || l2 < 15 || l2 > 85) return 0.8;
      const hueDiff = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
      if (hueDiff <= 20) return 0.9;
      if (hueDiff >= 150 && hueDiff <= 210) return 0.8;
      if (hueDiff > 20 && hueDiff <= 60) return 0.45;
      return 0.65;
    } catch { return 0.6; }
  }

  function scoreAccessoryColorNorm(accessory: any, top: any, bottom: any): { score: number; note: string } {
    if (!accessory?.selected_color) return { score: 0.6, note: '' };
    try {
      const [h, s, l] = hexToHsl(accessory.selected_color);
      if (s < 20 || l < 15 || l > 85) return { score: 0.75, note: '' };
      const isSilver = l > 65 && s < 25;
      const isGold = h >= 35 && h <= 65 && s > 25 && l > 35 && l < 78;
      const outfitHues = [top, bottom]
        .filter((i: any) => i?.selected_color)
        .map((i: any) => hexToHsl(i.selected_color)[0]);
      if (!outfitHues.length) return { score: 0.7, note: '' };
      const avgHue = outfitHues.reduce((a: number, b: number) => a + b, 0) / outfitHues.length;
      const isWarm = avgHue <= 60 || avgHue >= 300;
      const isCool = avgHue >= 120 && avgHue <= 270;
      if (isGold && isWarm) return { score: 1.0, note: '✨ Gold match' };
      if (isSilver && isCool) return { score: 1.0, note: '🪙 Silver match' };
      if (isGold && isCool) return { score: 0.45, note: '' };
      if (isSilver && isWarm) return { score: 0.45, note: '' };
      return { score: 0.7, note: '' };
    } catch { return { score: 0.6, note: '' }; }
  }

  function checkCombinationHistory(topId: number, bottomId: number): 'recent_repeat' | 'co_occurrence' | 'none' {
    if (!wornHistory.length) return 'none';
    const now = Date.now();
    const sevenDaysAgo  = now - 7   * 86400000;
    const sixMonthsAgo  = now - 180 * 86400000;
    let foundInSixMonths = false;

    for (const entry of wornHistory) {
      const entryTime = new Date(entry.date + 'T12:00:00').getTime();
      if (entryTime < sixMonthsAgo) continue;
      const ids: number[] = (entry.outfits?.item_list || []).map((i: any) => i.id);
      if (ids.includes(topId) && ids.includes(bottomId)) {
        if (entryTime >= sevenDaysAgo) return 'recent_repeat';
        foundInSixMonths = true;
      }
    }
    return foundInSixMonths ? 'co_occurrence' : 'none';
  }

  function scoreHistoryNorm(item: any): number {
    const now = new Date();
    if (item.recent_repeat_date) {
      const d = (now.getTime() - new Date(item.recent_repeat_date).getTime()) / 86400000;
      if (d <= 7) return 0.0;
    }
    if (item.last_worn_date) {
      const d = (now.getTime() - new Date(item.last_worn_date).getTime()) / 86400000;
      if (d <= 7) return 0.1;
      if (d <= 30) return 1.0;
      if (d <= 60) return 0.7;
      return 0.4;
    }
    return 0.6;
  }

  function computeScore(
    top: any, bottom: any, outerwear: any, shoes: any, accessory: any = null, isDress = false
  ): { total: number; weather: number; color: number; pattern: number; history: number; combinationStatus: string; accessoryNote: string } {
    const allItems = [top, bottom, outerwear, shoes, accessory].filter(Boolean);
    const coreItems = isDress ? [bottom].filter(Boolean) : [top, bottom].filter(Boolean);

    const w = allItems.length
      ? allItems.reduce((s, item) => s + scoreWeatherNorm(item), 0) / allItems.length
      : 0.5;

    const affinityBonus = scoreColorAffinityBonus(allItems);
    const topBottomColor = isDress ? 0.5 : scoreColorNorm(top, bottom);
    const shoeColor = scoreShoeColorNorm(shoes, bottom, top);
    const accResult = scoreAccessoryColorNorm(accessory, top, bottom);

    let c: number;
    if (shoes && accessory) {
      c = topBottomColor * 0.6 + shoeColor * 0.3 + accResult.score * 0.1;
    } else if (shoes) {
      c = topBottomColor * 0.7 + shoeColor * 0.3;
    } else if (accessory) {
      c = topBottomColor * 0.9 + accResult.score * 0.1;
    } else {
      c = topBottomColor;
    }
    c = Math.min(1.0, c + affinityBonus);

    const p = isDress ? 0.75 : scorePatternNorm(top, bottom);

    let h = coreItems.length
      ? coreItems.reduce((s, item) => s + scoreHistoryNorm(item), 0) / coreItems.length
      : 0.6;

    let combinationStatus = 'none';
    if (!isDress && top && bottom) {
      combinationStatus = checkCombinationHistory(top.id, bottom.id);
      if (combinationStatus === 'recent_repeat') {
        h = 0.0;
      } else if (combinationStatus === 'co_occurrence') {
        h = Math.min(1.0, h + 0.3);
      }
    }

    const weather  = Math.round(w * 40);
    const color    = Math.round(c * 30);
    const pattern  = Math.round(p * 15);
    const history  = Math.round(h * 15);
    return { total: weather + color + pattern + history, weather, color, pattern, history, combinationStatus, accessoryNote: accResult.note };
  }

  function generateOutfitCombinations(filtered: any[]): any[] {
    const tops        = filtered.filter(i => i.category === 'top');
    const bottoms     = filtered.filter(i => i.category === 'bottom');
    const dresses     = filtered.filter(i => i.category === 'dress');
    const outerwear   = filtered.filter(i => i.category === 'outerwear');
    const shoes       = filtered.filter(i => i.category === 'shoes');
    const accessories = filtered.filter(i => i.category === 'accessory');
    const combinations: any[] = [];

    for (const top of tops) {
      for (const bottom of bottoms) {
        const bestOuterwear = outerwear.length
          ? outerwear.reduce((best: any, ow: any) =>
              scoreWeatherNorm(ow) >= scoreWeatherNorm(best) ? ow : best)
          : null;
        const bestShoes = shoes.length
          ? shoes.reduce((best: any, sh: any) =>
              scoreWeatherNorm(sh) >= scoreWeatherNorm(best) ? sh : best)
          : null;
        const bestAccessory = accessories.length
          ? accessories.reduce((best: any, acc: any) =>
              scoreAccessoryColorNorm(acc, top, bottom).score >= scoreAccessoryColorNorm(best, top, bottom).score ? acc : best)
          : null;

        const scoreData = computeScore(top, bottom, bestOuterwear, bestShoes, bestAccessory);
        if (scoreData.total >= 30) {
          combinations.push({
            items: [top, bottom, bestOuterwear, bestShoes, bestAccessory].filter(Boolean),
            score: scoreData.total,
            scoreBreakdown: scoreData,
            type: 'top+bottom'
          });
        }
      }
    }

    for (const dress of dresses) {
      const bestOuterwear = outerwear.length
        ? outerwear.reduce((best: any, ow: any) =>
            scoreWeatherNorm(ow) >= scoreWeatherNorm(best) ? ow : best)
        : null;
      const bestShoes = shoes.length
        ? shoes.reduce((best: any, sh: any) =>
            scoreWeatherNorm(sh) >= scoreWeatherNorm(best) ? sh : best)
        : null;
      const bestAccessory = accessories.length
        ? accessories.reduce((best: any, acc: any) =>
            scoreAccessoryColorNorm(acc, dress, null).score >= scoreAccessoryColorNorm(best, dress, null).score ? acc : best)
        : null;

      const scoreData = computeScore(null, dress, bestOuterwear, bestShoes, bestAccessory, true);
      if (scoreData.total >= 30) {
        combinations.push({
          items: [dress, bestOuterwear, bestShoes, bestAccessory].filter(Boolean),
          score: scoreData.total,
          scoreBreakdown: scoreData,
          type: 'dress'
        });
      }
    }

    return combinations
      .sort((a, b) => b.score - a.score)
      .filter((combo, index, arr) => {
        const topId    = combo.items.find((i: any) => i.category === 'top' || i.category === 'dress')?.id;
        const bottomId = combo.items.find((i: any) => i.category === 'bottom')?.id;
        const key = `${topId}-${bottomId}`;
        return arr.findIndex(c => {
          const cTopId    = c.items.find((i: any) => i.category === 'top' || i.category === 'dress')?.id;
          const cBottomId = c.items.find((i: any) => i.category === 'bottom')?.id;
          return `${cTopId}-${cBottomId}` === key;
        }) === index;
      })
      .reduce((unique: any[], combo) => {
        if (unique.length >= 3) return unique;
        const bottomId = combo.items.find((i: any) => i.category === 'bottom' || i.category === 'dress')?.id;
        if (unique.some(c => c.items.find((i: any) => i.category === 'bottom' || i.category === 'dress')?.id === bottomId)) return unique;
        unique.push(combo);
        return unique;
      }, []);
  }

  function scoreBadgeColor(score: number): string {
    if (score >= 80) return 'bg-emerald-50 text-emerald-600';
    if (score >= 60) return 'bg-blue-50 text-pink-500';
    if (score >= 40) return 'bg-amber-50 text-amber-600';
    return 'bg-gray-50 text-gray-500';
  }

  function scoreLabel(score: number): string {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Low';
  }

  async function generate() {
    loading = true;
    generated = false;
    calendarSavedIndex = null;
    const filtered = filterItems(items);
    suggestions = generateOutfitCombinations(filtered);
    generated = true;
    loading = false;
  }

  function openCalendarModal(suggestion: any) {
    activeCalendarSuggestion = suggestion;
    const today = new Date();
    calendarDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    showCalendarModal = true;
  }

  async function saveToCalendar() {
    if (!calendarDate || !activeCalendarSuggestion) return;
    savingToCalendar = true;
    calendarSaveError = '';

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { savingToCalendar = false; return; }

    const dateObj = new Date(calendarDate + 'T12:00:00');
    const outfitName = 'Suggested Outfit – ' + dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const itemList = activeCalendarSuggestion.items.map((item: any) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      selected_color: item.selected_color,
      photo_url: item.photo_url,
      is_patterned: item.is_patterned
    }));

    const { data: outfitData, error: outfitError } = await supabase
      .from('outfits')
      .insert([{ user_id: user.id, name: outfitName, item_list: itemList }])
      .select()
      .single();

    if (outfitError || !outfitData) {
      calendarSaveError = outfitError?.message || 'Could not save outfit.';
      savingToCalendar = false;
      return;
    }

    const { error: entryError } = await supabase.from('calendar_entries').insert([{
      user_id: user.id,
      date: calendarDate,
      outfit_id: outfitData.id,
      is_worn: false
    }]);

    if (entryError) {
      calendarSaveError = entryError.message || 'Could not save calendar entry.';
      savingToCalendar = false;
      return;
    }

    calendarSavedIndex = suggestions.indexOf(activeCalendarSuggestion);
    savingToCalendar = false;
    showCalendarModal = false;
  }
</script>

<div class="min-h-screen bg-[#FFF5F9] p-6 pb-24 font-sans">
  <div class="max-w-3xl mx-auto">
    <header class="mb-10">
      <a href="/" class="text-pink-500 font-bold text-sm hover:opacity-80 transition">← Back to Dashboard</a>
      <h1 class="text-4xl font-black text-gray-900 mt-4 tracking-tight">Generate Outfit</h1>
      <p class="text-gray-400 mt-2">Let the algorithm pick the best outfit for you.</p>
    </header>

    <div class="bg-white rounded-[24px] p-6 mb-6 shadow-sm border border-gray-50 flex items-center justify-between">
      <div>
        <p class="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Current Weather</p>
        {#if weatherLoading}
          <p class="text-gray-400 font-medium">Fetching weather...</p>
        {:else if weatherError}
          <p class="text-red-400 font-medium text-sm">{weatherError}</p>
          <p class="text-gray-400 text-xs mt-1">Suggestions will be based on color and preferences only.</p>
          <button on:click={requestLocation} class="mt-2 text-pink-500 font-bold text-sm hover:underline">Try again</button>
        {:else if temperature !== null}
          <p class="text-3xl font-black text-gray-900">{temperature}°C <span class="text-base font-medium text-gray-400">feels like</span></p>
          <p class="text-sm text-gray-400 mt-1">
            {#if temperature < coldThreshold}Cold ❄️
            {:else if temperature > heatThreshold}Warm ☀️
            {:else}Mild 🌤️{/if}
          </p>
        {:else}
          <p class="text-gray-400 font-medium text-sm">Detecting location...</p>
        {/if}
      </div>
      <div class="text-5xl">
        {#if weatherLoading}⏳
        {:else if weatherError}❓
        {:else if !locationAsked}📍
        {:else if temperature !== null && temperature < coldThreshold}❄️
        {:else if temperature !== null && temperature > heatThreshold}☀️
        {:else}🌤️{/if}
      </div>
    </div>

    {#if wornHistory.length > 0}
      <div class="bg-white rounded-[24px] p-5 mb-5 shadow-sm border border-gray-50">
        <p class="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Your Style Profile</p>
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-sm font-black text-gray-900">
              {#if userProfile.patternAffinity > 0.6}Bold & Patterned
              {:else if userProfile.patternAffinity < 0.3}Clean & Minimal
              {:else}Mixed Style{/if}
            </p>
            <p class="text-xs text-gray-400 mt-0.5">Inferred from {wornHistory.length} worn outfit{wornHistory.length > 1 ? 's' : ''}</p>
          </div>
          {#if userProfile.colorAffinities.length > 0}
            <div class="flex gap-1.5 flex-shrink-0">
              {#each userProfile.colorAffinities as color}
                <div class="w-6 h-6 rounded-full border-2 border-white shadow-sm ring-1 ring-gray-100" style="background-color: {color}"></div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <div class="bg-white rounded-[24px] p-6 mb-6 shadow-sm border border-gray-50">
      <p class="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Occasion (Optional)</p>
      <div class="flex gap-3 flex-wrap">
        {#each occasions as occ}
          <button
            on:click={() => occasion = occ}
            class="px-5 py-2 rounded-2xl font-bold text-sm transition-all {occasion === occ ? 'bg-pink-500 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}"
          >
            {occ === '' ? 'Any' : occ}
          </button>
        {/each}
      </div>
    </div>

    <button on:click={generate} disabled={loading}
      class="w-full bg-pink-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-pink-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 mb-8">
      {loading ? 'GENERATING...' : '✨ GENERATE OUTFIT'}
    </button>

    {#if generated}
      {#if suggestions.length === 0}
        <div class="bg-white rounded-[24px] p-8 text-center shadow-sm border border-gray-50">
          <p class="text-2xl mb-2">😕</p>
          <p class="font-bold text-gray-700">No suitable outfits found.</p>
          <p class="text-gray-400 text-sm mt-1">Try adding more clean items or changing the occasion.</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each suggestions as suggestion, i}
            <div class="bg-white rounded-[24px] p-6 shadow-sm border border-gray-50">
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-black uppercase tracking-widest text-gray-400">Outfit {i + 1}</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold px-2 py-0.5 rounded-full {scoreBadgeColor(suggestion.score)}">
                    {scoreLabel(suggestion.score)}
                  </span>
                  <span class="text-2xl font-black text-gray-900">{suggestion.score}<span class="text-sm font-medium text-gray-400">/100</span></span>
                </div>
              </div>

              <div class="flex gap-2 flex-wrap mb-4">
                <span class="text-[11px] font-bold bg-sky-50 text-sky-600 px-2.5 py-1 rounded-full">
                  🌤 Weather {suggestion.scoreBreakdown.weather}/40
                </span>
                <span class="text-[11px] font-bold bg-purple-50 text-purple-600 px-2.5 py-1 rounded-full">
                  🎨 Color {suggestion.scoreBreakdown.color}/30
                </span>
                <span class="text-[11px] font-bold bg-pink-50 text-pink-600 px-2.5 py-1 rounded-full">
                  🌀 Pattern {suggestion.scoreBreakdown.pattern}/15
                </span>
                <span class="text-[11px] font-bold bg-green-50 text-green-600 px-2.5 py-1 rounded-full">
                  ⏱ Freshness {suggestion.scoreBreakdown.history}/15
                </span>
                {#if suggestion.scoreBreakdown.combinationStatus === 'co_occurrence'}
                  <span class="text-[11px] font-bold bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full">
                    ⭐ Proven pair
                  </span>
                {:else if suggestion.scoreBreakdown.combinationStatus === 'recent_repeat'}
                  <span class="text-[11px] font-bold bg-red-50 text-red-400 px-2.5 py-1 rounded-full">
                    🔁 Worn recently
                  </span>
                {/if}
                {#if userProfile.colorAffinities.some(c => suggestion.items.some((item: any) => item.selected_color === c))}
                  <span class="text-[11px] font-bold bg-indigo-50 text-indigo-500 px-2.5 py-1 rounded-full">
                    💙 Your palette
                  </span>
                {/if}
                {#if suggestion.scoreBreakdown.accessoryNote}
                  <span class="text-[11px] font-bold bg-yellow-50 text-yellow-600 px-2.5 py-1 rounded-full">
                    {suggestion.scoreBreakdown.accessoryNote}
                  </span>
                {/if}
              </div>

              <div class="grid grid-cols-4 gap-3 mb-4">
                {#each suggestion.items as item}
                  <div class="text-center">
                    <div class="aspect-square rounded-2xl overflow-hidden bg-[#F1F4F9] mb-2 flex items-center justify-center">
                      {#if item.photo_url}
                        <img src={item.photo_url} alt={item.name} class="w-full h-full object-cover" />
                      {:else}
                        <div class="w-full h-full" style="background-color: {item.selected_color || '#e5e7eb'}"></div>
                      {/if}
                    </div>
                    <p class="text-xs font-bold text-gray-700 truncate">{item.name}</p>
                    <p class="text-[10px] text-gray-400 capitalize">{item.category}</p>
                  </div>
                {/each}
              </div>

              {#if calendarSavedIndex === i}
                <a href="/calendar" class="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-green-50 text-green-600 font-semibold text-sm text-center hover:bg-green-100 transition-all">
                  ✓ Saved to Calendar <span class="text-green-400">→</span>
                </a>
              {:else}
                <button
                  on:click={() => openCalendarModal(suggestion)}
                  class="w-full py-3 rounded-2xl bg-[#F1F4F9] text-gray-600 font-medium text-sm hover:bg-[#e8ecf4] active:scale-95 transition-all"
                >
                  📅 Add to Calendar
                </button>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {/if}

  </div>
</div>

{#if showCalendarModal && activeCalendarSuggestion}
  <div
    class="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-end justify-center"
    on:click|self={() => showCalendarModal = false}
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-white rounded-t-[32px] w-full max-w-lg p-6 pb-10">
      <div class="flex items-start justify-between mb-5">
        <div>
          <p class="text-xs font-black uppercase tracking-widest text-gray-400">Add to Calendar</p>
          <h3 class="text-xl font-black text-gray-900 mt-1">Pick a date</h3>
        </div>
        <button
          on:click={() => showCalendarModal = false}
          class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-all"
        >✕</button>
      </div>

      <div class="flex gap-2 mb-5">
        {#each activeCalendarSuggestion.items.slice(0, 4) as item}
          <div class="w-14 h-14 rounded-2xl overflow-hidden bg-[#F1F4F9] flex-shrink-0">
            {#if item.photo_url}
              <img src={item.photo_url} alt={item.name} class="w-full h-full object-cover" />
            {:else}
              <div class="w-full h-full" style="background-color: {item.selected_color || '#e5e7eb'}"></div>
            {/if}
          </div>
        {/each}
        <div class="flex-1 flex flex-col justify-center pl-1">
          <p class="text-sm font-black text-gray-900">{activeCalendarSuggestion.score}/100</p>
          <p class="text-xs text-gray-400">{activeCalendarSuggestion.items.length} items</p>
        </div>
      </div>

      <label class="block mb-5">
        <span class="text-xs font-black uppercase tracking-widest text-gray-400 mb-2 block">Date</span>
        <input
          type="date"
          bind:value={calendarDate}
          class="w-full bg-[#F1F4F9] rounded-2xl px-4 py-3 font-bold text-gray-800 border-none outline-none focus:ring-2 focus:ring-pink-300 transition"
        />
      </label>

      {#if calendarSaveError}
        <p class="text-red-400 text-sm font-medium mb-3">{calendarSaveError}</p>
      {/if}

      <button
        on:click={saveToCalendar}
        disabled={savingToCalendar || !calendarDate}
        class="w-full bg-pink-500 text-white py-4 rounded-2xl font-black text-base shadow-lg shadow-pink-100 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
      >
        {savingToCalendar ? 'Saving...' : '📅 Save to Calendar'}
      </button>
    </div>
  </div>
{/if}
