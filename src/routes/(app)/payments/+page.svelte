<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { getExpenses, getExpenseHeaders, getExpenseSummary } from '$features/expenses/api';
	import type { ExpenseResponse, ExpenseHeaderResponse, ExpenseSummaryResponse } from '$features/expenses/types';
	import { EXPENSE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '$features/expenses/types';
	import { hasRole } from '$lib/stores/auth';
	import { getSupplierPayments, getSuppliers, approveSupplierPayment, rejectSupplierPayment } from '$features/suppliers/api';
	import type { SupplierPaymentResponse, SupplierResponse } from '$features/suppliers/types';
	import { getAccounts } from '$features/cash-accounts/api';
	import type { AccountResponse } from '$features/cash-accounts/types';
	import { getBanks } from '$features/bank-accounts/api';
	import type { BankResponse } from '$features/bank-accounts/types';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import FinancialTableSkeleton from '$lib/components/financial/FinancialTableSkeleton.svelte';
	import FinancialStatusBadge from '$lib/components/financial/FinancialStatusBadge.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { Button } from '$lib/components/ui/button';
	import { previewDocument } from '$lib/utils/preview-document';
	import { toast } from '$lib/stores/toast';
	import { exportToCSV } from '$lib/utils/csv-exporter';
	import { formatDateOnly, getBahrainDateString } from '$lib/formatters/date';
	import {
		Wallet,
		Search,
		Filter,
		Plus,
		FileSpreadsheet,
		FileDown,
		Calendar,
		RotateCcw,
		Tag,
		CreditCard,
		Building2,
		Receipt,
		ArrowUpRight,
		ArrowDownLeft,
		Landmark,
		Coins,
		Clock,
		CheckCircle2,
		XCircle,
		ExternalLink,
		Check,
		X
	} from 'lucide-svelte';

	// Primary Tab: 'expenses' (General & Operational) | 'supplier' (Supplier Payments & Settlements)
	let activePaymentTab = $state<'expenses' | 'supplier'>('expenses');

	// Operational Expenses Data
	let expenses = $state<ExpenseResponse[]>([]);
	let headers = $state<ExpenseHeaderResponse[]>([]);
	let summary = $state<ExpenseSummaryResponse | null>(null);

	// Supplier Payments Data
	let supplierPayments = $state<SupplierPaymentResponse[]>([]);
	let suppliers = $state<SupplierResponse[]>([]);
	let cashAccounts = $state<AccountResponse[]>([]);
	let bankAccounts = $state<BankResponse[]>([]);

	let loading = $state(true);
	let errorMsg = $state<string | null>(null);
	let correlationId = $state('');

	// Operational Expenses Filters
	let searchVal = $state('');
	let statusFilter = $state('all');
	let categoryFilter = $state('all');
	let headerFilter = $state('all');
	let startDate = $state('');
	let endDate = $state('');

	// Supplier Payments Filters
	let supSearchVal = $state('');
	let supStatusFilter = $state('all');
	let supPurposeFilter = $state('all');
	let supSupplierFilter = $state('all');
	let supStartDate = $state('');
	let supEndDate = $state('');

	let abortController: AbortController | null = null;

	async function loadData() {
		if (abortController) abortController.abort();
		abortController = new AbortController();
		loading = true;
		errorMsg = null;
		correlationId = '';

		try {
			const [expList, headersList, summaryData, spList, supList, cashList, bankList] = await Promise.all([
				getExpenses(abortController.signal).catch(() => []),
				getExpenseHeaders(abortController.signal).catch(() => []),
				getExpenseSummary(abortController.signal).catch(() => null),
				getSupplierPayments({}, abortController.signal).catch(() => []),
				getSuppliers(abortController.signal).catch(() => []),
				getAccounts(abortController.signal).catch(() => []),
				getBanks(abortController.signal).catch(() => [])
			]);

			expenses = (Array.isArray(expList) ? expList : []).sort(
				(a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()
			);
			headers = Array.isArray(headersList) ? headersList : [];
			summary = summaryData;

			const rawSpList = Array.isArray(spList) ? spList : [];
			supplierPayments = rawSpList
				.filter(isTreasurySupplierPayment)
				.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
			suppliers = Array.isArray(supList) ? supList : [];
			cashAccounts = (Array.isArray(cashList) ? cashList : (cashList as any)?.items || []).filter((a: any) => a.isActive);
			bankAccounts = (Array.isArray(bankList) ? bankList : (bankList as any)?.items || []).filter((b: any) => b.isActive);
		} catch (err: any) {
			if (err.name === 'AbortError') return;
			errorMsg = err.message || 'Failed to load payments history.';
			correlationId = err.correlationId || '';
		} finally {
			loading = false;
		}
	}

	// Filtered list of headers for the Category Name dropdown
	const availableHeaders = $derived(() => {
		if (categoryFilter === 'all') {
			return headers;
		}
		return headers.filter((h) => {
			return h.category.toLowerCase() === categoryFilter.toLowerCase() ||
				(categoryFilter.toLowerCase() === 'expenses' && h.category.toLowerCase() === 'expense');
		});
	});

	// Filtered list of expenses
	const filteredExpenses = $derived(() => {
		let result = expenses;

		if (statusFilter !== 'all') {
			result = result.filter((e) => e.status === statusFilter);
		}

		if (categoryFilter !== 'all') {
			result = result.filter((e) => {
				const h = headers.find((x) => x.id === e.expenseCategoryId);
				if (!h) return false;
				return h.category.toLowerCase() === categoryFilter.toLowerCase() ||
					(categoryFilter.toLowerCase() === 'expenses' && h.category.toLowerCase() === 'expense');
			});
		}

		if (headerFilter !== 'all') {
			result = result.filter((e) => String(e.expenseCategoryId) === String(headerFilter));
		}

		if (startDate) {
			const start = new Date(startDate).getTime();
			result = result.filter((e) => new Date(e.expenseDate).getTime() >= start);
		}

		if (endDate) {
			const end = new Date(endDate).getTime() + 86400000;
			result = result.filter((e) => new Date(e.expenseDate).getTime() < end);
		}

		if (searchVal.trim() !== '') {
			const query = searchVal.toLowerCase();
			result = result.filter((e) => {
				const headerName = headers.find((x) => x.id === e.expenseCategoryId)?.name.toLowerCase() || '';
				return e.expenseNumber.toLowerCase().includes(query) ||
					e.description.toLowerCase().includes(query) ||
					headerName.includes(query);
			});
		}

		return result;
	});

	function resetFilters() {
		statusFilter = 'all';
		categoryFilter = 'all';
		headerFilter = 'all';
		startDate = '';
		endDate = '';
		searchVal = '';
	}

	function handleBucketCardClick(bucket: string) {
		if (categoryFilter === bucket) {
			categoryFilter = 'all';
		} else {
			categoryFilter = bucket;
		}
		headerFilter = 'all';
	}

	// ── Treasury Supplier Payments (Top-up, Credit Settlement, Advance, Refund) ────
	export function getSupplierPaymentPurpose(sp: SupplierPaymentResponse): {
		key: 'wallet' | 'credit' | 'advance' | 'refund';
		label: string;
		sublabel: string;
		badgeClass: string;
	} | null {
		const rawType = (sp.serviceType || '').toLowerCase().replace(/[-_]/g, '').trim();
		const desc = (sp.description || '').toLowerCase().trim();

		// Explicit booking services (e.g. flight, hotel, visa, package, transport, etc.) -> EXCLUDE
		const isBookingService =
			rawType.includes('flight') ||
			rawType.includes('hotel') ||
			rawType.includes('visa') ||
			rawType.includes('holiday') ||
			rawType.includes('package') ||
			rawType.includes('transport') ||
			rawType.includes('vfs') ||
			rawType.includes('activity') ||
			rawType.includes('insurance');

		if (isBookingService) {
			return null;
		}

		// 1. Credit Debt Settlement
		if (
			rawType.includes('credit') ||
			desc.includes('settling credit') ||
			desc.includes('credit debt') ||
			desc.includes('credit settlement')
		) {
			return {
				key: 'credit',
				label: 'Credit Settlement',
				sublabel: 'Debt Clearance',
				badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
			};
		}

		// 2. Advance Payment
		if (rawType.includes('advance') || desc.includes('advance')) {
			return {
				key: 'advance',
				label: 'Advance Payment',
				sublabel: 'Supplier Advance',
				badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20'
			};
		}

		// 3. Supplier Refund
		if (rawType.includes('refund') || desc.includes('refund')) {
			return {
				key: 'refund',
				label: 'Supplier Refund',
				sublabel: 'Returned Funds',
				badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
			};
		}

		// 4. Wallet Top-up
		if (
			rawType.includes('wallet') ||
			desc.includes('top-up') ||
			desc.includes('topup') ||
			desc.includes('wallet top-up') ||
			desc.includes('wallet')
		) {
			return {
				key: 'wallet',
				label: 'Wallet Top-up',
				sublabel: 'Prepaid Wallet',
				badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
			};
		}

		return null;
	}

	export function isTreasurySupplierPayment(sp: SupplierPaymentResponse): boolean {
		return getSupplierPaymentPurpose(sp) !== null;
	}

	function getSupplierPaymentChannel(sp: SupplierPaymentResponse): string {
		const pm = (sp.paymentMethod || '').toLowerCase();
		let base = pm === 'bank' || pm === 'bank_transfer' ? 'Bank' : pm === 'cash' ? 'Cash' : pm === 'credit' ? 'Credit' : pm === 'wallet' || pm === 'supplier_wallet' ? 'Wallet' : pm;

		if (sp.sourceBankName) return `${base} (${sp.sourceBankName})`;
		if (sp.sourceAccountName) return `${base} (${sp.sourceAccountName})`;

		if (sp.sourceBankId) {
			const b = bankAccounts.find((x) => x.id === sp.sourceBankId);
			if (b) return `${base} (${b.bankName})`;
		}
		if (sp.sourceAccountId) {
			const a = cashAccounts.find((x) => x.id === sp.sourceAccountId);
			if (a) return `${base} (${a.name})`;
		}
		return base;
	}

	const supplierPaymentStats = $derived.by(() => {
		let totalCount = supplierPayments.length;
		let totalAmount = 0;
		let walletCount = 0;
		let walletAmount = 0;
		let creditCount = 0;
		let creditAmount = 0;
		let advanceCount = 0;
		let advanceAmount = 0;
		let refundCount = 0;
		let refundAmount = 0;
		let pendingCount = 0;
		let pendingAmount = 0;

		for (const sp of supplierPayments) {
			totalAmount += sp.amount;
			const purpose = getSupplierPaymentPurpose(sp);
			if (purpose?.key === 'wallet') {
				walletCount++;
				walletAmount += sp.amount;
			} else if (purpose?.key === 'credit') {
				creditCount++;
				creditAmount += sp.amount;
			} else if (purpose?.key === 'advance') {
				advanceCount++;
				advanceAmount += sp.amount;
			} else if (purpose?.key === 'refund') {
				refundCount++;
				refundAmount += sp.amount;
			}

			if ((sp.status || '').toLowerCase() === 'pending') {
				pendingCount++;
				pendingAmount += sp.amount;
			}
		}

		return {
			all: { count: totalCount, amount: totalAmount },
			wallet: { count: walletCount, amount: walletAmount },
			credit: { count: creditCount, amount: creditAmount },
			advance: { count: advanceCount, amount: advanceAmount },
			refund: { count: refundCount, amount: refundAmount },
			pending: { count: pendingCount, amount: pendingAmount }
		};
	});

	const filteredSupplierPayments = $derived(() => {
		let result = supplierPayments;

		if (supStatusFilter !== 'all') {
			result = result.filter((p) => (p.status || '').toLowerCase() === supStatusFilter.toLowerCase());
		}

		if (supPurposeFilter !== 'all') {
			result = result.filter((p) => {
				const purpose = getSupplierPaymentPurpose(p);
				return purpose?.key === supPurposeFilter;
			});
		}

		if (supSupplierFilter !== 'all') {
			result = result.filter((p) => String(p.supplierId) === String(supSupplierFilter));
		}

		if (supStartDate) {
			const start = new Date(supStartDate).getTime();
			result = result.filter((p) => new Date(p.createdAt).getTime() >= start);
		}

		if (supEndDate) {
			const end = new Date(supEndDate).getTime() + 86400000;
			result = result.filter((p) => new Date(p.createdAt).getTime() < end);
		}

		if (supSearchVal.trim() !== '') {
			const query = supSearchVal.toLowerCase().trim();
			result = result.filter((p) => {
				const sup = suppliers.find((s) => s.id === p.supplierId);
				const supName = (sup?.name || '').toLowerCase();
				const supCode = (sup?.code || '').toLowerCase();
				const docNo = (p.documentNumber || '').toLowerCase();
				const refNo = (p.referenceNumber || '').toLowerCase();
				const extRef = (p.externalReference || '').toLowerCase();
				const desc = (p.description || '').toLowerCase();
				const idStr = String(p.id);

				return (
					idStr.includes(query) ||
					docNo.includes(query) ||
					supName.includes(query) ||
					supCode.includes(query) ||
					refNo.includes(query) ||
					extRef.includes(query) ||
					desc.includes(query)
				);
			});
		}

		return result;
	});

	let processingSpId = $state<number | null>(null);

	async function handleApproveSupplierPayment(sp: SupplierPaymentResponse, e?: MouseEvent) {
		if (e) e.stopPropagation();
		if (!confirm(`Are you sure you want to approve this supplier payment of BHD ${sp.amount.toFixed(3)}?`)) return;

		processingSpId = sp.id;
		try {
			await approveSupplierPayment(sp.id, sp.rowVersion || undefined);
			toast.success('Supplier payment approved successfully.');
			await loadData();
		} catch (err: any) {
			toast.error(err.message || 'Failed to approve supplier payment.');
		} finally {
			processingSpId = null;
		}
	}

	async function handleRejectSupplierPayment(sp: SupplierPaymentResponse, e?: MouseEvent) {
		if (e) e.stopPropagation();
		const reason = prompt('Please enter a rejection reason:');
		if (reason === null) return;
		if (!reason.trim()) {
			toast.error('Rejection reason is required.');
			return;
		}

		processingSpId = sp.id;
		try {
			await rejectSupplierPayment(sp.id, reason.trim());
			toast.success('Supplier payment rejected.');
			await loadData();
		} catch (err: any) {
			toast.error(err.message || 'Failed to reject supplier payment.');
		} finally {
			processingSpId = null;
		}
	}

	function resetSupplierFilters() {
		supSearchVal = '';
		supStatusFilter = 'all';
		supPurposeFilter = 'all';
		supSupplierFilter = 'all';
		supStartDate = '';
		supEndDate = '';
	}

	function handleSupplierPurposeCardClick(purposeKey: string) {
		if (supPurposeFilter === purposeKey) {
			supPurposeFilter = 'all';
		} else {
			supPurposeFilter = purposeKey;
		}
	}

	function handleSupplierPendingCardClick() {
		if (supStatusFilter === 'pending') {
			supStatusFilter = 'all';
		} else {
			supStatusFilter = 'pending';
		}
	}

	// Exports CSV (Client Side)
	function exportCSV() {
		const list = filteredExpenses();
		if (list.length === 0) return;

		const csvHeaders = ['Payment Number', 'Category Name (Header)', 'Category Bucket', 'Description', 'Payment Channel', 'Date', 'Amount (BHD)', 'Status'];
		const csvRows = list.map(row => {
			const h = headers.find((x) => x.id === row.expenseCategoryId);
			const catName = h?.name || 'Uncategorized';
			const catType = h?.category || 'Expenses';
			return [
				row.expenseNumber,
				catName,
				catType,
				row.description,
				PAYMENT_METHOD_LABELS[row.paymentMethod] || row.paymentMethod,
				row.expenseDate ? formatDateOnly(row.expenseDate) : '',
				row.amount,
				EXPENSE_STATUS_LABELS[row.status] || row.status
			];
		});

		exportToCSV('Expenses_Export_' + getBahrainDateString() + '.csv', csvHeaders, csvRows);
		toast.success('CSV exported successfully.');
	}

	function exportSupplierCSV() {
		const list = filteredSupplierPayments();
		if (list.length === 0) return;

		const csvHeaders = [
			'Payment ID',
			'Document Number',
			'Supplier Code',
			'Supplier Name',
			'Purpose',
			'Payment Channel',
			'Reference #',
			'Description',
			'Date',
			'Amount (BHD)',
			'Status'
		];

		const csvRows = list.map((p) => {
			const sup = suppliers.find((s) => s.id === p.supplierId);
			const purpose = getSupplierPaymentPurpose(p);
			const channel = getSupplierPaymentChannel(p);
			return [
				p.id,
				p.documentNumber || `TXSPAY-${p.id}`,
				sup?.code || '',
				sup?.name || `Supplier #${p.supplierId}`,
				purpose?.label || 'Settlement',
				channel,
				p.referenceNumber || '',
				p.description || '',
				p.createdAt ? formatDateOnly(p.createdAt) : '',
				p.amount,
				p.status
			];
		});

		exportToCSV('Supplier_Payments_Export_' + getBahrainDateString() + '.csv', csvHeaders, csvRows);
		toast.success('Supplier payments exported successfully.');
	}

	function exportPDF() {
		const selectedHeader = headers.find((h) => String(h.id) === String(headerFilter));
		previewDocument('report', 'payments', {
			status: statusFilter,
			category: categoryFilter,
			headerId: headerFilter !== 'all' ? headerFilter : undefined,
			headerName: selectedHeader ? selectedHeader.name : undefined,
			startDate,
			endDate,
			searchVal
		});
		toast.info('Generating print document...');
	}

	onMount(() => {
		const tabParam = $page.url.searchParams.get('tab');
		if (tabParam === 'supplier' || tabParam === 'suppliers') {
			activePaymentTab = 'supplier';
		}

		loadData();
		return () => {
			if (abortController) abortController.abort();
		};
	});

	function getBucketBadgeStyle(cat: string): { bg: string; label: string } {
		const norm = (cat || '').toLowerCase();
		if (norm === 'income') {
			return { bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', label: 'Income' };
		}
		if (norm === 'asset') {
			return { bg: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30', label: 'Asset' };
		}
		if (norm === 'liability') {
			return { bg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', label: 'Liability' };
		}
		if (norm === 'capital') {
			return { bg: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30', label: 'Capital' };
		}
		if (norm === 'contra') {
			return { bg: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30', label: 'Contra' };
		}
		return { bg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30', label: 'Expenses' };
	}
</script>

<svelte:head>
	<title>Payments & Settlements — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-bold text-foreground">Payments & Settlements</h1>
			<p class="text-xs text-muted-foreground">
				Record operational expenses, supplier wallet top-ups, debt settlements, advance disbursements, and audit payouts.
			</p>
		</div>
		<div class="flex items-center gap-2">
			{#if activePaymentTab === 'expenses'}
				<Button
					variant="outline"
					class="rounded-xl text-xs py-5 cursor-pointer font-semibold"
					onclick={() => goto('/payments/expenses/create-header')}
				>
					<Plus class="h-3.5 w-3.5 mr-1" />
					Create Header
				</Button>
			{/if}
			<Button
				class="rounded-xl text-xs py-5 cursor-pointer font-semibold"
				onclick={() => goto(activePaymentTab === 'supplier' ? '/payments/new?tab=supplier' : '/payments/new')}
			>
				<Plus class="h-3.5 w-3.5 mr-1" />
				Log Payment
			</Button>
		</div>
	</div>

	<!-- Primary Navigation Switcher: Operational Expenses vs Supplier Payments -->
	<div class="flex items-center gap-2 p-1.5 bg-card border border-border rounded-2xl w-fit shadow-xs">
		<button
			type="button"
			class={[
				'px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2',
				activePaymentTab === 'expenses'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'text-muted-foreground hover:text-foreground'
			].join(' ')}
			onclick={() => (activePaymentTab = 'expenses')}
		>
			<Receipt class="h-4 w-4" />
			<span>General & Operational</span>
			<span class={[
				'px-1.5 py-0.5 rounded-md text-[10px] font-mono',
				activePaymentTab === 'expenses' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
			].join(' ')}>
				{expenses.length}
			</span>
		</button>

		<button
			type="button"
			class={[
				'px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2',
				activePaymentTab === 'supplier'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'text-muted-foreground hover:text-foreground'
			].join(' ')}
			onclick={() => (activePaymentTab = 'supplier')}
		>
			<CreditCard class="h-4 w-4" />
			<span>Supplier Settlements & Top-ups</span>
			<span class={[
				'px-1.5 py-0.5 rounded-md text-[10px] font-mono',
				activePaymentTab === 'supplier' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold'
			].join(' ')}>
				{supplierPayments.length}
			</span>
		</button>
	</div>

	<!-- ═══════════════════════════════════════════════════════════════════════════════ -->
	<!-- TAB 1: OPERATIONAL & GENERAL EXPENSES                                            -->
	<!-- ═══════════════════════════════════════════════════════════════════════════════ -->
	{#if activePaymentTab === 'expenses'}
		<!-- Dashboard Summary Card Grid (Clickable) -->
		{#if summary}
			<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
				<!-- All categories -->
				<button
					type="button"
					onclick={() => handleBucketCardClick('all')}
					class={[
						'bg-card border rounded-2xl p-4 space-y-2 shadow-xs relative overflow-hidden group text-left cursor-pointer transition-all',
						categoryFilter === 'all' ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border hover:border-border/80'
					].join(' ')}
				>
					<div class="absolute top-0 left-0 w-1 h-full bg-primary"></div>
					<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">All Categories</span>
					<div class="flex items-baseline justify-between">
						<span class="text-lg font-bold text-foreground">{summary.all.count}</span>
						<span class="text-xs font-semibold text-muted-foreground"><MoneyDisplay amount={summary.all.totalAmount} /></span>
					</div>
				</button>

				<!-- Asset -->
				<button
					type="button"
					onclick={() => handleBucketCardClick('Asset')}
					class={[
						'bg-card border rounded-2xl p-4 space-y-2 shadow-xs relative overflow-hidden group text-left cursor-pointer transition-all',
						categoryFilter === 'Asset' ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/5' : 'border-border hover:border-border/80'
					].join(' ')}
				>
					<div class="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
					<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Asset</span>
					<div class="flex items-baseline justify-between">
						<span class="text-lg font-bold text-foreground">{summary.asset.count}</span>
						<span class="text-xs font-semibold text-muted-foreground"><MoneyDisplay amount={summary.asset.totalAmount} /></span>
					</div>
				</button>

				<!-- Liability -->
				<button
					type="button"
					onclick={() => handleBucketCardClick('Liability')}
					class={[
						'bg-card border rounded-2xl p-4 space-y-2 shadow-xs relative overflow-hidden group text-left cursor-pointer transition-all',
						categoryFilter === 'Liability' ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5' : 'border-border hover:border-border/80'
					].join(' ')}
				>
					<div class="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
					<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Liability</span>
					<div class="flex items-baseline justify-between">
						<span class="text-lg font-bold text-foreground">{summary.liability.count}</span>
						<span class="text-xs font-semibold text-muted-foreground"><MoneyDisplay amount={summary.liability.totalAmount} /></span>
					</div>
				</button>

				<!-- Income -->
				<button
					type="button"
					onclick={() => handleBucketCardClick('Income')}
					class={[
						'bg-card border rounded-2xl p-4 space-y-2 shadow-xs relative overflow-hidden group text-left cursor-pointer transition-all',
						categoryFilter === 'Income' ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5' : 'border-border hover:border-border/80'
					].join(' ')}
				>
					<div class="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
					<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Income</span>
					<div class="flex items-baseline justify-between">
						<span class="text-lg font-bold text-foreground">{summary.income.count}</span>
						<span class="text-xs font-semibold text-muted-foreground"><MoneyDisplay amount={summary.income.totalAmount} /></span>
					</div>
				</button>

				<!-- Capital -->
				<button
					type="button"
					onclick={() => handleBucketCardClick('Capital')}
					class={[
						'bg-card border rounded-2xl p-4 space-y-2 shadow-xs relative overflow-hidden group text-left cursor-pointer transition-all',
						categoryFilter === 'Capital' ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-500/5' : 'border-border hover:border-border/80'
					].join(' ')}
				>
					<div class="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
					<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Capital</span>
					<div class="flex items-baseline justify-between">
						<span class="text-lg font-bold text-foreground">{summary.capital.count}</span>
						<span class="text-xs font-semibold text-muted-foreground"><MoneyDisplay amount={summary.capital.totalAmount} /></span>
					</div>
				</button>

				<!-- Expenses -->
				<button
					type="button"
					onclick={() => handleBucketCardClick('Expenses')}
					class={[
						'bg-card border rounded-2xl p-4 space-y-2 shadow-xs relative overflow-hidden group text-left cursor-pointer transition-all',
						categoryFilter === 'Expenses' ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/5' : 'border-border hover:border-border/80'
					].join(' ')}
				>
					<div class="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
					<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expenses</span>
					<div class="flex items-baseline justify-between">
						<span class="text-lg font-bold text-foreground">{summary.expenses.count}</span>
						<span class="text-xs font-semibold text-muted-foreground"><MoneyDisplay amount={summary.expenses.totalAmount} /></span>
					</div>
				</button>

				<!-- Contra -->
				{#if (summary as any)?.contra}
					<button
						type="button"
						onclick={() => handleBucketCardClick('Contra')}
						class={[
							'bg-card border rounded-2xl p-4 space-y-2 shadow-xs relative overflow-hidden group text-left cursor-pointer transition-all',
							categoryFilter === 'Contra' ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-500/5' : 'border-border hover:border-border/80'
						].join(' ')}
					>
						<div class="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
						<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contra</span>
						<div class="flex items-baseline justify-between">
							<span class="text-lg font-bold text-foreground">{(summary as any).contra.count}</span>
							<span class="text-xs font-semibold text-muted-foreground"><MoneyDisplay amount={(summary as any).contra.totalAmount} /></span>
						</div>
					</button>
				{/if}
			</div>
		{/if}

		<!-- Filters & Search -->
		<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-4">
			<!-- Search & Status filter -->
			<div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
				<div class="relative flex-1">
					<Search class="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
					<input
						type="text"
						placeholder="Search by Payment #, Description, or Category Name..."
						class="pl-9 h-10 w-full bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
						bind:value={searchVal}
					/>
				</div>
				<div class="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
					{#each ['all', 'pendingapproval', 'approved', 'rejected'] as status}
						<button
							class={[
								'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap capitalize',
								statusFilter === status
									? 'bg-primary border-primary text-primary-foreground'
									: 'bg-background border-border text-muted-foreground hover:text-foreground'
							].join(' ')}
							onclick={() => (statusFilter = status)}
						>
							{EXPENSE_STATUS_LABELS[status as import('$features/expenses/types').ExpenseStatus] || status}
						</button>
					{/each}
				</div>
			</div>

			<!-- Date range, Category Bucket, Category Name Filters -->
			<div class="flex flex-wrap items-center gap-3 pt-3 border-t border-border/60 text-xs">
				<div class="flex items-center gap-2">
					<Calendar class="h-3.5 w-3.5 text-muted-foreground" />
					<span class="font-medium text-muted-foreground">Date Range:</span>
					<input
						type="date"
						class="h-8 bg-background border border-border rounded-lg px-2 text-[11px] text-foreground focus:outline-none cursor-pointer"
						bind:value={startDate}
					/>
					<span class="text-muted-foreground">—</span>
					<input
						type="date"
						class="h-8 bg-background border border-border rounded-lg px-2 text-[11px] text-foreground focus:outline-none cursor-pointer"
						bind:value={endDate}
					/>
				</div>

				<!-- Category Bucket Dropdown -->
				<div class="flex items-center gap-2">
					<Filter class="h-3.5 w-3.5 text-muted-foreground" />
					<span class="font-medium text-muted-foreground">Bucket:</span>
					<select
						class="h-8 bg-background border border-border rounded-lg px-2 text-[11px] text-foreground focus:outline-none cursor-pointer"
						bind:value={categoryFilter}
						onchange={() => (headerFilter = 'all')}
					>
						<option value="all">All Buckets</option>
						<option value="Asset">Asset</option>
						<option value="Liability">Liability</option>
						<option value="Income">Income</option>
						<option value="Capital">Capital</option>
						<option value="Expenses">Expenses</option>
						<option value="Contra">Contra</option>
					</select>
				</div>

				<!-- Category Name (Header) Dropdown -->
				<div class="flex items-center gap-2">
					<Tag class="h-3.5 w-3.5 text-muted-foreground" />
					<span class="font-medium text-muted-foreground">Category Name:</span>
					<select
						class="h-8 bg-background border border-border rounded-lg px-2 text-[11px] text-foreground focus:outline-none cursor-pointer max-w-[220px]"
						bind:value={headerFilter}
					>
						<option value="all">All Category Names ({availableHeaders().length})</option>
						{#each availableHeaders() as h}
							<option value={String(h.id)}>
								{h.name} {categoryFilter === 'all' ? '(' + h.category + ')' : ''}
							</option>
						{/each}
					</select>
				</div>

				<!-- Reset Filters Button -->
				{#if statusFilter !== 'all' || categoryFilter !== 'all' || headerFilter !== 'all' || startDate || endDate || searchVal}
					<Button
						variant="ghost"
						size="sm"
						class="h-8 px-2 text-[11px] text-muted-foreground hover:text-foreground rounded-lg cursor-pointer flex items-center gap-1"
						onclick={resetFilters}
					>
						<RotateCcw class="h-3 w-3" />
						Reset
					</Button>
				{/if}

				<div class="flex items-center gap-2 ml-auto">
					<Button
						variant="outline"
						size="sm"
						class="h-8 rounded-lg text-[11px] cursor-pointer"
						onclick={exportCSV}
						disabled={filteredExpenses().length === 0}
					>
						<FileSpreadsheet class="h-3.5 w-3.5 mr-1 text-emerald-600" />
						Export CSV
					</Button>
					<Button
						variant="outline"
						size="sm"
						class="h-8 rounded-lg text-[11px] cursor-pointer"
						onclick={exportPDF}
						disabled={filteredExpenses().length === 0}
					>
						<FileDown class="h-3.5 w-3.5 mr-1 text-blue-600" />
						Export PDF
					</Button>
				</div>
			</div>
		</div>

		<!-- Main Operational Expenses List -->
		{#if errorMsg}
			<ErrorState message={errorMsg} {correlationId} retryAction={loadData} />
		{:else}
			{#if loading}
				<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
					<FinancialTableSkeleton rows={5} columns={8} />
				</div>
			{:else if filteredExpenses().length === 0}
				<EmptyState
					title="No operational payments found"
					description="No records match the current category name, bucket, date, or status filter."
					icon={Wallet}
				/>
			{:else}
				<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
					<div class="overflow-x-auto">
						<table class="w-full min-w-[850px] text-left border-collapse text-xs">
							<thead>
								<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold">
									<th class="p-4 w-28">Payment No.</th>
									<th class="p-4 w-24">Direction</th>
									<th class="p-4 w-40">Category Name</th>
									<th class="p-4 w-32">Category Bucket</th>
									<th class="p-4">Description</th>
									<th class="p-4 w-28">Payment Method</th>
									<th class="p-4 w-28">Date</th>
									<th class="p-4 w-28 text-right">Amount</th>
									<th class="p-4 w-24">Status</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60">
								{#each filteredExpenses() as exp (exp.id)}
									{@const headerObj = headers.find((x) => x.id === exp.expenseCategoryId)}
									{@const categoryBucket = headerObj?.category || 'Expenses'}
									{@const badge = getBucketBadgeStyle(categoryBucket)}
									{@const isIncoming = categoryBucket.toLowerCase() === 'income' || categoryBucket.toLowerCase() === 'capital'}
									<tr
										class="hover:bg-muted/10 transition-colors cursor-pointer"
										onclick={() => goto('/payments/' + exp.id)}
									>
										<td class="p-4 font-mono font-medium text-muted-foreground">{exp.expenseNumber}</td>
										<td class="p-4">
											{#if categoryBucket.toLowerCase() === 'contra'}
												<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20 shadow-xs">
													Contra Transfer
												</span>
											{:else if isIncoming}
												<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
													Incoming
												</span>
											{:else}
												<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
													Outgoing
												</span>
											{/if}
										</td>
										<td
											class="p-4 font-semibold text-foreground truncate max-w-[180px]"
											title={headerObj?.name || 'Uncategorized'}
										>
											{headerObj?.name || 'Uncategorized'}
										</td>
										<td class="p-4">
											<span class={'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ' + badge.bg}>
												{badge.label}
											</span>
										</td>
										<td class="p-4 text-foreground truncate max-w-[250px]" title={exp.description}>
											{exp.description}
										</td>
										<td class="p-4 capitalize">
											{PAYMENT_METHOD_LABELS[exp.paymentMethod] || exp.paymentMethod}
										</td>
										<td class="p-4">{exp.expenseDate ? formatDateOnly(exp.expenseDate) : '—'}</td>
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
															: exp.status === 'rejected' || exp.status === 'cancelled' || exp.status === 'reversed'
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
	{:else}
		<!-- ═══════════════════════════════════════════════════════════════════════════════ -->
		<!-- TAB 2: SUPPLIER PAYMENTS & SETTLEMENTS                                           -->
		<!-- ═══════════════════════════════════════════════════════════════════════════════ -->
		<!-- Supplier Dashboard Summary Card Grid (Clickable) -->
		<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
			<!-- All Supplier Payments -->
			<button
				type="button"
				onclick={() => { supPurposeFilter = 'all'; supStatusFilter = 'all'; }}
				class={[
					'bg-card border rounded-2xl p-4 space-y-2 shadow-xs relative overflow-hidden group text-left cursor-pointer transition-all',
					supPurposeFilter === 'all' && supStatusFilter === 'all'
						? 'border-primary ring-2 ring-primary/20 bg-primary/5'
						: 'border-border hover:border-border/80'
				].join(' ')}
			>
				<div class="absolute top-0 left-0 w-1 h-full bg-primary"></div>
				<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">All Settlements</span>
				<div class="flex items-baseline justify-between">
					<span class="text-lg font-bold text-foreground">{supplierPaymentStats.all.count}</span>
					<span class="text-xs font-semibold text-muted-foreground"><MoneyDisplay amount={supplierPaymentStats.all.amount} /></span>
				</div>
			</button>

			<!-- Wallet Top-ups -->
			<button
				type="button"
				onclick={() => handleSupplierPurposeCardClick('wallet')}
				class={[
					'bg-card border rounded-2xl p-4 space-y-2 shadow-xs relative overflow-hidden group text-left cursor-pointer transition-all',
					supPurposeFilter === 'wallet'
						? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5'
						: 'border-border hover:border-border/80'
				].join(' ')}
			>
				<div class="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
				<span class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Wallet Top-up</span>
				<div class="flex items-baseline justify-between">
					<span class="text-lg font-bold text-emerald-600 dark:text-emerald-400">{supplierPaymentStats.wallet.count}</span>
					<span class="text-xs font-semibold text-muted-foreground"><MoneyDisplay amount={supplierPaymentStats.wallet.amount} /></span>
				</div>
			</button>

			<!-- Credit Debt Settlements -->
			<button
				type="button"
				onclick={() => handleSupplierPurposeCardClick('credit')}
				class={[
					'bg-card border rounded-2xl p-4 space-y-2 shadow-xs relative overflow-hidden group text-left cursor-pointer transition-all',
					supPurposeFilter === 'credit'
						? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/5'
						: 'border-border hover:border-border/80'
				].join(' ')}
			>
				<div class="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
				<span class="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Credit Settlement</span>
				<div class="flex items-baseline justify-between">
					<span class="text-lg font-bold text-blue-600 dark:text-blue-400">{supplierPaymentStats.credit.count}</span>
					<span class="text-xs font-semibold text-muted-foreground"><MoneyDisplay amount={supplierPaymentStats.credit.amount} /></span>
				</div>
			</button>

			<!-- Advance Payments -->
			<button
				type="button"
				onclick={() => handleSupplierPurposeCardClick('advance')}
				class={[
					'bg-card border rounded-2xl p-4 space-y-2 shadow-xs relative overflow-hidden group text-left cursor-pointer transition-all',
					supPurposeFilter === 'advance'
						? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-500/5'
						: 'border-border hover:border-border/80'
				].join(' ')}
			>
				<div class="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
				<span class="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">Advance Payment</span>
				<div class="flex items-baseline justify-between">
					<span class="text-lg font-bold text-purple-600 dark:text-purple-400">{supplierPaymentStats.advance.count}</span>
					<span class="text-xs font-semibold text-muted-foreground"><MoneyDisplay amount={supplierPaymentStats.advance.amount} /></span>
				</div>
			</button>

			<!-- Supplier Refunds -->
			<button
				type="button"
				onclick={() => handleSupplierPurposeCardClick('refund')}
				class={[
					'bg-card border rounded-2xl p-4 space-y-2 shadow-xs relative overflow-hidden group text-left cursor-pointer transition-all',
					supPurposeFilter === 'refund'
						? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5'
						: 'border-border hover:border-border/80'
				].join(' ')}
			>
				<div class="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
				<span class="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Supplier Refund</span>
				<div class="flex items-baseline justify-between">
					<span class="text-lg font-bold text-amber-600 dark:text-amber-400">{supplierPaymentStats.refund.count}</span>
					<span class="text-xs font-semibold text-muted-foreground"><MoneyDisplay amount={supplierPaymentStats.refund.amount} /></span>
				</div>
			</button>

			<!-- Pending Approvals -->
			<button
				type="button"
				onclick={handleSupplierPendingCardClick}
				class={[
					'bg-card border rounded-2xl p-4 space-y-2 shadow-xs relative overflow-hidden group text-left cursor-pointer transition-all',
					supStatusFilter === 'pending'
						? 'border-yellow-500 ring-2 ring-yellow-500/20 bg-yellow-500/5'
						: 'border-border hover:border-border/80'
				].join(' ')}
			>
				<div class="absolute top-0 left-0 w-1 h-full bg-yellow-500"></div>
				<span class="text-[10px] font-bold uppercase tracking-wider text-yellow-700 dark:text-yellow-400">Pending Approval</span>
				<div class="flex items-baseline justify-between">
					<span class="text-lg font-bold text-yellow-600 dark:text-yellow-400">{supplierPaymentStats.pending.count}</span>
					<span class="text-xs font-semibold text-muted-foreground"><MoneyDisplay amount={supplierPaymentStats.pending.amount} /></span>
				</div>
			</button>
		</div>

		<!-- Supplier Filters & Search -->
		<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-4">
			<!-- Search & Status Buttons -->
			<div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
				<div class="relative flex-1">
					<Search class="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
					<input
						type="text"
						placeholder="Search by Payment #, Supplier, Ref #, or Description..."
						class="pl-9 h-10 w-full bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
						bind:value={supSearchVal}
					/>
				</div>
				<div class="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
					{#each ['all', 'pending', 'approved', 'rejected'] as status}
						<button
							class={[
								'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap capitalize',
								supStatusFilter === status
									? 'bg-primary border-primary text-primary-foreground'
									: 'bg-background border-border text-muted-foreground hover:text-foreground'
							].join(' ')}
							onclick={() => (supStatusFilter = status)}
						>
							{status}
						</button>
					{/each}
				</div>
			</div>

			<!-- Date range, Purpose filter, Supplier filter -->
			<div class="flex flex-wrap items-center gap-3 pt-3 border-t border-border/60 text-xs">
				<div class="flex items-center gap-2">
					<Calendar class="h-3.5 w-3.5 text-muted-foreground" />
					<span class="font-medium text-muted-foreground">Date:</span>
					<input
						type="date"
						class="h-8 bg-background border border-border rounded-lg px-2 text-[11px] text-foreground focus:outline-none cursor-pointer"
						bind:value={supStartDate}
					/>
					<span class="text-muted-foreground">—</span>
					<input
						type="date"
						class="h-8 bg-background border border-border rounded-lg px-2 text-[11px] text-foreground focus:outline-none cursor-pointer"
						bind:value={supEndDate}
					/>
				</div>

				<!-- Purpose Filter Dropdown -->
				<div class="flex items-center gap-2">
					<Tag class="h-3.5 w-3.5 text-muted-foreground" />
					<span class="font-medium text-muted-foreground">Purpose:</span>
					<select
						class="h-8 bg-background border border-border rounded-lg px-2 text-[11px] text-foreground focus:outline-none cursor-pointer"
						bind:value={supPurposeFilter}
					>
						<option value="all">All Purposes</option>
						<option value="wallet">Prepaid Wallet Top-up</option>
						<option value="credit">Credit Debt Settlement</option>
						<option value="advance">Advance Payment</option>
						<option value="refund">Supplier Refund</option>
					</select>
				</div>

				<!-- Supplier Filter Dropdown -->
				<div class="flex items-center gap-2">
					<Building2 class="h-3.5 w-3.5 text-muted-foreground" />
					<span class="font-medium text-muted-foreground">Supplier:</span>
					<select
						class="h-8 bg-background border border-border rounded-lg px-2 text-[11px] text-foreground focus:outline-none cursor-pointer max-w-[220px]"
						bind:value={supSupplierFilter}
					>
						<option value="all">All Suppliers ({suppliers.length})</option>
						{#each suppliers as s}
							<option value={String(s.id)}>
								{s.name} ({s.code})
							</option>
						{/each}
					</select>
				</div>

				<!-- Reset Filters -->
				{#if supStatusFilter !== 'all' || supPurposeFilter !== 'all' || supSupplierFilter !== 'all' || supStartDate || supEndDate || supSearchVal}
					<Button
						variant="ghost"
						size="sm"
						class="h-8 px-2 text-[11px] text-muted-foreground hover:text-foreground rounded-lg cursor-pointer flex items-center gap-1"
						onclick={resetSupplierFilters}
					>
						<RotateCcw class="h-3 w-3" />
						Reset
					</Button>
				{/if}

				<div class="flex items-center gap-2 ml-auto">
					<Button
						variant="outline"
						size="sm"
						class="h-8 rounded-lg text-[11px] cursor-pointer"
						onclick={exportSupplierCSV}
						disabled={filteredSupplierPayments().length === 0}
					>
						<FileSpreadsheet class="h-3.5 w-3.5 mr-1 text-emerald-600" />
						Export CSV
					</Button>
				</div>
			</div>
		</div>

		<!-- Supplier Payments Table -->
		{#if errorMsg}
			<ErrorState message={errorMsg} {correlationId} retryAction={loadData} />
		{:else}
			{#if loading}
				<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
					<FinancialTableSkeleton rows={5} columns={8} />
				</div>
			{:else if filteredSupplierPayments().length === 0}
				<EmptyState
					title="No supplier payments found"
					description="No supplier payment or settlement records match the current filter or search criteria."
					icon={CreditCard}
				/>
			{:else}
				<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
					<div class="overflow-x-auto">
						<table class="w-full min-w-[950px] text-left border-collapse text-xs">
							<thead>
								<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold">
									<th class="p-4 w-32">Payment Ref</th>
									<th class="p-4 w-44">Supplier</th>
									<th class="p-4 w-36">Purpose</th>
									<th class="p-4 w-36">Payment Channel</th>
									<th class="p-4 w-28">Ref #</th>
									<th class="p-4">Description</th>
									<th class="p-4 w-28">Date</th>
									<th class="p-4 w-28 text-right">Amount</th>
									<th class="p-4 w-28 text-center">Status</th>
									<th class="p-4 w-20 text-center">Action</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60">
								{#each filteredSupplierPayments() as sp (sp.id)}
									{@const sup = suppliers.find((s) => s.id === sp.supplierId)}
									{@const purpose = getSupplierPaymentPurpose(sp)}
									{@const channel = getSupplierPaymentChannel(sp)}
									<tr
										class="hover:bg-muted/10 transition-colors group cursor-pointer"
										onclick={() => goto(`/suppliers/${sp.supplierId}`)}
									>
										<!-- Payment ID / Doc No -->
										<td class="p-4 font-mono font-bold text-foreground">
											{sp.documentNumber || `#${sp.id}`}
										</td>

										<!-- Supplier Name & Code -->
										<td class="p-4">
											<div class="flex flex-col">
												<span class="font-bold text-foreground truncate max-w-[170px]" title={sup?.name || `Supplier #${sp.supplierId}`}>
													{sup?.name || `Supplier #${sp.supplierId}`}
												</span>
												{#if sup?.code}
													<span class="text-[10px] font-mono font-medium text-muted-foreground">
														{sup.code}
													</span>
												{/if}
											</div>
										</td>

										<!-- Purpose -->
										<td class="p-4">
											<span class={'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ' + (purpose?.badgeClass || 'bg-muted text-muted-foreground border-border')}>
												{purpose?.label || 'Settlement'}
											</span>
										</td>

										<!-- Payment Channel -->
										<td class="p-4 font-medium text-foreground">
											<div class="flex items-center gap-1.5 truncate max-w-[150px]" title={channel}>
												{#if channel.toLowerCase().includes('bank')}
													<Landmark class="h-3 w-3 text-emerald-600 shrink-0" />
												{:else if channel.toLowerCase().includes('cash')}
													<Coins class="h-3 w-3 text-amber-600 shrink-0" />
												{:else}
													<Wallet class="h-3 w-3 text-primary shrink-0" />
												{/if}
												<span class="truncate">{channel}</span>
											</div>
										</td>

										<!-- Reference Number -->
										<td class="p-4 font-mono text-muted-foreground truncate max-w-[110px]" title={sp.referenceNumber || '—'}>
											{sp.referenceNumber || '—'}
										</td>

										<!-- Description -->
										<td class="p-4 text-foreground truncate max-w-[220px]" title={sp.description || '—'}>
											{sp.description || '—'}
										</td>

										<!-- Date -->
										<td class="p-4 text-muted-foreground whitespace-nowrap">
											{sp.createdAt ? formatDateOnly(sp.createdAt) : '—'}
										</td>

										<!-- Amount -->
										<td class="p-4 text-right font-mono font-bold text-foreground whitespace-nowrap">
											<MoneyDisplay amount={sp.amount} />
										</td>

										<!-- Status -->
										<td class="p-4 text-center">
											<FinancialStatusBadge status={sp.status} size="sm" />
										</td>

										<!-- Actions -->
										<td class="p-4 text-center">
											<div class="flex items-center justify-center gap-1.5" onclick={(e) => e.stopPropagation()}>
												{#if (sp.status || '').toLowerCase() === 'pending' && hasRole('master_accountant')}
													<button
														type="button"
														disabled={processingSpId === sp.id}
														class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-700 transition-colors cursor-pointer inline-flex items-center justify-center disabled:opacity-50"
														title="Approve Settlement"
														onclick={(e) => handleApproveSupplierPayment(sp, e)}
													>
														<Check class="h-3.5 w-3.5" />
													</button>
													<button
														type="button"
														disabled={processingSpId === sp.id}
														class="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 hover:text-rose-700 transition-colors cursor-pointer inline-flex items-center justify-center disabled:opacity-50"
														title="Reject Settlement"
														onclick={(e) => handleRejectSupplierPayment(sp, e)}
													>
														<X class="h-3.5 w-3.5" />
													</button>
												{/if}
												<button
													type="button"
													class="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer inline-flex items-center justify-center"
													title="View Supplier Statement"
													onclick={(e) => {
														e.stopPropagation();
														goto(`/suppliers/${sp.supplierId}`);
													}}
												>
													<ExternalLink class="h-3.5 w-3.5" />
												</button>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		{/if}
	{/if}
</div>
