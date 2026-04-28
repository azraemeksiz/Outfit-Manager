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
      const { data } = await supabase.from('items').select('status').eq('user_id', user.id);
      if (data) {
        totalItems = data.length;
        cleanItems = data.filter(i => i.status === 'Clean').length;
        dirtyItems = data.filter(i => i.status === 'Dirty' || i.status === 'Laundry' || i.status === 'Drying').length;
      }
    }
    loading = false;
  });
</script>

<div class="min-h-screen bg-[#FFF5F9] pb-24 px-4 pt-6 font-sans">
  <div class="max-w-lg mx-auto">

    <header class="mb-7">
      <p class="text-gray-400 font-medium text-xs uppercase tracking-widest mb-1">Welcome back</p>
      <h1 class="text-4xl font-black text-[#1A1C1E] tracking-tight">
        {#if loading}...{:else}Hey, {userName} 👋{/if}
      </h1>
    </header>

    <div class="grid grid-cols-3 gap-3 mb-6">
      <div class="bg-white rounded-[20px] p-4 shadow-sm border border-pink-50">
        <p class="text-[10px] font-black uppercase tracking-tight text-gray-400 mb-1.5">Total</p>
        <p class="text-3xl font-black text-[#1A1C1E]">{totalItems}</p>
      </div>
      <div class="bg-white rounded-[20px] p-4 shadow-sm border border-pink-50">
        <p class="text-[10px] font-black uppercase tracking-tight text-gray-400 mb-1.5">Clean</p>
        <p class="text-3xl font-black text-green-500">{cleanItems}</p>
      </div>
      <div class="bg-white rounded-[20px] p-4 shadow-sm border border-pink-50">
        <p class="text-[10px] font-black uppercase tracking-tight text-gray-400 mb-1.5">Laundry</p>
        <p class="text-3xl font-black text-red-400">{dirtyItems}</p>
      </div>
    </div>

    <div class="flex flex-col gap-4">
      <a href="/suggest" class="rounded-[24px] p-6 transition-all active:scale-95" style="background: linear-gradient(135deg, #f472b6, #ec4899); box-shadow: 0 8px 24px rgba(236,72,153,0.3);">
        <div class="text-3xl mb-3">✨</div>
        <h2 class="text-xl font-black mb-1 text-white">Generate an Outfit for MEEEE, Let's GO!</h2>
        <p class="text-pink-100 text-sm">Let the algorithm pick the best outfit based on weather, color and your wardrobe</p>
      </a>

      <div class="grid grid-cols-2 gap-4">
        <a href="/wardrobe" class="bg-white text-[#1A1C1E] rounded-[24px] p-5 shadow-sm border border-pink-50 active:scale-95 transition-all">
          <div class="text-3xl mb-3">👔</div>
          <h2 class="text-lg font-black mb-1">My Wardrobe</h2>
          <p class="text-gray-400 text-xs">Manage your clothes</p>
        </a>
        <a href="/outfits" class="bg-white text-[#1A1C1E] rounded-[24px] p-5 shadow-sm border border-pink-50 active:scale-95 transition-all">
          <div class="text-3xl mb-3">👗</div>
          <h2 class="text-lg font-black mb-1">My Outfits</h2>
          <p class="text-gray-400 text-xs">Your saved combinations</p>
        </a>
      </div>
    </div>

  </div>
</div>
