<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<script lang="ts">
  import { supabase } from '$lib/supabase'
  import { onMount } from 'svelte'

  onMount(async () => {
    const { data, error } = await supabase.from('profiles').select('*')
    console.log('data:', data)
    console.log('error:', error)
  })
</script>

<h1>Test</h1> 
