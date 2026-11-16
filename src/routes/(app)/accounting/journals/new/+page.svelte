<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createJournalEntry } from '$features/journal-entries/api';
	import { apiFetch } from '$lib/api/api-client';
	import { Button } from '$lib/components/ui/button';
	import SearchablePartySelect from '$lib/components/SearchablePartySelect.svelte';
	import { addToast } from '$lib/stores/toast';
	import { ArrowLeft, RefreshCw } from 'lucide-svelte';

	let debitPartyType = $state('agent');
	let debitPartyId = $state(0);

	let creditPartyType = $state('supplier');
	let creditPartyId = $state(0);

	let amount = $state(0);
	let note = $state('');

	let agents = $state<{ id: number; fullName: string; wallet?: number }[]>([]);
	let suppliers = $state<{ id: number; name: string; wallet?: number }[]>([]);
	let heads = $state<{ id: number; fullName: string; wallet?: number }[]>([]);

	let loadingData = $state(true);
	let isSubmitting = $state(false);

	let debitPartyItems = $derived.by(() => {
		if (debitPartyType === 'agent') {
			return agents.map(a => ({ id: a.id, label: a.fullName, wallet: a.wallet }));
		} else if (debitPartyType === 'supplier') {
			return suppliers.map(s => ({ id: s.id, label: s.name, wallet: s.wallet }));
		} else if (debitPartyType === 'head') {
			return heads.map(h => ({ id: h.id, label: h.fullName, wallet: h.wallet }));
		}
		return [];
	});

	let creditPartyItems = $derived.by(() => {
		if (creditPartyType === 'agent') {
			return agents.map(a => ({ id: a.id, label: a.fullName, wallet: a.wallet }));
		} else if (creditPartyType === 'supplier') {
			return suppliers.map(s => ({ id: s.id, label: s.name, wallet: s.wallet }));
		} else if (creditPartyType === 'head') {
			return heads.map(h => ({ id: h.id, label: h.fullName, wallet: h.wallet }));
		}
		return [];
	});

	async function loadParties() {
		try {
			const [agentsRes, suppliersRes, headsRes] = await Promise.all([
				apiFetch<{ id: number; firstName: string; lastName: string; wallet: number }[]>('api/agent'),
				apiFetch<{ id: number; name: string; wallet: number }[]>('api/supplier'),
				apiFetch<{ items: { id: number; firstName: string; lastName: string; wallet: number }[] }>('api/sales-entries/heads?pageSize=1000&type=customer')
			]);

			agents = (agentsRes || []).map(a => ({ id: a.id, fullName: `${a.firstName} ${a.lastName}`.trim(), wallet: a.wallet }));
			suppliers = suppliersRes || [];
			heads = (headsRes?.items || []).map(h => ({ id: h.id, fullName: `${h.firstName} ${h.lastName}`.trim(), wallet: h.wallet }));
		} catch (err: any) {
			addToast(err.message || 'Failed to load parties data.', 'error');
		} finally {
			loadingData = false;
		}
	}

	function isComboSupported(debit: string, credit: string): boolean {
		return true;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!debitPartyId) {
			addToast('Please select a Sender (Debit Party).', 'error');
			return;
		}
		if (!creditPartyId) {
			addToast('Please select a Receiver (Credit Party).', 'error');
			return;
		}
		if (debitPartyId === creditPartyId && debitPartyType === creditPartyType) {
			addToast('Self-transfers are not allowed.', 'error');
			return;
		}
		if (!isComboSupported(debitPartyType, creditPartyType)) {
			addToast(`Transfer combination '${debitPartyType} to ${creditPartyType}' is not supported.`, 'error');
			return;
		}
		if (amount <= 0.001) {
			addToast('Amount must be greater than 0.001 BHD.', 'error');
			return;
		}

		isSubmitting = true;
		try {
			await createJournalEntry({
				debitPartyType,
				debitPartyId,
				creditPartyType,
				creditPartyId,
				amount,
				note: note.trim() || null
			});

			addToast('Party transfer journal request created successfully.', 'success');
			goto('/accounting/journals');
		} catch (err: any) {
			addToast(err.message || 'Failed to create party transfer journal.', 'error');
		} finally {
			isSubmitting = false;
		}
	}

	onMount(() => {
		loadParties();
	});
</script>

