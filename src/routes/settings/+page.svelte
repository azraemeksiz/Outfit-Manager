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

<div class="min-h-screen bg-[#F8F9FB] pb-24 p-6 font-sans">
  <div class="max-w-xl mx-auto">
    <header class="mb-10">
      <h1 class="text-4xl font-black text-gray-900 tracking-tight">Settings</h1>
      <p class="text-gray-400 mt-2">Personalize your outfit suggestions.</p>
    </header>

    {#if loading}
      <div class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    {:else}
      <div class="space-y-6">

        <div class="bg-white rounded-[24px] p-6 shadow-sm border border-gray-50">
          <div class="flex items-center justify-between mb-2">
            <div>
              <p class="font-black text-gray-900">Cold Threshold</p>
              <p class="text-sm text-gray-400 mt-1">I start feeling cold below this temperature</p>
            </div>
            <span class="text-2xl font-black text-blue-600">{coldThreshold}°C</span>
          </div>
          <input
            type="range"
            min="-10"
            max="20"
            step="1"
            bind:value={coldThreshold}
            class="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600 mt-4"
          />
          <div class="flex justify-between text-xs text-gray-400 mt-1">
            <span>-10°C</span>
            <span>20°C</span>
          </div>
        </div>

        <div class="bg-white rounded-[24px] p-6 shadow-sm border border-gray-50">
          <div class="flex items-center justify-between mb-2">
            <div>
              <p class="font-black text-gray-900">Heat Threshold</p>
              <p class="text-sm text-gray-400 mt-1">I start feeling warm above this temperature</p>
            </div>
            <span class="text-2xl font-black text-orange-500">{heatThreshold}°C</span>
          </div>
          <input
            type="range"
            min="15"
            max="40"
            step="1"
            bind:value={heatThreshold}
            class="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-orange-500 mt-4"
          />
          <div class="flex justify-between text-xs text-gray-400 mt-1">
            <span>15°C</span>
            <span>40°C</span>
          </div>
        </div>

        <div class="bg-blue-50 rounded-[24px] p-4">
  <p class="text-sm text-blue-600 font-bold">Your comfort zones</p>
  <p class="text-sm text-blue-500 mt-1">
    Below {coldThreshold}°C → cold  &nbsp;|&nbsp; 
    {coldThreshold}–{heatThreshold}°C → mild  &nbsp;|&nbsp; 
    Above {heatThreshold}°C → warm 
  </p>
</div>

        {#if message}
          <div class="p-4 rounded-2xl text-center text-sm font-bold {message.includes('Error') ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}">
            {message}
          </div>
        {/if}

        <button on:click={saveSettings} disabled={saving}
          class="w-full bg-[#2D60FF] text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
          {saving ? 'SAVING...' : 'SAVE SETTINGS'}
        </button>

      </div>
    {/if}
  </div>
</div>