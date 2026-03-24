<script lang="ts">
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import { page } from '$app/stores';

  let { children } = $props();

  const navItems = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/wardrobe', label: 'Wardrobe', icon: '👔' },
    { href: '/suggest', label: 'Suggest', icon: '✨' },
    { href: '/outfits', label: 'Outfits', icon: '👗' },
  ];

  function isActive(href: string): boolean {
    return $page.url.pathname === href;
  }
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{@render children()}

<nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-50 font-sans">
  <div class="flex justify-around items-center py-3 max-w-lg mx-auto">
    {#each navItems as item}
      <a href={item.href} class="flex flex-col items-center gap-1 px-4 py-1 rounded-2xl transition-all {isActive(item.href) ? 'text-[#2D60FF]' : 'text-gray-400 hover:text-gray-600'}">
        <span class="text-2xl">{item.icon}</span>
        <span class="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
      </a>
    {/each}
  </div>
</nav>