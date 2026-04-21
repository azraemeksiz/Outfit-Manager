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

<div class="min-h-screen bg-[#F8F9FB] pb-28 font-sans">

  <div class="p-6 max-w-4xl mx-auto">
    <header class="flex items-center justify-between mb-8 pt-2">
      <div>
        <h1 class="text-4xl font-black text-[#1A1C1E] tracking-tight">My Outfits</h1>
        <p class="text-gray-400 mt-1 text-sm">Your saved combinations</p>
      </div>
      <a href="/outfits/create"
        class="bg-[#2D60FF] text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-[#1E4AD9] transition-all active:scale-95">
        + Create
      </a>
    </header>

    {#if loading}
      <div class="flex flex-col items-center justify-center h-64 gap-4">
        <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
        <p class="text-gray-400 font-medium">Loading outfits...</p>
      </div>

    {:else if outfits.length === 0}
      <div class="flex flex-col items-center justify-center py-32 bg-white rounded-[32px] border border-dashed border-gray-200">
        <div class="text-6xl mb-6">👗</div>
        <h2 class="text-2xl font-bold text-gray-900">No outfits yet</h2>
        <p class="text-gray-400 mt-2 text-sm text-center max-w-xs">
          Create your first outfit by combining pieces from your wardrobe.
        </p>
        <a href="/outfits/create" class="mt-8 bg-[#2D60FF] text-white px-8 py-3 rounded-2xl font-bold text-sm hover:bg-[#1E4AD9] transition-all">
          Create Outfit
        </a>
      </div>

    {:else}
      <div class="space-y-4">
        {#each outfits as outfit}
          <div class="bg-white rounded-[24px] shadow-sm border border-gray-50 overflow-hidden hover:shadow-md transition-all">
            <div class="flex items-stretch">

              <!-- Item strip -->
              <div class="flex gap-0 flex-shrink-0">
                {#each (outfit.item_list || []).slice(0, 4) as item, i}
                  <div class="w-20 h-24 flex-shrink-0 bg-[#F1F4F9] relative {i === 0 ? '' : 'border-l border-white/50'}">
                    {#if item.photo_url}
                      <img src={item.photo_url} alt={item.name} class="w-full h-full object-cover" />
                    {:else}
                      <div class="w-full h-full flex items-center justify-center">
                        <div class="w-8 h-8 rounded-full" style="background-color: {item.selected_color || '#e5e7eb'}"></div>
                      </div>
                    {/if}
                  </div>
                {/each}
                {#if (outfit.item_list?.length || 0) > 4}
                  <div class="w-10 h-24 bg-gray-100 flex items-center justify-center border-l border-white/50">
                    <span class="text-xs font-bold text-gray-400">+{outfit.item_list.length - 4}</span>
                  </div>
                {/if}
              </div>

              <!-- Info -->
              <div class="flex-1 p-5 flex flex-col justify-between min-w-0">
                <div>
                  <h3 class="text-lg font-black text-gray-900 truncate">{outfit.name}</h3>
                  <div class="flex flex-wrap gap-1.5 mt-2">
                    {#each (outfit.item_list || []) as item}
                      <span class="text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">
                        {item.category}
                      </span>
                    {/each}
                  </div>
                </div>
                <p class="text-xs text-gray-400 mt-3">{outfit.item_list?.length || 0} items</p>
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