<svelte:head>
	<title>New Party Transfer Journal — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="space-y-2">
		<button
			onclick={() => goto('/accounting/journals')}
			class="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
		>
			<ArrowLeft class="h-3.5 w-3.5" />
			Back to Journals List
		</button>
		<h1 class="text-xl font-bold text-foreground">New Party Transfer Journal</h1>
		<p class="text-xs text-muted-foreground">
			Record a direct value transfer request between Agents, Suppliers, and Customer Heads.
		</p>
	</div>

	{#if loadingData}
		<div class="bg-card border border-border rounded-2xl p-16 flex flex-col items-center justify-center space-y-2">
			<RefreshCw class="h-8 w-8 text-primary animate-spin" />
			<span class="text-xs text-muted-foreground">Loading accounts and customer heads...</span>
		</div>
	{:else}
		<form onsubmit={handleSubmit} class="space-y-6 text-xs">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<!-- Sender (Debit) Card -->
				<div class="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
					<div class="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider">Debit Source (Sender)</div>
					
					<div class="space-y-2">
						<label for="debit-type" class="block font-semibold text-muted-foreground">Party Segment Type</label>
						<select
							id="debit-type"
							value={debitPartyType}
							onchange={(e) => {
								debitPartyType = (e.target as HTMLSelectElement).value;
								debitPartyId = 0;
							}}
							class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground cursor-pointer"
						>
							<option value="agent">Agent</option>
							<option value="supplier">Supplier</option>
							<option value="head">Customer</option>
						</select>
					</div>

					<div class="space-y-2">
						<label for="debit-party" class="block font-semibold text-muted-foreground">Select Party</label>
						<SearchablePartySelect
							id="debit-party"
							items={debitPartyItems}
							bind:selectedId={debitPartyId}
							placeholder="-- Select Sender Party --"
						/>
					</div>
				</div>

				<!-- Receiver (Credit) Card -->
				<div class="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
					<div class="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">Credit Destination (Receiver)</div>
					
					<div class="space-y-2">
						<label for="credit-type" class="block font-semibold text-muted-foreground">Party Segment Type</label>
						<select
							id="credit-type"
							value={creditPartyType}
							onchange={(e) => {
								creditPartyType = (e.target as HTMLSelectElement).value;
								creditPartyId = 0;
							}}
							class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground cursor-pointer"
						>
							<option value="agent">Agent</option>
							<option value="supplier">Supplier</option>
							<option value="head">Customer</option>
						</select>
					</div>

					<div class="space-y-2">
						<label for="credit-party" class="block font-semibold text-muted-foreground">Select Party</label>
						<SearchablePartySelect
							id="credit-party"
							items={creditPartyItems}
							bind:selectedId={creditPartyId}
							placeholder="-- Select Receiver Party --"
						/>
					</div>
				</div>
			</div>

			<!-- Amount and Memo Details Card -->
			<div class="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
				<h3 class="font-bold text-sm text-foreground">Transaction Details</h3>
				
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div class="space-y-2">
						<label for="amount" class="block font-semibold text-muted-foreground">Amount (BHD) <span class="text-red-500">*</span></label>
						<div class="relative">
							<span class="absolute left-3 top-2.5 text-muted-foreground font-semibold">BHD</span>
							<input
								id="amount"
								type="number"
								step="0.001"
								min="0.002"
								required
								placeholder="0.000"
								class="h-10 w-full bg-background border border-border rounded-xl pl-12 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-semibold"
								bind:value={amount}
							/>
						</div>
					</div>

					<div class="space-y-2">
						<label for="note" class="block font-semibold text-muted-foreground">Memo / Description</label>
						<input
							id="note"
							type="text"
							placeholder="e.g. Wallet rebalancing correction"
							class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
							bind:value={note}
						/>
					</div>
				</div>
			</div>

			<!-- Form Actions -->
			<div class="flex items-center justify-end gap-3 pt-4 border-t border-border">
				<Button
					variant="outline"
					class="rounded-xl px-5 py-4.5 font-semibold cursor-pointer"
					disabled={isSubmitting}
					onclick={() => goto('/accounting/journals')}
				>
					Cancel
				</Button>
				<Button
					type="submit"
					class="rounded-xl px-5 py-4.5 font-semibold cursor-pointer"
					disabled={isSubmitting || !debitPartyId || !creditPartyId}
				>
					{isSubmitting ? 'Creating Request...' : 'Create Transfer Journal'}
				</Button>
			</div>
		</form>
	{/if}
</div>
