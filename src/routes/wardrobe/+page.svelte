<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';

  let items: any[] = [];
  let loading = true;
  let deletingId: number | null = null;

  const statusCycle = ['Clean', 'Dirty', 'Laundry', 'Drying'];
  const statusColors: Record<string, string> = {
    Clean: 'bg-green-100 text-green-700',
    Dirty: 'bg-red-100 text-red-600',
    Laundry: 'bg-yellow-100 text-yellow-700',
    Drying: 'bg-blue-100 text-blue-600'
  };

  onMount(async () => {
    await fetchItems();
  });

  async function fetchItems() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error) items = data;
    }
    loading = false;
  }

  async function deleteItem(id: number) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    deletingId = id;
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (!error) items = items.filter(item => item.id !== id);
    deletingId = null;
  }

  async function cycleStatus(item: any) {
    const currentIndex = statusCycle.indexOf(item.status || 'Clean');
    const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];
    const { error } = await supabase
      .from('items')
      .update({ status: nextStatus })
      .eq('id', item.id);
    if (!error) {
      items = items.map(i => i.id === item.id ? { ...i, status: nextStatus } : i);
    }
  }
</script>

<div class="min-h-screen bg-[#F8F9FB] p-8 font-sans">
  <div class="max-w-7xl mx-auto">

    <header class="flex justify-between items-center mb-12">
      <div>
        <h1 class="text-4xl font-extrabold text-[#1A1C1E] tracking-tight">My Wardrobe</h1>
        <p class="text-gray-500 mt-2">Organize your collection for better outfits</p>
      </div>
      <a href="/wardrobe/add" class="bg-[#2D60FF] text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-[#1E4AD9] transition-all transform hover:-translate-y-1">
        + Add New Item
      </a>
    </header>

    {#if loading}
      <div class="flex flex-col items-center justify-center h-64 space-y-4">
        <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
        <p class="text-gray-400 font-medium">Fetching your items...</p>
      </div>

    {:else if items.length === 0}
      <div class="flex flex-col items-center justify-center py-32 bg-white rounded-[32px] border border-dashed border-gray-200 shadow-sm">
        <div class="bg-blue-50 p-6 rounded-full mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-900">Your wardrobe is empty</h2>
        <p class="text-gray-500 mt-2 max-w-xs text-center">Start adding your favorite clothes to see them here.</p>
        <a href="/wardrobe/add" class="mt-8 text-blue-600 font-semibold hover:underline">Add your first item</a>
      </div>

    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {#each items as item}
          <div class="group bg-white rounded-[28px] overflow-hidden shadow-sm border border-gray-50 hover:shadow-xl transition-all duration-300">

            <div class="aspect-[3/4] bg-[#F1F4F9] flex items-center justify-center transition-transform duration-500 relative">
              <span class="text-gray-400 font-bold uppercase tracking-widest text-xs">{item.category}</span>

              <div class="absolute bottom-4 left-4 bg-white/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-gray-600 uppercase">
                {item.seasons?.[0] || 'All Season'}
              </div>

              <button
                on:click={() => cycleStatus(item)}
                class="absolute bottom-4 right-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all hover:scale-105 {statusColors[item.status || 'Clean']}"
              >
                {item.status || 'Clean'}
              </button>

              <a href="/wardrobe/edit/{item.id}" class="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-md text-blue-500 hover:bg-blue-50 w-8 h-8 rounded-full flex items-center justify-center shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                </svg>
              </a>

              <button
                on:click={() => deleteItem(item.id)}
                disabled={deletingId === item.id}
                class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-md text-red-500 hover:bg-red-50 w-8 h-8 rounded-full flex items-center justify-center shadow-sm"
              >
                {#if deletingId === item.id}
                  <div class="animate-spin w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full"></div>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                {/if}
              </button>
            </div>

            <div class="p-6">
              <h3 class="text-lg font-bold text-gray-900 mb-1">{item.name}</h3>
              <div class="flex items-center justify-between">
                <p class="text-sm text-gray-500 capitalize">{item.occasion || item.category}</p>
                <div class="w-4 h-4 rounded-full border border-gray-100" style="background-color: {item.selected_color}"></div>
              </div>
            </div>

          </div>
        {/each}
      </div>
    {/if}

  </div>
</div>
