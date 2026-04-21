<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const now = new Date();
  let currentYear = now.getFullYear();
  let currentMonth = now.getMonth();

  let outfits: any[] = [];
  let entries: Record<string, any> = {};
  let loading = true;
  let selectedDate: string | null = null;
  let showModal = false;
  let saving = false;

  let showLaundryModal = false;
  let dirtyItemIds: Set<number> = new Set();
  let markingWorn = false;

  $: monthLabel = new Date(currentYear, currentMonth, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  $: calendarDays = buildCalendarDays(currentYear, currentMonth);

  function buildCalendarDays(year: number, month: number): (string | null)[] {
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const days: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) {
      days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }

  function getTodayStr() {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function dayNum(dateStr: string) {
    return parseInt(dateStr.split('-')[2]);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  }

  function formatDateShort(dateStr: string) {
    return new Date(dateStr + 'T12:00:00').toLocaleString('en-US', { weekday: 'short' });
  }

  async function prevMonth() {
    if (currentMonth === 0) { currentMonth = 11; currentYear--; }
    else currentMonth--;
    await fetchEntries();
  }

  async function nextMonth() {
    if (currentMonth === 11) { currentMonth = 0; currentYear++; }
    else currentMonth++;
    await fetchEntries();
  }

  function openDay(dateStr: string | null) {
    if (!dateStr) return;
    selectedDate = dateStr;
    showModal = true;
  }

  async function assignOutfit(outfit: any) {
    if (!selectedDate) return;
    saving = true;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { saving = false; return; }

    const existing = entries[selectedDate];
    const payload = {
      user_id: user.id,
      date: selectedDate,
      outfit_id: outfit.id
    };

    if (existing) {
      await supabase.from('calendar_entries').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('calendar_entries').insert([payload]);
    }

    // Yeniden çek — outfit detayları JOIN ile gelsin
    await fetchEntries();
    saving = false;
    showModal = false;
  }

  async function removeEntry() {
    if (!selectedDate) return;
    const entry = entries[selectedDate];
    if (!entry) return;
    await supabase.from('calendar_entries').delete().eq('id', entry.id);
    const updated = { ...entries };
    delete updated[selectedDate];
    entries = updated;
    showModal = false;
  }

  async function fetchEntries() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const m = String(currentMonth + 1).padStart(2, '0');
    const endDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    const { data } = await supabase
      .from('calendar_entries')
      .select('id, date, outfit_id, is_worn, outfits(id, name, item_list)')
      .eq('user_id', user.id)
      .gte('date', `${currentYear}-${m}-01`)
      .lte('date', `${currentYear}-${m}-${endDay}`);
    if (data) entries = Object.fromEntries(data.map(e => [e.date, e]));
  }

  onMount(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const [{ data: outfitData }] = await Promise.all([
        supabase.from('outfits').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        fetchEntries()
      ]);
      if (outfitData) outfits = outfitData;
    }
    loading = false;
  });

  $: sortedEntries = Object.entries(entries).sort(([a], [b]) => a.localeCompare(b));

  function openLaundryModal() {
    const items = entries[selectedDate!]?.outfits?.item_list || [];
    const washableCategories = ['top', 'bottom', 'dress', 'outerwear'];
    dirtyItemIds = new Set(
      items.filter((i: any) => washableCategories.includes(i.category)).map((i: any) => i.id)
    );
    showLaundryModal = true;
  }

  function toggleDirty(id: number) {
    const updated = new Set(dirtyItemIds);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    dirtyItemIds = updated;
  }

  async function confirmWorn() {
    if (!selectedDate) return;
    markingWorn = true;

    const entry = entries[selectedDate];
    const items: any[] = entry?.outfits?.item_list || [];
    const today = getTodayStr();

    await supabase
      .from('calendar_entries')
      .update({ is_worn: true })
      .eq('id', entry.id);

    for (const item of items) {
      const update: any = { last_worn_date: today };
      if (dirtyItemIds.has(item.id)) update.status = 'Dirty';
      await supabase.from('items').update(update).eq('id', item.id);
    }

    await fetchEntries();
    markingWorn = false;
    showLaundryModal = false;
    showModal = false;
  }
</script>

