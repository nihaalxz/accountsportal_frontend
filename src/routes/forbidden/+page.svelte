<script lang="ts">
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { Button } from '$lib/components/ui/button';
	import { goto } from '$app/navigation';
</script>

<svelte:head>
	<title>Access Forbidden — Accounts Portal</title>
</svelte:head>

<div class="h-[70vh] flex flex-col items-center justify-center p-6">
	<div class="w-full max-w-[480px]">
		<ErrorState
			title="Access Denied (403 Forbidden)"
			message="You do not possess the role permissions required to view this financial ledger or operational view. Please request access from a Master Accountant if this is an error."
		/>

		<div class="flex justify-center mt-6">
			<Button
				onclick={() => goto('/dashboard')}
				class="rounded-xl font-semibold cursor-pointer"
			>
				Return to Dashboard
			</Button>
		</div>
	</div>
</div>
