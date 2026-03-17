<script lang="ts">
  import { supabase } from '$lib/supabase'
  import { onMount } from 'svelte'

  let items: any[] = []
  let loading = true

  onMount(async () => {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('id', { ascending: false })

    if (error) {
      console.error(error)
    } else {
      items = data
    }

    loading = false
  })
</script>

<div class="min-h-screen bg-gray-50 p-6">
  <div class="max-w-4xl mx-auto">

    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">My Wardrobe</h1>
      
        <a href="/wardrobe/new" class="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800">+ Add Item</a>
    </div>

    {#if loading}
      <p class="text-gray-500">Loading...</p>

    {:else if items.length === 0}
      <div class="text-center py-20 text-gray-400">
        <p class="text-lg">Your wardrobe is empty.</p>
        <p class="text-sm mt-2">Add your first item to get started.</p>
      </div>

    {:else}
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {#each items as item}
          <div class="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-2">
            {#if item.photo_url}
              <img src={item.photo_url} alt={item.name} class="w-full h-40 object-cover rounded-lg" />
            {:else}
              <div class="w-full h-40 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                No Photo
              </div>
            {/if}

            <p class="font-semibold truncate">{item.name}</p>
            <p class="text-sm text-gray-500">{item.category ?? '—'}</p>

            <div class="flex items-center gap-2">
              <div
                class="w-4 h-4 rounded-full border"
                style="background-color: {item.selected_color ?? '#ccc'}"
              ></div>
              <span class="text-xs text-gray-400">{item.status}</span>
            </div>
          </div>
        {/each}
      </div>
    {/if}

  </div>
</div>