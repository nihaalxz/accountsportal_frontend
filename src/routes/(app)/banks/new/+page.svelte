<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Loader2 } from 'lucide-svelte';

	onMount(() => {
		goto('/banks?new=true');
	});
</script>

<svelte:head>
	<title>Register Bank Account — Accounts Portal</title>
</svelte:head>

<div class="flex flex-col items-center justify-center py-24 gap-3 text-xs text-muted-foreground">
	<Loader2 class="h-6 w-6 animate-spin text-primary" />
	<span>Redirecting to bank account registration...</span>
</div>
