<script lang="ts">
  import { supabase } from '$lib/supabase'

  let name = ''
  let category = ''
  let selectedColor = '#ffffff'
  let occasion = ''
  let status = 'Clean'
  let seasons: string[] = []
  let isPatterne = false
  let loading = false
  let errorMsg = ''

  const categoryOptions = ['Top', 'Bottom', 'Dress', 'Outerwear', 'Shoes', 'Accessory']
  const occasionOptions = ['Formal', 'Casual', 'Sport', 'Party']
  const seasonOptions = ['Spring', 'Summer', 'Autumn', 'Winter']

  function toggleSeason(season: string) {
    if (seasons.includes(season)) {
      seasons = seasons.filter(s => s !== season)
    } else {
      seasons = [...seasons, season]
    }
  }

  async function handleSubmit() {
    loading = true
    errorMsg = ''

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      errorMsg = 'You must be logged in.'
      loading = false
      return
    }

    const { error } = await supabase.from('items').insert({
      user_id: user.id,
      name,
      category,
      selected_color: selectedColor,
      occasion,
      status,
      seasons,
      is_patterned: isPatterne
    })

    if (error) {
      errorMsg = error.message
    } else {
      window.location.href = '/wardrobe'
    }

    loading = false
  }
</script>

<div class="min-h-screen bg-gray-50 p-6">
  <div class="max-w-lg mx-auto bg-white rounded-xl shadow-sm p-6">

    <div class="flex items-center gap-3 mb-6">
      <a href="/wardrobe" class="text-gray-400 hover:text-black">← Back</a>
      <h1 class="text-2xl font-bold">Add New Item</h1>
    </div>

    324qc
    <label class="block text-sm font-medium mb-1">Item Name</label>
    <input
      type="text"
      bind:value={name}
      placeholder="e.g. White Oxford Shirt"
      class="w-full border rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-black"
    />

    
    <label class="block text-sm font-medium mb-1">Category</label>
    <select bind:value={category} class="w-full border rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-black">
      <option value="">Select category</option>
      {#each categoryOptions as cat}
        <option value={cat}>{cat}</option>
      {/each}
    </select>

    
    <label class="block text-sm font-medium mb-1">Color</label>
    <div class="flex items-center gap-3 mb-4">
      <input type="color" bind:value={selectedColor} class="w-10 h-10 rounded cursor-pointer border" />
      <span class="text-sm text-gray-500">{selectedColor}</span>
    </div>

    
    <label class="block text-sm font-medium mb-1">Occasion</label>
    <select bind:value={occasion} class="w-full border rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-black">
      <option value="">Select occasion</option>
      {#each occasionOptions as occ}
        <option value={occ}>{occ}</option>
      {/each}
    </select>

    
    <label class="block text-sm font-medium mb-2">Seasons</label>
    <div class="flex gap-2 flex-wrap mb-4">
      {#each seasonOptions as season}
        <button
          type="button"
          onclick={() => toggleSeason(season)}
          class="px-3 py-1 rounded-full border text-sm {seasons.includes(season) ? 'bg-black text-white border-black' : 'bg-white text-gray-600'}"
        >
          {season}
        </button>
      {/each}
    </div>

    
    <label class="flex items-center gap-3 mb-6 cursor-pointer">
      <input type="checkbox" bind:checked={isPatterne} class="w-4 h-4" />
      <span class="text-sm font-medium">Patterned item</span>
    </label>

    {#if errorMsg}
      <p class="text-red-500 text-sm mb-3">{errorMsg}</p>
    {/if}

    <button
      onclick={handleSubmit}
      disabled={loading}
      class="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
    >
      {loading ? 'Saving...' : 'Save Item'}
    </button>

  </div>
</div>