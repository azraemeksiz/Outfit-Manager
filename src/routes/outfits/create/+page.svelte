<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';

  let outfitName = '';
  let items: any[] = [];
  let loading = true;
  let saving = false;
  let message = '';

  const categories = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'];
  let selectedItems: Record<string, any> = {};

  onMount(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'Clean')
        .order('created_at', { ascending: false });
      if (!error) items = data;
    }
    loading = false;
  });

  function selectItem(item: any) {
    const cat = item.category;

    if (cat === 'dress') {
      if (selectedItems['dress']?.id === item.id) {
        const { dress, ...rest } = selectedItems;
        selectedItems = rest;
      } else {
        const { top, bottom, ...rest } = selectedItems;
        selectedItems = { ...rest, dress: item };
      }
    } else if (cat === 'top' || cat === 'bottom') {
      if (selectedItems[cat]?.id === item.id) {
        const updated = { ...selectedItems };
        delete updated[cat];
        selectedItems = updated;
      } else {
        const { dress, ...rest } = selectedItems;
        selectedItems = { ...rest, [cat]: item };
      }
    } else {
      if (selectedItems[cat]?.id === item.id) {
        const updated = { ...selectedItems };
        delete updated[cat];
        selectedItems = updated;
      } else {
        selectedItems = { ...selectedItems, [cat]: item };
      }
    }
  }

  function isSelected(item: any) {
    return selectedItems[item.category]?.id === item.id;
  }

  function isDisabled(item: any) {
    const cat = item.category;
    if (cat === 'dress') return !!(selectedItems['top'] || selectedItems['bottom']);
    if (cat === 'top' || cat === 'bottom') return !!selectedItems['dress'];
    return false;
  }

  function getItemsByCategory(cat: string) {
    return items.filter(i => i.category === cat);
  }

  async function saveOutfit() {
    if (!outfitName.trim()) {
      message = 'Error: Please enter an outfit name.';
      return;
    }
    if (Object.keys(selectedItems).length === 0) {
      message = 'Error: Please select at least one item.';
      return;
    }

    saving = true;
    message = '';

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { saving = false; return; }

    const itemList = Object.values(selectedItems).map((item: any) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      photo_url: item.photo_url,
      selected_color: item.selected_color,
      is_patterned: item.is_patterned
    }));

    const { error } = await supabase.from('outfits').insert([{
      user_id: user.id,
      name: outfitName,
      item_list: itemList
    }]);

    if (error) {
      message = `Error: ${error.message}`;
    } else {
      message = 'Outfit saved!';
      setTimeout(() => goto('/outfits'), 1500);
    }
    saving = false;
  }
</script>

<div class="min-h-screen bg-[#F8F9FB] p-6 font-sans">
  <div class="max-w-4xl mx-auto">
    <header class="mb-10">
      <a href="/outfits" class="text-blue-600 font-bold text-sm hover:opacity-80 transition">← Back to Outfits</a>
      <h1 class="text-4xl font-black text-gray-900 mt-4 tracking-tight">Create Outfit</h1>
      <p class="text-gray-400 mt-2">Select items from your wardrobe to build an outfit.</p>
    </header>

    
    <div class="bg-white rounded-[24px] p-6 mb-6 shadow-sm border border-gray-50">
      <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Name your Outfit</label>
      <input bind:value={outfitName} type="text" placeholder="e.g. Monday Casual" required
        class="w-full bg-gray-50 border-none rounded-2xl p-4 mt-2 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-gray-300" />
    </div>

    
    {#if Object.keys(selectedItems).length > 0}
      <div class="bg-white rounded-[24px] p-6 mb-6 shadow-sm border border-gray-50">
        <p class="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Selected Items</p>
        <div class="flex gap-3 flex-wrap">
          {#each Object.values(selectedItems) as item}
            <div class="flex items-center gap-2 bg-blue-50 rounded-2xl px-4 py-2">
              {#if item.photo_url}
                <img src={item.photo_url} alt={item.name} class="w-8 h-8 rounded-lg object-cover" />
              {:else}
                <div class="w-8 h-8 rounded-lg" style="background-color: {item.selected_color || '#e5e7eb'}"></div>
              {/if}
              <span class="text-sm font-bold text-blue-700">{item.name}</span>
              <span class="text-xs text-blue-400 capitalize">{item.category}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if loading}
      <div class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    {:else}
      {#each categories as cat}
        {#if getItemsByCategory(cat).length > 0}
          <div class="mb-6">
            <p class="text-xs font-black uppercase tracking-widest text-gray-400 mb-3 ml-1">{cat}</p>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {#each getItemsByCategory(cat) as item}
                <button
                  type="button"
                  on:click={() => selectItem(item)}
                  disabled={isDisabled(item)}
                  class="relative bg-white rounded-[20px] overflow-hidden shadow-sm border-2 transition-all
                    {isSelected(item) ? 'border-blue-500 shadow-blue-100 shadow-lg' : 'border-transparent hover:border-gray-200'}
                    {isDisabled(item) ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}"
                >
                  <div class="aspect-square bg-[#F1F4F9] flex items-center justify-center overflow-hidden">
                    {#if item.photo_url}
                      <img src={item.photo_url} alt={item.name} class="w-full h-full object-cover" />
                    {:else}
                      <div class="w-10 h-10 rounded-full" style="background-color: {item.selected_color || '#e5e7eb'}"></div>
                    {/if}
                  </div>
                  <div class="p-3">
                    <p class="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                  </div>
                  {#if isSelected(item)}
                    <div class="absolute top-2 right-2 bg-blue-500 w-6 h-6 rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    {/if}

    {#if message}
      <div class="p-4 rounded-2xl text-center text-sm font-bold mb-4 {message.includes('Error') ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}">
        {message}
      </div>
    {/if}

    <button on:click={saveOutfit} disabled={saving}
      class="w-full bg-[#2D60FF] text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
      {saving ? 'SAVING...' : 'SAVE OUTFIT'}
    </button>
  </div>
</div>