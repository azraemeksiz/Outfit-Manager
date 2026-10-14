<script lang="ts">
  /**
   * The colours of a piece: one to four round swatches.
   * Tap a swatch to correct that colour with the colour picker; the little × removes a colour.
   * No presets, no "main colour": all colours are equal and all of them count.
   */
  export let colors: string[] = ['#3b82f6'];

  function change(i: number, value: string) {
    colors = colors.map((c, k) => (k === i ? value : c));
  }

  function remove(i: number) {
    if (colors.length <= 1) return;
    colors = colors.filter((_, k) => k !== i);
  }
</script>

<div class="bg-gray-50 rounded-2xl p-4 flex items-center gap-4 flex-wrap" style="touch-action: pan-y;">
  {#each colors as c, i}
    <div class="relative">
      <label
        class="block w-12 h-12 rounded-full border-2 border-white shadow-sm cursor-pointer overflow-hidden"
        style="background-color: {c}"
        title="Tap to change this color"
      >
        <input
          type="color"
          value={c}
          on:input={(e) => change(i, e.currentTarget.value)}
          class="sr-only"
          aria-label="Change color {i + 1}"
        />
      </label>
      {#if colors.length > 1}
        <button
          type="button"
          on:click={() => remove(i)}
          aria-label="Remove color {i + 1}"
          class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-gray-400 text-xs font-black shadow hover:text-red-400"
        >×</button>
      {/if}
    </div>
  {/each}
  <span class="text-xs text-gray-400 flex-1 min-w-[8rem]">
    {colors.length > 1 ? `${colors.length} colors found. Tap one to correct it.` : 'Tap the color to correct it.'}
  </span>
</div>
