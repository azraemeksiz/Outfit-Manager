<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { buildUserStyleProfile, diagnoseEmpty, filterItems, generateOutfitCombinations } from '$lib/recommender';
  import type { RecommenderContext } from '$lib/recommender';
  import CalendarModal from './CalendarModal.svelte';
  import StyleOccasionPicker from './StyleOccasionPicker.svelte';
  import SuggestionCard from './SuggestionCard.svelte';
  import WeatherCard from './WeatherCard.svelte';
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
  let manualTemperature: number | null = null;
  $: temperature = manualTemperature ?? liveTemperature;
  let weatherError = '';
  let suggestions: Suggestion[] = [];
  let generated = false;
  let coldThreshold = 15;
  let heatThreshold = 25;
  let lightOuterwearMax: number | null = null;

  let locationAsked = false;

  let showCalendarModal = false;
  let activeCalendarSuggestion: Suggestion | null = null;
  let calendarDate = '';
  let savingToCalendar = false;
  let calendarSavedIndex: number | null = null;
  let calendarSaveError = '';

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

    <WeatherCard
      {temperature}
      bind:manualTemperature
      {weatherLoading}
      {weatherError}
      {locationAsked}
      {coldThreshold}
      {heatThreshold}
      on:retry={requestLocation}
    />

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

    <StyleOccasionPicker bind:occasion bind:style />

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
            <SuggestionCard
              {suggestion}
              index={i}
              {occasion}
              {userProfile}
              saved={calendarSavedIndex === i}
              on:add={() => openCalendarModal(suggestion)}
            />
          {/each}
        </div>
      {/if}
    {/if}

  </div>
</div>

{#if showCalendarModal && activeCalendarSuggestion}
  <CalendarModal
    suggestion={activeCalendarSuggestion}
    bind:date={calendarDate}
    saving={savingToCalendar}
    error={calendarSaveError}
    on:close={() => (showCalendarModal = false)}
    on:save={saveToCalendar}
  />
{/if}
