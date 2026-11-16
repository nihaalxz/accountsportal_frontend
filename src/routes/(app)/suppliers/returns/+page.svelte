<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { hasRole } from '$lib/stores/auth';
	import { getTransactions } from '$features/financial-transactions/api';
	import type { TransactionResponse } from '$features/financial-transactions/types';
	import {
		TRANSACTION_STATUS_VALUES,
		TRANSACTION_STATUS_CONFIG
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
	import TransactionRejectDialog from '$lib/components/TransactionRejectDialog.svelte';
	import ConflictDialog from '$lib/components/ConflictDialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { DateDisplay } from '$lib/components';
	import { getBahrainPresetRanges, getBahrainDateString, formatDateOnly } from '$lib/formatters/date';
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
		Calendar,
		RotateCcw,
		Undo2,
		Plus
	} from 'lucide-svelte';

	// State
	let transactions = $state<TransactionResponse[]>([]);
	let loading = $state(true);
	let errorMsg = $state<string | null>(null);
	let correlationId = $state('');

	// Active tab: 'all' | 'purchasereturn' | 'salesreturn'
	let activeTab = $state<'all' | 'purchasereturn' | 'salesreturn'>('all');
	let statusFilter = $state<string>('');
	let startDate = $state<string>('');
	let endDate = $state<string>('');
	let searchInput = $state<string>('');
	let searchTimeout: any;

	// Dialog states
	let selectedTxId = $state<number | null>(null);
	let approveDialogOpen = $state(false);
	let rejectDialogOpen = $state(false);
	let conflictDialogOpen = $state(false);

	let abortController: AbortController | null = null;

	// Pagination state
	let currentPage = $state(1);
	let pageSize = $state(10);
	const pageSizeOptions = [10, 25, 50, 100, 200, 500, 1000];

	// Derived filtered items for search & instant filtering
	let filteredTransactions = $derived.by(() => {
		let list = transactions;

		// Tab filter
		if (activeTab === 'purchasereturn') {
			list = list.filter((t) => (t.transactionType || '').toLowerCase() === 'purchasereturn');
		} else if (activeTab === 'salesreturn') {
			list = list.filter((t) => (t.transactionType || '').toLowerCase() === 'salesreturn');
		}

		// Status filter
		if (statusFilter) {
			list = list.filter((t) => (t.status || '').toLowerCase() === statusFilter.toLowerCase());
		}

		// Search term matching
		const term = searchInput.trim().toLowerCase();
		if (!term) return list;

		return list.filter((t) =>
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
			(t.supplierName && t.supplierName.toLowerCase().includes(term)) ||
			(t.returnReason && t.returnReason.toLowerCase().includes(term)) ||
			(t.createdByName && t.createdByName.toLowerCase().includes(term)) ||
			(t.approvedByName && t.approvedByName.toLowerCase().includes(term)) ||
			(t.rejectedByName && t.rejectedByName.toLowerCase().includes(term))
		);
	});

	const totalRecords = $derived(filteredTransactions.length);
	const totalPages = $derived(Math.max(1, Math.ceil(totalRecords / pageSize)));

	const paginatedTransactions = $derived.by(() => {
		const start = (currentPage - 1) * pageSize;
		return filteredTransactions.slice(start, start + pageSize);
	});

	$effect(() => {
		if (currentPage > totalPages) {
			currentPage = totalPages;
		}
		if (currentPage < 1) {
			currentPage = 1;
		}
	});

	async function loadReturns() {
		loading = true;
		errorMsg = null;
		correlationId = '';

		if (abortController) {
			abortController.abort();
		}
		abortController = new AbortController();

		try {
			const typeParam = activeTab === 'all' ? 'returns' : activeTab;
			const apiQuery: any = {
				type: typeParam,
				status: statusFilter || undefined,
				startDate: startDate || undefined,
				endDate: endDate || undefined,
				search: searchInput.trim() || undefined,
				page: 1,
				pageSize: 500
			};

			const res = await getTransactions(apiQuery, abortController.signal);
			transactions = res;
		} catch (err: any) {
			if (err.name === 'AbortError') return;
			errorMsg = err.message || 'Failed to load returns data.';
			correlationId = err.correlationId || '';
		} finally {
			loading = false;
		}
	}

	function handleSearchInput(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		searchInput = val;
		currentPage = 1;

		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			loadReturns();
		}, 350);
	}

	function handleTabChange(tab: 'all' | 'purchasereturn' | 'salesreturn') {
		activeTab = tab;
		currentPage = 1;
		loadReturns();
	}

	function handleDatePreset(preset: 'today' | 'this_week' | 'this_month') {
		const presets = getBahrainPresetRanges();
		if (preset === 'today') {
			startDate = presets.today.startDate;
			endDate = presets.today.endDate;
		} else if (preset === 'this_week') {
			startDate = presets.thisWeek.startDate;
			endDate = presets.thisWeek.endDate;
		} else if (preset === 'this_month') {
			startDate = presets.thisMonth.startDate;
			endDate = presets.thisMonth.endDate;
		}
		currentPage = 1;
		loadReturns();
	}

	function clearAllFilters() {
		activeTab = 'all';
		statusFilter = '';
		startDate = '';
		endDate = '';
		searchInput = '';
		currentPage = 1;
		loadReturns();
	}

	function openApprove(id: number) {
		selectedTxId = id;
		approveDialogOpen = true;
	}

	function openReject(id: number) {
		selectedTxId = id;
		rejectDialogOpen = true;
	}

	function handleActionSuccess() {
		loadReturns();
	}

	// Export CSV
	let exportingCSV = $state(false);
	function exportReturnsCSV() {
		try {
			exportingCSV = true;
			const list = filteredTransactions;
			if (!list || list.length === 0) {
				toast.info('No returns records available to export.');
				return;
			}

			const csvHeaders = [
				'Document Number',
				'Date',
				'Return Type',
				'Status',
				'Narrative Explanation',
				'Source Channel / Party',
				'Destination Channel / Party',
				'Payment Method',
				'Reference ID',
				'Amount (BHD)',
				'Created By',
				'Approved By'
			];

			const csvRows = list.map((t) => {
				const source = t.sourceBankName ? `Bank: ${t.sourceBankName}` : (t.sourceAccountName ? `Account: ${t.sourceAccountName}` : (t.sourceParty?.name || '-'));
				const dest = t.destinationBankName ? `Bank: ${t.destinationBankName}` : (t.destinationAccountName ? `Account: ${t.destinationAccountName}` : (t.destinationParty?.name || '-'));
				const narrative = t.displayNarrative || t.description || '-';
				const dateStr = t.createdAt ? formatDateOnly(t.createdAt) : '';

				return [
					t.documentNumber || `TXSTRN-${t.id}`,
					dateStr,
					t.transactionType ? t.transactionType.toUpperCase() : 'RETURN',
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

			const fileName = `returns_export_${getBahrainDateString()}.csv`;
			exportToCSV(fileName, csvHeaders, csvRows);
			toast.success('Returns CSV exported successfully.');
		} catch (err: any) {
			console.error('Failed to export returns CSV:', err);
			toast.error('Failed to export CSV: ' + (err?.message || 'Unknown error'));
		} finally {
			exportingCSV = false;
		}
	}

	// Export PDF
	let exportingPDF = $state(false);
	async function exportReturnsPDF() {
		try {
			exportingPDF = true;
			toast.info('Generating Returns PDF with company logo...');
			const typeParam = activeTab === 'all' ? 'returns' : activeTab;
			await previewDocument('report', 'transactions', {
				type: typeParam,
				status: statusFilter || undefined,
				startDate: startDate || undefined,
				endDate: endDate || undefined,
				search: searchInput.trim() || undefined
			});
		} catch (err: any) {
			console.error('Failed to generate returns PDF:', err);
			toast.error('Failed to generate PDF: ' + (err?.message || 'Unknown error'));
		} finally {
			exportingPDF = false;
		}
	}

	onMount(() => {
		// Read initial query params from URL if any
		const urlParams = $page.url.searchParams;
		const typeParam = urlParams.get('type')?.toLowerCase();
		if (typeParam === 'purchasereturn') activeTab = 'purchasereturn';
		else if (typeParam === 'salesreturn') activeTab = 'salesreturn';

		const st = urlParams.get('status');
		if (st) statusFilter = st;

		const sd = urlParams.get('startDate') || urlParams.get('from');
		if (sd) startDate = sd;

		const ed = urlParams.get('endDate') || urlParams.get('to');
		if (ed) endDate = ed;

		loadReturns();
	});

	onDestroy(() => {
		if (abortController) abortController.abort();
		clearTimeout(searchTimeout);
	});
</script>

<svelte:head>
	<title>Sales Return and Purchase Return — Texas Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Title & Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex flex-col gap-1">
			<div class="flex items-center gap-2">
				<div class="p-2 rounded-xl bg-primary/10 text-primary">
					<RotateCcw class="h-5 w-5" />
				</div>
				<div>
					<h1 class="text-xl font-bold text-foreground font-sans">Sales Return and Purchase Return</h1>
					<p class="text-xs text-muted-foreground">
						Complete audit workspace for supplier purchase returns (incoming cash) and customer sales returns (outgoing refunds).
					</p>
				</div>
			</div>
		</div>
		<div class="flex items-center gap-2 shrink-0">
			<Button
				size="sm"
				class="h-9 rounded-xl text-xs font-semibold cursor-pointer shadow-xs bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
				onclick={() => goto('/suppliers/returns/record')}
			>
				<Plus class="h-3.5 w-3.5" />
				<span>Record Return</span>
			</Button>
			<Button
				variant="outline"
				size="sm"
				class="h-9 rounded-xl text-xs font-semibold cursor-pointer border-border shadow-xs hover:bg-muted/80 flex items-center gap-1.5"
				onclick={exportReturnsCSV}
				disabled={exportingCSV || filteredTransactions.length === 0}
			>
				<Download class={['h-3.5 w-3.5', exportingCSV ? 'animate-spin' : ''].join(' ')} />
				<span>{exportingCSV ? 'Exporting...' : 'Export CSV'}</span>
			</Button>
			<Button
				variant="outline"
				size="sm"
				class="h-9 rounded-xl text-xs font-semibold cursor-pointer border-border shadow-xs hover:bg-muted/80 flex items-center gap-1.5"
				onclick={exportReturnsPDF}
				disabled={exportingPDF || filteredTransactions.length === 0}
			>
				<FileText class={['h-3.5 w-3.5 text-primary', exportingPDF ? 'animate-spin' : ''].join(' ')} />
				<span>{exportingPDF ? 'Generating...' : 'Export PDF'}</span>
			</Button>
		</div>
	</div>

	<!-- Filter & Search Control Panel -->
	<div class="bg-card border border-border rounded-2xl p-4 space-y-4 shadow-xs">
		<!-- Top Row: Return Type Switcher Tabs & Status -->
		<div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
			<!-- Segmented Type Selector -->
			<div class="inline-flex p-1 bg-muted/60 rounded-xl border border-border">
				<button
					type="button"
					onclick={() => handleTabChange('all')}
					class={['px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer', activeTab === 'all' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'].join(' ')}
				>
					All Returns
				</button>
				<button
					type="button"
					onclick={() => handleTabChange('purchasereturn')}
					class={['px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5', activeTab === 'purchasereturn' ? 'bg-background text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-muted-foreground hover:text-foreground'].join(' ')}
				>
					<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
					Purchase Returns
				</button>
				<button
					type="button"
					onclick={() => handleTabChange('salesreturn')}
					class={['px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5', activeTab === 'salesreturn' ? 'bg-background text-rose-600 dark:text-rose-400 shadow-xs' : 'text-muted-foreground hover:text-foreground'].join(' ')}
				>
					<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
					Sales Returns
				</button>
			</div>

			<!-- Status Filter Dropdown -->
			<div class="flex items-center gap-2">
				<select
					value={statusFilter}
					onchange={(e) => { statusFilter = (e.target as HTMLSelectElement).value; loadReturns(); }}
					class="text-xs p-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground font-medium min-w-36"
				>
					<option value="">All Statuses</option>
					{#each TRANSACTION_STATUS_VALUES as st}
						<option value={st}>{TRANSACTION_STATUS_CONFIG[st].label}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Universal Search Input -->
		<div class="relative">
			<Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
			<input
				type="text"
				placeholder="Search by Document Number, Customer, Supplier, Reference ID, Bank, Account, Reason, or Narrative..."
				value={searchInput}
				oninput={handleSearchInput}
				class="w-full text-xs pl-9.5 pr-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder-muted-foreground/60 leading-relaxed font-medium"
			/>
		</div>

		<!-- Date Range Selection Row -->
		<div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60 text-xs">
			<div class="flex flex-wrap items-center gap-2">
				<div class="flex items-center gap-1.5 text-muted-foreground font-semibold">
					<Calendar class="h-3.5 w-3.5 text-primary" />
					<span>Date Range:</span>
				</div>
				<input
					type="date"
					class="h-8.5 bg-background border border-border rounded-xl px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					value={startDate}
					onchange={(e) => { startDate = (e.target as HTMLInputElement).value; loadReturns(); }}
					title="Start Date"
				/>
				<span class="text-muted-foreground font-medium">—</span>
				<input
					type="date"
					class="h-8.5 bg-background border border-border rounded-xl px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					value={endDate}
					onchange={(e) => { endDate = (e.target as HTMLInputElement).value; loadReturns(); }}
					title="End Date"
				/>
				{#if startDate || endDate}
					<button
						type="button"
						onclick={() => { startDate = ''; endDate = ''; loadReturns(); }}
						class="text-xs font-semibold text-destructive hover:underline ml-1.5 cursor-pointer"
					>
						Clear Date
					</button>
				{/if}
			</div>

			<!-- Quick Date Presets -->
			<div class="flex items-center gap-1.5 text-[11px]">
				<button
					type="button"
					onclick={() => handleDatePreset('today')}
					class="px-2.5 py-1 rounded-lg border border-border bg-muted/40 hover:bg-muted font-medium transition-colors cursor-pointer text-foreground"
				>
					Today
				</button>
				<button
					type="button"
					onclick={() => handleDatePreset('this_week')}
					class="px-2.5 py-1 rounded-lg border border-border bg-muted/40 hover:bg-muted font-medium transition-colors cursor-pointer text-foreground"
				>
					This Week
				</button>
				<button
					type="button"
					onclick={() => handleDatePreset('this_month')}
					class="px-2.5 py-1 rounded-lg border border-border bg-muted/40 hover:bg-muted font-medium transition-colors cursor-pointer text-foreground"
				>
					This Month
				</button>
			</div>
		</div>

		<!-- Active Filter Chips -->
		{#if searchInput || statusFilter || startDate || endDate || activeTab !== 'all'}
			<div class="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 text-[11px]">
				<span class="text-muted-foreground font-medium mr-1">Active filters:</span>
				{#if searchInput}
					<span class="inline-flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20 font-medium">
						Search: "{searchInput}"
						<button onclick={() => { searchInput = ''; loadReturns(); }} class="hover:text-destructive shrink-0 cursor-pointer">
							<X class="h-3 w-3" />
						</button>
					</span>
				{/if}
				{#if activeTab !== 'all'}
					<span class="inline-flex items-center gap-1 bg-muted px-2.5 py-1 rounded-full border border-border text-foreground font-medium">
						Type: {activeTab === 'purchasereturn' ? 'Purchase Returns' : 'Sales Returns'}
						<button onclick={() => handleTabChange('all')} class="hover:text-destructive shrink-0 cursor-pointer">
							<X class="h-3 w-3" />
						</button>
					</span>
				{/if}
				{#if statusFilter}
					<span class="inline-flex items-center gap-1 bg-muted px-2.5 py-1 rounded-full border border-border text-foreground">
						Status: {(TRANSACTION_STATUS_CONFIG as any)[statusFilter]?.label || statusFilter}
						<button onclick={() => { statusFilter = ''; loadReturns(); }} class="hover:text-destructive shrink-0 cursor-pointer">
							<X class="h-3 w-3" />
						</button>
					</span>
				{/if}
				{#if startDate || endDate}
					<span class="inline-flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20 font-medium">
						Date: {startDate || 'Start'} → {endDate || 'End'}
						<button onclick={() => { startDate = ''; endDate = ''; loadReturns(); }} class="hover:text-destructive shrink-0 cursor-pointer">
							<X class="h-3 w-3" />
						</button>
					</span>
				{/if}
				<button onclick={clearAllFilters} class="text-xs font-semibold text-primary hover:underline ml-auto cursor-pointer">
					Clear All
				</button>
			</div>
		{/if}
	</div>

	<!-- Results Table / Cards -->
	{#if errorMsg}
		<ErrorState message={errorMsg} {correlationId} retryAction={loadReturns} />
	{:else if loading}
		<div class="hidden md:block bg-card border border-border rounded-2xl overflow-hidden">
			<FinancialTableSkeleton rows={10} columns={9} />
		</div>
		<div class="block md:hidden space-y-3">
			<FinancialCardSkeleton count={5} />
		</div>
	{:else if filteredTransactions.length === 0}
		<div class="bg-card border border-border rounded-2xl p-6 text-center">
			<EmptyState
				title="No Return Records Found"
				description="No sales returns or purchase returns match your active filter criteria."
				actionLabel="Reset Filters"
				actionClick={clearAllFilters}
			/>
		</div>
	{:else}
		<!-- Desktop Audit Grid View -->
		<div class="hidden md:block bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
			<div class="overflow-x-auto">
				<table class="w-full text-left border-collapse text-xs">
					<thead>
						<tr class="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground select-none">
							<th class="py-3.5 px-4">Transaction</th>
							<th class="py-3.5 px-4">Type</th>
							<th class="py-3.5 px-4">Financial Flow</th>
							<th class="py-3.5 px-4">Narrative Explanation</th>
							<th class="py-3.5 px-4">Reference</th>
							<th class="py-3.5 px-4 text-right">Amount</th>
							<th class="py-3.5 px-4 text-center">Status</th>
							<th class="py-3.5 px-4">Audit</th>
							<th class="py-3.5 px-4 text-right">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/60">
						{#each paginatedTransactions as tx (tx.id)}
							<tr class="hover:bg-muted/30 transition-colors group">
								<!-- 1. Transaction Column -->
								<td class="py-3 px-4 font-mono font-medium text-foreground whitespace-nowrap">
									<a
										href="/transactions/{tx.id}"
										class="hover:text-primary hover:underline font-bold"
										title="View transaction #{tx.id} audit trail"
									>
										{tx.documentNumber || `TXSTRN${String(tx.id).padStart(6, '0')}`}
									</a>
									<div class="text-[10px] text-muted-foreground font-sans font-normal mt-0.5">
										<DateDisplay date={tx.createdAt} format="short" />
									</div>
								</td>

								<!-- 2. Type Column -->
								<td class="py-3 px-4 whitespace-nowrap">
									<div class="flex flex-col gap-0.5">
										<TransactionTypeChip type={tx.transactionType} />
										<span class="text-[10px] text-muted-foreground font-mono">
											{tx.paymentMethodName || tx.paymentMethod || 'Direct'}
										</span>
									</div>
								</td>

								<!-- 3. Financial Flow Column -->
								<td class="py-3 px-4 text-xs">
									<div class="flex flex-col gap-1">
										<!-- Source -->
										<div class="flex items-center gap-1.5 text-foreground font-medium">
											{#if tx.sourceBankName}
												<Building2 class="h-3.5 w-3.5 text-primary/70 shrink-0" />
												<span class="truncate max-w-[140px]" title={tx.sourceBankName}>{tx.sourceBankName}</span>
											{:else if tx.sourceAccountName}
												<Wallet class="h-3.5 w-3.5 text-primary/70 shrink-0" />
												<span class="truncate max-w-[140px]" title={tx.sourceAccountName}>{tx.sourceAccountName}</span>
											{:else if tx.sourceParty}
												<User class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
												<span class="truncate max-w-[140px]" title={tx.sourceParty.name}>{tx.sourceParty.name}</span>
											{:else if tx.supplierName}
												<User class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
												<span class="truncate max-w-[140px]" title={tx.supplierName}>{tx.supplierName}</span>
											{:else}
												<span class="text-muted-foreground">-</span>
											{/if}
										</div>

										<!-- Destination -->
										<div class="flex items-center gap-1 text-[11px] text-muted-foreground">
											<span class="text-primary font-bold">→</span>
											{#if tx.destinationBankName}
												<span class="truncate max-w-[140px]" title={tx.destinationBankName}>{tx.destinationBankName}</span>
											{:else if tx.destinationAccountName}
												<span class="truncate max-w-[140px]" title={tx.destinationAccountName}>{tx.destinationAccountName}</span>
											{:else if tx.destinationParty}
												<span class="truncate max-w-[140px]" title={tx.destinationParty.name}>{tx.destinationParty.name}</span>
											{:else if tx.recipientName}
												<span class="truncate max-w-[140px]" title={tx.recipientName}>{tx.recipientName}</span>
											{:else}
												<span class="text-muted-foreground">-</span>
											{/if}
										</div>
									</div>
								</td>

								<!-- 4. Narrative Explanation Column -->
								<td class="py-3 px-4 max-w-[240px]">
									<div class="text-xs text-foreground/90 line-clamp-2">
										<FormattedNarrative
											text={tx.displayNarrative || tx.description || tx.returnReason || ''}
										/>
									</div>
								</td>

								<!-- 5. Reference Column -->
								<td class="py-3 px-4 whitespace-nowrap">
									{#if tx.referenceId}
										<div class="flex flex-col gap-0.5">
											{#if tx.referenceUrl}
												<a
													href={tx.referenceUrl}
													class="inline-flex items-center gap-1 p-1 px-1.5 rounded-md bg-muted hover:bg-muted/80 text-foreground font-mono text-[11px] border border-border/60 transition-colors"
													title="Open operational reference details"
												>
													<span class="text-[9px] font-bold uppercase text-primary">
														{tx.referenceDisplayName || tx.referenceType || 'Ref'}
													</span>
													<span class="truncate max-w-[100px]">{tx.referenceId}</span>
													<ExternalLink class="h-2.5 w-2.5 text-muted-foreground" />
												</a>
											{:else}
												<div class="inline-flex items-center gap-1 p-1 px-1.5 rounded-md bg-muted text-foreground font-mono text-[11px] border border-border/60">
													<span class="text-[9px] font-bold uppercase text-primary">
														{tx.referenceDisplayName || tx.referenceType || 'Ref'}
													</span>
													<span class="truncate max-w-[100px]">{tx.referenceId}</span>
												</div>
											{/if}
										</div>
									{:else}
										<span class="text-muted-foreground text-xs">-</span>
									{/if}
								</td>

								<!-- 6. Amount Column -->
								<td class="py-3 px-4 text-right whitespace-nowrap">
									<div class="font-bold font-mono text-foreground text-sm">
										<MoneyDisplay amount={tx.amount} />
									</div>
								</td>

								<!-- 7. Status Column -->
								<td class="py-3 px-4 text-center whitespace-nowrap">
									<FinancialStatusBadge status={tx.status} />
								</td>

								<!-- 8. Audit Trail Column -->
								<td class="py-3 px-4 text-[11px] whitespace-nowrap text-muted-foreground">
									<div class="flex flex-col gap-0.5">
										{#if tx.createdByName}
											<div class="flex items-center gap-1">
												<User class="h-3 w-3 text-muted-foreground/70" />
												<span>{tx.createdByName}</span>
											</div>
										{/if}
										{#if tx.approvedByName}
											<div class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
												<Check class="h-3 w-3" />
												<span>{tx.approvedByName}</span>
											</div>
										{:else if tx.rejectedByName}
											<div class="flex items-center gap-1 text-destructive">
												<Ban class="h-3 w-3" />
												<span>{tx.rejectedByName}</span>
											</div>
										{/if}
									</div>
								</td>

								<!-- 9. Actions Column -->
								<td class="py-3 px-4 text-right whitespace-nowrap">
									<div class="flex items-center justify-end gap-1.5">
										<a
											href="/transactions/{tx.id}"
											class="text-xs font-semibold text-primary hover:underline px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
										>
											Details
										</a>

										{#if tx.status === 'pending' && hasRole('master_accountant')}
											<Button
												variant="ghost"
												size="sm"
												class="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg cursor-pointer"
												title="Quick Approve"
												onclick={() => openApprove(tx.id)}
											>
												<Check class="h-3.5 w-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												class="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer"
												title="Quick Reject"
												onclick={() => openReject(tx.id)}
											>
												<Ban class="h-3.5 w-3.5" />
											</Button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination Bar for Desktop Table -->
			<div class="p-3.5 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground bg-muted/10">
				<div class="flex items-center gap-2">
					<span>
						Showing <strong class="text-foreground">{(currentPage - 1) * pageSize + 1}</strong> to <strong class="text-foreground">{Math.min(currentPage * pageSize, totalRecords)}</strong> of <strong class="text-foreground">{totalRecords}</strong> return{totalRecords === 1 ? '' : 's'}
					</span>
					<select
						bind:value={pageSize}
						onchange={() => currentPage = 1}
						class="h-7 px-2 bg-background border border-border rounded-lg text-xs text-foreground cursor-pointer font-semibold"
					>
						{#each pageSizeOptions as opt}
							<option value={opt}>{opt} / page</option>
						{/each}
					</select>
				</div>

				<div class="flex items-center gap-1.5">
					<button
						type="button"
						disabled={currentPage <= 1}
						onclick={() => currentPage = 1}
						class="h-7.5 px-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center transition-colors"
						title="First Page"
					>
						<span>«</span>
					</button>
					<button
						type="button"
						disabled={currentPage <= 1}
						onclick={() => currentPage--}
						class="h-7.5 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1 transition-colors"
					>
						<ChevronLeft class="h-3.5 w-3.5" />
						<span>Prev</span>
					</button>
					<span class="px-2 font-semibold text-foreground">
						Page {currentPage} of {totalPages}
					</span>
					<button
						type="button"
						disabled={currentPage >= totalPages}
						onclick={() => currentPage++}
						class="h-7.5 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1 transition-colors"
					>
						<span>Next</span>
						<ChevronRight class="h-3.5 w-3.5" />
					</button>
					<button
						type="button"
						disabled={currentPage >= totalPages}
						onclick={() => currentPage = totalPages}
						class="h-7.5 px-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center transition-colors"
						title="Last Page"
					>
						<span>»</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Mobile Card Stack View -->
		<div class="block md:hidden space-y-3">
			{#each paginatedTransactions as tx (tx.id)}
				<div class="bg-card border border-border rounded-2xl p-4 space-y-3 shadow-xs">
					<div class="flex items-start justify-between gap-2">
						<div>
							<a
								href="/transactions/{tx.id}"
								class="font-mono font-bold text-sm text-foreground hover:text-primary hover:underline"
							>
								{tx.documentNumber || `TXSTRN${String(tx.id).padStart(6, '0')}`}
							</a>
							<div class="text-xs text-muted-foreground">
								<DateDisplay date={tx.createdAt} format="short" />
							</div>
						</div>
						<FinancialStatusBadge status={tx.status} />
					</div>

					<div class="flex items-center justify-between py-2 border-y border-border/50 text-xs">
						<TransactionTypeChip type={tx.transactionType} />
						<div class="font-bold font-mono text-sm text-foreground">
							<MoneyDisplay amount={tx.amount} />
						</div>
					</div>

					{#if tx.displayNarrative || tx.description || tx.returnReason}
						<div class="text-xs text-foreground/80 line-clamp-2">
							{tx.displayNarrative || tx.description || tx.returnReason}
						</div>
					{/if}

					<div class="flex items-center justify-between pt-1">
						<span class="text-[11px] text-muted-foreground font-mono">
							By: {tx.createdByName || 'System'}
						</span>
						<a
							href="/transactions/{tx.id}"
							class="text-xs font-semibold text-primary hover:underline"
						>
							View Full Audit Trail →
						</a>
					</div>
				</div>
			{/each}

			<!-- Mobile Pagination Controls -->
			<div class="p-3 bg-card border border-border rounded-2xl flex flex-col gap-2.5 text-xs text-muted-foreground">
				<div class="flex items-center justify-between">
					<span>
						Showing <strong>{(currentPage - 1) * pageSize + 1}</strong>-<strong>{Math.min(currentPage * pageSize, totalRecords)}</strong> of <strong>{totalRecords}</strong>
					</span>
					<select
						bind:value={pageSize}
						onchange={() => currentPage = 1}
						class="h-7 px-2 bg-background border border-border rounded-lg text-xs text-foreground font-semibold"
					>
						{#each pageSizeOptions as opt}
							<option value={opt}>{opt} / page</option>
						{/each}
					</select>
				</div>
				<div class="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
					<button
						type="button"
						disabled={currentPage <= 1}
						onclick={() => currentPage--}
						class="h-8 px-3 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:pointer-events-none font-semibold flex items-center gap-1"
					>
						<ChevronLeft class="h-3.5 w-3.5" /> Prev
					</button>
					<span class="font-semibold text-foreground">
						Page {currentPage} of {totalPages}
					</span>
					<button
						type="button"
						disabled={currentPage >= totalPages}
						onclick={() => currentPage++}
						class="h-8 px-3 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:pointer-events-none font-semibold flex items-center gap-1"
					>
						Next <ChevronRight class="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Modal Dialogs for Pending Quick Actions -->
{#if selectedTxId !== null}
	<TransactionApproveDialog
		bind:open={approveDialogOpen}
		transactionId={selectedTxId}
		onConfirm={handleActionSuccess}
	/>

	<TransactionRejectDialog
		bind:open={rejectDialogOpen}
		transactionId={selectedTxId}
		onConfirm={handleActionSuccess}
	/>
{/if}

<ConflictDialog bind:open={conflictDialogOpen} onReload={handleActionSuccess} />
