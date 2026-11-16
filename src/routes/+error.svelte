<script lang="ts">
	import { page } from '$app/stores';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { Button } from '$lib/components/ui/button';
	import { goto } from '$app/navigation';
	function handleReturn() {
		if (typeof window !== 'undefined') {
			window.location.href = '/dashboard';
		} else {
			goto('/dashboard');
		}
	}
</script>

<svelte:head>
	<title>Error — {$page.status}</title>
</svelte:head>

<div class="h-screen w-screen flex flex-col items-center justify-center bg-muted/10 p-6">
	<div class="w-full max-w-[480px]">
		<ErrorState
			title="Application Error ({$page.status})"
			message={$page.error?.message || 'An unexpected routing error occurred.'}
			correlationId={$page.error?.message?.includes('correlation')
				? 'captured-telemetry'
				: undefined}
		/>

		<div class="flex justify-center mt-6">
			<Button
				onclick={handleReturn}
				class="rounded-xl font-semibold cursor-pointer"
			>
				Return to Dashboard
			</Button>
		</div>
	</div>
</div>
