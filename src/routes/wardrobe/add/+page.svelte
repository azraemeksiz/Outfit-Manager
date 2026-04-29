<script lang="ts">
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';
  
  const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  let name = '';
  let category = 'top';
  let color = '#3b82f6';
  let seasons: string[] = [];
  let occasions: string[] = [];
  let is_patterned = false;
  let photoFile: File | null = null;
  let photoPreview: string | null = null;
  let uploading = false;
  let loading = false;
  let message = '';
  let colorDetected = false;
  let detectedColors: string[] = [];

  function toggleSeason(s: string) {
    if (seasons.includes(s)) {
      seasons = seasons.filter(x => x !== s);
    } else {
      seasons = [...seasons, s];
    }
  }

  function toggleOccasion(o: string) {
    if (occasions.includes(o)) {
      occasions = occasions.filter(x => x !== o);
    } else {
      occasions = [...occasions, o];
    }
  }

async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      photoFile = input.files[0];
      photoPreview = URL.createObjectURL(photoFile);
      colorDetected = false;

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const size = 200;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, size, size);

          const fullData = ctx.getImageData(0, 0, size, size).data;

          // Detect background color from image corners
          const cs = 8;
          let bgR = 0, bgG = 0, bgB = 0, bgN = 0;
          [[0, 0], [size - cs, 0], [0, size - cs], [size - cs, size - cs]].forEach(([sx, sy]) => {
            for (let y = sy; y < sy + cs; y++) {
              for (let x = sx; x < sx + cs; x++) {
                const i = (y * size + x) * 4;
                if (fullData[i + 3] < 128) continue;
                bgR += fullData[i]; bgG += fullData[i + 1]; bgB += fullData[i + 2]; bgN++;
              }
            }
          });
          if (bgN > 0) { bgR /= bgN; bgG /= bgN; bgB /= bgN; }

          const margin = Math.floor(size * 0.2);
          const colorMap: Record<string, number> = {};

          for (let y = margin; y < size - margin; y++) {
            for (let x = margin; x < size - margin; x++) {
              const i = (y * size + x) * 4;
              if (fullData[i + 3] < 128) continue;

              const r = fullData[i], g = fullData[i + 1], b = fullData[i + 2];

              // Skip near-white and near-black
              if (r > 230 && g > 230 && b > 230) continue;
              if (r < 30 && g < 30 && b < 30) continue;

              // Skip pixels similar to detected background color
              const dR = r - bgR, dG = g - bgG, dB = b - bgB;
              if (Math.sqrt(dR * dR + dG * dG + dB * dB) < 35) continue;

              // HSL saturation check — filters grays and near-neutrals
              const rN = r / 255, gN = g / 255, bN = b / 255;
              const maxC = Math.max(rN, gN, bN), minC = Math.min(rN, gN, bN);
              const lightness = (maxC + minC) / 2;
              const chroma = maxC - minC;
              const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1));
              if (saturation < 0.2) continue;

              // Use Math.floor to guarantee quantized values stay ≤ 224 (avoids 256 → invalid hex bug)
              const step = 32;
              const rQ = Math.floor(r / step) * step;
              const gQ = Math.floor(g / step) * step;
              const bQ = Math.floor(b / step) * step;

              const key = `${rQ},${gQ},${bQ}`;
              colorMap[key] = (colorMap[key] || 0) + 1;
            }
          }

          const top3 = Object.entries(colorMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
          detectedColors = top3.map(([key]) => {
            const [r, g, b] = key.split(',').map(Number);
            return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          });
          if (detectedColors.length > 0) {
            color = detectedColors[0];
            colorDetected = true;
          }
        } catch (e) {
          colorDetected = false;
        }
      };
      img.src = photoPreview;
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
      } catch {
        message = 'Error: Photo upload failed.';
        loading = false;
        uploading = false;
        return;
      }
      uploading = false;
    }

    const { error } = await supabase.from('items').insert([{
      name,
      category,
      selected_color: color,
      colors: detectedColors.length > 0 ? detectedColors : null,
      seasons,
      occasions,
      is_patterned,
      photo_url,
      user_id: user.id
    }]);

    if (error) {
      message = `Error: ${error.message}`;
    } else {
      message = 'Success! Adding to your wardrobe...';
      setTimeout(() => goto('/wardrobe'), 1500);
    }
    loading = false;
  }
