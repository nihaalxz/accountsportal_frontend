<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getChartOfAccountById, updateChartOfAccount } from '$features/chart-of-accounts/api';
	import type { ChartOfAccountResponse } from '$features/chart-of-accounts/types';
	import Spinner from '$lib/components/Spinner.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { Button } from '$lib/components/ui/button';
	import { addToast } from '$lib/stores/toast';
	import { ArrowLeft } from 'lucide-svelte';

	const id = $page.params.id ? parseInt($page.params.id) : 0;

	let name = $state('');
	let description = $state('');

	let account = $state<ChartOfAccountResponse | null>(null);
	let loading = $state(true);
	let errorMsg = $state<string | null>(null);
	let correlationId = $state('');
	let isSubmitting = $state(false);

	let abortController: AbortController | null = null;

	async function loadAccountDetails() {
		if (abortController) abortController.abort();
		abortController = new AbortController();
		loading = true;
		errorMsg = null;

		try {
			const acc = await getChartOfAccountById(id, abortController.signal);
			account = acc;
			name = acc.name;
			description = acc.description || '';
		} catch (err: any) {
			if (err.name === 'AbortError') return;
			errorMsg = err.message || 'Failed to load account details.';
			correlationId = err.correlationId || '';
		} finally {
			loading = false;
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!name.trim()) {
			addToast('Please fill in Name.', 'error');
			return;
		}

		isSubmitting = true;
		try {
			await updateChartOfAccount(id, {
				name: name.trim(),
				description: description.trim() || null
			});
			addToast('Account details updated successfully.', 'success');
			goto(`/accounting/chart-of-accounts/${id}`);
		} catch (err: any) {
			addToast(err.message || 'Failed to update account.', 'error');
		} finally {
			isSubmitting = false;
		}
	}

	onMount(() => {
		loadAccountDetails();
		return () => {
			if (abortController) abortController.abort();
		};
	});
</script>

<svelte:head>
	<title>Edit Account — Accounts Portal</title>
</svelte:head>

<div class="max-w-2xl mx-auto space-y-6">
	<!-- Header -->
	<div class="space-y-2">
		<button
			onclick={() => goto(`/accounting/chart-of-accounts/${id}`)}
			class="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
		>
			<ArrowLeft class="h-3.5 w-3.5" />
			Back to Account Details
		</button>
		<h1 class="text-xl font-bold text-foreground">Edit Chart of Account</h1>
		<p class="text-xs text-muted-foreground">Update details for this account ledger record.</p>
	</div>

	<!-- Form Card -->
	{#if errorMsg}
		<ErrorState message={errorMsg} {correlationId} retryAction={loadAccountDetails} />
	{:else}
		{#if loading || !account}
			<div
				class="flex flex-col items-center justify-center min-h-[250px] bg-card border border-border rounded-2xl"
			>
				<Spinner class="h-8 w-8 text-primary" />
				<span class="text-xs text-muted-foreground mt-2">Loading account details...</span>
			</div>
		{:else}
			<form
				onsubmit={handleSubmit}
				class="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4 text-xs"
			>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<!-- Account Code (Disabled) -->
					<div class="space-y-1.5 opacity-60">
						<label for="code-display" class="font-semibold text-muted-foreground"
							>Account Code</label
						>
						<input
							id="code-display"
							type="text"
							disabled
							class="h-10 w-full bg-muted border border-border rounded-xl px-3 text-xs text-foreground font-mono"
							value={account.code}
						/>
					</div>

					<!-- Account Name -->
					<div class="space-y-1.5">
						<label for="name" class="font-semibold text-muted-foreground"
							>Account Name</label
						>
						<input
							id="name"
							type="text"
							required
							placeholder="e.g. Petty Cash Drawer"
							class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
							bind:value={name}
						/>
					</div>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-60">
					<!-- Account Type (Disabled) -->
					<div class="space-y-1.5">
						<label for="type-display" class="font-semibold text-muted-foreground"
							>Account Type</label
						>
						<input
							id="type-display"
							type="text"
							disabled
							class="h-10 w-full bg-muted border border-border rounded-xl px-3 text-xs text-foreground capitalize"
							value={account.accountType}
						/>
					</div>

					<!-- Normal Balance Direction (Disabled) -->
					<div class="space-y-1.5">
						<label for="bal-display" class="font-semibold text-muted-foreground"
							>Normal Balance</label
						>
						<input
							id="bal-display"
							type="text"
							disabled
							class="h-10 w-full bg-muted border border-border rounded-xl px-3 text-xs text-foreground capitalize"
							value={account.normalBalance}
						/>
					</div>
				</div>

				<!-- Description -->
				<div class="space-y-1.5">
					<label for="description" class="font-semibold text-muted-foreground"
						>Description / Notes (Optional)</label
					>
					<textarea
						id="description"
						rows="3"
						placeholder="Add contextual details for this ledger account..."
						class="w-full bg-background border border-border rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground resize-y"
						bind:value={description}></textarea>
				</div>

				<!-- Action Buttons -->
				<div class="flex items-center justify-end gap-3 pt-4 border-t border-border">
					<Button
						variant="outline"
						class="rounded-xl px-5 py-4.5 font-semibold cursor-pointer"
						disabled={isSubmitting}
						onclick={() => goto(`/accounting/chart-of-accounts/${id}`)}
					>
						Cancel
					</Button>
					<Button
						type="submit"
						class="rounded-xl px-5 py-4.5 font-semibold cursor-pointer"
						disabled={isSubmitting}
					>
						{isSubmitting ? 'Updating...' : 'Save Changes'}
					</Button>
				</div>
			</form>
		{/if}
	{/if}
</div>
