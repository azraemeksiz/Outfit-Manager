<script lang="ts">
  import { STYLES, styleOccasionHint } from '$lib/styles';
  import type { StyleId } from '$lib/styles';

  /** Where the outfit is for, then today's style. Styles that rarely suit the occasion are faded, never hidden. */
  export let occasion = '';
  export let style: StyleId | null = null;

  const occasions = ['Casual', 'Sport', 'Indoor', 'Party', 'Formal', ''];
</script>

<div class="bg-white rounded-[24px] p-6 mb-6 shadow-sm border border-gray-50">
  <p class="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Where to? (Optional)</p>
  <div class="flex gap-2 flex-wrap mb-5">
    {#each occasions as occ}
      <button
        on:click={() => occasion = occ}
        class="px-4 py-2 rounded-2xl font-bold text-sm transition-all {occasion === occ ? 'bg-pink-500 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}"
      >
        {occ === '' ? 'Any' : occ}
      </button>
    {/each}
  </div>

  <p class="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Today's style (Optional)</p>
  <p class="text-xs text-gray-400 mb-3">Changes how colors are judged. It never hides an outfit. Faded styles rarely suit this occasion.</p>
  <div class="flex gap-2 flex-wrap">
    <button
      on:click={() => (style = null)}
      class="px-4 py-2 rounded-2xl font-bold text-sm transition-all {style === null ? 'bg-pink-500 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}"
    >
      Any
    </button>
    {#each STYLES as s}
      <button
        on:click={() => (style = s.id)}
        title={styleOccasionHint(s.id, occasion).message}
        class="px-4 py-2 rounded-2xl font-bold text-sm transition-all {style === s.id ? 'bg-pink-500 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'} {style !== s.id && styleOccasionHint(s.id, occasion).fit === 'poor' ? 'opacity-40' : ''}"
      >
        {s.emoji} {s.label}
      </button>
    {/each}
  </div>
</div>

{#if styleOccasionHint(style, occasion).message}
  <p class="text-xs font-bold text-amber-600 bg-amber-50 rounded-2xl px-4 py-3 mb-4">
    💡 {styleOccasionHint(style, occasion).message}
  </p>
{/if}