</script>

<div class="min-h-screen bg-[#FFF5F9] pb-24 p-6 font-sans">
  <div class="bg-white w-full max-w-xl mx-auto rounded-[32px] shadow-sm border border-gray-100 p-8 md:p-12">
    <header class="mb-10">
      <a href="/wardrobe" class="text-pink-500 font-bold text-sm hover:opacity-80 transition">← Back to Wardrobe</a>
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
            <div class="w-full aspect-square rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center hover:border-pink-300 hover:bg-pink-50 transition-all">
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
          class="w-full bg-gray-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-pink-300 outline-none placeholder:text-gray-300" />
      </div>

      <div class="space-y-2">
        <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Category</label>
        <select bind:value={category} class="w-full bg-gray-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-pink-300 outline-none cursor-pointer">
          <option value="top">Top</option>
          <option value="bottom">Bottom</option>
          <option value="dress">Dress</option>
          <option value="outerwear">Outerwear</option>
          <option value="shoes">Shoes</option>
          <option value="accessory">Accessory</option>
        </select>
      </div>

      <div class="space-y-2">
        <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Season</label>
        <div class="grid grid-cols-2 gap-2">
          {#each ['all-season', 'winter', 'summer', 'spring-fall'] as s}
            <button
              type="button"
              on:click={() => toggleSeason(s)}
              class="py-3 rounded-2xl font-bold text-sm transition-all {seasons.includes(s) ? 'bg-pink-500 text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}"
            >
              {s === 'all-season' ? 'All Season' : s === 'spring-fall' ? 'Spring/Fall' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          {/each}
        </div>
      </div>

      <div class="space-y-2">
        <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Occasion</label>
        <div class="grid grid-cols-3 gap-2">
          {#each ['Formal', 'Casual', 'Sport', 'Party', 'Indoor'] as o}
            <button
              type="button"
              on:click={() => toggleOccasion(o)}
              class="py-3 rounded-2xl font-bold text-sm transition-all {occasions.includes(o) ? 'bg-pink-500 text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}"
            >
              {o}
            </button>
          {/each}
        </div>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between ml-1 mb-1">
          <label class="text-xs font-black uppercase tracking-widest text-gray-400">Color</label>
          {#if colorDetected}
            <span class="text-xs font-bold text-green-500">Auto-detected ✓</span>
          {/if}
        </div>
        <div class="flex items-center space-x-4 bg-gray-50 rounded-2xl p-4">
          <input bind:value={color} type="color" class="w-10 h-10 rounded-full cursor-pointer border-none bg-transparent" />
          <div class="flex-1">
            <span class="text-sm font-mono font-bold text-gray-400 uppercase">{color}</span>
            {#if detectedColors.length > 1}
              <div class="flex gap-2 mt-2">
                {#each detectedColors as c}
                  <button
                    type="button"
                    on:click={() => color = c}
                    class="w-7 h-7 rounded-full border-2 transition-all {color === c ? 'border-pink-500 scale-110' : 'border-white shadow-sm'}"
                    style="background-color: {c}"
                  />
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <label class="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Pattern</label>
        <button
          type="button"
          on:click={() => is_patterned = !is_patterned}
          class="w-full bg-gray-50 rounded-2xl p-4 font-bold text-sm transition-all {is_patterned ? 'text-pink-500 ring-2 ring-pink-400' : 'text-gray-400'}"
        >
          {is_patterned ? '✓ Patterned' : 'Solid'}
        </button>
      </div>

      {#if message}
        <div class="p-4 rounded-2xl text-center text-sm font-bold {message.includes('Error') ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}">
          {message}
        </div>
      {/if}

      <button type="submit" disabled={loading}
        class="w-full text-white py-5 rounded-2xl font-black text-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
        style="background: linear-gradient(135deg, #f472b6, #ec4899); box-shadow: 0 8px 24px rgba(236,72,153,0.3);">
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