<div class="min-h-screen bg-[#F8F9FB] pb-24 p-6 font-sans">
  <div class="max-w-2xl mx-auto">

    <header class="mb-8">
      <h1 class="text-4xl font-black text-gray-900 tracking-tight">Calendar</h1>
      <p class="text-gray-400 mt-2">Plan your outfits ahead of time.</p>
    </header>

    {#if loading}
      <div class="flex justify-center py-32">
        <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    {:else}

      <div class="bg-white rounded-[24px] p-6 shadow-sm border border-gray-50">
        <!-- Month nav -->
        <div class="flex items-center justify-between mb-6">
          <button on:click={prevMonth}
            class="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-all text-xl font-bold text-gray-600">
            ‹
          </button>
          <h2 class="text-lg font-black text-gray-900">{monthLabel}</h2>
          <button on:click={nextMonth}
            class="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-all text-xl font-bold text-gray-600">
            ›
          </button>
        </div>

        <div class="grid grid-cols-7 mb-1">
          {#each WEEKDAYS as day}
            <div class="text-center text-[10px] font-black uppercase tracking-widest text-gray-400 py-1">{day}</div>
          {/each}
        </div>

        
        <div class="grid grid-cols-7 gap-1.5">
          {#each calendarDays as dateStr}
            {#if dateStr === null}
              <div class="aspect-[3/4]"></div>
            {:else}
              {@const entry = entries[dateStr]}
              {@const isToday = dateStr === getTodayStr()}
              {@const firstItem = entry?.outfits?.item_list?.[0]}
              <button
                on:click={() => openDay(dateStr)}
                class="aspect-[3/4] rounded-2xl relative overflow-hidden transition-all active:scale-95
                  {isToday ? 'ring-2 ring-[#2D60FF]' : ''}
                  {entry ? '' : 'bg-gray-50 hover:bg-gray-100'}"
              >
                {#if entry}
                  <!-- Background: photo or color -->
                  {#if firstItem?.photo_url}
                    <img
                      src={firstItem.photo_url}
                      alt=""
                      class="absolute inset-0 w-full h-full object-cover"
                    />
                  {:else}
                    <div
                      class="absolute inset-0"
                      style="background-color: {firstItem?.selected_color || '#f9a8d4'}"
                    ></div>
                  {/if}
                  <!-- Dusty pink overlay -->
                  <div class="absolute inset-0" style="background: rgba(249, 168, 212, 0.45)"></div>
                  <!-- Day number -->
                  <span class="absolute top-1.5 left-0 right-0 text-center text-[11px] font-black text-white drop-shadow z-10">
                    {dayNum(dateStr)}
                  </span>
                  <!-- Mini item strip at bottom -->
                  <div class="absolute bottom-0 left-0 right-0 flex z-10">
                    {#each (entry.outfits?.item_list || []).slice(0, 3) as item}
                      <div class="flex-1 h-5 overflow-hidden">
                        {#if item.photo_url}
                          <img src={item.photo_url} alt="" class="w-full h-full object-cover" />
                        {:else}
                          <div class="w-full h-full" style="background-color: {item.selected_color || '#e5e7eb'}"></div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {:else}
                  <!-- Empty day -->
                  <span class="text-[11px] font-bold {isToday ? 'text-[#2D60FF]' : 'text-gray-400'} absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    {dayNum(dateStr)}
                  </span>
                {/if}
              </button>
            {/if}
          {/each}
        </div>
      </div>

      
      {#if sortedEntries.length > 0}
        <div class="mt-6 space-y-3">
          <p class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Planned This Month</p>
          {#each sortedEntries as [dateStr, entry]}
            {@const firstItem = entry.outfits?.item_list?.[0]}
            <button
              on:click={() => openDay(dateStr)}
              class="w-full rounded-[20px] overflow-hidden shadow-sm flex items-stretch hover:shadow-md transition-all text-left"
              style="background: rgba(249, 168, 212, 0.15); border: 1px solid rgba(249, 168, 212, 0.4)"
            >
              <!-- Date badge -->
              <div class="flex flex-col items-center justify-center px-4 py-3 flex-shrink-0"
                style="background: rgba(249, 168, 212, 0.3)">
                <p class="text-2xl font-black text-gray-800">{dayNum(dateStr)}</p>
                <p class="text-[10px] text-pink-400 font-black uppercase tracking-wide">{formatDateShort(dateStr)}</p>
              </div>

              <!-- Item thumbnails -->
              <div class="flex gap-2 p-3 flex-shrink-0 items-center">
                {#each (entry.outfits?.item_list || []).slice(0, 3) as item}
                  <div class="w-10 h-10 rounded-xl overflow-hidden bg-white/60 flex-shrink-0">
                    {#if item.photo_url}
                      <img src={item.photo_url} alt={item.name} class="w-full h-full object-cover" />
                    {:else}
                      <div class="w-full h-full" style="background-color: {item.selected_color || '#e5e7eb'}"></div>
                    {/if}
                  </div>
                {/each}
              </div>

              <!-- Name -->
              <div class="flex-1 min-w-0 flex flex-col justify-center py-3 pr-4">
                <p class="font-black text-gray-900 truncate">{entry.outfits?.name || 'Outfit'}</p>
                <p class="text-xs text-pink-400 font-bold mt-0.5">{entry.outfits?.item_list?.length || 0} items</p>
              </div>

              <div class="flex items-center pr-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-pink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          {/each}
        </div>
      {:else}
        <div class="mt-6 bg-white rounded-[20px] p-8 text-center shadow-sm border border-gray-50">
          <p class="text-gray-400 font-medium">No outfits planned this month.</p>
          <p class="text-gray-300 text-sm mt-1">Tap a day on the calendar to assign an outfit.</p>
        </div>
      {/if}

    {/if}
  </div>
</div>


{#if showModal && selectedDate}
  <div
    class="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-end justify-center"
    on:click|self={() => showModal = false}
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-white rounded-t-[32px] w-full max-w-lg p-6 pb-28 max-h-[85vh] overflow-y-auto">
      <div class="flex items-start justify-between mb-6">
        <div>
          <p class="text-xs font-black uppercase tracking-widest text-gray-400">Assign Outfit</p>
          <h3 class="text-xl font-black text-gray-900 mt-1">{formatDate(selectedDate)}</h3>
        </div>
        <div class="flex items-center gap-3">
          {#if entries[selectedDate]?.is_worn}
            <span class="text-xs font-black text-green-500 bg-green-50 px-3 py-1 rounded-full">Worn ✓</span>
          {:else if entries[selectedDate]}
            <button
              on:click={removeEntry}
              class="text-red-400 hover:text-red-600 text-sm font-bold transition-colors"
            >
              Remove
            </button>
          {/if}
          <button
            on:click={() => showModal = false}
            class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-all"
          >
            ✕
          </button>
        </div>
      </div>

      {#if outfits.length === 0}
        <div class="text-center py-12">
          <p class="text-gray-400 font-medium">No saved outfits yet.</p>
          <a href="/outfits/create" class="text-blue-600 font-bold text-sm mt-2 inline-block hover:underline">
            Create your first outfit →
          </a>
        </div>
      {:else}
        <div class="space-y-3">
          {#each outfits as outfit}
            {@const isAssigned = entries[selectedDate]?.outfit_id === outfit.id}
            <button
              on:click={() => assignOutfit(outfit)}
              disabled={saving || entries[selectedDate]?.is_worn}
              class="w-full flex items-center gap-4 p-4 rounded-[20px] border-2 transition-all text-left disabled:opacity-50
                {isAssigned ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200 bg-white'}"
            >
              <div class="flex gap-1.5 flex-shrink-0">
                {#each (outfit.item_list || []).slice(0, 3) as item}
                  <div class="w-10 h-10 rounded-xl overflow-hidden bg-gray-100">
                    {#if item.photo_url}
                      <img src={item.photo_url} alt={item.name} class="w-full h-full object-cover" />
                    {:else}
                      <div class="w-full h-full" style="background-color: {item.selected_color || '#e5e7eb'}"></div>
                    {/if}
                  </div>
                {/each}
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-bold text-gray-900 truncate">{outfit.name}</p>
                <p class="text-xs text-gray-400">{outfit.item_list?.length || 0} items</p>
              </div>
              {#if isAssigned}
                <div class="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              {/if}
            </button>
          {/each}
        </div>

        {#if entries[selectedDate] && !entries[selectedDate].is_worn}
          <button
            on:click={openLaundryModal}
            class="w-full mt-4 bg-gray-900 text-white py-4 rounded-2xl font-black text-sm hover:bg-gray-700 active:scale-95 transition-all"
          >
            👕 Mark as Worn
          </button>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<!-- Laundry modal -->
{#if showLaundryModal && selectedDate}
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center"
    on:click|self={() => showLaundryModal = false}
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-white rounded-t-[32px] w-full max-w-lg p-6 pb-28 max-h-[85vh] overflow-y-auto">
      <div class="mb-6">
        <p class="text-xs font-black uppercase tracking-widest text-gray-400">Mark as Worn</p>
        <h3 class="text-xl font-black text-gray-900 mt-1">Which items need washing?</h3>
        <p class="text-sm text-gray-400 mt-1">Unselect anything that's still clean.</p>
      </div>

      <div class="space-y-3">
        {#each (entries[selectedDate]?.outfits?.item_list || []) as item}
          {@const isDirty = dirtyItemIds.has(item.id)}
          <button
            on:click={() => toggleDirty(item.id)}
            class="w-full flex items-center gap-4 p-4 rounded-[20px] border-2 transition-all text-left
              {isDirty ? 'border-gray-900 bg-gray-50' : 'border-gray-100 bg-white opacity-50'}"
          >
            <div class="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
              {#if item.photo_url}
                <img src={item.photo_url} alt={item.name} class="w-full h-full object-cover" />
              {:else}
                <div class="w-full h-full" style="background-color: {item.selected_color || '#e5e7eb'}"></div>
              {/if}
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-gray-900 truncate">{item.name}</p>
              <p class="text-xs capitalize {isDirty ? 'text-red-400 font-bold' : 'text-gray-400'}">{isDirty ? 'Needs washing' : 'Still clean'}</p>
            </div>
            <div class="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center
              {isDirty ? 'bg-gray-900' : 'border-2 border-gray-200'}">
              {#if isDirty}
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              {/if}
            </div>
          </button>
        {/each}
      </div>

      <button
        on:click={confirmWorn}
        disabled={markingWorn}
        class="w-full mt-6 bg-[#2D60FF] text-white py-4 rounded-2xl font-black text-base shadow-lg shadow-blue-100 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
      >
        {markingWorn ? 'Saving...' : 'Done'}
      </button>
    </div>
  </div>
{/if}
