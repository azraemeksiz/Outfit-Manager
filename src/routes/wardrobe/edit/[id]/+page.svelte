<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  const id = $page.params.id;

  let name = '';
  let category = 'top';
  let color = '#3b82f6';
  let seasons: string[] = [];
  let is_patterned = false;
  let occasion = '';
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

  onMount(async () => {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && data) {
      name = data.name;
      category = data.category;
      color = data.selected_color || '#3b82f6';
      seasons = data.seasons || [];
      is_patterned = data.is_patterned || false;
      occasion = data.occasion || '';
    }
    loading = false;
  });

  async function handleUpdate() {
    saving = true;
    message = '';

    const { error } = await supabase
      .from('items')
      .update({
        name,
        category,
        selected_color: color,
        seasons,
        is_patterned,
        occasion: occasion || null
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

<div class="min-h-screen bg-[#F8F9FB] p-6 flex items-center justify-center font-sans">
  <div class="bg-white w-full max-w-xl rounded-[32px] shadow-sm border border-gray-100 p-8 md:p-12">
    <header class="mb-10">
      <a href="/wardrobe" class="text-blue-600 font-bold text-sm hover:opacity-80 transition">← Back to Wardrobe</a>
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
            class="w-full bg-gray-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Category</label>
            <select bind:value={category} class="w-full bg-gray-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
              <option value="dress">Dress</option>
              <option value="outerwear">Outerwear</option>
              <option value="shoes">Shoes</option>
              <option value="accessory">Accessory</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Occasion</label>
            <select bind:value={occasion} class="w-full bg-gray-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
              <option value="">None</option>
              <option value="Formal">Formal</option>
              <option value="Casual">Casual</option>
              <option value="Sport">Sport</option>
              <option value="Party">Party</option>
            </select>
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Season</label>
          <div class="grid grid-cols-2 gap-2">
            {#each ['all-season', 'winter', 'summer', 'spring-fall'] as s}
              <button
                type="button"
                on:click={() => toggleSeason(s)}
                class="py-3 rounded-2xl font-bold text-sm transition-all {seasons.includes(s) ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}"
              >
                {s === 'all-season' ? 'All Season' : s === 'spring-fall' ? 'Spring/Fall' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            {/each}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Color Pick</label>
            <div class="flex items-center space-x-4 bg-gray-50 rounded-2xl p-4">
              <input bind:value={color} type="color" class="w-10 h-10 rounded-full cursor-pointer border-none bg-transparent" />
              <span class="text-sm font-mono font-bold text-gray-400 uppercase">{color}</span>
            </div>
          </div>
          <div class="space-y-2">
            <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Pattern</label>
            <button
              type="button"
              on:click={() => is_patterned = !is_patterned}
              class="w-full bg-gray-50 rounded-2xl p-4 font-bold text-sm transition-all {is_patterned ? 'text-blue-600 ring-2 ring-blue-500' : 'text-gray-400'}"
            >
              {is_patterned ? '✓ Patterned' : 'Solid'}
            </button>
          </div>
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