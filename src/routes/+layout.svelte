<script lang="ts">
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import { page } from '$app/stores';

  let { children } = $props();

  const navItems = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/wardrobe', label: 'Closet', icon: '👔' },
    { href: '/suggest', label: 'Suggest', icon: '✨' },
    { href: '/outfits', label: 'Outfits', icon: '👗' },
    { href: '/calendar', label: 'Plan', icon: '📅' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  const hideNavRoutes = ['/login', '/register', '/forgot-password'];

  function isActive(href: string): boolean {
    return $page.url.pathname === href;
  }

  const showNav = $derived(!hideNavRoutes.includes($page.url.pathname));
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>Outfit Manager</title>
  <meta name="description" content="Smart outfit suggestions based on weather, color theory, and your personal style." />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#ec4899" />
</svelte:head>

{@render children()}

{#if showNav}
<nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-50 font-sans" style="padding-bottom: env(safe-area-inset-bottom)">
  <div class="flex justify-around items-center py-2 max-w-lg mx-auto">
    {#each navItems as item}
      <a href={item.href} class="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all {isActive(item.href) ? 'text-pink-500' : 'text-gray-400'}">
        <span class="text-lg leading-none">{item.icon}</span>
        <span class="text-[9px] font-black uppercase">{item.label}</span>
      </a>
    {/each}
  </div>
</nav>
{/if}
