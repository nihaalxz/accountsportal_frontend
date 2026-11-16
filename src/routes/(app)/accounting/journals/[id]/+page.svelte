<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { hasRole } from '$lib/stores/auth';
	import {
		getJournalEntryById,
		approveJournalEntry,
		rejectJournalEntry
	} from '$features/journal-entries/api';
	import type { JournalEntryResponse } from '$features/journal-entries/types';
	import { JOURNAL_STATUS_LABELS } from '$features/journal-entries/types';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { Button } from '$lib/components/ui/button';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import { addToast } from '$lib/stores/toast';
	import { ArrowLeft, Check, X, Calendar, ArrowRight } from 'lucide-svelte';

	const id = $page.params.id ? parseInt($page.params.id) : 0;

	let journal = $state<JournalEntryResponse | null>(null);
	let loading = $state(true);
	let errorMsg = $state<string | null>(null);
	let correlationId = $state('');

	let showApproveConfirm = $state(false);
	let showRejectConfirm = $state(false);
	let isActionRunning = $state(false);

	let abortController: AbortController | null = null;

	async function loadDetails() {
		if (abortController) abortController.abort();
		abortController = new AbortController();
		loading = true;
		errorMsg = null;

		try {
			journal = await getJournalEntryById(id, abortController.signal);
		} catch (err: any) {
			if (err.name === 'AbortError') return;
			errorMsg = err.message || 'Failed to load transfer journal details.';
			correlationId = err.correlationId || '';
		} finally {
			loading = false;
		}
	}

	async function handleApprove() {
		if (!journal) return;
		isActionRunning = true;
		try {
			// Generate a unique idempotency key for this click
			const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'txf-idemp-' + Math.random().toString(36).substring(2) + '-' + Date.now();
			await approveJournalEntry(id, idempotencyKey, journal.rowVersion);
			addToast('Transfer journal approved and wallets updated successfully.', 'success');
			await loadDetails();
		} catch (err: any) {
			addToast(err.message || 'Failed to approve transfer journal.', 'error');
		} finally {
			isActionRunning = false;
			showApproveConfirm = false;
		}
	}

	async function handleReject() {
		isActionRunning = true;
		try {
			await rejectJournalEntry(id);
			addToast('Transfer journal rejected successfully.', 'success');
			await loadDetails();
		} catch (err: any) {
			addToast(err.message || 'Failed to reject transfer journal.', 'error');
		} finally {
			isActionRunning = false;
			showRejectConfirm = false;
		}
	}

	onMount(() => {
		loadDetails();
		return () => {
			if (abortController) abortController.abort();
		};
	});
</script>

