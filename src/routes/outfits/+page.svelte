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

<div class="min-h-screen bg-[#FFF5F9] pb-28 font-sans">

  <div class="px-4 pt-6 max-w-lg mx-auto">
    <header class="flex items-center justify-between mb-6 gap-3">
      <div class="min-w-0">
        <h1 class="text-3xl font-black text-[#1A1C1E] tracking-tight">My Outfits</h1>
        <p class="text-gray-400 mt-1 text-sm">Your saved combinations</p>
      </div>
      <a href="/outfits/create"
        class="text-white px-4 py-2.5 rounded-2xl font-bold text-sm transition-all active:scale-95 flex-shrink-0 whitespace-nowrap" style="background: linear-gradient(135deg, #f472b6, #ec4899); box-shadow: 0 4px 14px rgba(236,72,153,0.25);">
        + Create
      </a>
    </header>

    {#if loading}
      <div class="flex flex-col items-center justify-center h-64 gap-4">
        <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-pink-400"></div>
        <p class="text-gray-400 font-medium">Loading outfits...</p>
      </div>

    {:else if outfits.length === 0}
      <div class="flex flex-col items-center justify-center py-32 bg-white rounded-[32px] border border-dashed border-gray-200">
        <div class="text-6xl mb-6">👗</div>
        <h2 class="text-2xl font-bold text-gray-900">No outfits yet</h2>
        <p class="text-gray-400 mt-2 text-sm text-center max-w-xs">
          Create your first outfit by combining pieces from your wardrobe.
        </p>
        <a href="/outfits/create" class="mt-8 text-white px-8 py-3 rounded-2xl font-bold text-sm transition-all" style="background: linear-gradient(135deg, #f472b6, #ec4899);">
          Create Outfit
        </a>
      </div>

    {:else}
      <div class="space-y-4">
        {#each outfits as outfit}
          <div class="bg-white rounded-[24px] shadow-sm border border-gray-50 overflow-hidden hover:shadow-md transition-all">
            <div class="flex items-stretch">

              <div class="flex items-center gap-1.5 px-3 flex-shrink-0">
                {#each (outfit.item_list || []).slice(0, 3) as item}
                  <div class="w-10 h-10 rounded-xl overflow-hidden bg-pink-50 flex-shrink-0">
                    {#if item.photo_url}
                      <img src={item.photo_url} alt={item.name} class="w-full h-full object-cover" />
                    {:else}
                      <div class="w-full h-full" style="background-color: {item.selected_color || '#e5e7eb'}"></div>
                    {/if}
                  </div>
                {/each}
                {#if (outfit.item_list?.length || 0) > 3}
                  <span class="text-[10px] font-bold text-gray-400 ml-0.5">+{outfit.item_list.length - 3}</span>
                {/if}
              </div>

              <div class="flex-1 py-4 pr-2 flex flex-col justify-center min-w-0">
                <h3 class="text-sm font-black text-gray-900 truncate">{outfit.name}</h3>
                <p class="text-xs text-gray-400 mt-0.5">{outfit.item_list?.length || 0} items</p>
              </div>

              <!-- Delete -->
              <div class="flex items-center pr-5">
                <button
                  on:click={() => deleteOutfit(outfit.id)}
                  disabled={deletingId === outfit.id}
                  class="w-9 h-9 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 transition-all"
                >
                  {#if deletingId === outfit.id}
                    <div class="animate-spin w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full"></div>
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
