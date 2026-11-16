<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { hasRole } from '$lib/stores/auth';
	import {
		getChartOfAccountById,
		deleteChartOfAccount,
		getChartOfAccounts
	} from '$features/chart-of-accounts/api';
	import type { ChartOfAccountResponse } from '$features/chart-of-accounts/types';
	import { ACCOUNT_TYPE_LABELS, NORMAL_BALANCE_LABELS } from '$features/chart-of-accounts/types';
	import Spinner from '$lib/components/Spinner.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { Button } from '$lib/components/ui/button';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import { addToast } from '$lib/stores/toast';
	import { ArrowLeft, Edit3, Trash2, Calendar, FileText, FolderOpen } from 'lucide-svelte';

	const id = $page.params.id ? parseInt($page.params.id) : 0;

	let account = $state<ChartOfAccountResponse | null>(null);
	let parentAccount = $state<ChartOfAccountResponse | null>(null);
	let loading = $state(true);
	let errorMsg = $state<string | null>(null);
	let correlationId = $state('');

	let showDeleteConfirm = $state(false);
	let isDeleting = $state(false);

	let abortController: AbortController | null = null;

	async function loadAccountDetails() {
		if (abortController) abortController.abort();
		abortController = new AbortController();
		loading = true;
		errorMsg = null;

		try {
			const acc = await getChartOfAccountById(id, abortController.signal);
			account = acc;

			if (acc.parentId) {
				try {
					parentAccount = await getChartOfAccountById(
						acc.parentId,
						abortController.signal
					);
				} catch {
					// Soft failure: parent account name not loaded is ok
					parentAccount = null;
				}
			} else {
				parentAccount = null;
			}
		} catch (err: any) {
			if (err.name === 'AbortError') return;
			errorMsg = err.message || 'Failed to load account details.';
			correlationId = err.correlationId || '';
		} finally {
			loading = false;
		}
	}

	async function handleDelete() {
		if (!account) return;
		isDeleting = true;
		try {
			await deleteChartOfAccount(account.id);
			addToast(`Account "${account.name}" deleted successfully.`, 'success');
			goto('/accounting/chart-of-accounts');
		} catch (err: any) {
			addToast(err.message || 'Failed to delete account.', 'error');
		} finally {
			isDeleting = false;
			showDeleteConfirm = false;
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
	<title>Account Details — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Top Bar / Back button -->
	<div class="flex items-center justify-between">
		<button
			onclick={() => goto('/accounting/chart-of-accounts')}
			class="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
		>
			<ArrowLeft class="h-3.5 w-3.5" />
			Back to Chart of Accounts
		</button>

		<div class="flex items-center gap-2">
			{#if hasRole('master_accountant') && account}
				<Button
					variant="outline"
					size="sm"
					class="rounded-xl text-xs py-4 cursor-pointer font-semibold"
					onclick={() => goto(`/accounting/chart-of-accounts/${id}/edit`)}
				>
					<Edit3 class="h-3.5 w-3.5 mr-1" />
					Edit
				</Button>
				{#if !account.isSystemAccount}
					<Button
						variant="destructive"
						size="sm"
						class="rounded-xl text-xs py-4 cursor-pointer font-semibold"
						onclick={() => (showDeleteConfirm = true)}
					>
						<Trash2 class="h-3.5 w-3.5 mr-1" />
						Delete
					</Button>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Main Card Grid -->
	{#if errorMsg}
		<ErrorState message={errorMsg} {correlationId} retryAction={loadAccountDetails} />
	{:else}
		{#if loading || !account}
			<div
				class="flex flex-col items-center justify-center min-h-[300px] bg-card border border-border rounded-2xl"
			>
				<Spinner class="h-8 w-8 text-primary" />
				<span class="text-xs text-muted-foreground mt-2">Loading account details...</span>
			</div>
		{:else}
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<!-- Core attributes card -->
				<div
					class="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6"
				>
					<div class="flex items-start justify-between border-b border-border pb-4">
						<div class="space-y-1">
							<div class="flex items-center gap-2">
								<span
									class="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded-md font-semibold"
								>
									Code {account.code}
								</span>
								{#if account.isSystemAccount}
									<span
										class="text-[9px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider"
									>
										System Critical
									</span>
								{/if}
							</div>
							<h2 class="text-lg font-bold text-foreground">{account.name}</h2>
						</div>
						<span
							class={[
								'inline-flex items-center gap-1 font-semibold rounded-full border text-[10px] px-3 py-1',
								account.isActive
									? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800'
									: 'text-muted-foreground bg-muted border-border'
							].join(' ')}
						>
							{account.isActive ? 'Active' : 'Inactive'}
						</span>
					</div>

					<!-- Details Grid -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
						<div class="space-y-1">
							<span class="text-muted-foreground font-semibold">Account Type</span>
							<p class="font-bold text-foreground capitalize">
								{ACCOUNT_TYPE_LABELS[account.accountType] || account.accountType}
							</p>
						</div>
						<div class="space-y-1">
							<span class="text-muted-foreground font-semibold"
								>Normal Balance Direction</span
							>
							<p class="font-bold text-foreground capitalize">
								{NORMAL_BALANCE_LABELS[account.normalBalance] ||
									account.normalBalance}
							</p>
						</div>
						<div class="space-y-1">
							<span class="text-muted-foreground font-semibold">Control Account</span>
							<p class="font-bold text-foreground">
								{account.isControlAccount
									? 'Yes (Allows children sub-accounts, no direct postings)'
									: 'No (Standard posting account)'}
							</p>
						</div>
						<div class="space-y-1">
							<span class="text-muted-foreground font-semibold">Hierarchy Level</span>
							<p class="font-bold text-foreground">
								{parentAccount ? 'Sub-account' : 'Root / Top-level Account'}
							</p>
						</div>
					</div>

					{#if account.description}
						<div class="pt-4 border-t border-border space-y-1.5 text-xs">
							<span class="text-muted-foreground font-semibold"
								>Description / Notes</span
							>
							<p class="text-foreground leading-relaxed">{account.description}</p>
						</div>
					{/if}
				</div>

				<!-- Side details card (Parent / audit) -->
				<div class="space-y-6">
					<!-- Hierarchy Context -->
					<div class="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
						<h3
							class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
						>
							<FolderOpen class="h-4 w-4 text-primary" />
							Hierarchy Context
						</h3>

						<div class="text-xs space-y-3">
							{#if parentAccount}
								<div
									class="p-3 bg-muted/40 border border-border rounded-xl space-y-1"
								>
									<span
										class="text-[10px] uppercase font-bold text-muted-foreground"
										>Parent Account</span
									>
									<a
										href={`/accounting/chart-of-accounts/${parentAccount.id}`}
										class="block font-semibold text-primary hover:underline"
									>
										{parentAccount.code} — {parentAccount.name}
									</a>
								</div>
							{:else}
								<p class="text-muted-foreground">
									This is a root account and has no parent.
								</p>
							{/if}
						</div>
					</div>

					<!-- Audit / Meta info -->
					<div class="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
						<h3
							class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
						>
							<Calendar class="h-4 w-4 text-primary" />
							Audit Metadata
						</h3>

						<div class="text-xs space-y-3 text-muted-foreground">
							<div class="flex justify-between">
								<span>Created On</span>
								<span class="font-medium text-foreground">
									{new Date(account.createdAt).toLocaleDateString()}
								</span>
							</div>
							<div class="flex justify-between">
								<span>Account ID</span>
								<span class="font-mono font-medium text-foreground"
									>#{account.id}</span
								>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- High friction delete confirmation dialog -->
<ConfirmationDialog
	bind:open={showDeleteConfirm}
	title="Delete Chart of Account?"
	message={`Are you sure you want to permanently delete "${account?.name}" (${account?.code})? This action will fail if the account has ledger activity or sub-accounts.`}
	confirmLabel="Yes, Delete"
	isDestructive={true}
	onConfirm={handleDelete}
/>
