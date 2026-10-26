<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  /** Current weather and the slider for trying another temperature. Fetching the weather is done by the page. */
  export let temperature: number | null;
  /** Set by the user to try the app at another temperature; null = use the real weather. */
  export let manualTemperature: number | null = null;
  export let weatherLoading = false;
  export let weatherError = '';
  export let locationAsked = false;
  export let coldThreshold = 15;
  export let heatThreshold = 25;

  const dispatch = createEventDispatcher<{ retry: void }>();
</script>

<div class="bg-white rounded-[24px] p-6 mb-6 shadow-sm border border-gray-50 flex items-center justify-between">
  <div>
    <p class="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Current Weather</p>
    {#if manualTemperature === null && weatherLoading}
      <p class="text-gray-400 font-medium">Fetching weather...</p>
    {:else if manualTemperature === null && weatherError}
      <p class="text-red-400 font-medium text-sm">{weatherError}</p>
      <p class="text-gray-400 text-xs mt-1">Suggestions will be based on color and preferences only.</p>
      <button on:click={() => dispatch('retry')} class="mt-2 text-pink-500 font-bold text-sm hover:underline">Try again</button>
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
