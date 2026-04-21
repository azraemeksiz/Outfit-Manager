<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';

  const SLOT_LABELS: Record<string, string> = {
    top: 'Top',
    bottom: 'Bottom',
    dress: 'Dress',
    outerwear: 'Outerwear',
    shoes: 'Shoes',
    accessory: 'Accessory'
  };

  const SLOT_ICONS: Record<string, string> = {
    top: '👕',
    bottom: '👖',
    dress: '👗',
    outerwear: '🧥',
    shoes: '👟',
    accessory: '👜'
  };

  let outfitName = '';
  let items: any[] = [];
  let loading = true;
  let saving = false;
  let message = '';
  let activeFilter = 'all';

  let slots: Record<string, any | null> = {
    top: null,
    bottom: null,
    dress: null,
    outerwear: null,
    shoes: null,
    accessory: null
  };

  let dragItem: any = null;
  let dragOverSlot: string | null = null;

  const filters = ['all', 'top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'];

  $: filteredItems = activeFilter === 'all'
    ? items
    : items.filter(i => i.category === activeFilter);

  $: selectedCount = Object.values(slots).filter(Boolean).length;

  onMount(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'Clean')
        .order('created_at', { ascending: false });
      if (data) items = data;
    }
    loading = false;
  });

  function handleDragStart(e: DragEvent, item: any) {
    dragItem = item;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
  }

  function handleDragEnd() {
    dragItem = null;
    dragOverSlot = null;
  }

  function handleSlotDragOver(e: DragEvent, slot: string) {
    if (!dragItem) return;
    if (dragItem.category !== slot) return;
    e.preventDefault();
    dragOverSlot = slot;
  }

  function handleSlotDragLeave() {
    dragOverSlot = null;
  }

  function handleSlotDrop(e: DragEvent, slot: string) {
    e.preventDefault();
    dragOverSlot = null;
    if (!dragItem || dragItem.category !== slot) return;
    placeInSlot(dragItem, slot);
    dragItem = null;
  }

  function placeInSlot(item: any, slot: string) {
    if (slot === 'dress') {
      slots = { ...slots, dress: item, top: null, bottom: null };
    } else if (slot === 'top' || slot === 'bottom') {
      slots = { ...slots, [slot]: item, dress: null };
    } else {
      slots = { ...slots, [slot]: item };
    }
  }

  function clickItem(item: any) {
    const cat = item.category;
    if (slots[cat]?.id === item.id) {
      slots = { ...slots, [cat]: null };
    } else {
      placeInSlot(item, cat);
    }
  }

  function removeSlot(cat: string) {
    slots = { ...slots, [cat]: null };
  }

  function isSelected(item: any): boolean {
    return slots[item.category]?.id === item.id;
  }

  function isDisabled(item: any): boolean {
    if (item.category === 'dress') return !!(slots.top || slots.bottom);
    if (item.category === 'top' || item.category === 'bottom') return !!slots.dress;
    return false;
  }

  async function saveOutfit() {
    if (!outfitName.trim()) { message = 'Error: Please enter a name for this outfit.'; return; }
    if (selectedCount === 0) { message = 'Error: Select at least one item.'; return; }

    saving = true;
    message = '';
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { saving = false; return; }

    const itemList = Object.values(slots).filter(Boolean).map((item: any) => ({
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
      saving = false;
    } else {
      setTimeout(() => goto('/outfits'), 800);
    }
  }
</script>

<div class="min-h-screen bg-[#F8F9FB] pb-28 font-sans">
  <div class="max-w-4xl mx-auto p-6">

    <header class="mb-6">
      <a href="/outfits" class="text-blue-600 font-bold text-sm hover:opacity-80 transition">← Back</a>
      <h1 class="text-4xl font-black text-gray-900 mt-3 tracking-tight">Create Outfit</h1>
      <p class="text-gray-400 mt-1 text-sm">Drag items into the slots or tap to select.</p>
    </header>

    <!-- Outfit name -->
    <div class="bg-white rounded-[20px] p-5 mb-5 shadow-sm border border-gray-50">
      <input
        bind:value={outfitName}
        type="text"
        placeholder="Outfit name — e.g. Monday Casual"
        class="w-full bg-gray-50 rounded-2xl px-5 py-4 font-bold text-gray-900 placeholder:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500 border-none text-lg"
      />
    </div>

    <!-- Outfit canvas / slots -->
    <div class="bg-white rounded-[24px] p-5 mb-5 shadow-sm border border-gray-50">
      <p class="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Outfit Canvas</p>
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {#each Object.keys(slots) as cat}
          {@const item = slots[cat]}
          {@const isOver = dragOverSlot === cat}
          {@const compatible = dragItem?.category === cat}
          <div
            role="region"
            aria-label="{SLOT_LABELS[cat]} slot"
            on:dragover={(e) => handleSlotDragOver(e, cat)}
            on:dragleave={handleSlotDragLeave}
            on:drop={(e) => handleSlotDrop(e, cat)}
            class="relative aspect-square rounded-2xl border-2 transition-all flex flex-col items-center justify-center overflow-hidden
              {item ? 'border-transparent' : isOver && compatible ? 'border-blue-400 bg-blue-50' : 'border-dashed border-gray-200 hover:border-gray-300'}"
          >
            {#if item}
              <!-- Filled slot -->
              {#if item.photo_url}
                <img src={item.photo_url} alt={item.name} class="absolute inset-0 w-full h-full object-cover" />
              {:else}
                <div class="absolute inset-0" style="background-color: {item.selected_color || '#e5e7eb'}"></div>
              {/if}
              <div class="absolute inset-0 bg-black/10"></div>
              <p class="absolute bottom-1 left-0 right-0 text-center text-[9px] font-black text-white uppercase tracking-wide drop-shadow z-10 truncate px-1">
                {item.name}
              </p>
              <button
                on:click={() => removeSlot(cat)}
                class="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 flex items-center justify-center text-gray-600 hover:text-red-500 transition-colors z-10 text-xs font-bold"
              >
                ✕
              </button>
            {:else}
              <!-- Empty slot -->
              <span class="text-2xl mb-1 opacity-40">{SLOT_ICONS[cat]}</span>
              <span class="text-[9px] font-black uppercase tracking-wide text-gray-400">{SLOT_LABELS[cat]}</span>
              {#if isOver && compatible}
                <span class="text-[8px] text-blue-500 font-bold mt-0.5">Drop here</span>
              {/if}
            {/if}
          </div>
        {/each}
      </div>

      {#if selectedCount > 0}
        <div class="mt-4 flex items-center gap-2">
          <div class="flex-1 h-px bg-gray-100"></div>
          <span class="text-xs font-bold text-gray-400">{selectedCount} item{selectedCount > 1 ? 's' : ''} selected</span>
          <div class="flex-1 h-px bg-gray-100"></div>
        </div>
      {/if}
    </div>

    <!-- Wardrobe items -->
    <div class="bg-white rounded-[24px] p-5 shadow-sm border border-gray-50">
      <p class="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Your Wardrobe</p>

      <!-- Category filter -->
      <div class="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
        {#each filters as f}
          <button
            on:click={() => activeFilter = f}
            class="flex-shrink-0 px-4 py-1.5 rounded-xl font-bold text-xs transition-all capitalize
              {activeFilter === f ? 'bg-[#1A1C1E] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}"
          >
            {f === 'all' ? 'All' : f}
          </button>
        {/each}
      </div>

      {#if loading}
        <div class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      {:else if filteredItems.length === 0}
        <div class="text-center py-12">
          <p class="text-gray-400 font-medium">No clean items in this category.</p>
        </div>
      {:else}
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {#each filteredItems as item}
            {@const selected = isSelected(item)}
            {@const disabled = isDisabled(item)}
            <div
              draggable={!disabled}
              on:dragstart={(e) => !disabled && handleDragStart(e, item)}
              on:dragend={handleDragEnd}
              on:click={() => !disabled && clickItem(item)}
              role="button"
              tabindex="0"
              on:keydown={(e) => e.key === 'Enter' && !disabled && clickItem(item)}
              class="relative aspect-square rounded-2xl overflow-hidden cursor-pointer transition-all select-none
                {selected ? 'ring-2 ring-blue-500 scale-95' : ''}
                {disabled ? 'opacity-25 cursor-not-allowed' : 'hover:scale-95 active:scale-90'}"
            >
              {#if item.photo_url}
                <img src={item.photo_url} alt={item.name} class="w-full h-full object-cover" />
              {:else}
                <div class="w-full h-full bg-[#F1F4F9] flex items-center justify-center">
                  <div class="w-8 h-8 rounded-full" style="background-color: {item.selected_color || '#e5e7eb'}"></div>
                </div>
              {/if}

              <!-- Name overlay -->
              <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent pt-4 pb-1.5 px-1.5">
                <p class="text-[9px] font-bold text-white truncate">{item.name}</p>
              </div>

              <!-- Selected checkmark -->
              {#if selected}
                <div class="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              {/if}

              <!-- Drag hint -->
              {#if !disabled && !selected}
                <div class="absolute top-1.5 left-1.5 opacity-0 hover:opacity-100 transition-opacity">
                  <div class="bg-white/80 rounded-full w-5 h-5 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    {#if message}
      <div class="mt-4 p-4 rounded-2xl text-center text-sm font-bold {message.includes('Error') ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}">
        {message}
      </div>
    {/if}

    <button
      on:click={saveOutfit}
      disabled={saving || selectedCount === 0}
      class="w-full mt-5 bg-[#2D60FF] text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-100 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-40"
    >
      {saving ? 'SAVING...' : `SAVE OUTFIT${selectedCount > 0 ? ` (${selectedCount} items)` : ''}`}
    </button>

  </div>
</div>
