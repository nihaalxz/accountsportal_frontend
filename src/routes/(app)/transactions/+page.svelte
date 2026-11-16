<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { hasRole } from '$lib/stores/auth';
	import { getTransactions } from '$features/financial-transactions/api';
	import type { TransactionResponse } from '$features/financial-transactions/types';
	import {
		parseTransactionFilters,
		serializeTransactionFilters,
		hasActiveFilters,
		type TransactionFilters
	} from '$lib/utils/query-params';
	import {
		TRANSACTION_STATUS_VALUES,
		TRANSACTION_STATUS_CONFIG,
		TRANSACTION_TYPE_VALUES,
		TRANSACTION_TYPE_CONFIG,
		REFERENCE_TYPE_VALUES,
		REFERENCE_TYPE_LABELS
	} from '$lib/types/financial';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import FinancialStatusBadge from '$lib/components/financial/FinancialStatusBadge.svelte';
	import TransactionTypeChip from '$lib/components/financial/TransactionTypeChip.svelte';
	import FinancialTableSkeleton from '$lib/components/financial/FinancialTableSkeleton.svelte';
	import FinancialCardSkeleton from '$lib/components/financial/FinancialCardSkeleton.svelte';
	import FormattedNarrative from '$lib/components/financial/FormattedNarrative.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import TransactionApproveDialog from '$lib/components/TransactionApproveDialog.svelte';
	import { formatDateOnly, getBahrainDateString, getBahrainPresetRanges } from '$lib/formatters/date';
	import TransactionRejectDialog from '$lib/components/TransactionRejectDialog.svelte';
	import ConflictDialog from '$lib/components/ConflictDialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { DateDisplay } from '$lib/components';
	import { previewDocument } from '$lib/utils/preview-document';
	import { exportToCSV } from '$lib/utils/csv-exporter';
	import { toast } from '$lib/stores/toast';
	import {
		Search,
		X,
		ChevronLeft,
		ChevronRight,
		Check,
		Ban,
		Receipt,
		User,
		ArrowRight,
		ArrowUpRight,
		ArrowDownLeft,
		Building2,
		Wallet,
		ExternalLink,
		TrendingUp,
		TrendingDown,
		Clock,
		Layers,
		Download,
		FileText,
		Calendar
	} from 'lucide-svelte';

	// State
	let transactions = $state<TransactionResponse[]>([]);
	let loading = $state(true);
	let errorMsg = $state<string | null>(null);
	let correlationId = $state('');

	// Dialog states
	let selectedTxId = $state<number | null>(null);
	let approveDialogOpen = $state(false);
	let rejectDialogOpen = $state(false);
	let conflictDialogOpen = $state(false);

	// Active filters derived from page store URL
	let filters = $derived(parseTransactionFilters($page.url));

	// Local search input
	let searchInput = $state('');
	let searchTimeout: any;

	let abortController: AbortController | null = null;

	// Derived filtered transactions (combines server-side search and client-side instant matching)
	let filteredTransactions = $derived.by(() => {
		const term = searchInput.trim().toLowerCase();
		if (!term) return transactions;
		return transactions.filter(t => 
			(t.documentNumber && t.documentNumber.toLowerCase().includes(term)) ||
			(t.sourceParty?.name && t.sourceParty.name.toLowerCase().includes(term)) ||
			(t.destinationParty?.name && t.destinationParty.name.toLowerCase().includes(term)) ||
			(t.sourceBankName && t.sourceBankName.toLowerCase().includes(term)) ||
			(t.destinationBankName && t.destinationBankName.toLowerCase().includes(term)) ||
			(t.sourceAccountName && t.sourceAccountName.toLowerCase().includes(term)) ||
			(t.destinationAccountName && t.destinationAccountName.toLowerCase().includes(term)) ||
			(t.displayNarrative && t.displayNarrative.toLowerCase().includes(term)) ||
			(t.description && t.description.toLowerCase().includes(term)) ||
			(t.referenceDisplayName && t.referenceDisplayName.toLowerCase().includes(term)) ||
			(t.referenceId && t.referenceId.toLowerCase().includes(term)) ||
			(t.createdByName && t.createdByName.toLowerCase().includes(term)) ||
			(t.approvedByName && t.approvedByName.toLowerCase().includes(term)) ||
			(t.rejectedByName && t.rejectedByName.toLowerCase().includes(term)) ||
			(t.status && t.status.toLowerCase().includes(term)) ||
			(t.transactionType && t.transactionType.toLowerCase().includes(term))
		);
	});

	async function loadTransactions() {
		loading = true;
		errorMsg = null;
		correlationId = '';

		if (abortController) {
			abortController.abort();
		}
		abortController = new AbortController();

		try {
			const apiQuery = {
				status: filters.status || undefined,
				type: filters.type || undefined,
				referenceType: filters.referenceType || undefined,
				referenceId: filters.referenceId || undefined,
				search: searchInput.trim() || undefined,
				startDate: filters.startDate || undefined,
				endDate: filters.endDate || undefined,
				page: filters.page,
				pageSize: filters.pageSize
			};

			const res = await getTransactions(apiQuery, abortController.signal);
			transactions = res;
		} catch (err: any) {
			if (err.name === 'AbortError') return;
			errorMsg = err.message || 'Failed to load transactions.';
			correlationId = err.correlationId || '';
		} finally {
			loading = false;
		}
	}

	function updateFilters(newFilters: Partial<TransactionFilters>) {
		const merged = { ...filters, ...newFilters };
		if (newFilters.page === undefined) {
			merged.page = 1;
		}
		const params = serializeTransactionFilters(merged);
		const qs = params.toString();
		goto(`/transactions${qs ? `?${qs}` : ''}`, { keepFocus: true, noScroll: true });
	}

	function handleSearchInput(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		searchInput = val;

		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			loadTransactions();
		}, 350);
	}

	function clearFilters() {
		searchInput = '';
		goto('/transactions');
	}

	function refreshView() {
		loadTransactions();
	}

	function openApprove(id: number) {
		selectedTxId = id;
		approveDialogOpen = true;
	}

	function openReject(id: number) {
		selectedTxId = id;
		rejectDialogOpen = true;
	}

	$effect(() => {
		if (filters.referenceId !== searchInput && !searchInput) {
			searchInput = filters.referenceId || '';
		}
		loadTransactions();
	});

	// Export States
	let exportingCSV = $state(false);
	let exportingPDF = $state(false);

	function exportTransactionsCSV() {
		try {
			exportingCSV = true;
			const list = filteredTransactions;
			if (!list || list.length === 0) {
				toast.info('No transaction records available to export.');
				return;
			}

			const csvHeaders = [
				'Transaction ID / Doc No.',
				'Date',
				'Type',
				'Status',
				'Narrative & Details',
				'Source Channel / Party',
				'Destination Channel / Party',
				'Payment Channel',
				'Reference ID',
				'Amount (BHD)',
				'Created By',
				'Approved By'
			];

			const csvRows = list.map((t) => {
				const source = t.sourceBankName ? `Bank: ${t.sourceBankName}` : (t.sourceAccountName ? `Account: ${t.sourceAccountName}` : (t.sourceParty?.name || '-'));
				const dest = t.destinationBankName ? `Bank: ${t.destinationBankName}` : (t.destinationAccountName ? `Account: ${t.destinationAccountName}` : (t.destinationParty?.name || '-'));
				const narrative = t.displayNarrative || t.description || '-';
				const dateStr = formatDateOnly(t.createdAt);

				return [
					t.documentNumber || `TXSTRN-${t.id}`,
					dateStr,
					t.transactionType ? t.transactionType.toUpperCase() : 'TXN',
					t.status ? t.status.toUpperCase() : 'COMPLETED',
					narrative,
					source,
					dest,
					t.paymentMethod || 'Direct',
					t.referenceId || '',
					t.amount !== undefined ? t.amount.toFixed(3) : '0.000',
					t.createdByName || '',
					t.approvedByName || ''
				];
			});

			const fileName = `transactions_export_${getBahrainDateString()}.csv`;
			exportToCSV(fileName, csvHeaders, csvRows);
			toast.success('CSV statement exported successfully.');
		} catch (err: any) {
			console.error('Failed to export transactions CSV:', err);
			toast.error('Failed to export CSV: ' + (err?.message || 'Unknown error'));
		} finally {
			exportingCSV = false;
		}
	}

	async function exportTransactionsPDF() {
		try {
			exportingPDF = true;
			toast.info('Generating PDF with company logo...');
			await previewDocument('report', 'transactions', {
				status: filters.status || undefined,
				type: filters.type || undefined,
				referenceType: filters.referenceType || undefined,
				referenceId: filters.referenceId || undefined,
				search: searchInput.trim() || undefined,
				startDate: filters.startDate || undefined,
				endDate: filters.endDate || undefined
			});
		} catch (err: any) {
			console.error('Failed to generate transactions PDF:', err);
			toast.error('Failed to generate PDF: ' + (err?.message || 'Unknown error'));
		} finally {
			exportingPDF = false;
		}
	}

	onDestroy(() => {
		if (abortController) {
			abortController.abort();
		}
		clearTimeout(searchTimeout);
	});
