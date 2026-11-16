<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { hasRole } from '$lib/stores/auth';
	import { getChartOfAccounts, seedSystemAccounts } from '$features/chart-of-accounts/api';
	import {
		buildAccountTree,
		flattenTree,
		ACCOUNT_TYPE_LABELS,
		NORMAL_BALANCE_LABELS
	} from '$features/chart-of-accounts/types';
	import type {
		ChartOfAccountResponse,
		ChartOfAccountNode
	} from '$features/chart-of-accounts/types';
	import FinancialTableSkeleton from '$lib/components/financial/FinancialTableSkeleton.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { Button } from '$lib/components/ui/button';
	import { addToast } from '$lib/stores/toast';
	import { BookOpen, Folder, FileText, Search, RefreshCw, Plus } from 'lucide-svelte';

	let accounts = $state<ChartOfAccountResponse[]>([]);
	let loading = $state(true);
	let errorMsg = $state<string | null>(null);
	let correlationId = $state('');
	let searchVal = $state('');
	let typeFilter = $state('all');
	let isSeeding = $state(false);

	let abortController: AbortController | null = null;

	async function loadCOA() {
		if (abortController) {
			abortController.abort();
		}
		abortController = new AbortController();
		loading = true;
		errorMsg = null;
		correlationId = '';

		try {
			const res = await getChartOfAccounts(abortController.signal);
			accounts = res;
		} catch (err: any) {
			if (err.name === 'AbortError') return;
			errorMsg = err.message || 'Failed to load Chart of Accounts.';
			correlationId = err.correlationId || '';
		} finally {
			loading = false;
		}
	}

	async function handleSeed() {
		if (!hasRole('master_accountant')) {
			addToast('Only a Master Accountant can seed system accounts.', 'error');
			return;
		}

		isSeeding = true;
		try {
			await seedSystemAccounts();
			addToast('System accounts seeded successfully.', 'success');
			await loadCOA();
		} catch (err: any) {
			addToast(err.message || 'Failed to seed system accounts.', 'error');
		} finally {
			isSeeding = false;
		}
	}

	// Computed tree list
	const processedAccounts = $derived(() => {
		// Filter first if filters are active
		let filtered = accounts;
		if (typeFilter !== 'all') {
			filtered = filtered.filter((a) => a.accountType === typeFilter);
		}
		if (searchVal.trim() !== '') {
			const search = searchVal.toLowerCase();
			filtered = filtered.filter(
				(a) =>
					a.code.toLowerCase().includes(search) || a.name.toLowerCase().includes(search)
			);
			// Flat list for search is better than tree structure
			return filtered.map((a) => ({ ...a, children: [], depth: 0 }));
		}

		// Otherwise, construct tree structure
		const tree = buildAccountTree(filtered);
		return flattenTree(tree);
	});

	onMount(() => {
		loadCOA();
		return () => {
			if (abortController) abortController.abort();
		};
	});
</script>