<svelte:head>
	<title>Party Transfer Journal Details — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Top Navigation Bar -->
	<div class="flex items-center justify-between">
		<button
			onclick={() => goto('/accounting/journals')}
			class="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
		>
			<ArrowLeft class="h-3.5 w-3.5" />
			Back to Journals List
		</button>

		<!-- Actions -->
		{#if journal && journal.status === 'pending' && hasRole('master_accountant')}
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					class="rounded-xl text-xs py-4 cursor-pointer font-semibold border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100"
					disabled={isActionRunning}
					onclick={() => (showRejectConfirm = true)}
				>
					<X class="h-3.5 w-3.5 mr-1" />
					Reject
				</Button>
				<Button
					variant="default"
					size="sm"
					class="rounded-xl text-xs py-4 cursor-pointer font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
					disabled={isActionRunning}
					onclick={() => (showApproveConfirm = true)}
				>
					<Check class="h-3.5 w-3.5 mr-1" />
					Approve & Execute
				</Button>
			</div>
		{/if}
	</div>

	<!-- Main Details Display -->
	{#if errorMsg}
		<ErrorState message={errorMsg} {correlationId} retryAction={loadDetails} />
	{:else}
		{#if loading || !journal}
			<div
				class="flex flex-col items-center justify-center min-h-[300px] bg-card border border-border rounded-2xl"
			>
				<Spinner class="h-8 w-8 text-primary" />
				<span class="text-xs text-muted-foreground mt-2">Loading journal details...</span>
			</div>
		{:else}
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<!-- Header Details Card -->
				<div class="lg:col-span-2 space-y-6">
					<div class="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6">
						<div class="flex items-start justify-between border-b border-border pb-4">
							<div class="space-y-1">
								<span
									class="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded-md font-semibold"
								>
									Journal No. {journal.journalNumber}
								</span>
								<h2 class="text-lg font-bold text-foreground mt-1">
									{journal.note || 'No memo description provided.'}
								</h2>
							</div>
							<span
								class={[
									'inline-flex items-center gap-1 font-semibold rounded-full border text-[10px] px-3 py-1 capitalize',
									journal.status === 'approved'
										? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800'
										: journal.status === 'pending'
											? 'text-yellow-700 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-950/40 dark:border-yellow-800'
											: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/40 dark:border-rose-800'
								].join(' ')}
							>
								{JOURNAL_STATUS_LABELS[journal.status] || journal.status}
							</span>
						</div>

						<!-- Core info grids -->
						<div class="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
							<div class="space-y-1">
								<span class="text-muted-foreground font-semibold">Date Created</span>
								<p class="font-bold text-foreground">
									{new Date(journal.createdAt).toLocaleDateString(undefined, {
										dateStyle: 'full'
									})}
								</p>
							</div>
							<div class="space-y-1">
								<span class="text-muted-foreground font-semibold">Transfer Reference</span>
								<p class="font-bold text-foreground font-mono">
									{journal.transferReference || 'Pending Approval'}
								</p>
							</div>
							<div class="space-y-1">
								<span class="text-muted-foreground font-semibold">Created By</span>
								<p class="font-bold text-foreground">
									{journal.createdByName || `User #${journal.createdBy}`}
								</p>
							</div>
						</div>
					</div>

					<!-- Visual Value Transfer Flow -->
					<div class="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6">
						<h3 class="font-bold text-sm text-foreground">Wallet Value Transfer Flow</h3>
						
						<div class="flex flex-col md:flex-row items-center justify-between gap-6 py-4 px-2">
							<!-- Sender Card -->
							<div class="flex-1 w-full p-4 bg-muted/20 border border-border/80 rounded-xl space-y-2 text-center md:text-left">
								<div class="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider">Debit Source (Sender)</div>
								<div class="text-base font-bold text-foreground">{journal.debitPartyName}</div>
								<div class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground capitalize">
									{journal.debitPartyType}
								</div>
								<div class="text-xs text-rose-600 font-bold pt-2">
									- <MoneyDisplay amount={journal.amount} />
								</div>
							</div>

							<!-- Arrow Divider -->
							<div class="flex flex-col items-center justify-center text-muted-foreground">
								<ArrowRight class="h-6 w-6 hidden md:block" />
								<div class="block md:hidden font-mono font-bold text-[10px] text-muted-foreground">To</div>
							</div>

							<!-- Receiver Card -->
							<div class="flex-1 w-full p-4 bg-muted/20 border border-border/80 rounded-xl space-y-2 text-center md:text-left">
								<div class="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">Credit Destination (Receiver)</div>
								<div class="text-base font-bold text-foreground">{journal.creditPartyName}</div>
								<div class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground capitalize">
									{journal.creditPartyType}
								</div>
								<div class="text-xs text-emerald-600 font-bold pt-2">
									+ <MoneyDisplay amount={journal.amount} />
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Side details and audit logs card -->
				<div class="space-y-6 text-xs">
					<!-- Workflow info -->
					<div class="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
						<h3
							class="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
						>
							<Calendar class="h-4 w-4 text-primary" />
							Workflow Status
						</h3>

						<div class="space-y-4 text-muted-foreground">
							<div class="flex items-center justify-between">
								<span>Request Status</span>
								<span class="font-semibold text-foreground capitalize">{journal.status}</span>
							</div>
							<div class="flex items-center justify-between">
								<span>Transfer Amount</span>
								<span class="font-bold text-foreground"><MoneyDisplay amount={journal.amount} /></span>
							</div>
							{#if journal.approvedBy}
								<div class="flex items-center justify-between">
									<span>Processed By</span>
									<span class="font-semibold text-foreground"
										>{journal.approvedByName || `User #${journal.approvedBy}`}</span
									>
								</div>
								<div class="flex justify-between">
									<span>Processed At</span>
									<span class="font-semibold text-foreground"
										>{journal.approvedAt
											? new Date(journal.approvedAt).toLocaleString()
											: ''}</span
									>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Approve Confirmation -->
<ConfirmationDialog
	bind:open={showApproveConfirm}
	title="Approve Wallet Transfer?"
	message="Are you sure you want to approve this party transfer journal? The specified wallet balances will be updated immediately."
	confirmLabel="Yes, Approve and Transfer"
	onConfirm={handleApprove}
/>

<!-- Reject Confirmation -->
<ConfirmationDialog
	bind:open={showRejectConfirm}
	title="Reject Wallet Transfer?"
	message="Are you sure you want to reject this party transfer request? The status will update to rejected and no balances will move."
	confirmLabel="Yes, Reject Request"
	onConfirm={handleReject}
/>
