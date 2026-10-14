<script lang="ts">
  /**
   * Colour palette editor: up to `max` colours, the first one is the main colour.
   * Picking works without the native colour picker (preset swatches + hex field);
   * the native picker is an optional extra button.
   */
  export let colors: string[] = ['#3b82f6'];
  export let max = 3;
  /** Colours found in the photo, offered as one-tap choices. */
  export let suggestions: string[] = [];

  const PRESETS = [
    '#101010', '#f5f5f5', '#808080', '#1f2a44',
    '#d9c3a0', '#5a3a22', '#4a6fa5', '#d62828',
    '#f28c28', '#f2c12e', '#28a050', '#a8c5b5',
    '#f4a6c0', '#7a3fb0', '#8a2a2a', '#28d6d6'
  ];

  let active = 0;
  let hexInput = colors[0] ?? '';

  $: if (active >= colors.length) active = Math.max(colors.length - 1, 0);
  $: hexInput = colors[active] ?? '';

  const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

  function setActive(value: string) {
    colors = colors.map((c, i) => (i === active ? value : c));
  }

  function onHex(e: Event) {
    let v = (e.currentTarget as HTMLInputElement).value.trim();
    if (!v.startsWith('#')) v = '#' + v;
    hexInput = v;
    if (isHex(v)) setActive(v.toLowerCase());
  }

  function addColor() {
    if (colors.length >= max) return;
    const next = suggestions.find((s) => !colors.includes(s)) ?? PRESETS.find((p) => !colors.includes(p)) ?? '#808080';
    colors = [...colors, next];
    active = colors.length - 1;
  }

  function removeActive() {
    if (colors.length <= 1) return;
    colors = colors.filter((_, i) => i !== active);
    active = Math.min(active, colors.length - 1);
  }

  function makeMain() {
    if (active === 0) return;
    colors = [colors[active], ...colors.filter((_, i) => i !== active)];
    active = 0;
  }
</script>

<div class="bg-gray-50 rounded-2xl p-4 space-y-4" style="touch-action: pan-y;">
  <div class="flex items-center gap-3 flex-wrap">
    {#each colors as c, i}
      <button
        type="button"
        on:click={() => (active = i)}
        aria-label="Color {i + 1}{i === 0 ? ' (main)' : ''}"
        class="relative w-11 h-11 rounded-full border-2 transition-all {active === i ? 'border-pink-500 scale-110' : 'border-white shadow-sm'}"
        style="background-color: {c}"
      >
        {#if i === 0}
          <span class="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black bg-white text-pink-500 rounded-full px-1.5 shadow-sm">MAIN</span>
        {/if}
      </button>
    {/each}
    {#if colors.length < max}
      <button
        type="button"
        on:click={addColor}
        class="w-11 h-11 rounded-full border-2 border-dashed border-gray-300 text-gray-400 font-black text-xl hover:border-pink-300 hover:text-pink-400 transition-all"
        aria-label="Add a color"
      >+</button>
    {/if}
  </div>

  <div class="grid grid-cols-8 gap-2">
    {#each PRESETS as p}
      <button
        type="button"
        on:click={() => setActive(p)}
        aria-label="Use {p}"
        class="aspect-square rounded-full border-2 transition-all {colors[active]?.toLowerCase() === p ? 'border-pink-500 scale-110' : 'border-white shadow-sm'}"
        style="background-color: {p}"
      ></button>
    {/each}
  </div>

  {#if suggestions.length > 0}
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-[11px] font-black uppercase tracking-widest text-gray-400">From photo</span>
      {#each suggestions as s}
        <button
          type="button"
          on:click={() => setActive(s)}
          aria-label="Use photo color {s}"
          class="w-7 h-7 rounded-full border-2 border-white shadow-sm"
          style="background-color: {s}"
        ></button>
      {/each}
    </div>
  {/if}

  <div class="flex items-center gap-2 flex-wrap">
    <input
      value={hexInput}
      on:input={onHex}
      maxlength="7"
      placeholder="#rrggbb"
      aria-label="Hex color"
      class="w-28 bg-white rounded-xl px-3 py-2 text-sm font-mono font-bold uppercase text-gray-500 outline-none focus:ring-2 focus:ring-pink-300 {isHex(hexInput) ? '' : 'ring-2 ring-red-300'}"
    />
    <label class="text-xs font-bold text-gray-400 bg-white rounded-xl px-3 py-2 cursor-pointer hover:text-pink-500">
      Color picker
      <input
        type="color"
        value={colors[active] ?? '#808080'}
        on:input={(e) => setActive(e.currentTarget.value)}
        class="sr-only"
      />
    </label>
    {#if active !== 0}
      <button type="button" on:click={makeMain} class="text-xs font-bold text-pink-500 bg-white rounded-xl px-3 py-2 hover:bg-pink-50">Make main</button>
    {/if}
    {#if colors.length > 1}
      <button type="button" on:click={removeActive} class="text-xs font-bold text-gray-400 bg-white rounded-xl px-3 py-2 hover:text-red-400">Remove</button>
    {/if}
  </div>
</div>
