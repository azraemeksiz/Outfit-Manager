<script lang="ts">
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import { page } from '$app/stores';

  let { children } = $props();

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/wardrobe', label: 'Wardrobe' },
    { href: '/suggest', label: 'Suggest' },
    { href: '/outfits', label: 'Outfits' },
  ];

  const hideNavRoutes = ['/login', '/register', '/forgot-password'];

  function isActive(href: string): boolean {
    return $page.url.pathname === href;
  }

const showNav = $derived(!hideNavRoutes.includes($page.url.pathname));</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{@render children()}

{#if showNav}
<nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-50 font-sans">
  <div class="flex justify-around items-center py-3 max-w-lg mx-auto">
    {#each navItems as item}
      <a href={item.href} class="flex flex-col items-center gap-1 px-6 py-2 rounded-2xl transition-all {isActive(item.href) ? 'text-[#2D60FF] font-black' : 'text-gray-400 hover:text-gray-600'}">
        <span class="text-xs font-black uppercase tracking-widest">{item.label}</span>
      </a>
    {/each}
  </div>
</nav>
{/if}