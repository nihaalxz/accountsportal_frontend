<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { isAuthenticated, isInitializing } from '$lib/stores/auth';
	import { signalRService } from '$lib/realtime/signalr-service';
	import Sidebar from '$lib/layout/Sidebar.svelte';
	import Header from '$lib/layout/Header.svelte';
	import MobileBottomNav from '$lib/layout/MobileBottomNav.svelte';

	let { children } = $props();

	// Automatically redirect if authentication is revoked or session expires, once initializing completes
	$effect(() => {
		if ($isInitializing) return;

		if (!$isAuthenticated) {
			const currentPath = $page.url.pathname;
			if (currentPath !== '/login') {
				const returnTo = $page.url.pathname + $page.url.search;
				const loginUrl = `/login${returnTo !== '/' && returnTo !== '/dashboard' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
				goto(loginUrl);
			}
		} else {
			signalRService.startConnection();
		}
	});
</script>

{#if $isAuthenticated}
	<div
		class="min-h-[100dvh] h-[100dvh] bg-background text-foreground antialiased flex flex-row overflow-hidden"
	>
		<div class="hidden lg:block h-[100dvh] sticky top-0">
			<Sidebar />
		</div>
		<div class="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden">
			<Header />
			<main class="flex-1 overflow-y-auto px-6 pt-6 pb-24 lg:pb-6 bg-muted/10">
				{@render children()}
			</main>
		</div>
	</div>
	<MobileBottomNav />
{/if}
