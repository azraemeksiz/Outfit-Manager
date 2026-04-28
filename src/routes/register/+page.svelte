<script lang="ts">
  import { supabase } from '$lib/supabase'

  let email = ''
  let password = ''
  let confirmPassword = ''
  let errorMsg = ''
  let successMsg = ''
  let loading = false

  async function handleRegister() {
    loading = true
    errorMsg = ''
    successMsg = ''
    if (password !== confirmPassword) {
      errorMsg = 'Passwords do not match.'
      loading = false
      return
    }
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      errorMsg = error.message
    } else {
      successMsg = 'Account created! Please check your email to confirm.'
    }
    loading = false
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen font-sans" style="background: #FFF5F9">
  <div class="w-full max-w-sm px-6">

    <div class="text-center mb-10">
      <div class="text-5xl mb-4">✨</div>
      <h1 class="text-3xl font-black text-gray-900 tracking-tight">Create Account</h1>
      <p class="text-gray-400 mt-1 text-sm">Start planning your outfits</p>
    </div>

    <div class="bg-white rounded-[28px] p-8 shadow-sm border border-pink-100">

      <input
        type="email"
        placeholder="Email"
        bind:value={email}
        class="w-full bg-gray-50 rounded-2xl px-4 py-3.5 mb-3 font-medium text-gray-800 placeholder:text-gray-300 outline-none focus:ring-2 focus:ring-pink-300 border-none"
      />

      <input
        type="password"
        placeholder="Password"
        bind:value={password}
        class="w-full bg-gray-50 rounded-2xl px-4 py-3.5 mb-3 font-medium text-gray-800 placeholder:text-gray-300 outline-none focus:ring-2 focus:ring-pink-300 border-none"
      />

      <input
        type="password"
        placeholder="Confirm Password"
        bind:value={confirmPassword}
        class="w-full bg-gray-50 rounded-2xl px-4 py-3.5 mb-4 font-medium text-gray-800 placeholder:text-gray-300 outline-none focus:ring-2 focus:ring-pink-300 border-none"
      />

      {#if errorMsg}
        <p class="text-red-400 text-sm mb-4 font-medium">{errorMsg}</p>
      {/if}
      {#if successMsg}
        <p class="text-pink-500 text-sm mb-4 font-medium">{successMsg}</p>
      {/if}

      <button
        onclick={handleRegister}
        disabled={loading}
        class="w-full py-4 rounded-2xl font-black text-white text-base transition-all active:scale-95 disabled:opacity-50"
        style="background: linear-gradient(135deg, #f472b6, #ec4899); box-shadow: 0 6px 20px rgba(236,72,153,0.3);"
      >
        {loading ? 'Creating account...' : 'Register'}
      </button>

      <p class="text-center text-sm mt-5 text-gray-400">
        Already have an account? <a href="/login" class="text-pink-500 font-bold hover:underline">Login</a>
      </p>
    </div>
  </div>
</div>
