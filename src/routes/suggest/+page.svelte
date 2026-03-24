<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';

  let items: any[] = [];
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

  const occasions = ['', 'Formal', 'Casual', 'Sport', 'Party' , 'Indoor'];



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
      (e) => {
        weatherError = 'Could not fetch weather data.';
        weatherLoading = false;
      },
      { timeout: 10000, enableHighAccuracy: false, maximumAge: 0 }
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
    }
  });

function filterItems(allItems: any[]): any[] {
    return allItems.filter(item => {
      if (occasion && item.occasions && item.occasions.length > 0) {
        if (!item.occasions.includes(occasion)) return false;
      }
      return true;
    });
  }

  function scoreWeather(item: any): number {
    if (occasion === 'Indoor') return 0;
    if (temperature === null) return 0;
    let score = 0;
    const seasons = item.seasons || [];
    
    const isAllSeason = seasons.includes('all-season') || seasons.length === 0;
    const isWarmItem = seasons.includes('summer');
    const isColdItem = seasons.includes('winter');
    const isMildItem = seasons.includes('spring-fall');

    if (isAllSeason) return 0;

    if (temperature < coldThreshold && isColdItem) score += 100;
    if (temperature > heatThreshold && isWarmItem) score += 100;
    if (isMildItem && temperature >= coldThreshold && temperature <= heatThreshold) score += 50;

    if (temperature < coldThreshold - 5 && !isColdItem && !isMildItem && !isAllSeason) score -= 400;
    if (temperature > heatThreshold + 5 && !isWarmItem && !isMildItem && !isAllSeason) score -= 400;
    if (temperature < coldThreshold && isWarmItem && !isColdItem && !isAllSeason) score -= 200;

    return score;
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

  function scoreColor(item1: any, item2: any): number {
    if (!item1?.selected_color || !item2?.selected_color) return 0;
    if (item1.is_patterned || item2.is_patterned) return 0;
    try {
      const [h1, s1, l1] = hexToHsl(item1.selected_color);
      const [h2, s2, l2] = hexToHsl(item2.selected_color);
      const isNeutral = (s: number, l: number) => s < 15 || l < 15 || l > 85;
      if (isNeutral(s1, l1) || isNeutral(s2, l2)) return 30;
      const diff = Math.abs(h1 - h2);
      const hueDiff = Math.min(diff, 360 - diff);
      if (hueDiff >= 15 && hueDiff <= 45 && s1 > 40 && s2 > 40) return -30;
      if (hueDiff >= 150 && hueDiff <= 210) return 50;
      if (hueDiff <= 15 && Math.abs(s1 - s2) < 20) return 40;
      if (hueDiff > 45 && hueDiff <= 60) return 30;
      if (hueDiff >= 110 && hueDiff <= 130) return 20;
      return 0;
    } catch { return 0; }
  }

  function scorePattern(top: any, bottom: any): number {
    if (!top || !bottom) return 0;
    if (top.is_patterned && bottom.is_patterned) return -20;
    return 0;
  }

  function scoreHistory(item: any): number {
    let score = 0;
    const now = new Date();
    if (item.last_worn_date) {
      const daysSince = (now.getTime() - new Date(item.last_worn_date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince <= 30) score += 10;
      if (daysSince > 60) score -= 10;
    }
    if (item.recent_repeat_date) {
      const daysSince = (now.getTime() - new Date(item.recent_repeat_date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince <= 7) score -= 20;
    }
    return score;
  }

  function generateOutfitCombinations(filtered: any[]): any[] {
    const tops = filtered.filter(i => i.category === 'top');
    const bottoms = filtered.filter(i => i.category === 'bottom');
    const dresses = filtered.filter(i => i.category === 'dress');
    const outerwear = filtered.filter(i => i.category === 'outerwear');
    const shoes = filtered.filter(i => i.category === 'shoes');
    const combinations: any[] = [];

    for (const top of tops) {
      for (const bottom of bottoms) {
        let score = 0;
        score += scoreWeather(top);
        score += scoreWeather(bottom);
        score += scoreColor(top, bottom);
        score += scorePattern(top, bottom);
        score += scoreHistory(top);
        score += scoreHistory(bottom);

        let bestOuterwear = null;
        if (outerwear.length > 0) {
          bestOuterwear = outerwear.reduce((best: any, ow: any) => {
            return (scoreWeather(ow) + scoreColor(top, ow)) > (scoreWeather(best) + scoreColor(top, best)) ? ow : best;
          });
          score += scoreWeather(bestOuterwear);
        }

        let bestShoes = null;
        if (shoes.length > 0) {
          bestShoes = shoes[0];
          score += scoreWeather(bestShoes);
        }

        if (score >= 0) {
          combinations.push({
            items: [top, bottom, bestOuterwear, bestShoes].filter(Boolean),
            score,
            type: 'top+bottom'
          });
        }
      }
    }

    for (const dress of dresses) {
      let score = 0;
      score += scoreWeather(dress);
      score += scoreHistory(dress);

      let bestOuterwear = null;
      if (outerwear.length > 0) {
        bestOuterwear = outerwear.reduce((best: any, ow: any) => {
          return (scoreWeather(ow) + scoreColor(dress, ow)) > (scoreWeather(best) + scoreColor(dress, best)) ? ow : best;
        });
        score += scoreWeather(bestOuterwear);
      }

      let bestShoes = null;
      if (shoes.length > 0) {
        bestShoes = shoes[0];
        score += scoreWeather(bestShoes);
      }

      if (score >= 0) {
        combinations.push({
          items: [dress, bestOuterwear, bestShoes].filter(Boolean),
          score,
          type: 'dress'
        });
      }
    }

    return combinations.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  function getScoreReasons(suggestion: any): string[] {
    const reasons: string[] = [];
    if (weatherError) reasons.push('Weather unavailable — color-based suggestion 🎨');
    else if (temperature !== null && temperature < coldThreshold) reasons.push('Cold weather appropriate ❄️');
    else if (temperature !== null && temperature > heatThreshold) reasons.push('Warm weather appropriate ☀️');
    else if (temperature !== null) reasons.push('Mild weather appropriate 🌤️');

    const top = suggestion.items.find((i: any) => i.category === 'top');
    const bottom = suggestion.items.find((i: any) => i.category === 'bottom');
    if (top && bottom) {
      const colorScore = scoreColor(top, bottom);
      if (colorScore >= 50) reasons.push('Great color harmony 🎨');
      else if (colorScore >= 30) reasons.push('Neutral color balance 🤍');
      if (!top.is_patterned && !bottom.is_patterned) reasons.push('No pattern clash ✓');
    }
    return reasons;
  }

  async function generate() {
    loading = true;
    generated = false;
    const filtered = filterItems(items);
    suggestions = generateOutfitCombinations(filtered);
    generated = true;
    loading = false;
  }
</script>

<div class="min-h-screen bg-[#F8F9FB] p-6 font-sans">
  <div class="max-w-3xl mx-auto">
    <header class="mb-10">
      <a href="/" class="text-blue-600 font-bold text-sm hover:opacity-80 transition">← Back to Dashboard</a>
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
          <button on:click={requestLocation} class="mt-2 text-blue-600 font-bold text-sm hover:underline">Try again</button>
        {:else if !locationAsked}
          <p class="text-gray-500 font-medium text-sm">Weather not fetched yet.</p>
          <button on:click={requestLocation} class="mt-3 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition">
            📍 Get My Location
          </button>
        {:else}
          <p class="text-3xl font-black text-gray-900">{temperature}°C <span class="text-base font-medium text-gray-400">feels like</span></p>
          <p class="text-sm text-gray-400 mt-1">
            {#if temperature !== null && temperature < coldThreshold}Cold ❄️
            {:else if temperature !== null && temperature > heatThreshold}Warm ☀️
            {:else}Mild 🌤️{/if}
          </p>
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

    <div class="bg-white rounded-[24px] p-6 mb-6 shadow-sm border border-gray-50">
      <p class="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Occasion (Optional)</p>
      <div class="flex gap-3 flex-wrap">
        {#each occasions as occ}
          <button
            on:click={() => occasion = occ}
            class="px-5 py-2 rounded-2xl font-bold text-sm transition-all {occasion === occ ? 'bg-[#2D60FF] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}"
          >
            {occ === '' ? 'Any' : occ}
          </button>
        {/each}
      </div>
    </div>

    <button on:click={generate} disabled={loading}
      class="w-full bg-[#2D60FF] text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 mb-8">
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
              <div class="flex items-center justify-between mb-4">
                <div>
                  <span class="text-xs font-black uppercase tracking-widest text-gray-400">Outfit {i + 1}</span>
                  <div class="flex flex-wrap gap-2 mt-2">
                    {#each getScoreReasons(suggestion) as reason}
                      <span class="text-xs bg-blue-50 text-blue-600 font-bold px-3 py-1 rounded-full">{reason}</span>
                    {/each}
                  </div>
                </div>
                <div class="bg-blue-50 px-3 py-1 rounded-full shrink-0 ml-2">
                  <span class="text-blue-600 font-black text-sm">Score: {suggestion.score}</span>
                </div>
              </div>
              <div class="grid grid-cols-4 gap-3">
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
            </div>
          {/each}
        </div>
      {/if}
    {/if}

  </div>
</div>