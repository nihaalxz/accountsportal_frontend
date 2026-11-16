<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getJournalEntries } from '$features/journal-entries/api';
	import type { JournalEntryResponse } from '$features/journal-entries/types';
	import { JOURNAL_STATUS_LABELS } from '$features/journal-entries/types';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import FinancialTableSkeleton from '$lib/components/financial/FinancialTableSkeleton.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { Button } from '$lib/components/ui/button';
	import { BookOpen, Search, Plus } from 'lucide-svelte';

	let journals = $state<JournalEntryResponse[]>([]);
	let loading = $state(true);
	let errorMsg = $state<string | null>(null);
	let correlationId = $state('');

	let searchVal = $state('');
	let statusFilter = $state('all');

	let abortController: AbortController | null = null;

	async function loadJournals() {
		if (abortController) abortController.abort();
		abortController = new AbortController();
		loading = true;
		errorMsg = null;
		correlationId = '';

		try {
			const res = await getJournalEntries(abortController.signal);
			journals = res.sort(
				(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			);
		} catch (err: any) {
			if (err.name === 'AbortError') return;
			errorMsg = err.message || 'Failed to load transfer journals.';
			correlationId = err.correlationId || '';
		} finally {
			loading = false;
		}
	}

	// Filtered list
	const filteredJournals = $derived(() => {
		let result = journals;
		if (statusFilter !== 'all') {
			result = result.filter((j) => j.status === statusFilter);
		}
		if (searchVal.trim() !== '') {
			const query = searchVal.toLowerCase();
			result = result.filter(
				(j) =>
					j.journalNumber.toLowerCase().includes(query) ||
					(j.debitPartyName && j.debitPartyName.toLowerCase().includes(query)) ||
					(j.creditPartyName && j.creditPartyName.toLowerCase().includes(query)) ||
					(j.note && j.note.toLowerCase().includes(query))
			);
		}
		return result;
	});

	onMount(() => {
		loadJournals();
		return () => {
			if (abortController) abortController.abort();
		};
	});
</script>

<svelte:head>
	<title>Party Transfers — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-bold text-foreground">Party Transfer Journals</h1>
			<p class="text-xs text-muted-foreground">
				Record and approve direct wallet value transfers between customer heads, travel agents, and suppliers.
			</p>
		</div>
		<Button
			class="rounded-xl text-xs py-5 cursor-pointer font-semibold"
			onclick={() => goto('/accounting/journals/new')}
		>
			<Plus class="h-3.5 w-3.5 mr-1" />
			New Party Transfer
		</Button>
	</div>

	<!-- Filters & Search -->
	<div
		class="bg-card border border-border rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-xs"
	>
		<div class="relative flex-1">
			<Search class="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
			<input
				type="text"
				placeholder="Search by Journal No., Party Name, or Note..."
				class="pl-9 h-10 w-full bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
				bind:value={searchVal}
			/>
		</div>
		<div class="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
			{#each ['all', 'pending', 'approved', 'rejected'] as status}
				<button
					class={[
						'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap capitalize',
						statusFilter === status
							? 'bg-primary border-primary text-primary-foreground'
							: 'bg-background border-border text-muted-foreground hover:text-foreground'
					].join(' ')}
					onclick={() => (statusFilter = status)}
				>
					{JOURNAL_STATUS_LABELS[
						status as import('$features/journal-entries/types').JournalStatus
					] || status}
				</button>
			{/each}
		</div>
	</div>

	<!-- Main List -->
	{#if errorMsg}
		<ErrorState message={errorMsg} {correlationId} retryAction={loadJournals} />
	{:else}
		{#if loading}
			<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
				<FinancialTableSkeleton rows={5} columns={6} />
			</div>
		{:else if filteredJournals().length === 0}
			<EmptyState
				title="No transfers found"
				description="Record a new direct wallet value transfer between parties to start."
				icon={BookOpen}
			/>
		{:else}
			<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
				<div class="overflow-x-auto">
					<table class="w-full min-w-[750px] text-left border-collapse text-xs">
						<thead>
							<tr
								class="bg-muted/30 border-b border-border text-muted-foreground font-semibold"
							>
								<th class="p-4 w-28">Journal No.</th>
								<th class="p-4 w-32">Date Created</th>
								<th class="p-4">Sender (Debit Party)</th>
								<th class="p-4">Receiver (Credit Party)</th>
								<th class="p-4 w-28 text-right">Amount</th>
								<th class="p-4 w-36">Status</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/60">
							{#each filteredJournals() as j (j.id)}
								<tr
									class="hover:bg-muted/10 transition-colors cursor-pointer"
									onclick={() => goto(`/accounting/journals/${j.id}`)}
								>
									<td class="p-4 font-mono font-medium text-muted-foreground"
										>{j.journalNumber}</td
									>
									<td class="p-4">{new Date(j.createdAt).toLocaleDateString()}</td>
									<td class="p-4">
										<div class="font-semibold text-foreground">{j.debitPartyName}</div>
										<div class="text-[10px] text-muted-foreground capitalize">{j.debitPartyType}</div>
									</td>
									<td class="p-4">
										<div class="font-semibold text-foreground">{j.creditPartyName}</div>
										<div class="text-[10px] text-muted-foreground capitalize">{j.creditPartyType}</div>
									</td>
									<td class="p-4 text-right font-bold text-foreground">
										<MoneyDisplay amount={j.amount} />
									</td>
									<td class="p-4">
										<span
											class={[
												'inline-flex items-center gap-1 font-semibold rounded-full border text-[10px] px-2 py-0.5 capitalize',
												j.status === 'approved'
													? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800'
													: j.status === 'pending'
														? 'text-yellow-700 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-950/40 dark:border-yellow-800'
														: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/40 dark:border-rose-800'
											].join(' ')}
										>
											{JOURNAL_STATUS_LABELS[j.status] || j.status}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	{/if}
</div>