</script>

<svelte:head>
	<title>Transactions | Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Top Bar -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl font-black tracking-tight text-foreground">Transactions</h1>
			<p class="text-xs text-muted-foreground mt-0.5 font-medium">
				Audit trail of all incoming collections, supplier settlements, and bank/cash movements
			</p>
		</div>

		<div class="flex items-center gap-2">
			<!-- Export CSV Button -->
			<Button
				variant="outline"
				class="rounded-2xl text-xs py-5 px-3.5 gap-2 border-border bg-card hover:bg-muted font-bold text-foreground cursor-pointer shadow-2xs"
				onclick={exportTransactionsCSV}
				disabled={exportingCSV || loading}
			>
				<Download class="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
				<span>{exportingCSV ? 'Exporting...' : 'Export CSV'}</span>
			</Button>

			<!-- Export PDF Button -->
			<Button
				variant="outline"
				class="rounded-2xl text-xs py-5 px-3.5 gap-2 border-border bg-card hover:bg-muted font-bold text-foreground cursor-pointer shadow-2xs"
				onclick={exportTransactionsPDF}
				disabled={exportingPDF}
			>
				<FileText class="h-4 w-4 text-primary" />
				<span>{exportingPDF ? 'Generating...' : 'Export PDF'}</span>
			</Button>
		</div>
	</div>

	<!-- Filter Controls & Search -->
	<div class="bg-card border border-border rounded-3xl p-5 shadow-xs space-y-4">
		<div class="grid grid-cols-1 md:grid-cols-4 gap-3">
			<!-- Universal Search -->
			<div class="relative md:col-span-2">
				<Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
				<input
					type="text"
					value={searchInput}
					oninput={handleSearchInput}
					placeholder="Search by doc #, ref #, description, customer..."
					class="w-full pl-9.5 pr-8 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
				/>
			</div>

			<!-- Status Filter Dropdown -->
			<select
				value={filters.status || ''}
				onchange={(e) => updateFilters({ status: ((e.target as HTMLSelectElement).value as any) || null })}
				class="w-full py-2.5 px-3 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium cursor-pointer"
			>
				<option value="">All Statuses</option>
				{#each TRANSACTION_STATUS_VALUES as st}
					<option value={st}>{TRANSACTION_STATUS_CONFIG[st].label}</option>
				{/each}
			</select>

			<!-- Type Filter Dropdown -->
			<select
				value={filters.type || ''}
				onchange={(e) => updateFilters({ type: ((e.target as HTMLSelectElement).value as any) || null })}
				class="w-full py-2.5 px-3 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium cursor-pointer"
			>
				<option value="">All Types</option>
				{#each TRANSACTION_TYPE_VALUES as ty}
					<option value={ty}>{TRANSACTION_TYPE_CONFIG[ty].label}</option>
				{/each}
			</select>
		</div>

		<!-- Date Range Filtering Row with Quick Presets -->
		<div class="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/40">
			<div class="flex flex-wrap items-center gap-2 text-xs">
				<Calendar class="h-3.5 w-3.5 text-muted-foreground" />
				<span class="font-bold text-muted-foreground text-[11px] uppercase tracking-wider">Date Range:</span>
				<input
					type="date"
					class="py-1 px-2.5 bg-background border border-border rounded-lg text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
					value={filters.startDate || ''}
					onchange={(e) => updateFilters({ startDate: (e.target as HTMLInputElement).value || null })}
				/>
				<span class="text-muted-foreground text-xs font-semibold">to</span>
				<input
					type="date"
					class="py-1 px-2.5 bg-background border border-border rounded-lg text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
					value={filters.endDate || ''}
					onchange={(e) => updateFilters({ endDate: (e.target as HTMLInputElement).value || null })}
				/>
			</div>

			<!-- Quick Date Presets in Bahrain Time -->
			<div class="flex items-center gap-1.5 text-[11px]">
				<button
					type="button"
					onclick={() => {
						const presets = getBahrainPresetRanges();
						updateFilters(presets.today);
					}}
					class="px-2.5 py-1 rounded-lg border border-border bg-muted/40 hover:bg-muted font-medium transition-colors cursor-pointer text-foreground"
				>
					Today
				</button>
				<button
					type="button"
					onclick={() => {
						const presets = getBahrainPresetRanges();
						updateFilters(presets.thisWeek);
					}}
					class="px-2.5 py-1 rounded-lg border border-border bg-muted/40 hover:bg-muted font-medium transition-colors cursor-pointer text-foreground"
				>
					This Week
				</button>
				<button
					type="button"
					onclick={() => {
						const presets = getBahrainPresetRanges();
						updateFilters(presets.thisMonth);
					}}
					class="px-2.5 py-1 rounded-lg border border-border bg-muted/40 hover:bg-muted font-medium transition-colors cursor-pointer text-foreground"
				>
					This Month
				</button>
			</div>
		</div>

		<!-- Active Filter Chips -->
		{#if hasActiveFilters(filters) || searchInput}
			<div class="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 text-[11px]">
				<span class="text-muted-foreground font-medium mr-1">Active filters:</span>
				{#if searchInput}
					<span class="inline-flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20 font-medium">
						Search: "{searchInput}"
						<button onclick={() => { searchInput = ''; loadTransactions(); }} class="hover:text-destructive shrink-0 cursor-pointer">
							<X class="h-3 w-3" />
						</button>
					</span>
				{/if}
				{#if filters.startDate || filters.endDate}
					<span class="inline-flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20 font-medium">
						Date: {filters.startDate || 'Start'} → {filters.endDate || 'End'}
						<button onclick={() => updateFilters({ startDate: null, endDate: null })} class="hover:text-destructive shrink-0 cursor-pointer">
							<X class="h-3 w-3" />
						</button>
					</span>
				{/if}
				{#if filters.status}
					<span class="inline-flex items-center gap-1 bg-muted px-2.5 py-1 rounded-full border border-border text-foreground">
						Status: {TRANSACTION_STATUS_CONFIG[filters.status].label}
						<button onclick={() => updateFilters({ status: null })} class="hover:text-destructive shrink-0 cursor-pointer">
							<X class="h-3 w-3" />
						</button>
					</span>
				{/if}
				{#if filters.type}
					<span class="inline-flex items-center gap-1 bg-muted px-2.5 py-1 rounded-full border border-border text-foreground">
						Type: {TRANSACTION_TYPE_CONFIG[filters.type]?.label || filters.type}
						<button onclick={() => updateFilters({ type: null })} class="hover:text-destructive shrink-0 cursor-pointer">
							<X class="h-3 w-3" />
						</button>
					</span>
				{/if}
				<button onclick={clearFilters} class="text-xs font-semibold text-primary hover:underline ml-auto cursor-pointer">
					Clear All
				</button>
			</div>
		{/if}
	</div>

	<!-- Results Table / Cards -->
	{#if errorMsg}
		<ErrorState message={errorMsg} {correlationId} retryAction={refreshView} />
	{:else if loading}
		<div class="hidden md:block bg-card border border-border rounded-2xl overflow-hidden">
			<FinancialTableSkeleton rows={filters.pageSize} columns={9} />
		</div>
		<div class="block md:hidden">
			<FinancialCardSkeleton count={4} />
		</div>
	{:else if transactions.length === 0}
		<EmptyState
			title="No transactions found"
			description="No matching transactions found. Adjust search terms or clear active filters."
			icon={Receipt}
		/>
	{:else}
		<!-- 9-Column Enterprise Audit Table -->
		<div class="hidden md:block bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
			<div class="overflow-x-auto">
				<table class="w-full text-left border-collapse text-xs">
					<thead>
						<tr class="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
							<th class="p-3.5 w-24">Transaction</th>
							<th class="p-3.5 w-24">Type</th>
							<th class="p-3.5 w-52">Financial Flow</th>
							<th class="p-3.5">Narrative Explanation</th>
							<th class="p-3.5 w-32">Reference</th>
							<th class="p-3.5 w-32 text-right">Amount</th>
							<th class="p-3.5 w-28">Status</th>
							<th class="p-3.5 w-32">Audit</th>
							<th class="p-3.5 w-28 text-right">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/60">
						{#each filteredTransactions as tx (tx.id)}
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
						target="_blank"
						rel="noopener noreferrer"
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

								<!-- Col 8: Audit -->
								<td class="p-3.5 space-y-0.5 text-[11px]">
									<div class="flex items-center gap-1 text-foreground font-medium">
										<User class="h-3 w-3 text-primary shrink-0" />
										<span class="truncate">{tx.createdByName || `User #${tx.createdBy}`}</span>
									</div>
									{#if tx.approvedByName}
										<div class="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
											<Check class="h-3 w-3 shrink-0" />
											<span class="truncate">{tx.approvedByName}</span>
										</div>
									{:else if tx.rejectedByName}
										<div class="flex items-center gap-1 text-[10px] text-rose-600 font-semibold">
											<Ban class="h-3 w-3 shrink-0" />
											<span class="truncate">{tx.rejectedByName}</span>
										</div>
									{/if}
								</td>

								<!-- Col 9: Actions -->
								<td class="p-3.5 text-right" onclick={(e) => e.stopPropagation()}>
									{#if tx.status === 'pending' && hasRole('master_accountant')}
										<div class="flex items-center justify-end gap-1.5">
											<button
												onclick={() => openApprove(tx.id)}
												class="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 cursor-pointer"
												title="Approve Transaction"
											>
												<Check class="h-3.5 w-3.5" />
											</button>
											<button
												onclick={() => openReject(tx.id)}
												class="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 cursor-pointer"
												title="Reject Transaction"
											>
												<Ban class="h-3.5 w-3.5" />
											</button>
										</div>
									{:else}
										<Button
											variant="ghost"
											size="xs"
											class="text-[11px] font-semibold text-primary"
											onclick={() => goto(`/transactions/${tx.id}`)}
										>
											Details
										</Button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Mobile Card View -->
		<div class="block md:hidden space-y-3">
			{#each filteredTransactions as tx (tx.id)}
				<a
					href={`/transactions/${tx.id}`}
					class="block bg-card border border-border rounded-2xl p-4 space-y-3 hover:border-primary/40 transition-all text-left shadow-xs"
				>
					<div class="flex items-center justify-between">
						<TransactionTypeChip type={tx.transactionType} />
						<span class="font-bold text-base font-mono">
							<MoneyDisplay amount={tx.amount} />
						</span>
					</div>

					<p class="text-xs text-foreground font-medium leading-relaxed">
						{tx.displayNarrative || tx.description}
					</p>

					<div class="flex items-center justify-between text-[11px] pt-2 border-t border-border/40 text-muted-foreground">
						<span class="font-mono font-semibold">{tx.documentNumber}</span>
						<FinancialStatusBadge status={tx.status} size="sm" />
					</div>
				</a>
			{/each}
		</div>

		<!-- Pagination Footer -->
		<div class="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
			<span class="text-[11px] text-muted-foreground font-medium">
				Page {filters.page} (Showing max {filters.pageSize} items)
			</span>
			<div class="flex items-center gap-4">
				<div class="flex items-center gap-2">
					<span class="text-xs text-muted-foreground whitespace-nowrap">Rows per page:</span>
					<select
						value={filters.pageSize}
						onchange={(e) => updateFilters({ pageSize: Number((e.target as HTMLSelectElement).value), page: 1 })}
						class="bg-background border border-border rounded-xl px-2.5 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
					>
						<option value={10}>10</option>
						<option value={20}>20</option>
						<option value={50}>50</option>
						<option value={100}>100</option>
						<option value={200}>200</option>
						<option value={500}>500</option>
						<option value={1000}>1000 (All)</option>
					</select>
				</div>
				<div class="flex items-center gap-1.5">
					<Button
						variant="outline"
						class="h-8.5 rounded-xl cursor-pointer p-3 font-semibold text-xs flex items-center gap-1"
					disabled={filters.page <= 1 || loading}
					onclick={() => updateFilters({ page: filters.page - 1 })}
					>
						<ChevronLeft class="h-3.5 w-3.5" />
						<span>Prev</span>
					</Button>
					<Button
						variant="outline"
						class="h-8.5 rounded-xl cursor-pointer p-3 font-semibold text-xs flex items-center gap-1"
					disabled={transactions.length < filters.pageSize || loading}
					onclick={() => updateFilters({ page: filters.page + 1 })}
					>
						<span>Next</span>
						<ChevronRight class="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Modal Dialogs -->
<TransactionApproveDialog
	transactionId={selectedTxId}
	bind:open={approveDialogOpen}
	onConfirm={refreshView}
/>

<TransactionRejectDialog
	transactionId={selectedTxId}
	bind:open={rejectDialogOpen}
	onConfirm={refreshView}
/>

<ConflictDialog bind:open={conflictDialogOpen} onReload={refreshView} />
