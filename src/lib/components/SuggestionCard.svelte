<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Suggestion, UserStyleProfile } from '$lib/types';

  /** One suggested outfit: score, score breakdown chips, its pieces and the "Add to Calendar" button. */
  export let suggestion: Suggestion;
  export let index: number;
  export let occasion: string;
  export let userProfile: UserStyleProfile;
  /** True once this outfit has been saved to the calendar. */
  export let saved = false;

  const dispatch = createEventDispatcher<{ add: void }>();

  const silhouetteLabels: Record<string, string> = {
    fitted: 'Fitted',
    regular: 'Regular',
    relaxed: 'Relaxed',
    oversized: 'Oversized',
    contrast: 'Volume contrast'
  };

  const harmonyLabels: Record<string, string> = {
    neutral: 'All neutrals',
    accent: 'Neutrals + one accent',
    monochrome: 'Monochrome',
    analogous: 'Analogous colors',
    complementary: 'Complementary colors',
    mixed: 'Mixed colors',
    clash: 'Bold clash'
  };

  function scoreBadgeColor(score: number): string {
    if (score >= 80) return 'bg-emerald-50 text-emerald-600';
    if (score >= 60) return 'bg-blue-50 text-pink-500';
    if (score >= 40) return 'bg-amber-50 text-amber-600';
    return 'bg-gray-50 text-gray-500';
  }

  function scoreLabel(score: number): string {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Low';
  }
</script>

<div class="bg-white rounded-[24px] p-6 shadow-sm border border-gray-50">
  <div class="flex items-center justify-between mb-3">
    <span class="text-xs font-black uppercase tracking-widest text-gray-400">Outfit {index + 1}</span>
    <div class="flex items-center gap-2">
      <span class="text-xs font-bold px-2 py-0.5 rounded-full {scoreBadgeColor(suggestion.score)}">
        {scoreLabel(suggestion.score)}
      </span>
      <span class="text-2xl font-black text-gray-900">{suggestion.score}<span class="text-sm font-medium text-gray-400">/100</span></span>
    </div>
  </div>

  <div class="flex gap-2 flex-wrap mb-4">
    <span class="text-[11px] font-bold bg-sky-50 text-sky-600 px-2.5 py-1 rounded-full">
      🌤 Weather {suggestion.scoreBreakdown.weather}/{suggestion.scoreBreakdown.max.weather}
    </span>
    <span class="text-[11px] font-bold bg-purple-50 text-purple-600 px-2.5 py-1 rounded-full">
      🎨 Color {suggestion.scoreBreakdown.color}/{suggestion.scoreBreakdown.max.color}
    </span>
    <span class="text-[11px] font-bold bg-pink-50 text-pink-600 px-2.5 py-1 rounded-full">
      🌀 Pattern {suggestion.scoreBreakdown.pattern}/{suggestion.scoreBreakdown.max.pattern}
    </span>
    {#if suggestion.scoreBreakdown.max.occasion > 0}
      <span class="text-[11px] font-bold bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full">
        🎯 {occasion} {suggestion.scoreBreakdown.occasion}/{suggestion.scoreBreakdown.max.occasion}
      </span>
    {/if}
    {#if suggestion.scoreBreakdown.max.silhouette > 0}
      <span class="text-[11px] font-bold bg-teal-50 text-teal-600 px-2.5 py-1 rounded-full">
        👖 Fit {suggestion.scoreBreakdown.silhouette}/{suggestion.scoreBreakdown.max.silhouette}{suggestion.scoreBreakdown.silhouetteType ? ` · ${silhouetteLabels[suggestion.scoreBreakdown.silhouetteType]}` : ' · not tagged'}
      </span>
    {/if}
    <span class="text-[11px] font-bold bg-green-50 text-green-600 px-2.5 py-1 rounded-full">
      ⏱ Freshness {suggestion.scoreBreakdown.history}/{suggestion.scoreBreakdown.max.history}
    </span>
    {#if suggestion.scoreBreakdown.combinationStatus === 'co_occurrence'}
      <span class="text-[11px] font-bold bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full">
        ⭐ Proven pair
      </span>
    {:else if suggestion.scoreBreakdown.combinationStatus === 'recent_repeat'}
      <span class="text-[11px] font-bold bg-red-50 text-red-400 px-2.5 py-1 rounded-full">
        🔁 Worn recently
      </span>
    {/if}
    {#if userProfile.colorAffinities.some(c => suggestion.items.some((item) => item.selected_color === c))}
      <span class="text-[11px] font-bold bg-indigo-50 text-indigo-500 px-2.5 py-1 rounded-full">
        💙 Your palette
      </span>
    {/if}
    {#if suggestion.scoreBreakdown.colorHarmony}
      <span class="text-[11px] font-bold bg-yellow-50 text-yellow-600 px-2.5 py-1 rounded-full">
        🎨 {harmonyLabels[suggestion.scoreBreakdown.colorHarmony]}
      </span>
    {/if}
    {#if suggestion.outerwearMissing}
      <span class="text-[11px] font-bold bg-red-50 text-red-500 px-2.5 py-1 rounded-full">
        🧥 It's cold, but no suitable coat in your wardrobe
      </span>
    {/if}
  </div>

  <div class="grid grid-cols-4 gap-3 mb-4">
    {#each suggestion.items as item}
      <div class="text-center">
        <div class="aspect-square rounded-2xl overflow-hidden bg-[#F1F4F9] mb-2 flex items-center justify-center">
          {#if item.photo_url}
            <img src={item.photo_url} alt={item.name} class="w-full h-full object-cover" />
          {:else}
            <div class="w-full h-full" style="background-color: {item.selected_color || '#e5e7eb'}"></div>
          {/if}
        </div>
        <p class="text-xs font-bold text-gray-700 truncate">{item.name}</p>
        <p class="text-[10px] text-gray-400 capitalize">{item.category}</p>
      </div>
    {/each}
  </div>

  {#if saved}
    <a href="/calendar" class="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-green-50 text-green-600 font-semibold text-sm text-center hover:bg-green-100 transition-all">
      ✓ Saved to Calendar <span class="text-green-400">→</span>
    </a>
  {:else}
    <button
      on:click={() => dispatch('add')}
      class="w-full py-3 rounded-2xl bg-[#F1F4F9] text-gray-600 font-medium text-sm hover:bg-[#e8ecf4] active:scale-95 transition-all"
    >
      📅 Add to Calendar
    </button>
  {/if}
</div>
