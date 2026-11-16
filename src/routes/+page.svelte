<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isAuthenticated } from '$lib/stores/auth';

	onMount(() => {
		if ($isAuthenticated) {
			goto('/dashboard');
		} else {
			goto('/login');
		}
	});
</script>

<div class="h-screen w-screen flex items-center justify-center">
	<div class="animate-pulse text-sm text-muted-foreground">Redirecting...</div>
</div>
