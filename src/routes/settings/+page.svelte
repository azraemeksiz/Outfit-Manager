<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';

  let coldThreshold = 15;
  let heatThreshold = 25;
  let loading = true;
  let saving = false;
  let message = '';

  onMount(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('cold_threshold_pref, heat_threshold_pref')
        .eq('id', user.id)
        .single();
      if (data) {
        coldThreshold = data.cold_threshold_pref ?? 15;
        heatThreshold = data.heat_threshold_pref ?? 25;
      }
    }
    loading = false;
  });

  async function saveSettings() {
    saving = true;
    message = '';
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { saving = false; return; }

    const { error } = await supabase
      .from('profiles')
      .update({
        cold_threshold_pref: coldThreshold,
        heat_threshold_pref: heatThreshold
      })
      .eq('id', user.id);

    if (error) {
      message = `Error: ${error.message}`;
    } else {
      message = 'Settings saved!';
      setTimeout(() => message = '', 2000);
    }
    saving = false;
  }
</script>

<style>
  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 9999px;
    outline: none;
    cursor: pointer;
  }

  input[type='range'].pink-range {
    background: linear-gradient(to right, #f9a8d4, #ec4899);
  }

  input[type='range'].pink-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 22px;
    height: 22px;
    border-radius: 9999px;
    background: #ec4899;
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(236, 72, 153, 0.4);
    cursor: pointer;
  }

  input[type='range'].pink-range::-moz-range-thumb {
    width: 22px;
    height: 22px;
    border-radius: 9999px;
    background: #ec4899;
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(236, 72, 153, 0.4);
    cursor: pointer;
  }
</style>

<div class="min-h-screen bg-[#FFF5F9] pb-24 p-6 font-sans">
  <div class="max-w-xl mx-auto">

    <header class="mb-10">
      <h1 class="text-4xl font-black text-gray-900 tracking-tight">Settings</h1>
      <p class="text-gray-400 mt-2">Personalize your outfit suggestions.</p>
    </header>

    {#if loading}
      <div class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-pink-400"></div>
      </div>
    {:else}
      <div class="space-y-5">

        <!-- Cold threshold -->
        <div class="bg-white rounded-[24px] p-6 shadow-sm border border-pink-100">
          <div class="flex items-center gap-3 mb-1">
            <span class="text-2xl">❄️</span>
            <div class="flex-1">
              <p class="font-black text-gray-900">Cold Threshold</p>
              <p class="text-sm text-gray-400 mt-0.5">I start feeling cold below this</p>
            </div>
            <span class="text-2xl font-black text-pink-500">{coldThreshold}°C</span>
          </div>
          <input
            type="range"
            min="-10"
            max="20"
            step="1"
            bind:value={coldThreshold}
            class="pink-range mt-5"
          />
          <div class="flex justify-between text-xs text-pink-300 mt-1.5 font-semibold">
            <span>-10°C</span>
            <span>20°C</span>
          </div>
        </div>

        <!-- Heat threshold -->
        <div class="bg-white rounded-[24px] p-6 shadow-sm border border-pink-100">
          <div class="flex items-center gap-3 mb-1">
            <span class="text-2xl">☀️</span>
            <div class="flex-1">
              <p class="font-black text-gray-900">Heat Threshold</p>
              <p class="text-sm text-gray-400 mt-0.5">I start feeling warm above this</p>
            </div>
            <span class="text-2xl font-black text-pink-500">{heatThreshold}°C</span>
          </div>
          <input
            type="range"
            min="15"
            max="40"
            step="1"
            bind:value={heatThreshold}
            class="pink-range mt-5"
          />
          <div class="flex justify-between text-xs text-pink-300 mt-1.5 font-semibold">
            <span>15°C</span>
            <span>40°C</span>
          </div>
        </div>

        <!-- Comfort zone summary -->
        <div class="rounded-[20px] p-5" style="background: linear-gradient(135deg, rgba(249,168,212,0.2), rgba(236,72,153,0.08))">
          <p class="text-sm font-black text-pink-500 mb-2">Your comfort zones</p>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-bold bg-white px-3 py-1.5 rounded-full text-pink-400 shadow-sm">❄️ Below {coldThreshold}°C → Cold</span>
            <span class="text-xs font-bold bg-white px-3 py-1.5 rounded-full text-pink-400 shadow-sm">🌤️ {coldThreshold}–{heatThreshold}°C → Mild</span>
            <span class="text-xs font-bold bg-white px-3 py-1.5 rounded-full text-pink-400 shadow-sm">☀️ Above {heatThreshold}°C → Warm</span>
          </div>
        </div>

        {#if message}
          <div class="p-4 rounded-2xl text-center text-sm font-bold {message.includes('Error') ? 'bg-red-50 text-red-500' : 'bg-pink-50 text-pink-500'}">
            {message}
          </div>
        {/if}

        <button
          on:click={saveSettings}
          disabled={saving}
          class="w-full py-5 rounded-2xl font-black text-lg text-white transition-all active:scale-95 disabled:opacity-50"
          style="background: linear-gradient(135deg, #f472b6, #ec4899); box-shadow: 0 8px 24px rgba(236,72,153,0.3);"
        >
          {saving ? 'SAVING...' : 'SAVE SETTINGS'}
        </button>

      </div>
    {/if}
  </div>
</div>