<svelte:head>
	<title>Chart of Accounts — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-bold text-foreground">Chart of Accounts</h1>
			<p class="text-xs text-muted-foreground">
				Explore and manage the double-entry account ledger hierarchy.
			</p>
		</div>
		<div class="flex items-center gap-2">
			{#if hasRole('master_accountant')}
				<Button
					variant="outline"
					class="rounded-xl text-xs py-5 cursor-pointer font-semibold"
					disabled={isSeeding}
					onclick={handleSeed}
				>
					<RefreshCw
						class={['h-3.5 w-3.5 mr-1', isSeeding && 'animate-spin'].join(' ')}
					/>
					Seed System Accounts
				</Button>
				<Button
					class="rounded-xl text-xs py-5 cursor-pointer font-semibold"
					onclick={() => goto('/accounting/chart-of-accounts/new')}
				>
					<Plus class="h-3.5 w-3.5 mr-1" />
					Add Account
				</Button>
			{/if}
		</div>
	</div>

	<!-- Filters & Search -->
	<div
		class="bg-card border border-border rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-xs"
	>
		<div class="relative flex-1">
			<Search class="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
			<input
				type="text"
				placeholder="Search by Code or Name..."
				class="pl-9 h-10 w-full bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
				bind:value={searchVal}
			/>
		</div>
		<div class="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
			{#each ['all', 'asset', 'liability', 'equity', 'revenue', 'expense'] as type}
				<button
					class={[
						'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap capitalize',
						typeFilter === type
							? 'bg-primary border-primary text-primary-foreground'
							: 'bg-background border-border text-muted-foreground hover:text-foreground'
					].join(' ')}
					onclick={() => (typeFilter = type)}
				>
					{type}
				</button>
			{/each}
		</div>
	</div>

	<!-- Main List -->
	{#if errorMsg}
		<ErrorState message={errorMsg} {correlationId} retryAction={loadCOA} />
	{:else}
		{#if loading}
			<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
				<FinancialTableSkeleton rows={8} columns={6} />
			</div>
		{:else if processedAccounts().length === 0}
			<EmptyState
				title="No accounts found"
				description="Try adjusting your filters or search terms."
				icon={BookOpen}
			/>
		{:else}
			<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
				<div class="overflow-x-auto">
					<table class="w-full min-w-[700px] text-left border-collapse text-xs">
						<thead>
							<tr
								class="bg-muted/30 border-b border-border text-muted-foreground font-semibold"
							>
								<th class="p-4 w-48">Account Code</th>
								<th class="p-4">Account Name</th>
								<th class="p-4 w-28">Type</th>
								<th class="p-4 w-28">Normal Balance</th>
								<th class="p-4 w-28 text-center">Control Account</th>
								<th class="p-4 w-24">Status</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/60">
							{#each processedAccounts() as acc (acc.id)}
								<tr
									class="hover:bg-muted/10 transition-colors cursor-pointer"
									onclick={() => goto(`/accounting/chart-of-accounts/${acc.id}`)}
								>
									<!-- Account Code (indented if showing hierarchy) -->
									<td class="p-4 font-mono font-medium text-foreground">
										<div
											class="flex items-center"
											style="padding-left: {searchVal.trim() === ''
												? acc.depth * 1.2
												: 0}rem"
										>
											{#if searchVal.trim() === '' && acc.depth > 0}
												<span class="text-muted-foreground/30 mr-1.5"
													>└─</span
												>
											{/if}
											{acc.code}
										</div>
									</td>

									<!-- Name -->
									<td class="p-4 font-semibold text-foreground">
										<div class="flex items-center gap-1.5">
											{#if acc.isControlAccount}
												<Folder
													class="h-3.5 w-3.5 text-yellow-500 fill-yellow-500/10 shrink-0"
												/>
											{:else}
												<FileText
													class="h-3.5 w-3.5 text-muted-foreground/60 shrink-0"
												/>
											{/if}
											<span class={acc.isControlAccount ? 'font-bold' : ''}
												>{acc.name}</span
											>
											{#if acc.isSystemAccount}
												<span
													class="text-[9px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wider shrink-0"
													>System</span
												>
											{/if}
										</div>
									</td>

									<!-- Type -->
									<td class="p-4 capitalize">
										{ACCOUNT_TYPE_LABELS[acc.accountType] || acc.accountType}
									</td>

									<!-- Normal Balance -->
									<td class="p-4 capitalize">
										{NORMAL_BALANCE_LABELS[acc.normalBalance] ||
											acc.normalBalance}
									</td>

									<!-- Control -->
									<td class="p-4 text-center">
										{#if acc.isControlAccount}
											<span
												class="inline-flex text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full dark:bg-amber-950/20 dark:text-amber-400"
												>Yes</span
											>
										{:else}
											<span class="text-muted-foreground/60">No</span>
										{/if}
									</td>

									<!-- Status -->
									<td class="p-4">
										<span
											class={[
												'inline-flex items-center gap-1 font-semibold rounded-full border text-[10px] px-2 py-0.5',
												acc.isActive
													? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800'
													: 'text-muted-foreground bg-muted border-border'
											].join(' ')}
										>
											{acc.isActive ? 'Active' : 'Inactive'}
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
