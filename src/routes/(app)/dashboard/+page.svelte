<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { currentUser, hasRole } from '$lib/stores/auth';
	import { apiFetch } from '$lib/api/api-client';
	import { getReconciliationSummary, getRecentTransactions } from '$features/dashboard/api';
	import type { ReconciliationSummary } from '$features/dashboard/types';
	import type { TransactionResponse } from '$features/financial-transactions/types';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import FinancialStatusBadge from '$lib/components/financial/FinancialStatusBadge.svelte';
	import TransactionTypeChip from '$lib/components/financial/TransactionTypeChip.svelte';
	import FinancialSummaryCard from '$lib/components/financial/FinancialSummaryCard.svelte';
	import FinancialTableSkeleton from '$lib/components/financial/FinancialTableSkeleton.svelte';
	import FinancialCardSkeleton from '$lib/components/financial/FinancialCardSkeleton.svelte';
	import FormattedNarrative from '$lib/components/financial/FormattedNarrative.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { Button } from '$lib/components/ui/button';
	import { addToast } from '$lib/stores/toast';
	import { approveExpense, rejectExpense } from '$features/expenses/api';
	import { RefreshCw, Landmark, Receipt, Users, Banknote, CheckSquare, Clock, ArrowRight, Check, X, User, Building2, Wallet, ArrowDownLeft, ArrowUpRight, ExternalLink, Briefcase, ShieldCheck } from 'lucide-svelte';
	import { DateDisplay } from '$lib/components';

	let summary: ReconciliationSummary | null = $state(null);
	let recentTransactions: TransactionResponse[] = $state([]);
	let pendingApprovals: any[] = $state([]);
	let pendingExpenses: any[] = $state([]);
	let pendingReceiptsCount = $state(0);
	let pendingSupplierPaymentsCount = $state(0);
	let loading = $state(true);
	let errorMsg: string | null = $state(null);
	let correlationId = $state('');
	let processingId = $state<string | number | null>(null);

	let abortController: AbortController | null = null;

	const totalPendingCount = $derived(pendingApprovals.length + pendingExpenses.length);

	async function loadDashboardData() {
		loading = true;
		errorMsg = null;
		correlationId = '';

		if (abortController) {
			abortController.abort();
		}
		abortController = new AbortController();

		try {
			const [summaryRes, transactionsRes, pendingRes, expensesRes, receiptsRes, supplierPaymentsRes] = await Promise.all([
				getReconciliationSummary(abortController.signal),
				getRecentTransactions(abortController.signal),
				hasRole('master_accountant') ? apiFetch<any[]>('api/pending-approvals?status=pending').catch(() => []) : Promise.resolve([]),
				hasRole('master_accountant') ? apiFetch<any[]>('api/Expenses').catch(() => []) : Promise.resolve([]),
				hasRole('normal_accountant') ? apiFetch<any>('api/sales-entries/receipts?pageSize=100').catch(() => null) : Promise.resolve(null),
				hasRole('normal_accountant') ? apiFetch<any>('api/supplier-payments/pending-count').catch(() => null) : Promise.resolve(null)
			]);

			summary = summaryRes;
			recentTransactions = transactionsRes;
			pendingApprovals = pendingRes || [];
			pendingExpenses = (expensesRes || []).filter((e: any) => (e.status || '').toLowerCase() === 'pendingapproval');

			if (supplierPaymentsRes && typeof supplierPaymentsRes.count === 'number') {
				pendingSupplierPaymentsCount = supplierPaymentsRes.count;
			}

			if (receiptsRes && receiptsRes.items) {
				pendingReceiptsCount = receiptsRes.items.filter((r: any) => (r.status || '').toLowerCase() === 'pending').length;
			}
		} catch (err: any) {
			if (err.name === 'AbortError') return;
			errorMsg = err.message || 'Failed to load dashboard data. Please try again.';
			correlationId = err.correlationId || '';
		} finally {
			loading = false;
		}
	}

	async function quickApprovePending(item: any) {
		processingId = `approval-${item.id}`;
		try {
			await apiFetch(`api/pending-approvals/${item.id}/approve`, { method: 'POST' });
			addToast(`Approved ${item.entityType.replace('_', ' ')} request.`, 'success');
			await loadDashboardData();
		} catch (err: any) {
			addToast(err.message || 'Approval failed.', 'error');
		} finally {
			processingId = null;
		}
	}

	async function quickRejectPending(item: any) {
		processingId = `approval-${item.id}`;
		try {
			await apiFetch(`api/pending-approvals/${item.id}/reject`, { method: 'POST' });
			addToast('Request rejected.', 'success');
			await loadDashboardData();
		} catch (err: any) {
			addToast(err.message || 'Rejection failed.', 'error');
		} finally {
			processingId = null;
		}
	}

	async function quickApproveExpense(exp: any) {
		processingId = `expense-${exp.id}`;
		try {
			await approveExpense(exp.id);
			addToast(`Payment voucher ${exp.expenseNumber} approved and posted.`, 'success');
			await loadDashboardData();
		} catch (err: any) {
			addToast(err.message || 'Expense approval failed.', 'error');
		} finally {
			processingId = null;
		}
	}

	onMount(() => {
		loadDashboardData();
	});

	onDestroy(() => {
		if (abortController) {
			abortController.abort();
		}
	});
