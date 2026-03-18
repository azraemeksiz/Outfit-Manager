<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';

  let userName = '';
  let totalItems = 0;
  let cleanItems = 0;
  let dirtyItems = 0;
  let loading = true;

  onMount(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userName = user.email?.split('@')[0] || 'there';

      const { data } = await supabase
        .from('items')
        .select('status')
        .eq('user_id', user.id);

      if (data) {
        totalItems = data.length;
        cleanItems = data.filter(i => i.status === 'Clean').length;
        dirtyItems = data.filter(i => i.status === 'Dirty' || i.status === 'Laundry' || i.status === 'Drying').length;
      }
    }
    loading = false;
  });
</script>

<div class="min-h-screen bg-[#F8F9FB] p-8 font-sans">
  <div class="max-w-4xl mx-auto">

    <header class="mb-12">
      <p class="text-gray-400 font-medium text-sm uppercase tracking-widest mb-1">Welcome back</p>
      <h1 class="text-5xl font-black text-[#1A1C1E] tracking-tight">
        {#if loading}
          ...
        {:else}
          Hey, {userName} 👋
        {/if}
      </h1>
    </header>

    <!-- Stats -->
    <div class="grid grid-cols-3 gap-6 mb-12">
      <div class="bg-white rounded-[24px] p-6 shadow-sm border border-gray-50">
        <p class="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Total Items</p>
        <p class="text-4xl font-black text-[#1A1C1E]">{totalItems}</p>
      </div>
      <div class="bg-white rounded-[24px] p-6 shadow-sm border border-gray-50">
        <p class="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Clean</p>
        <p class="text-4xl font-black text-green-500">{cleanItems}</p>
      </div>
      <div class="bg-white rounded-[24px] p-6 shadow-sm border border-gray-50">
        <p class="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">In Laundry</p>
        <p class="text-4xl font-black text-red-400">{dirtyItems}</p>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="grid grid-cols-2 gap-6">
      <a href="/wardrobe" class="group bg-[#2D60FF] text-white rounded-[28px] p-8 shadow-lg shadow-blue-100 hover:bg-[#1E4AD9] transition-all transform hover:-translate-y-1">
        <div class="text-3xl mb-4">👔</div>
        <h2 class="text-2xl font-black mb-1">My Wardrobe</h2>
        <p class="text-blue-200 text-sm">Manage your clothes</p>
      </a>
      <a href="/wardrobe/add" class="group bg-white text-[#1A1C1E] rounded-[28px] p-8 shadow-sm border border-gray-100 hover:shadow-xl transition-all transform hover:-translate-y-1">
        <div class="text-3xl mb-4">➕</div>
        <h2 class="text-2xl font-black mb-1">Add Item</h2>
        <p class="text-gray-400 text-sm">Expand your collection</p>
      </a>
    </div>

  </div>
</div>
