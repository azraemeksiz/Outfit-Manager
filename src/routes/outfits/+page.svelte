<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';

  let outfits: any[] = [];
  let loading = true;
  let deletingId: number | null = null;

  onMount(async () => {
    await fetchOutfits();
  });

  async function fetchOutfits() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('outfits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error) outfits = data;
    }
    loading = false;
  }

  async function deleteOutfit(id: number) {
    if (!confirm('Delete this outfit?')) return;
    deletingId = id;
    const { error } = await supabase.from('outfits').delete().eq('id', id);
    if (!error) outfits = outfits.filter(o => o.id !== id);
    deletingId = null;
  }
</script>

<div class="min-h-screen bg-[#F8F9FB] p-8 font-sans">
  <div class="max-w-7xl mx-auto">
    <header class="flex justify-between items-center mb-12">
      <div>
        <h1 class="text-4xl font-extrabold text-[#1A1C1E] tracking-tight">My Outfits</h1>
        <p class="text-gray-500 mt-2">Your saved outfit combinations</p>
      </div>
      <a href="/outfits/create" class="bg-[#2D60FF] text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-[#1E4AD9] transition-all transform hover:-translate-y-1">
        + Create Outfit
      </a>
    </header>

    {#if loading}
      <div class="flex flex-col items-center justify-center h-64 space-y-4">
        <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
        <p class="text-gray-400 font-medium">Loading outfits...</p>
      </div>

    {:else if outfits.length === 0}
      <div class="flex flex-col items-center justify-center py-32 bg-white rounded-[32px] border border-dashed border-gray-200 shadow-sm">
        <div class="bg-blue-50 p-6 rounded-full mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-900">You have no outfits yet</h2>
        <p class="text-gray-500 mt-2 max-w-xs text-center">Create your first outfit combination</p>
        <a href="/outfits/create" class="mt-8 text-blue-600 font-semibold hover:underline">Create your first outfit &rarr;</a>
      </div>

    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        {#each outfits as outfit}
          <div class="group bg-white rounded-[28px] overflow-hidden shadow-sm border border-gray-50 hover:shadow-xl transition-all duration-300">

            
            <div class="p-4 bg-[#F1F4F9] grid grid-cols-3 gap-2 min-h-[160px]">
              {#each (outfit.item_list || []).slice(0, 3) as item}
                <div class="aspect-square rounded-xl overflow-hidden bg-white flex items-center justify-center">
                  {#if item.photo_url}
                    <img src={item.photo_url} alt={item.name} class="w-full h-full object-cover" />
                  {:else}
                    <div class="w-full h-full" style="background-color: {item.selected_color || '#e5e7eb'}"></div>
                  {/if}
                </div>
              {/each}
            </div>

            <div class="p-6">
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="text-lg font-bold text-gray-900 mb-1">{outfit.name}</h3>
                  <p class="text-sm text-gray-400">{outfit.item_list?.length || 0} items</p>
                </div>
                <button
                  on:click={() => deleteOutfit(outfit.id)}
                  disabled={deletingId === outfit.id}
                  class="text-red-400 hover:text-red-600 transition-colors"
                >
                  {#if deletingId === outfit.id}
                    <div class="animate-spin w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full"></div>
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  {/if}
                </button>
              </div>
            </div>

          </div>
        {/each}
      </div>
    {/if}

  </div>
</div>