</script>

<svelte:head>
	<title>Dashboard — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Welcome banner -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-bold text-foreground">Welcome back, {$currentUser?.name}</h1>
			<p class="text-xs text-muted-foreground">
				Accounts Portal dashboard overview and current liquidity indicators.
			</p>
		</div>
		<Button
			variant="outline"
			class="h-8.5 rounded-xl cursor-pointer self-start sm:self-auto flex items-center gap-1.5 text-xs font-semibold"
			onclick={loadDashboardData}
			disabled={loading}
		>
			<RefreshCw class={['h-3.5 w-3.5', loading ? 'animate-spin' : ''].join(' ')} />
			<span>Refresh</span>
		</Button>
	</div>

	{#if errorMsg}
		<ErrorState message={errorMsg} {correlationId} retryAction={loadDashboardData} />
	{:else}
		<!-- Metric stats grid -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			<FinancialSummaryCard
				label="Bank Balance"
				value={summary?.totalBankBalance ?? 0}
				subtitle="Total across active banks"
				tone="neutral"
				{loading}
			/>
			<FinancialSummaryCard
				label="Account Balance"
				value={summary?.totalAccountBalance ?? 0}
				subtitle="Total across active cash/credit accounts"
				tone="neutral"
				{loading}
			/>
			<FinancialSummaryCard
				label="Supplier Net Balance"
				value={summary?.totalSupplierNetBalance ?? 0}
				subtitle="Net standing (Surplus minus Payable)"
				tone={(summary?.totalSupplierNetBalance ?? 0) >= 0 ? 'positive' : 'negative'}
				{loading}
			/>
			<FinancialSummaryCard
				label="Supplier Payable (Debt)"
				value={summary?.totalSupplierPayableBalance ?? 0}
				subtitle="Total outstanding debt owed to suppliers"
				tone="negative"
				{loading}
			/>
		</div>

		<!-- Pending Receipts & Pending Supplier Payments Interactive Cards -->
		{#if hasRole('normal_accountant')}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
				<!-- Pending Receipts Card -->
				<div
					onclick={() => goto('/sales/receipts')}
					class="bg-card border border-border hover:border-emerald-500/50 rounded-xl p-3.5 shadow-xs flex items-center justify-between cursor-pointer transition-all hover:shadow-md group"
					role="button"
					tabindex="0"
					onkeydown={(e) => e.key === 'Enter' && goto('/sales/receipts')}
				>
					<div class="flex items-center gap-3 min-w-0">
						<div class="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg group-hover:scale-105 transition-transform shrink-0">
							<Receipt class="h-4.5 w-4.5" />
						</div>
						<div class="min-w-0">
							<div class="flex items-center gap-2">
								<h3 class="text-xs font-bold text-foreground group-hover:text-emerald-600 transition-colors truncate">
									Pending Receipts
								</h3>
								<span class="px-2 py-0.2 rounded-full text-[11px] font-extrabold bg-emerald-600 text-white shrink-0">
									{pendingReceiptsCount}
								</span>
							</div>
							<p class="text-[11px] text-muted-foreground truncate mt-0.5">
								{pendingReceiptsCount} unposted receipt{pendingReceiptsCount === 1 ? '' : 's'}
							</p>
						</div>
					</div>
					<div class="flex items-center text-xs font-semibold text-emerald-600 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
						<span>Manage</span>
						<ArrowRight class="h-3.5 w-3.5 ml-1" />
					</div>
				</div>

				<!-- Pending Supplier Payments Card -->
				<div
					onclick={() => goto('/suppliers/pending-payments')}
					class="bg-card border border-border hover:border-amber-500/50 rounded-xl p-3.5 shadow-xs flex items-center justify-between cursor-pointer transition-all hover:shadow-md group"
					role="button"
					tabindex="0"
					onkeydown={(e) => e.key === 'Enter' && goto('/suppliers/pending-payments')}
				>
					<div class="flex items-center gap-3 min-w-0">
						<div class="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg group-hover:scale-105 transition-transform shrink-0">
							<Building2 class="h-4.5 w-4.5" />
						</div>
						<div class="min-w-0">
							<div class="flex items-center gap-2">
								<h3 class="text-xs font-bold text-foreground group-hover:text-amber-600 transition-colors whitespace-nowrap">
									Operational Payments
								</h3>
								<span class="px-2 py-0.2 rounded-full text-[11px] font-extrabold bg-amber-600 text-white shrink-0">
									{pendingSupplierPaymentsCount}
								</span>
							</div>
							<p class="text-[11px] text-muted-foreground truncate mt-0.5">
								{pendingSupplierPaymentsCount} operational payment log{pendingSupplierPaymentsCount === 1 ? '' : 's'}
							</p>
						</div>
					</div>
					<div class="flex items-center text-xs font-semibold text-amber-600 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
						<span>Manage</span>
						<ArrowRight class="h-3.5 w-3.5 ml-1" />
					</div>
				</div>
			</div>
		{/if}

		<!-- Staff Management Section (Master Accountant) -->
		{#if hasRole('master_accountant')}
			<div class="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Users class="h-4 w-4 text-violet-600" />
						<h3 class="text-xs font-bold text-foreground uppercase tracking-wider">Portal Staff Administration</h3>
					</div>
					<span class="text-[10px] text-muted-foreground">Portal-Centric Management</span>
				</div>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
					<a
						href="/staffs/accounts"
						class="p-4 bg-muted/20 border border-blue-200/60 hover:border-blue-500/60 rounded-xl flex items-center justify-between group transition-all"
					>
						<div class="flex items-center gap-3">
							<div class="p-2.5 rounded-lg bg-blue-500/10 text-blue-600">
								<Building2 class="h-4 w-4" />
							</div>
							<div>
								<p class="text-xs font-bold text-foreground group-hover:text-blue-600 transition-colors">Accounts Staff</p>
								<p class="text-[10px] text-muted-foreground">Internal finance employees</p>
							</div>
						</div>
						<ArrowRight class="h-3.5 w-3.5 text-blue-600 group-hover:translate-x-0.5 transition-transform" />
					</a>

					<a
						href="/staffs/sales"
						class="p-4 bg-muted/20 border border-emerald-200/60 hover:border-emerald-500/60 rounded-xl flex items-center justify-between group transition-all"
					>
						<div class="flex items-center gap-3">
							<div class="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
								<Briefcase class="h-4 w-4" />
							</div>
							<div>
								<p class="text-xs font-bold text-foreground group-hover:text-emerald-600 transition-colors">Sales Staff</p>
								<p class="text-[10px] text-muted-foreground">Agency salesmen & representatives</p>
							</div>
						</div>
						<ArrowRight class="h-3.5 w-3.5 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
					</a>

					<a
						href="/staffs/operational"
						class="p-4 bg-muted/20 border border-purple-200/60 hover:border-purple-500/60 rounded-xl flex items-center justify-between group transition-all"
					>
						<div class="flex items-center gap-3">
							<div class="p-2.5 rounded-lg bg-purple-500/10 text-purple-600">
								<ShieldCheck class="h-4 w-4" />
							</div>
							<div>
								<p class="text-xs font-bold text-foreground group-hover:text-purple-600 transition-colors">Operational Staff</p>
								<p class="text-[10px] text-muted-foreground">Ops admins & section permissions</p>
							</div>
						</div>
						<ArrowRight class="h-3.5 w-3.5 text-purple-600 group-hover:translate-x-0.5 transition-transform" />
					</a>
				</div>
			</div>
		{/if}

		<!-- Master Accountant Pending Approvals Card Section -->
		{#if hasRole('master_accountant')}
			<div class="bg-card border border-amber-500/30 dark:border-amber-500/20 rounded-2xl p-5 shadow-xs space-y-4">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
					<div class="flex items-center gap-2.5">
						<div class="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
							<CheckSquare class="h-5 w-5" />
						</div>
						<div>
							<h2 class="text-sm font-bold text-foreground flex items-center gap-2">
								Pending Master Accountant Approvals
								{#if totalPendingCount > 0}
									<span class="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-500 text-white">
										{totalPendingCount}
									</span>
								{/if}
							</h2>
							<p class="text-xs text-muted-foreground">
								Entity registrations, payment headers, and payment vouchers awaiting your approval
							</p>
						</div>
					</div>

					<a
						href="/pending-approvals"
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold transition-colors cursor-pointer border border-amber-500/20 self-start sm:self-auto"
					>
						<span>Manage All Pending Approvals ({totalPendingCount})</span>
						<ArrowRight class="h-3.5 w-3.5" />
					</a>
				</div>

				{#if totalPendingCount === 0}
					<div class="py-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-1">
						<Clock class="h-6 w-6 text-muted-foreground/40" />
						<span class="font-semibold text-foreground">No Pending Approvals</span>
						<span>All submitted requests and payment vouchers are currently up to date.</span>
					</div>
				{:else}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
						<!-- Display up to 2 pending entity requests -->
						{#each pendingApprovals.slice(0, 2) as p (p.id)}
							{@const payload = JSON.parse(p.payloadJson || '{}')}
							<div class="p-3.5 bg-background border border-border rounded-xl flex items-center justify-between gap-3 text-xs">
								<div class="space-y-1 truncate">
									<div class="flex items-center gap-2">
										<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase tracking-wider">
											{p.entityType.replace('_', ' ')}
										</span>
										<span class="text-[10px] text-muted-foreground font-mono">#{p.id}</span>
									</div>
									<p class="font-bold text-foreground truncate">{payload.name || payload.Name || `${payload.firstName ?? ''} ${payload.lastName ?? ''}`.trim() || 'Request'}</p>
									<p class="text-[10px] text-muted-foreground">By {p.submittedByName}</p>
								</div>
								<div class="flex items-center gap-1 shrink-0">
									<button
										onclick={() => quickApprovePending(p)}
										disabled={processingId === `approval-${p.id}`}
										class="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold cursor-pointer disabled:opacity-50"
										title="Approve Request"
									>
										<Check class="h-3.5 w-3.5" />
									</button>
									<button
										onclick={() => quickRejectPending(p)}
										disabled={processingId === `approval-${p.id}`}
										class="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold cursor-pointer disabled:opacity-50"
										title="Reject Request"
									>
										<X class="h-3.5 w-3.5" />
									</button>
								</div>
							</div>
						{/each}

						<!-- Display up to 2 pending payment vouchers -->
						{#each pendingExpenses.slice(0, 2) as exp (exp.id)}
							<div class="p-3.5 bg-background border border-border rounded-xl flex items-center justify-between gap-3 text-xs">
								<div class="space-y-1 truncate">
									<div class="flex items-center gap-2">
										<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase tracking-wider">
											Payment Voucher
										</span>
										<span class="text-[10px] font-mono font-bold text-foreground">{exp.expenseNumber}</span>
									</div>
									<p class="font-bold text-foreground truncate">{exp.description}</p>
									<p class="text-[10px] text-muted-foreground font-bold text-emerald-600">
										<MoneyDisplay amount={exp.amount} />
									</p>
								</div>
								<div class="flex items-center gap-1 shrink-0">
									<button
										onclick={() => quickApproveExpense(exp)}
										disabled={processingId === `expense-${exp.id}`}
										class="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold cursor-pointer disabled:opacity-50"
										title="Approve Voucher"
									>
										<Check class="h-3.5 w-3.5" />
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Recent Transactions Section -->
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-bold text-foreground uppercase tracking-wider">
					Recent Transactions
				</h2>
				<a href="/transactions" class="text-xs font-semibold text-primary hover:underline">
					View All
				</a>
			</div>

			{#if loading}
				<!-- Desktop Skeleton -->
				<div
					class="hidden md:block bg-card border border-border rounded-2xl overflow-hidden"
				>
					<FinancialTableSkeleton rows={5} columns={6} />
				</div>
				<!-- Mobile Skeleton -->
				<div class="block md:hidden">
					<FinancialCardSkeleton count={3} />
				</div>
			{:else if recentTransactions.length === 0}
				<EmptyState
					title="No transactions found"
					description="There are no financial postings registered in this period."
					icon={Receipt}
				/>
			{:else}
				<!-- Desktop List (Table) -->
				<div
					class="hidden md:block bg-card border border-border rounded-2xl overflow-hidden shadow-xs"
				>
					<div class="overflow-x-auto">
						<table class="w-full text-left border-collapse text-xs">
							<thead>
								<tr
									class="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase text-[10px] tracking-wider"
								>
									<th class="p-3.5 w-24">Transaction</th>
									<th class="p-3.5 w-24">Type</th>
									<th class="p-3.5 w-52">Financial Flow</th>
									<th class="p-3.5">Narrative Explanation</th>
									<th class="p-3.5 w-32">Reference</th>
									<th class="p-3.5 w-32 text-right">Amount</th>
									<th class="p-3.5 w-28">Status</th>
									<th class="p-3.5 w-32">Audit</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60">
								{#each recentTransactions as tx (tx.id)}
									<tr
										class="hover:bg-muted/15 transition-colors cursor-pointer"
										onclick={() => goto(`/transactions/${tx.id}`)}
									>
										<!-- Col 1: Transaction ID & Date -->
										<td class="p-3.5 space-y-0.5">
											<span class="font-mono font-bold text-foreground block">{tx.documentNumber}</span>
											<span class="text-[10px] text-muted-foreground block">
												<DateDisplay value={tx.createdAt} />
											</span>
										</td>

										<!-- Col 2: Type Chip -->
										<td class="p-3.5">
											<TransactionTypeChip type={tx.transactionType} />
											<span class="block text-[10px] text-muted-foreground mt-1 capitalize font-medium">
												{tx.paymentMethodName || tx.paymentMethod}
											</span>
										</td>

										<!-- Col 3: Financial Flow (Visual Source -> Destination) -->
										<td class="p-3.5">
											<div class="space-y-1 text-[11px]">
												<div class="flex items-center gap-1.5 font-medium text-foreground">
													{#if tx.sourceParty}
														<User class="h-3 w-3 text-primary shrink-0" />
														<span class="truncate font-semibold">{tx.sourceParty.name}</span>
													{:else if tx.sourceBankName}
														<Building2 class="h-3 w-3 text-blue-500 shrink-0" />
														<span class="truncate font-semibold">{tx.sourceBankName}</span>
													{:else if tx.sourceAccountName}
														<Wallet class="h-3 w-3 text-amber-500 shrink-0" />
														<span class="truncate">{tx.sourceAccountName}</span>
													{:else}
														<span class="text-muted-foreground/70">Cash Drawer / Internal</span>
													{/if}
												</div>

												<div class="flex items-center gap-1 text-[10px] text-muted-foreground pl-0.5">
													<ArrowRight class="h-3 w-3 text-primary/70 shrink-0" />
													<span class="truncate font-mono">
														{#if tx.destinationParty}
															<strong class="text-foreground">{tx.destinationParty.name}</strong>
														{:else if tx.destinationBankName}
															<strong class="text-foreground">{tx.destinationBankName}</strong>
														{:else if tx.destinationAccountName}
															<strong class="text-foreground">{tx.destinationAccountName}</strong>
														{:else}
															<span>Accounts</span>
														{/if}
													</span>
												</div>
											</div>
										</td>

										<!-- Col 4: Narrative -->
										<td class="p-3.5 max-w-[280px]">
											<p class="line-clamp-2 text-[11px] leading-relaxed text-foreground font-medium">
												<FormattedNarrative text={tx.displayNarrative || tx.description || 'Standard posting.'} />
											</p>
										</td>

										<!-- Col 5: Reference -->
										<td class="p-3.5" onclick={(e) => e.stopPropagation()}>
											{#if tx.referenceDisplayName}
												{#if tx.referenceUrl}
													<a
														href={tx.referenceUrl}
														class="inline-flex items-center gap-1 text-[10px] font-mono font-semibold bg-muted hover:bg-muted/80 text-primary border border-border px-2 py-1 rounded-lg transition-colors"
													>
														<span>{tx.referenceDisplayName}</span>
														<ExternalLink class="h-2.5 w-2.5 shrink-0" />
													</a>
												{:else}
													<span class="font-mono text-[10px] bg-muted px-2 py-1 rounded-lg text-foreground font-semibold">
														{tx.referenceDisplayName}
													</span>
												{/if}
											{:else if tx.referenceId}
												<span class="font-mono text-[10px] text-muted-foreground">{tx.referenceId}</span>
											{:else}
												<span class="text-muted-foreground/50 text-[10px]">—</span>
											{/if}
										</td>

										<!-- Col 6: Amount -->
										<td class="p-3.5 text-right font-bold text-sm font-mono">
											<div class="flex items-center justify-end gap-1">
												{#if tx.transactionType === 'incoming'}
													<ArrowDownLeft class="h-3.5 w-3.5 text-emerald-500" />
													<span class="text-emerald-600 dark:text-emerald-400">
														<MoneyDisplay amount={tx.amount} />
													</span>
												{:else if tx.transactionType === 'outgoing'}
													<ArrowUpRight class="h-3.5 w-3.5 text-rose-500" />
													<span class="text-rose-600 dark:text-rose-400">
														<MoneyDisplay amount={tx.amount} />
													</span>
												{:else}
													<span class="text-foreground">
														<MoneyDisplay amount={tx.amount} />
													</span>
												{/if}
											</div>
										</td>

										<!-- Col 7: Status -->
										<td class="p-3.5">
											<FinancialStatusBadge status={tx.status} size="sm" />
										</td>

										<!-- Col 8: Audit Info -->
										<td class="p-3.5 space-y-0.5 text-[10px]">
											{#if tx.createdByName}
												<span class="block text-muted-foreground truncate">
													Posted by <strong class="text-foreground">{tx.createdByName}</strong>
												</span>
											{/if}
											{#if tx.status === 'approved' && tx.approvedByName}
												<span class="block text-emerald-600 dark:text-emerald-400 truncate">
													Approved by <strong>{tx.approvedByName}</strong>
												</span>
											{:else if tx.status === 'rejected' && tx.rejectedByName}
												<span class="block text-rose-600 dark:text-rose-400 truncate">
													Rejected by <strong>{tx.rejectedByName}</strong>
												</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>

				<!-- Mobile List (Cards) -->
				<div class="block md:hidden space-y-3">
					{#each recentTransactions as tx (tx.id)}
						<a
							href={`/transactions/${tx.id}`}
							class="block bg-card border border-border rounded-2xl p-4 space-y-3 hover:border-primary/40 active:bg-muted/5 transition-all text-left"
						>
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<TransactionTypeChip type={tx.transactionType} />
									<span class="font-mono font-bold text-xs text-foreground">{tx.documentNumber}</span>
								</div>
								<FinancialStatusBadge status={tx.status} size="sm" />
							</div>

							<p class="text-xs text-foreground font-medium line-clamp-2">
								<FormattedNarrative text={tx.displayNarrative || tx.description} />
							</p>

							<div class="flex items-center justify-between text-xs pt-2 border-t border-border/40">
								<span class="text-muted-foreground text-[11px]">
									<DateDisplay value={tx.createdAt} />
								</span>
								<div class="font-bold font-mono text-sm">
									{#if tx.transactionType === 'incoming'}
										<span class="text-emerald-600 dark:text-emerald-400">
											+<MoneyDisplay amount={tx.amount} />
										</span>
									{:else if tx.transactionType === 'outgoing'}
										<span class="text-rose-600 dark:text-rose-400">
											-<MoneyDisplay amount={tx.amount} />
										</span>
									{:else}
										<MoneyDisplay amount={tx.amount} />
									{/if}
								</div>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
