<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getExpenses } from '$features/expenses/api';
	import { getChartOfAccounts } from '$features/chart-of-accounts/api';
	import type { ExpenseResponse } from '$features/expenses/types';
	import type { ChartOfAccountResponse } from '$features/chart-of-accounts/types';
	import { EXPENSE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '$features/expenses/types';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import FinancialTableSkeleton from '$lib/components/financial/FinancialTableSkeleton.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { Button } from '$lib/components/ui/button';
	import { formatDateOnly } from '$lib/formatters/date';
	import { Wallet, Search, Filter, Plus } from 'lucide-svelte';

	let expenses = $state<ExpenseResponse[]>([]);
	let accounts = $state<ChartOfAccountResponse[]>([]);
	let loading = $state(true);
	let errorMsg = $state<string | null>(null);
	let correlationId = $state('');

	let searchVal = $state('');
	let statusFilter = $state('all');

	let abortController: AbortController | null = null;

	async function loadData() {
		if (abortController) abortController.abort();
		abortController = new AbortController();
		loading = true;
		errorMsg = null;
		correlationId = '';

		try {
			const [expList, coaList] = await Promise.all([
				getExpenses(abortController.signal),
				getChartOfAccounts(abortController.signal)
			]);
			expenses = expList.sort(
				(a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()
			);
			accounts = coaList;
		} catch (err: any) {
			if (err.name === 'AbortError') return;
			errorMsg = err.message || 'Failed to load expense records.';
			correlationId = err.correlationId || '';
		} finally {
			loading = false;
		}
	}

	// Lookup helper
	function getCategoryName(id: number): string {
		const acc = accounts.find((a) => a.id === id);
		return acc ? `${acc.code} - ${acc.name}` : `Category #${id}`;
	}

	// Filtered list
	const filteredExpenses = $derived(() => {
		let result = expenses;
		if (statusFilter !== 'all') {
			result = result.filter((e) => e.status === statusFilter);
		}
		if (searchVal.trim() !== '') {
			const query = searchVal.toLowerCase();
			result = result.filter(
				(e) =>
					e.expenseNumber.toLowerCase().includes(query) ||
					e.description.toLowerCase().includes(query)
			);
		}
		return result;
	});

	onMount(() => {
		loadData();
		return () => {
			if (abortController) abortController.abort();
		};
	});
</script>

<svelte:head>
	<title>Expense Management — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-bold text-foreground">Expense Claims</h1>
			<p class="text-xs text-muted-foreground">
				Record company expenses, reconcile petty cash payouts, and request master approval.
			</p>
		</div>
		<Button
			class="rounded-xl text-xs py-5 cursor-pointer font-semibold"
			onclick={() => goto('/expenses/new')}
		>
			<Plus class="h-3.5 w-3.5 mr-1" />
			Log Expense
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
				placeholder="Search by Expense Number or Description..."
				class="pl-9 h-10 w-full bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
				bind:value={searchVal}
			/>
		</div>
		<div class="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
			{#each ['all', 'draft', 'pendingapproval', 'approved', 'posted', 'rejected', 'cancelled', 'reversed'] as status}
				<button
					class={[
						'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap capitalize',
						statusFilter === status
							? 'bg-primary border-primary text-primary-foreground'
							: 'bg-background border-border text-muted-foreground hover:text-foreground'
					].join(' ')}
					onclick={() => (statusFilter = status)}
				>
					{EXPENSE_STATUS_LABELS[
						status as import('$features/expenses/types').ExpenseStatus
					] || status}
				</button>
			{/each}
		</div>
	</div>

	<!-- Main List -->
	{#if errorMsg}
		<ErrorState message={errorMsg} {correlationId} retryAction={loadData} />
	{:else}
		{#if loading}
			<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
				<FinancialTableSkeleton rows={5} columns={7} />
			</div>
		{:else if filteredExpenses().length === 0}
			<EmptyState
				title="No expense logs found"
				description="Track company operational costs by filing a new expense claim."
				icon={Wallet}
			/>
		{:else}
			<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
				<div class="overflow-x-auto">
					<table class="w-full min-w-[750px] text-left border-collapse text-xs">
						<thead>
							<tr
								class="bg-muted/30 border-b border-border text-muted-foreground font-semibold"
							>
								<th class="p-4 w-28">Expense No.</th>
								<th class="p-4 w-48">Expense Category</th>
								<th class="p-4">Description</th>
								<th class="p-4 w-32">Payment Method</th>
								<th class="p-4 w-32">Expense Date</th>
								<th class="p-4 w-28 text-right">Amount</th>
								<th class="p-4 w-24">Status</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/60">
							{#each filteredExpenses() as exp (exp.id)}
								<tr
									class="hover:bg-muted/10 transition-colors cursor-pointer"
									onclick={() => goto(`/expenses/${exp.id}`)}
								>
									<td class="p-4 font-mono font-medium text-muted-foreground"
										>{exp.expenseNumber}</td
									>
									<td
										class="p-4 font-semibold text-foreground truncate max-w-[200px]"
										title={getCategoryName(exp.expenseCategoryId)}
									>
										{getCategoryName(exp.expenseCategoryId)}
									</td>
									<td
										class="p-4 text-foreground truncate max-w-[250px]"
										title={exp.description}
									>
										{exp.description}
									</td>
									<td class="p-4 capitalize">
										{PAYMENT_METHOD_LABELS[exp.paymentMethod] ||
											exp.paymentMethod}
									</td>
									<td class="p-4"
										>{exp.expenseDate ? formatDateOnly(exp.expenseDate) : '—'}</td
									>
									<td class="p-4 text-right font-bold text-foreground">
										<MoneyDisplay amount={exp.amount} />
									</td>
									<td class="p-4">
										<span
											class={[
												'inline-flex items-center gap-1 font-semibold rounded-full border text-[10px] px-2 py-0.5 capitalize',
												exp.status === 'approved' || exp.status === 'posted'
													? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800'
													: exp.status === 'pendingapproval'
														? 'text-yellow-700 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-950/40 dark:border-yellow-800'
														: exp.status === 'rejected' ||
															  exp.status === 'cancelled' ||
															  exp.status === 'reversed'
															? 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/40 dark:border-rose-800'
															: 'text-muted-foreground bg-muted border-border'
											].join(' ')}
										>
											{EXPENSE_STATUS_LABELS[exp.status] || exp.status}
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
