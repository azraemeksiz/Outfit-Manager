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

<div class="flex flex-col items-center justify-center min-h-screen bg-gray-100">
  <div class="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
    <h1 class="text-2xl font-bold mb-6 text-center">Create Account</h1>

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

    <input
      type="password"
      placeholder="Confirm Password"
      bind:value={confirmPassword}
      class="w-full border rounded-lg px-4 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />

    {#if errorMsg}
      <p class="text-red-500 text-sm mb-3">{errorMsg}</p>
    {/if}

    {#if successMsg}
      <p class="text-green-500 text-sm mb-3">{successMsg}</p>
    {/if}

    <button
      onclick={handleRegister}
      disabled={loading}
      class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? 'Creating account...' : 'Register'}
    </button>

    <p class="text-center text-sm mt-4 text-gray-500">
      Already have an account? <a href="/login" class="text-blue-600 hover:underline">Login</a>
    </p>
  </div>
</div>