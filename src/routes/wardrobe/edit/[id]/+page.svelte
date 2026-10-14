<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import ColorPalette from '$lib/components/ColorPalette.svelte';
  import { paletteForItem, paletteToSave, togglePatterned } from '$lib/palette';

  const id = $page.params.id;

  let name = '';
  let category = 'top';
  // Colour palette: first colour is the main one. A solid piece keeps one colour, a patterned one up to three.
  let palette: string[] = ['#3b82f6'];
  let seasons: string[] = [];
  let occasions: string[] = [];
  let is_patterned = false;
  let fit: string | null = null;
  let initialFit: string | null = null;
  $: showFit = ['top', 'bottom', 'dress', 'outerwear'].includes(category);
  let loading = true;
  let saving = false;
  let message = '';

  function toggleSeason(s: string) {
    if (seasons.includes(s)) {
      seasons = seasons.filter(x => x !== s);
    } else {
      seasons = [...seasons, s];
    }
  }

  function toggleOccasion(o: string) {
    if (occasions.includes(o)) {
      occasions = occasions.filter(x => x !== o);
    } else {
      occasions = [...occasions, o];
    }
  }

  onMount(async () => {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && data) {
      name = data.name;
      category = data.category;
      is_patterned = data.is_patterned || false;
      palette = paletteForItem(data.selected_color, data.colors, is_patterned);
      seasons = data.seasons || [];
      occasions = data.occasions || [];
      fit = data.fit ?? null;
      initialFit = fit;
    }
    loading = false;
  });

  function togglePattern() {
    is_patterned = !is_patterned;
    // No photo here: turning Patterned on lets the user add colours by hand.
    palette = togglePatterned(palette, is_patterned, []);
  }

  async function handleUpdate() {
    saving = true;
    message = '';

    // Fit is only sent when it changed, so saving keeps working before the DB column exists.
    const nextFit = showFit ? fit : null;
    const { error } = await supabase
      .from('items')
      .update({
        name,
        category,
        ...paletteToSave(palette, is_patterned),
        seasons,
        occasions,
        is_patterned,
        ...(nextFit !== initialFit ? { fit: nextFit } : {})
      })
      .eq('id', id);

    if (error) {
      message = `Error: ${error.message}`;
    } else {
      message = 'Saved! Returning to wardrobe...';
      setTimeout(() => goto('/wardrobe'), 1500);
    }
    saving = false;
  }
</script>

<div class="min-h-screen bg-[#FFF5F9] p-6 pb-24 font-sans">
  <div class="bg-white w-full max-w-xl mx-auto rounded-[32px] shadow-sm border border-gray-100 p-8 md:p-12">
    <header class="mb-10">
      <a href="/wardrobe" class="text-pink-500 font-bold text-sm hover:opacity-80 transition">← Back to Wardrobe</a>
      <h1 class="text-4xl font-black text-gray-900 mt-4 tracking-tight">Edit Item</h1>
      <p class="text-gray-400 mt-2 text-lg">Update your item details.</p>
    </header>

    {#if loading}
      <div class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    {:else}
      <form on:submit|preventDefault={handleUpdate} class="space-y-6">

        <div class="space-y-2">
          <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Item Name</label>
          <input bind:value={name} type="text" required
            class="w-full bg-gray-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-pink-300 outline-none" />
        </div>

        <div class="space-y-2">
          <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Category</label>
          <select bind:value={category} class="w-full bg-gray-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-pink-300 outline-none cursor-pointer">
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="dress">Dress</option>
            <option value="outerwear">Outerwear</option>
            <option value="shoes">Shoes</option>
            <option value="accessory">Accessory</option>
          </select>
        </div>

        {#if showFit}
          <div class="space-y-2">
            <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Fit (Optional)</label>
            <div class="grid grid-cols-3 gap-2">
              {#each [['slim', 'Slim'], ['regular', 'Regular'], ['loose', 'Loose']] as [value, label]}
                <button
                  type="button"
                  on:click={() => (fit = fit === value ? null : value)}
                  class="py-3 rounded-2xl font-bold text-sm transition-all {fit === value ? 'bg-pink-500 text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}"
                >
                  {label}
                </button>
              {/each}
            </div>
            <p class="text-xs text-gray-400 ml-1">How it sits on the body: slim = close-fitting, loose = baggy or oversized.</p>
          </div>
        {/if}

        <div class="space-y-2">
          <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Season</label>
          <div class="grid grid-cols-2 gap-2">
            {#each ['all-season', 'winter', 'summer', 'spring-fall'] as s}
              <button
                type="button"
                on:click={() => toggleSeason(s)}
                class="py-3 rounded-2xl font-bold text-sm transition-all {seasons.includes(s) ? 'bg-pink-500 text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}"
              >
                {s === 'all-season' ? 'All Season' : s === 'spring-fall' ? 'Spring/Fall' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            {/each}
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Occasion</label>
          <div class="grid grid-cols-3 gap-2">
            {#each ['Formal', 'Casual', 'Sport', 'Party', 'Indoor'] as o}
              <button
                type="button"
                on:click={() => toggleOccasion(o)}
                class="py-3 rounded-2xl font-bold text-sm transition-all {occasions.includes(o) ? 'bg-pink-500 text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}"
              >
                {o}
              </button>
            {/each}
          </div>
        </div>

        <div class="space-y-2 mb-2">
          <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Pattern</label>
          <button
            type="button"
            on:click={togglePattern}
            class="w-full bg-gray-50 rounded-2xl p-4 font-bold text-sm transition-all {is_patterned ? 'text-pink-500 ring-2 ring-pink-400' : 'text-gray-400'}"
          >
            {is_patterned ? '✓ Patterned' : 'Solid'}
          </button>
        </div>

        <div class="space-y-2">
          <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Color</label>
          <ColorPalette bind:colors={palette} max={is_patterned ? 3 : 1} />
          <p class="text-xs text-gray-400 ml-1">
            {is_patterned
              ? 'Patterned: up to 3 colors count in the color theory, the first one is the main color.'
              : 'Solid: only the main color counts. Switch to Patterned above for a multi-color piece.'}
          </p>
        </div>

        {#if message}
          <div class="p-4 rounded-2xl text-center text-sm font-bold {message.includes('Error') ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}">
            {message}
          </div>
        {/if}

        <button type="submit" disabled={saving}
          class="w-full bg-[#2D60FF] text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
          {saving ? 'SAVING...' : 'SAVE CHANGES'}
        </button>
      </form>
    {/if}
  </div>
</div>