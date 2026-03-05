<script lang="ts">
  import { supabase } from '$lib/supabase'

  let email = ''
  let errorMsg = ''
  let successMsg = ''
  let loading = false

  async function handleReset() {
    loading = true
    errorMsg = ''
    successMsg = ''

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:5177/reset-password'
    })

    if (error) {
      errorMsg = error.message
    } else {
      successMsg = 'Password reset email sent! Please check your inbox.'
    }

    loading = false
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen bg-gray-100">
  <div class="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
    <h1 class="text-2xl font-bold mb-2 text-center">Forgot Password</h1>
    <p class="text-gray-500 text-sm text-center mb-6">
      Enter your email and we'll send you a reset link.
    </p>

    <input
      type="email"
      placeholder="Email"
      bind:value={email}
      class="w-full border rounded-lg px-4 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />

    {#if errorMsg}
      <p class="text-red-500 text-sm mb-3">{errorMsg}</p>
    {/if}

    {#if successMsg}
      <p class="text-green-500 text-sm mb-3">{successMsg}</p>
    {/if}

    <button
      onclick={handleReset}
      disabled={loading}
      class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? 'Sending...' : 'Send Reset Link'}
    </button>

    <p class="text-center text-sm mt-4 text-gray-500">
      Remember your password? <a href="/login" class="text-blue-600 hover:underline">Login</a>
    </p>
  </div>
</div>
