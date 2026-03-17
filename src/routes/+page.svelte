<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';

  let items: any[] = [];
  let loading = true;

  onMount(async () => {
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
  });
</script>

<div class="min-h-screen bg-[#F8F9FB] p-8 font-sans">
  <div class="max-w-7xl mx-auto">
    <header class="flex justify-between items-center mb-12">
      <div>
        <h1 class="text-4xl font-extrabold text-[#1A1C1E] tracking-tight">My Wardrobe</h1>
        <p class="text-gray-500 mt-2">Organize your collection for better outfits</p>
      </div>
      <a 
        href="/wardrobe/add" 
        class="bg-[#2D60FF] text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-[#1E4AD9] transition-all transform hover:-translate-y-1"
      >
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
        <a href="/wardrobe/add" class="mt-8 text-blue-600 font-semibold hover:underline">Add your first item &rarr;</a>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {#each items as item}
          <div class="group bg-white rounded-[28px] overflow-hidden shadow-sm border border-gray-50 hover:shadow-xl transition-all duration-300">
            <div class="aspect-[3/4] bg-[#F1F4F9] flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-500 relative">
               <span class="text-gray-400 font-bold uppercase tracking-widest text-xs">{item.category}</span>
               <div class="absolute bottom-4 left-4 bg-white/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-gray-600 uppercase">
                 {item.season || 'All Season'}
               </div>
            </div>
            <div class="p-6">
              <h3 class="text-lg font-bold text-gray-900 mb-1">{item.name}</h3>
              <div class="flex items-center justify-between">
                <p class="text-sm text-gray-500">{item.brand || 'No Brand'}</p>
                <div class="w-4 h-4 rounded-full border border-gray-100" style="background-color: {item.color}"></div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
