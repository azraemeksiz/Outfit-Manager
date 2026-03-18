<script lang="ts">
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';

  const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  let name = '';
  let category = 'top';
  let color = '#3b82f6';
  let season = 'all-season';
  let occasion = '';
  let is_patterned = false;
  let photoFile: File | null = null;
  let photoPreview: string | null = null;
  let uploading = false;
  let loading = false;
  let message = '';

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      photoFile = input.files[0];
      photoPreview = URL.createObjectURL(photoFile);
    }
  }

  async function uploadToCloudinary(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'outfix');

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Upload failed');
    return data.secure_url;
  }

  async function handleAddItem() {
    loading = true;
    message = '';

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      message = 'Error: Please login first.';
      loading = false;
      return;
    }

    let photo_url: string | null = null;

    if (photoFile) {
      uploading = true;
      try {
        photo_url = await uploadToCloudinary(photoFile);
      } catch (err) {
        message = 'Error: Photo upload failed.';
        loading = false;
        uploading = false;
        return;
      }
      uploading = false;
    }

    const { error } = await supabase.from('items').insert([
      {
        name,
        category,
        selected_color: color,
        seasons: [season],
        occasion: occasion || null,
        is_patterned,
        photo_url,
        user_id: user.id
      }
    ]);

    if (error) {
      message = `Error: ${error.message}`;
    } else {
      message = 'Success! Adding to your wardrobe...';
      setTimeout(() => goto('/wardrobe'), 1500);
    }
    loading = false;
  }
</script>

<div class="min-h-screen bg-[#F8F9FB] p-6 flex items-center justify-center font-sans">
  <div class="bg-white w-full max-w-xl rounded-[32px] shadow-sm border border-gray-100 p-8 md:p-12">
    <header class="mb-10">
      <a href="/wardrobe" class="text-blue-600 font-bold text-sm hover:opacity-80 transition">← Back to Wardrobe</a>
      <h1 class="text-4xl font-black text-gray-900 mt-4 tracking-tight">Add New Item</h1>
      <p class="text-gray-400 mt-2 text-lg">Bring a new piece into your digital closet.</p>
    </header>

    <form on:submit|preventDefault={handleAddItem} class="space-y-6">

      
      <div class="space-y-2">
        <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Photo</label>
        <label class="block cursor-pointer">
          <input type="file" accept="image/*" on:change={handleFileSelect} class="hidden" />
          {#if photoPreview}
            <div class="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-50">
              <img src={photoPreview} alt="Preview" class="w-full h-full object-cover" />
              <div class="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <span class="text-white font-bold text-sm">Change Photo</span>
              </div>
            </div>
          {:else}
            <div class="w-full aspect-square rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span class="text-sm font-bold text-gray-400">Click to upload photo</span>
              <span class="text-xs text-gray-300 mt-1">Optional</span>
            </div>
          {/if}
        </label>
      </div>

      <div class="space-y-2">
        <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Item Name</label>
        <input bind:value={name} type="text" placeholder="e.g. Vintage Denim Jacket" required
          class="w-full bg-gray-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-gray-300" />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Category</label>
          <select bind:value={category} class="w-full bg-gray-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="outerwear">Outerwear</option>
            <option value="shoes">Shoes</option>
            <option value="accessory">Accessory</option>
          </select>
        </div>
        <div class="space-y-2">
          <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Season</label>
          <select bind:value={season} class="w-full bg-gray-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
            <option value="all-season">All Season</option>
            <option value="winter">Winter</option>
            <option value="summer">Summer</option>
            <option value="spring-fall">Spring/Fall</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Occasion</label>
          <select bind:value={occasion} class="w-full bg-gray-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
            <option value="">None</option>
            <option value="Formal">Formal</option>
            <option value="Casual">Casual</option>
            <option value="Sport">Sport</option>
            <option value="Party">Party</option>
          </select>
        </div>
        <div class="space-y-2">
          <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Pattern</label>
          <button
            type="button"
            on:click={() => is_patterned = !is_patterned}
            class="w-full bg-gray-50 rounded-2xl p-4 font-bold text-sm transition-all {is_patterned ? 'text-blue-600 ring-2 ring-blue-500' : 'text-gray-400'}"
          >
            {is_patterned ? '✓ Patterned' : 'Solid'}
          </button>
        </div>
      </div>

      <div class="space-y-2">
        <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Color Pick</label>
        <div class="flex items-center space-x-4 bg-gray-50 rounded-2xl p-4">
          <input bind:value={color} type="color" class="w-10 h-10 rounded-full cursor-pointer border-none bg-transparent" />
          <span class="text-sm font-mono font-bold text-gray-400 uppercase">{color}</span>
        </div>
      </div>

      {#if message}
        <div class="p-4 rounded-2xl text-center text-sm font-bold {message.includes('Error') ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}">
          {message}
        </div>
      {/if}

      <button type="submit" disabled={loading}
        class="w-full bg-[#2D60FF] text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
        {#if uploading}
          UPLOADING PHOTO...
        {:else if loading}
          SAVING ITEM...
        {:else}
          CONFIRM ADDITION
        {/if}
      </button>
    </form>
  </div>
</div>