<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/api/api-client';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { Button } from '$lib/components/ui/button';
	import { toast } from '$lib/stores/toast';
	import { CreditCard, DollarSign, Clock, AlertTriangle, TrendingUp, Users, CheckCircle2, XCircle, RefreshCw, FileText } from 'lucide-svelte';

	let loading = $state(true);
	let activeTab = $state<'open' | 'partiallypaid' | 'closed' | 'overdue'>('open');

	let metrics = $state<any>(null);
	let receivables = $state<any[]>([]);
	let agingReport = $state<any>(null);

	async function loadCreditData() {
		loading = true;
		try {
			const [metricsRes, receivablesRes, agingRes] = await Promise.all([
				apiFetch<any>('api/receivables/dashboard').catch(() => null),
				apiFetch<any[]>(`api/receivables?status=${activeTab === 'overdue' ? 'open' : activeTab}`).catch(() => []),
				apiFetch<any>('api/receivables/aging').catch(() => null)
			]);

			metrics = metricsRes;
			receivables = receivablesRes || [];
			agingReport = agingRes;
		} catch (err) {
			console.error('Failed to load credit management data', err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadCreditData();
	});

	$effect(() => {
		const _ = activeTab;
		loadCreditData();
	});
</script>

<svelte:head>
	<title>Credit Management — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-xl font-bold text-foreground flex items-center gap-2">
				<CreditCard class="h-6 w-6 text-primary" />
				Credit Receivable Management
			</h1>
			<p class="text-xs text-muted-foreground mt-0.5">
				Enterprise Accounts Receivable tracking, multi-stage approval queue, and credit aging analytics.
			</p>
		</div>
		<div class="flex items-center gap-2">
			<Button variant="outline" class="h-8.5 text-xs rounded-xl" onclick={loadCreditData} disabled={loading}>
				<RefreshCw class={['h-3.5 w-3.5 mr-1.5', loading ? 'animate-spin' : ''].join(' ')} /> Reload Data
			</Button>
		</div>
	</div>

	<!-- Dashboard KPI Cards -->
	{#if metrics}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			<div class="bg-card border border-border/80 rounded-2xl p-4 shadow-xs space-y-1">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-semibold">Total Outstanding</span>
					<DollarSign class="h-4 w-4 text-amber-500" />
				</div>
				<p class="text-2xl font-extrabold font-mono text-foreground">
					<MoneyDisplay amount={metrics.totalOutstanding} currency="BHD" />
				</p>
				<span class="text-[10px] text-muted-foreground block">Active receivables balance</span>
			</div>

			<div class="bg-card border border-border/80 rounded-2xl p-4 shadow-xs space-y-1">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-semibold">Today's Collections</span>
					<TrendingUp class="h-4 w-4 text-emerald-500" />
				</div>
				<p class="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
					<MoneyDisplay amount={metrics.todaysCollections} currency="BHD" />
				</p>
				<span class="text-[10px] text-muted-foreground block">Total receipts recorded today</span>
			</div>

			<div class="bg-card border border-border/80 rounded-2xl p-4 shadow-xs space-y-1">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-semibold">Overdue Receivables</span>
					<AlertTriangle class="h-4 w-4 text-red-500" />
				</div>
				<p class="text-2xl font-extrabold font-mono text-red-600 dark:text-red-400">
					<MoneyDisplay amount={metrics.overdueReceivables} currency="BHD" />
				</p>
				<span class="text-[10px] text-muted-foreground block">Passed due date</span>
			</div>

			<div class="bg-card border border-border/80 rounded-2xl p-4 shadow-xs space-y-1">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-semibold">Days Sales Outstanding (DSO)</span>
					<Clock class="h-4 w-4 text-blue-500" />
				</div>
				<p class="text-2xl font-extrabold font-mono text-foreground">
					{metrics.dso} <span class="text-xs font-sans font-normal text-muted-foreground">Days</span>
				</p>
				<span class="text-[10px] text-emerald-600 font-semibold block">Collection Efficiency: {metrics.collectionPercentage}%</span>
			</div>
		</div>
	{/if}

	<!-- Credit Aging Summary Matrix -->
	{#if agingReport && agingReport.buckets}
		<div class="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-3">
			<h3 class="text-xs font-bold text-foreground uppercase tracking-wider">Credit Aging Matrix</h3>
			<div class="grid grid-cols-1 sm:grid-cols-5 gap-3">
				{#each agingReport.buckets as b}
					<div class="p-3 bg-muted/20 border border-border/40 rounded-xl space-y-1">
						<span class="text-[11px] font-bold text-muted-foreground uppercase">{b.bucketName}</span>
						<p class="text-base font-bold font-mono text-foreground">
							<MoneyDisplay amount={b.outstandingAmount} currency="BHD" />
						</p>
						<span class="text-[10px] text-muted-foreground block">{b.applicationCount} Applications ({b.collectionPercentage}%)</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Navigation Tabs & Queue -->
	<div class="space-y-4">
		<div class="border-b border-border/80">
			<nav class="flex gap-6">
				<button
					onclick={() => (activeTab = 'open')}
					class={['pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer', activeTab === 'open' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'].join(' ')}
				>
					Pending Credit
				</button>
				<button
					onclick={() => (activeTab = 'partiallypaid')}
					class={['pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer', activeTab === 'partiallypaid' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'].join(' ')}
				>
					Partially Paid
				</button>
				<button
					onclick={() => (activeTab = 'closed')}
					class={['pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer', activeTab === 'closed' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'].join(' ')}
				>
					Fully Paid (Closed)
				</button>
			</nav>
		</div>

		<!-- Receivables Table -->
		<div class="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xs">
			{#if loading}
				<div class="p-12 flex justify-center items-center">
					<RefreshCw class="h-6 w-6 text-primary animate-spin" />
				</div>
			{:else if receivables.length === 0}
				<div class="p-12 text-center text-muted-foreground text-xs space-y-2">
					<CheckCircle2 class="h-8 w-8 text-emerald-500 mx-auto" />
					<p class="font-semibold text-foreground">No credit receivables in this section</p>
					<p>All credit sales are fully processed or no items match the selected filter.</p>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs border-collapse">
						<thead>
							<tr class="bg-muted/40 border-b border-border/80 font-bold text-muted-foreground uppercase text-[10px]">
								<th class="px-4 py-3">Booking Reference</th>
								<th class="px-4 py-3">Module</th>
								<th class="px-4 py-3">Client Type</th>
								<th class="px-4 py-3 text-right">Total Amount</th>
								<th class="px-4 py-3 text-right">Outstanding</th>
								<th class="px-4 py-3">Status</th>
								<th class="px-4 py-3">Priority</th>
								<th class="px-4 py-3">Due Date</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/60">
							{#each receivables as r}
								<tr class="hover:bg-muted/30 transition-colors">
									<td class="px-4 py-3 font-mono font-bold text-primary">
										{r.bookingNumber}
									</td>
									<td class="px-4 py-3 capitalize font-medium">{r.bookingModule}</td>
									<td class="px-4 py-3 capitalize text-muted-foreground">{r.headType}</td>
									<td class="px-4 py-3 text-right font-mono font-bold text-foreground">
										<MoneyDisplay amount={r.totalAmount} currency="BHD" />
									</td>
									<td class="px-4 py-3 text-right font-mono font-bold text-red-600 dark:text-red-400">
										<MoneyDisplay amount={r.outstandingAmount} currency="BHD" />
									</td>
									<td class="px-4 py-3">
										<span class="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
											{r.status}
										</span>
									</td>
									<td class="px-4 py-3 font-semibold">
										<span class={['px-2 py-0.5 rounded-full text-[10px]', r.priority === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-muted text-muted-foreground'].join(' ')}>
											{r.priority}
										</span>
									</td>
									<td class="px-4 py-3 text-muted-foreground font-mono">
										{new Date(r.dueDate).toLocaleDateString()}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
</div>
