<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Suggestion } from '$lib/types';

  /** Bottom sheet for saving a suggested outfit to a day of the calendar. Saving itself is done by the page. */
  export let suggestion: Suggestion;
  export let date: string;
  export let saving = false;
  export let error = '';

  const dispatch = createEventDispatcher<{ close: void; save: void }>();
</script>

<div
  class="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-end justify-center"
  on:click|self={() => dispatch('close')}
  role="dialog"
  aria-modal="true"
>
  <div class="bg-white rounded-t-[32px] w-full max-w-lg p-6 pb-10">
    <div class="flex items-start justify-between mb-5">
      <div>
        <p class="text-xs font-black uppercase tracking-widest text-gray-400">Add to Calendar</p>
        <h3 class="text-xl font-black text-gray-900 mt-1">Pick a date</h3>
      </div>
      <button
        on:click={() => dispatch('close')}
        class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-all"
      >✕</button>
    </div>

    <div class="flex gap-2 mb-5">
      {#each suggestion.items.slice(0, 4) as item}
        <div class="w-14 h-14 rounded-2xl overflow-hidden bg-[#F1F4F9] flex-shrink-0">
          {#if item.photo_url}
            <img src={item.photo_url} alt={item.name} class="w-full h-full object-cover" />
          {:else}
            <div class="w-full h-full" style="background-color: {item.selected_color || '#e5e7eb'}"></div>
          {/if}
        </div>
      {/each}
      <div class="flex-1 flex flex-col justify-center pl-1">
        <p class="text-sm font-black text-gray-900">{suggestion.score}/100</p>
        <p class="text-xs text-gray-400">{suggestion.items.length} items</p>
      </div>
    </div>

    <label class="block mb-5">
      <span class="text-xs font-black uppercase tracking-widest text-gray-400 mb-2 block">Date</span>
      <input
        type="date"
        bind:value={date}
        class="w-full bg-[#F1F4F9] rounded-2xl px-4 py-3 font-bold text-gray-800 border-none outline-none focus:ring-2 focus:ring-pink-300 transition"
      />
    </label>

    {#if error}
      <p class="text-red-400 text-sm font-medium mb-3">{error}</p>
    {/if}

    <button
      on:click={() => dispatch('save')}
      disabled={saving || !date}
      class="w-full bg-pink-500 text-white py-4 rounded-2xl font-black text-base shadow-lg shadow-pink-100 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
    >
      {saving ? 'Saving...' : '📅 Save to Calendar'}
    </button>
  </div>
</div>
