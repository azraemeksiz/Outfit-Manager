<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { buildUserStyleProfile, diagnoseEmpty, filterItems, generateOutfitCombinations } from '$lib/recommender';
  import type { RecommenderContext } from '$lib/recommender';
  import { STYLES, styleOccasionHint } from '$lib/styles';
  import type { StyleId } from '$lib/styles';
  import type { CalendarEntry, Item, Suggestion, UserStyleProfile } from '$lib/types';

  let items: Item[] = [];
  let wornHistory: CalendarEntry[] = [];
  let userProfile: UserStyleProfile = {
    patternAffinity: 0.5,
    colorAffinities: []
  };
  let occasion = '';
  let style: StyleId | null = null;
  let emptyMessage = '';
  let loading = false;
  let weatherLoading = false;
  let liveTemperature: number | null = null;
  /** Set by the user to try the app at another temperature; null = use the real weather. */
  let manualTemperature: number | null = null;
  $: temperature = manualTemperature ?? liveTemperature;
  let weatherError = '';
  let suggestions: Suggestion[] = [];
  let generated = false;
  let coldThreshold = 15;
  let heatThreshold = 25;
  let lightOuterwearMax: number | null = null;

  const silhouetteLabels: Record<string, string> = {
    fitted: 'Fitted',
    regular: 'Regular',
    relaxed: 'Relaxed',
    oversized: 'Oversized',
    contrast: 'Volume contrast'
  };

  const harmonyLabels: Record<string, string> = {
    neutral: 'All neutrals',
    accent: 'Neutrals + one accent',
    monochrome: 'Monochrome',
    analogous: 'Analogous colors',
    complementary: 'Complementary colors',
    mixed: 'Mixed colors',
    clash: 'Bold clash'
  };
  let locationAsked = false;

  let showCalendarModal = false;
  let activeCalendarSuggestion: Suggestion | null = null;
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
      liveTemperature = Math.round(data.hourly.apparent_temperature[hour]);
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
        .select('cold_threshold_pref, heat_threshold_pref, light_outerwear_max_pref')
        .eq('id', user.id)
        .single();
      if (profile) {
        coldThreshold = profile.cold_threshold_pref ?? 15;
        heatThreshold = profile.heat_threshold_pref ?? 25;
        lightOuterwearMax = profile.light_outerwear_max_pref ?? null;
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
        // supabase infers outfits as an array, but the many-to-one join returns a single object
        wornHistory = histData as unknown as CalendarEntry[];
        userProfile = buildUserStyleProfile(wornHistory);
      }
    }
    requestLocation();
  });

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
    const ctx: RecommenderContext = {
      occasion,
      temperature,
      // Settings validate cold < heat; this guards old saved values that overlap.
      coldThreshold: Math.min(coldThreshold, heatThreshold),
      heatThreshold,
      lightOuterwearMax,
      style,
      userProfile,
      wornHistory
    };
    suggestions = generateOutfitCombinations(filterItems(items, ctx), ctx);
    emptyMessage = suggestions.length === 0 ? diagnoseEmpty(items, ctx).message : '';
    generated = true;
    loading = false;
  }

  function openCalendarModal(suggestion: Suggestion) {
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

    const itemList = activeCalendarSuggestion.items.map((item) => ({
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
        {#if manualTemperature === null && weatherLoading}
          <p class="text-gray-400 font-medium">Fetching weather...</p>
        {:else if manualTemperature === null && weatherError}
          <p class="text-red-400 font-medium text-sm">{weatherError}</p>
          <p class="text-gray-400 text-xs mt-1">Suggestions will be based on color and preferences only.</p>
          <button on:click={requestLocation} class="mt-2 text-pink-500 font-bold text-sm hover:underline">Try again</button>
        {:else if temperature !== null}
          <p class="text-3xl font-black text-gray-900">{temperature}°C <span class="text-base font-medium text-gray-400">{manualTemperature !== null ? 'manual' : 'feels like'}</span></p>
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
        {#if manualTemperature === null && weatherLoading}⏳
        {:else if manualTemperature === null && weatherError}❓
        {:else if !locationAsked}📍
        {:else if temperature !== null && temperature < coldThreshold}❄️
        {:else if temperature !== null && temperature > heatThreshold}☀️
        {:else}🌤️{/if}
      </div>
    </div>

    <div class="bg-white rounded-[24px] p-5 mb-6 shadow-sm border border-gray-50">
      <div class="flex items-center justify-between mb-2">
        <p class="text-xs font-black uppercase tracking-widest text-gray-400">Try another temperature</p>
        {#if manualTemperature !== null}
          <button on:click={() => (manualTemperature = null)} class="text-pink-500 font-bold text-xs hover:underline">
            Use real weather
          </button>
        {/if}
      </div>
      <input
        type="range"
        min="-10"
        max="45"
        step="1"
        value={manualTemperature ?? temperature ?? 20}
        on:input={(e) => (manualTemperature = Number(e.currentTarget.value))}
        class="w-full accent-pink-500"
      />
      <div class="flex justify-between text-xs text-pink-300 mt-1 font-semibold">
        <span>-10°C</span>
        <span>{manualTemperature !== null ? `${manualTemperature}°C (manual)` : 'drag to override'}</span>
        <span>45°C</span>
      </div>
      <p class="text-xs text-gray-400 mt-2">Press Generate again after changing the temperature.</p>
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

    <div class="bg-white rounded-[24px] p-6 mb-6 shadow-sm border border-gray-50">
      <p class="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Today's style (Optional)</p>
      <p class="text-xs text-gray-400 mb-3">Changes how colors are judged. It never hides an outfit.</p>
      <div class="flex gap-3 flex-wrap">
        <button
          on:click={() => (style = null)}
          class="px-5 py-2 rounded-2xl font-bold text-sm transition-all {style === null ? 'bg-pink-500 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}"
        >
          Any
        </button>
        {#each STYLES as s}
          <button
            on:click={() => (style = s.id)}
            class="px-5 py-2 rounded-2xl font-bold text-sm transition-all {style === s.id ? 'bg-pink-500 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}"
          >
            {s.emoji} {s.label}
          </button>
        {/each}
      </div>
    </div>

    {#if styleOccasionHint(style, occasion).message}
      <p class="text-xs font-bold text-amber-600 bg-amber-50 rounded-2xl px-4 py-3 mb-4">
        💡 {styleOccasionHint(style, occasion).message}
      </p>
    {/if}

    <button on:click={generate} disabled={loading}
      class="w-full bg-pink-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-pink-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 mb-8">
      {loading ? 'GENERATING...' : '✨ GENERATE OUTFIT'}
    </button>

    {#if generated}
      {#if suggestions.length === 0}
        <div class="bg-white rounded-[24px] p-8 text-center shadow-sm border border-gray-50">
          <p class="text-2xl mb-2">😕</p>
          <p class="font-bold text-gray-700">No suitable outfits found.</p>
          <p class="text-gray-400 text-sm mt-1">{emptyMessage || 'Try adding more clean items or changing the occasion.'}</p>
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
                  🎨 Color {suggestion.scoreBreakdown.color}/{suggestion.scoreBreakdown.max.color}
                </span>
                <span class="text-[11px] font-bold bg-pink-50 text-pink-600 px-2.5 py-1 rounded-full">
                  🌀 Pattern {suggestion.scoreBreakdown.pattern}/{suggestion.scoreBreakdown.max.pattern}
                </span>
                {#if suggestion.scoreBreakdown.max.occasion > 0}
                  <span class="text-[11px] font-bold bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full">
                    🎯 {occasion} {suggestion.scoreBreakdown.occasion}/{suggestion.scoreBreakdown.max.occasion}
                  </span>
                {/if}
                {#if suggestion.scoreBreakdown.max.silhouette > 0}
                  <span class="text-[11px] font-bold bg-teal-50 text-teal-600 px-2.5 py-1 rounded-full">
                    👖 Fit {suggestion.scoreBreakdown.silhouette}/{suggestion.scoreBreakdown.max.silhouette}{suggestion.scoreBreakdown.silhouetteType ? ` · ${silhouetteLabels[suggestion.scoreBreakdown.silhouetteType]}` : ' · not tagged'}
                  </span>
                {/if}
                <span class="text-[11px] font-bold bg-green-50 text-green-600 px-2.5 py-1 rounded-full">
                  ⏱ Freshness {suggestion.scoreBreakdown.history}/{suggestion.scoreBreakdown.max.history}
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
                {#if userProfile.colorAffinities.some(c => suggestion.items.some((item) => item.selected_color === c))}
                  <span class="text-[11px] font-bold bg-indigo-50 text-indigo-500 px-2.5 py-1 rounded-full">
                    💙 Your palette
                  </span>
                {/if}
                {#if suggestion.scoreBreakdown.colorHarmony}
                  <span class="text-[11px] font-bold bg-yellow-50 text-yellow-600 px-2.5 py-1 rounded-full">
                    🎨 {harmonyLabels[suggestion.scoreBreakdown.colorHarmony]}
                  </span>
                {/if}
                {#if suggestion.outerwearMissing}
                  <span class="text-[11px] font-bold bg-red-50 text-red-500 px-2.5 py-1 rounded-full">
                    🧥 It's cold, but no suitable coat in your wardrobe
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
