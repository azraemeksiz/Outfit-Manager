<script lang="ts">
  import { supabase } from '$lib/supabase'

  let email = ''
  let password = ''
  let errorMsg = ''
  let loading = false

  async function handleLogin() {
    loading = true
    errorMsg = ''

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      errorMsg = error.message
    } else {
      window.location.href = '/'
    }

    loading = false
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen bg-gray-100">
  <div class="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
    <h1 class="text-2xl font-bold mb-6 text-center">OUTFIX</h1>

    <input
      type="email"
      placeholder="Email"
      bind:value={email}
      class="w-full border rounded-lg px-4 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />

    <input
      type="password"
      placeholder="Password"
      bind:value={password}
      class="w-full border rounded-lg px-4 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />

    {#if errorMsg}
      <p class="text-red-500 text-sm mb-3">{errorMsg}</p>
    {/if}

    <button
      onclick={handleLogin}
      disabled={loading}
      class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? 'Logging in...' : 'Login'}
    </button>

    <p class="text-center text-sm mt-4 text-gray-500">
      Do not have an account? <a href="/register" class="text-blue-600 hover:underline">Register</a>
    </p>

    <p class="text-center text-sm mt-2 text-gray-500">
      <a href="/forgot-password" class="text-blue-600 hover:underline">I forgot my password</a>
    </p>
  </div>
</div>
