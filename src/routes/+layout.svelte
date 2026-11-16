<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import '$lib/theme/tokens.css';
	import { bootstrapSession, isInitializing, currentUser } from '$lib/stores/auth';
	import Toaster from '$lib/components/Toaster.svelte';
	import { initBahrainTimezoneDefaults } from '$lib/formatters/timezone-defaults';

	let { children } = $props();

	onMount(() => {
		initBahrainTimezoneDefaults();
		bootstrapSession();

		// Prevent mouse wheel scrolling from inadvertently changing number input values
		const handleWheel = (e: WheelEvent) => {
			const active = document.activeElement;
			if (active instanceof HTMLInputElement && active.type === 'number') {
				active.blur();
			}
			if (e.target instanceof HTMLInputElement && e.target.type === 'number') {
				e.target.blur();
			}
		};

		window.addEventListener('wheel', handleWheel, { passive: true });

		return () => {
			window.removeEventListener('wheel', handleWheel);
		};
	});

	let isMaster = $derived(
		$currentUser &&
		$currentUser.userType.toLowerCase().replace(/\s+/g, '_') === 'master_accountant'
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<svelte:body class:theme-master-accountant={isMaster} />

<div 
	class="min-h-[100dvh] bg-background text-foreground antialiased {isMaster ? 'theme-master-accountant' : ''}"
>
	{#if $isInitializing}
		<div
			class="h-[100dvh] w-full flex flex-col items-center justify-center bg-background gap-4"
		>
			<div
				class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"
			></div>
			<p class="text-sm text-muted-foreground">Restoring secure session...</p>
		</div>
	{:else}
		{@render children()}
	{/if}
	<Toaster />
</div>
