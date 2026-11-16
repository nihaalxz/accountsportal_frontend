<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import PageContainer from '$lib/components/PageContainer.svelte';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import DateDisplay from '$lib/components/DateDisplay.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import FormattedNarrative from '$lib/components/financial/FormattedNarrative.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { toast } from '$lib/stores/toast';
	import { exportToCSV as downloadCSV } from '$lib/utils/csv-exporter';
	import { formatDateOnly, getBahrainDateString } from '$lib/formatters/date';
	import { previewDocument } from '$lib/utils/preview-document';
	import {
		getSuppliers,
		getSupplierStatement,
		getSupplierPayments,
		getPurchaseReturns
	} from '$features/suppliers/api';
	import type {
		SupplierResponse,
		SupplierPaymentResponse,
		PurchaseReturnResponse
	} from '$features/suppliers/types';
	import type { TransactionResponse } from '$features/financial-transactions/types';
	import {
		Wallet,
		Landmark,
		ArrowLeft,
		Plus,
		Download,
		Printer,
		Search,
		Filter,
		RefreshCw,
		CheckCircle2,
		AlertCircle,
		Building2,
		CreditCard,
		Tag,
		FileText,
		RotateCcw,
		ChevronLeft,
		ChevronRight,
		X,
		ArrowUpRight,
		ArrowDownLeft,
		ShieldCheck,
		Scale
	} from 'lucide-svelte';

	const supplierId = Number($page.params.id);

	let isLoading = $state(true);
	let errorMsg = $state<string | null>(null);

	let supplier = $state<SupplierResponse | null>(null);
	let transactions = $state<TransactionResponse[]>([]);
	let supplierPayments = $state<SupplierPaymentResponse[]>([]);
	let purchaseReturns = $state<PurchaseReturnResponse[]>([]);

	// Active tab
	let activeTab = $state<'overview' | 'statement' | 'payments' | 'returns' | 'profile'>('overview');

	// Search & Filters for Statement
	let searchQuery = $state('');
	let selectedType = $state('all');
	let startDate = $state('');
	let endDate = $state('');
	let currentPage = $state(1);
	let pageSize = $state(15);

	// Export states
	let exportingCSV = $state(false);

	async function loadSupplierDetails() {
		isLoading = true;
		errorMsg = null;
		try {
			const [suppliersList, statementData, paymentsData, returnsData] = await Promise.all([
				getSuppliers(),
				getSupplierStatement(supplierId, { page: 1, pageSize: 1000 }),
				getSupplierPayments({ supplierId }).catch(() => []),
				getPurchaseReturns({ supplierId }).catch(() => [])
			]);

			supplier = suppliersList.find((s) => s.id === supplierId) || null;
			if (!supplier) {
				throw new Error(`Supplier with ID ${supplierId} not found.`);
			}

			transactions = statementData || [];
			supplierPayments = paymentsData || [];
			purchaseReturns = returnsData || [];
		} catch (err: any) {
			errorMsg = err.message || 'Failed to load supplier details.';
		} finally {
			isLoading = false;
		}
	}

	// Filtered transactions for statement ledger
	const filteredTransactions = $derived.by(() => {
		return transactions.filter((tx) => {
			// Search filter
			const q = searchQuery.toLowerCase().trim();
			const matchesSearch =
				!q ||
				String(tx.id).includes(q) ||
				(tx.documentNumber && tx.documentNumber.toLowerCase().includes(q)) ||
				(tx.referenceId && tx.referenceId.toLowerCase().includes(q)) ||
				(tx.referenceDisplayName && tx.referenceDisplayName.toLowerCase().includes(q)) ||
				(tx.paymentMethod && tx.paymentMethod.toLowerCase().includes(q)) ||
				(tx.paymentMethodName && tx.paymentMethodName.toLowerCase().includes(q)) ||
				(tx.sourceBankName && tx.sourceBankName.toLowerCase().includes(q)) ||
				(tx.destinationBankName && tx.destinationBankName.toLowerCase().includes(q)) ||
				(tx.sourceAccountName && tx.sourceAccountName.toLowerCase().includes(q)) ||
				(tx.destinationAccountName && tx.destinationAccountName.toLowerCase().includes(q)) ||
				(tx.displayNarrative && tx.displayNarrative.toLowerCase().includes(q)) ||
				(tx.description && tx.description.toLowerCase().includes(q)) ||
				(tx.transactionType && tx.transactionType.toLowerCase().includes(q));

			// Type filter
			const matchesType =
				selectedType === 'all' ||
				(tx.transactionType && tx.transactionType.toLowerCase() === selectedType.toLowerCase());

			// Date range filter
			let matchesDate = true;
			if (startDate || endDate) {
				const txDate = new Date(tx.createdAt).getTime();
				if (startDate && txDate < new Date(startDate).getTime()) matchesDate = false;
				if (endDate && txDate > new Date(endDate + 'T23:59:59').getTime()) matchesDate = false;
			}

			return matchesSearch && matchesType && matchesDate;
		});
	});

	const totalPages = $derived(Math.ceil(filteredTransactions.length / pageSize) || 1);
	const paginatedTransactions = $derived.by(() => {
		const start = (currentPage - 1) * pageSize;
		return filteredTransactions.slice(start, start + pageSize);
	});

	// Calculated metrics
	const totalPaidApproved = $derived(
		supplierPayments
			.filter((p) => p.status?.toLowerCase() === 'approved')
			.reduce((sum, p) => sum + p.amount, 0)
	);
	const totalReturnsApproved = $derived(
		purchaseReturns
			.filter((r) => r.status?.toLowerCase() === 'approved')
			.reduce((sum, r) => sum + r.amount, 0)
	);

	function resetFilters() {
		searchQuery = '';
		selectedType = 'all';
		startDate = '';
		endDate = '';
		currentPage = 1;
	}

	async function handlePrint() {
		if (!supplier) return;
		toast.info('Generating server PDF document...');
		await previewDocument('report', 'supplier-statement', { supplierId: supplier.id, startDate, endDate });
	}

	function exportCSV() {
		if (!supplier) return;
		exportingCSV = true;
		try {
			const headers = [
				'Txn ID',
				'Date',
				'Type',
				'Amount (BHD)',
				'Payment Mode',
				'Bank / Cash Account',
				'Application / Reference',
				'Description / Narrative',
				'Status'
			];

			const rows = filteredTransactions.map((tx) => [
				tx.documentNumber || `#${tx.id}`,
				tx.createdAt ? formatDateOnly(tx.createdAt) : '',
				tx.transactionType,
				tx.amount,
				tx.paymentMethodName || tx.paymentMethod || '',
				tx.sourceBankName || tx.destinationBankName || tx.sourceAccountName || tx.destinationAccountName || '',
				tx.referenceDisplayName || tx.referenceId || '',
				tx.displayNarrative || tx.displayDescription || tx.description || '',
				tx.status
			]);

			const sanitizedName = supplier.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
			downloadCSV(
				`supplier_statement_${sanitizedName}_${getBahrainDateString()}.csv`,
				headers,
				rows
			);
			toast.success('CSV statement exported successfully.');
		} catch (err: any) {
			toast.error(err.message || 'Failed to export CSV.');
		} finally {
			exportingCSV = false;
		}
	}

	onMount(() => {
		loadSupplierDetails();
	});
</script>

<svelte:head>
	<title>{supplier ? `${supplier.name} (${supplier.code})` : `Supplier #${supplierId}`} — Accounts Portal</title>
</svelte:head>

<PageContainer class="print:p-0 print:m-0 print:max-w-none">
	<!-- ── PRINT HEADER (Visible only in print / export PDF mode) ────────────────────────── -->
	<div class="hidden print:block space-y-4 mb-6 pb-4 border-b border-gray-300">
		<div class="flex justify-between items-start">
			<div>
				<h1 class="text-xl font-bold text-black uppercase tracking-wider">Texas Travels — Official Supplier Ledger</h1>
				<p class="text-xs text-gray-600">Supplier Statement of Account & Financial Activity Audit</p>
			</div>
			<div class="text-right text-xs text-gray-600">
				<p class="font-bold text-black">{supplier?.name || `Supplier #${supplierId}`}</p>
				<p>Code: {supplier?.code || 'N/A'}</p>
				<p>Generated: {new Date().toLocaleString()}</p>
			</div>
		</div>
		{#if supplier}
			<div class="grid grid-cols-2 gap-4 p-3 bg-gray-100 rounded text-xs">
				<div>
					<span class="block text-gray-500 font-semibold uppercase text-[10px]">Current Wallet Balance</span>
					<span class="font-mono font-bold text-black">{supplier.wallet > 0 ? '+' : ''}{supplier.wallet.toFixed(3)} BHD</span>
				</div>
				<div>
					<span class="block text-gray-500 font-semibold uppercase text-[10px]">Status</span>
					<span class="font-mono font-bold text-black">{supplier.wallet > 0 ? 'Surplus (+)' : supplier.wallet < 0 ? 'Outstanding Debt (-)' : 'Settled'}</span>
				</div>
			</div>
		{/if}
	</div>

	<!-- ── SCREEN PAGE HEADER ─────────────────────────────────────────────────────────── -->
	<div class="space-y-3 print:hidden">
		<!-- Back navigation -->
		<div>
			<button
				onclick={() => goto('/suppliers')}
				class="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
			>
				<ArrowLeft class="h-3.5 w-3.5" />
				<span>Back to Suppliers</span>
			</button>
		</div>

		<!-- Title & Actions Row -->
		<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
			<div class="space-y-1">
				<div class="flex items-center gap-2 flex-wrap">
					<h1 class="text-xl font-bold text-foreground">
						{supplier?.name || `Supplier #${supplierId}`}
					</h1>
					{#if supplier}
						<span class="font-mono text-xs text-muted-foreground font-semibold px-2 py-0.5 bg-muted rounded-md border border-border">
							{supplier.code}
						</span>
						<StatusBadge status={supplier.isVerified ? 'Verified' : 'Unverified'} />
					{/if}
				</div>
				<p class="text-xs text-muted-foreground">
					Supplier ID #{supplierId} &nbsp;•&nbsp; Wallet & Ledger Management Center
				</p>
			</div>

			<div class="flex items-center gap-2 flex-wrap lg:flex-nowrap shrink-0 lg:justify-end">
				<Button
					variant="outline"
					class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0"
					onclick={exportCSV}
					disabled={exportingCSV || filteredTransactions.length === 0}
				>
					<Download class={['h-3.5 w-3.5', exportingCSV ? 'animate-spin' : ''].join(' ')} />
					<span>{exportingCSV ? 'Exporting...' : 'Export CSV'}</span>
				</Button>

				<Button
					variant="outline"
					class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0"
					onclick={handlePrint}
				>
					<Printer class="h-3.5 w-3.5 text-primary" />
					<span>Export PDF / Print</span>
				</Button>

				<Button
					class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground shrink-0 shadow-xs"
					onclick={() => goto(`/payments/new?supplierId=${supplierId}`)}
				>
					<Plus class="h-3.5 w-3.5" />
					<span>Make Payment / Top-up</span>
				</Button>
			</div>
		</div>
	</div>

	<!-- ── LOADING / ERROR STATES ──────────────────────────────────────────────────────── -->
	{#if isLoading}
		<div class="bg-card border border-border rounded-2xl p-16 flex flex-col items-center justify-center gap-3 animate-pulse mt-6">
			<RefreshCw class="h-8 w-8 text-primary animate-spin" />
			<p class="text-xs text-muted-foreground font-medium">Loading supplier financial profile & statement ledger...</p>
		</div>
	{:else if errorMsg}
		<div class="mt-6">
			<ErrorState message={errorMsg} retryAction={loadSupplierDetails} />
		</div>
	{:else if supplier}
		<!-- ── EXECUTIVE METRICS & HERO GRID ─────────────────────────────────────────── -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6 print:hidden">
			<!-- Single Hero Wallet Card (spans 2 columns on lg) -->
			<div class="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-xs relative overflow-hidden flex flex-col justify-between">
				<div class="absolute top-0 right-0 w-48 h-48 -mr-12 -mt-12 rounded-full opacity-10 pointer-events-none {supplier.wallet > 0 ? 'bg-emerald-500' : supplier.wallet < 0 ? 'bg-rose-500' : 'bg-muted-foreground'}"></div>
				<div>
					<div class="flex items-center justify-between">
						<span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Supplier Wallet Balance</span>
						<span class="px-3 py-1 text-xs font-bold rounded-full {supplier.wallet > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : supplier.wallet < 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' : 'bg-muted text-muted-foreground border border-border'}">
							{supplier.wallet > 0 ? 'Surplus (+)' : supplier.wallet < 0 ? 'Outstanding Debt (-)' : 'Settled'}
						</span>
					</div>

					<div class="mt-4">
						<div class="text-4xl font-extrabold tracking-tight font-mono {supplier.wallet > 0 ? 'text-emerald-600 dark:text-emerald-400' : supplier.wallet < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}">
							{supplier.wallet > 0 ? '+' : ''}<MoneyDisplay amount={supplier.wallet} />
						</div>
						<p class="text-xs text-muted-foreground font-medium mt-1">
							{supplier.wallet > 0
								? 'Prepaid funds held by supplier.'
								: supplier.wallet < 0
								? 'Outstanding amount owed to supplier.'
								: 'Fully settled.'}
						</p>
					</div>
				</div>

				<div class="mt-6 pt-4 border-t border-border flex items-center justify-between">
					<span class="text-xs text-muted-foreground">Unified signed balance</span>
					<Button
						class="h-8 px-3 rounded-lg text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
						onclick={() => goto(`/payments/new?supplierId=${supplierId}`)}
					>
						<Plus class="h-3.5 w-3.5" />
						<span>Make Payment / Top-up</span>
					</Button>
				</div>
			</div>

			<!-- Payouts & Activity Summary -->
			<div class="bg-card border border-border rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
				<div class="flex items-center justify-between">
					<span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Activity Summary</span>
					<div class="p-2 rounded-xl bg-blue-500/10 text-blue-600">
						<CreditCard class="h-5 w-5" />
					</div>
				</div>
				<div class="mt-2 space-y-1">
					<div class="flex justify-between items-center text-xs">
						<span class="text-muted-foreground font-medium">Total Paid:</span>
						<span class="font-mono font-bold text-foreground"><MoneyDisplay amount={totalPaidApproved} /></span>
					</div>
					<div class="flex justify-between items-center text-xs">
						<span class="text-muted-foreground font-medium">Purchase Returns:</span>
						<span class="font-mono font-bold text-emerald-600"><MoneyDisplay amount={totalReturnsApproved} /></span>
					</div>
					<div class="flex justify-between items-center text-xs">
						<span class="text-muted-foreground font-medium">Ledger Entries:</span>
						<span class="font-bold text-foreground">{transactions.length}</span>
					</div>
				</div>
				<div class="mt-3 pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
					<span class="text-muted-foreground">Categories:</span>
					<span class="font-semibold text-foreground truncate max-w-[120px]">
						{supplier.categories?.join(', ') || 'General'}
					</span>
				</div>
			</div>
		</div>

		<!-- ── TABS NAVIGATION (Print Hidden) ──────────────────────────────────────────────── -->
		<div class="mt-6 border-b border-border flex gap-2 overflow-x-auto print:hidden">
			<button
				onclick={() => (activeTab = 'overview')}
				class={['px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5', activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'].join(' ')}
			>
				<Building2 class="h-4 w-4" /> Overview & Financial Summary
			</button>
			<button
				onclick={() => (activeTab = 'statement')}
				class={['px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5', activeTab === 'statement' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'].join(' ')}
			>
				<FileText class="h-4 w-4" /> Statement Ledger ({transactions.length})
			</button>
			<button
				onclick={() => (activeTab = 'payments')}
				class={['px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5', activeTab === 'payments' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'].join(' ')}
			>
				<CreditCard class="h-4 w-4" /> Supplier Payments ({supplierPayments.length})
			</button>
			<button
				onclick={() => (activeTab = 'returns')}
				class={['px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5', activeTab === 'returns' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'].join(' ')}
			>
				<RotateCcw class="h-4 w-4" /> Purchase Returns ({purchaseReturns.length})
			</button>
		</div>

		<!-- ── TAB 1: OVERVIEW & QUICK ACTIONS ──────────────────────────────────────────────── -->
		{#if activeTab === 'overview'}
			<div class="mt-6 space-y-6 print:hidden">
				<div>
					<!-- Supplier Details -->
					<div class="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
						<h3 class="text-sm font-bold text-foreground flex items-center gap-2">
							<Building2 class="h-4 w-4 text-primary" /> Supplier Credentials & Meta
						</h3>
						<div class="divide-y divide-border/60 text-xs">
							<div class="py-2.5 flex justify-between items-center">
								<span class="text-muted-foreground font-medium">Supplier Name</span>
								<span class="font-bold text-foreground">{supplier.name}</span>
							</div>
							<div class="py-2.5 flex justify-between items-center">
								<span class="text-muted-foreground font-medium">Supplier Code</span>
								<span class="font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded">{supplier.code}</span>
							</div>
							<div class="py-2.5 flex justify-between items-center">
								<span class="text-muted-foreground font-medium">System ID</span>
								<span class="font-mono font-semibold text-muted-foreground">#{supplier.id}</span>
							</div>
							<div class="py-2.5 flex justify-between items-center">
								<span class="text-muted-foreground font-medium">Verification Status</span>
								<StatusBadge status={supplier.isVerified ? 'Verified' : 'Unverified'} />
							</div>
							<div class="py-2.5 flex justify-between items-center">
								<span class="text-muted-foreground font-medium">Categories</span>
								<div class="flex flex-wrap gap-1">
									{#each supplier.categories as cat}
										<span class="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-md border border-primary/20">{cat}</span>
									{/each}
								</div>
							</div>
							<div class="py-2.5 flex justify-between items-center">
								<span class="text-muted-foreground font-medium">Created Date</span>
								<span class="text-foreground"><DateDisplay value={supplier.createdAt} /></span>
							</div>
						</div>
					</div>
				</div>

				<!-- Recent Transactions Preview -->
				<div class="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-bold text-foreground flex items-center gap-2">
							<FileText class="h-4 w-4 text-primary" /> Recent Statement Ledger Activity
						</h3>
						<button
							onclick={() => (activeTab = 'statement')}
							class="text-xs font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
						>
							View All ({transactions.length}) <ArrowUpRight class="h-3 w-3" />
						</button>
					</div>

					{#if transactions.length === 0}
						<div class="text-center py-10 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
							No financial statement entries logged for this supplier yet.
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full text-left border-collapse text-xs">
								<thead>
									<tr class="bg-muted/40 border-b border-border text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">
										<th class="p-3">Txn ID</th>
										<th class="p-3">Type</th>
										<th class="p-3 text-right">Amount</th>
										<th class="p-3">Payment Method</th>
										<th class="p-3">Reference</th>
										<th class="p-3">Status</th>
										<th class="p-3">Date</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-border/60">
									{#each transactions.slice(0, 5) as tx}
										<tr class="hover:bg-muted/10 transition-colors">
											<td class="p-3 font-mono font-bold text-foreground">#{tx.id}</td>
											<td class="p-3">
												<span class={['inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider', tx.transactionType === 'incoming' || tx.transactionType === 'salesreturn' || tx.transactionType === 'purchasereturn' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'].join(' ')}>
													{tx.transactionType}
												</span>
											</td>
											<td class="p-3 text-right font-mono font-bold text-foreground">
												<MoneyDisplay amount={tx.amount} />
											</td>
											<td class="p-3 uppercase font-medium">{tx.paymentMethod}</td>
											<td class="p-3 font-mono text-muted-foreground">{tx.referenceId || '—'}</td>
											<td class="p-3"><StatusBadge status={tx.status} /></td>
											<td class="p-3 text-muted-foreground"><DateDisplay value={tx.createdAt} /></td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- ── TAB 2: FULL STATEMENT LEDGER (Searchable & Filterable) ─────────────────────── -->
		{#if activeTab === 'statement'}
			<div class="mt-6 space-y-4 print:space-y-0">
				<!-- Search & Filter Controls (Print Hidden) -->
				<div class="bg-card border border-border rounded-2xl p-4 space-y-3 shadow-xs print:hidden">
					<div class="flex flex-col md:flex-row items-center justify-between gap-3">
						<div class="relative w-full md:w-80">
							<Search class="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								type="text"
								placeholder="Search Txn ID, Reference, Method..."
								bind:value={searchQuery}
								class="pl-9 h-9 text-xs rounded-xl"
							/>
						</div>

						<div class="flex flex-wrap items-center gap-2 w-full md:w-auto">
							<div class="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5 text-xs">
								<Filter class="h-3.5 w-3.5 text-muted-foreground" />
								<select bind:value={selectedType} class="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer">
									<option value="all">All Types</option>
									<option value="incoming">Incoming / Deposit</option>
									<option value="outgoing">Outgoing / Payout</option>
									<option value="purchasereturn">Purchase Return</option>
									<option value="salesreturn">Sales Return</option>
								</select>
							</div>

							<div class="flex items-center gap-2 text-xs">
								<Input type="date" bind:value={startDate} class="h-9 text-xs rounded-xl w-36" title="Start Date" />
								<span class="text-muted-foreground font-semibold">to</span>
								<Input type="date" bind:value={endDate} class="h-9 text-xs rounded-xl w-36" title="End Date" />
							</div>

							{#if searchQuery || selectedType !== 'all' || startDate || endDate}
								<Button variant="ghost" size="sm" onclick={resetFilters} class="h-9 text-xs rounded-xl text-muted-foreground hover:text-foreground">
									<X class="h-3.5 w-3.5 mr-1" /> Reset
								</Button>
							{/if}
						</div>
					</div>

					<div class="flex justify-between items-center text-xs text-muted-foreground pt-1 border-t border-border/40">
						<span>Showing <strong>{filteredTransactions.length}</strong> matching entries</span>
						<span>Page {currentPage} of {totalPages}</span>
					</div>
				</div>

				<!-- Statement Table View -->
				<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs print:border-none print:shadow-none">
					{#if filteredTransactions.length === 0}
						<div class="p-16 text-center text-muted-foreground text-xs space-y-2">
							<AlertCircle class="h-8 w-8 text-muted-foreground mx-auto" />
							<p class="font-bold text-foreground">No matching ledger entries found</p>
							<p>Try adjusting your search query, type filter, or date range.</p>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full text-left border-collapse text-xs">
								<thead>
									<tr class="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px] print:bg-transparent">
										<th class="p-3.5">Txn ID</th>
										<th class="p-3.5">Type</th>
										<th class="p-3.5 text-right">Amount</th>
										<th class="p-3.5">Payment Mode & Account</th>
										<th class="p-3.5">Application / Reference & Narrative</th>
										<th class="p-3.5">Status</th>
										<th class="p-3.5">Date</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-border/60">
									{#each paginatedTransactions as tx}
										<tr class="hover:bg-muted/10 transition-colors">
											<td class="p-3.5 font-mono font-bold text-foreground">
												{tx.documentNumber || `#${tx.id}`}
											</td>
											<td class="p-3.5">
												<span class={['inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider', tx.transactionType === 'incoming' || tx.transactionType === 'salesreturn' || tx.transactionType === 'purchasereturn' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-200' : 'bg-rose-500/10 text-rose-600 border border-rose-200'].join(' ')}>
													{tx.transactionType}
												</span>
											</td>
											<td class="p-3.5 text-right font-mono font-bold text-foreground">
												<MoneyDisplay amount={tx.amount} />
											</td>
											<td class="p-3.5">
												<div class="space-y-1">
													<div class="flex items-center gap-1.5">
														<span class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-muted border border-border text-foreground">
															{tx.paymentMethodName || tx.paymentMethod || '—'}
														</span>
													</div>
													{#if tx.sourceBankName || tx.destinationBankName}
														<div class="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
															<Landmark class="h-3 w-3 inline text-emerald-600" />
															<span>{tx.sourceBankName || tx.destinationBankName}</span>
														</div>
													{:else if tx.sourceAccountName || tx.destinationAccountName}
														<div class="flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-400">
															<Building2 class="h-3 w-3 inline text-blue-600" />
															<span>{tx.sourceAccountName || tx.destinationAccountName}</span>
														</div>
													{:else if tx.paymentMethod?.toLowerCase() === 'wallet' || tx.paymentMethodName?.toLowerCase().includes('wallet')}
														<div class="flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
															<Wallet class="h-3 w-3 inline text-amber-600 text-[10px]" />
															<span>Prepaid Supplier Wallet</span>
														</div>
													{/if}
												</div>
											</td>
											<td class="p-3.5">
												<div class="space-y-1 max-w-md">
													{#if tx.referenceDisplayName || tx.referenceId}
														<div class="flex items-center gap-1.5 flex-wrap">
															{#if tx.referenceUrl}
																<a
																	href={tx.referenceUrl}
																	class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
																>
																	<Tag class="h-3 w-3" />
																	{tx.referenceDisplayName || tx.referenceId}
																</a>
															{:else}
																<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
																	<Tag class="h-3 w-3" />
																	{tx.referenceDisplayName || tx.referenceId}
																</span>
															{/if}
														</div>
													{/if}
													<div class="text-xs text-foreground leading-snug">
														<FormattedNarrative text={tx.displayNarrative || tx.displayDescription || tx.description} />
													</div>
												</div>
											</td>
											<td class="p-3.5"><StatusBadge status={tx.status} /></td>
											<td class="p-3.5 text-muted-foreground"><DateDisplay value={tx.createdAt} /></td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<!-- Pagination Footer (Print Hidden) -->
						{#if filteredTransactions.length > 0}
							<div class="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs print:hidden">
								<span class="text-muted-foreground">Showing page {currentPage} of {totalPages} ({filteredTransactions.length} records)</span>
								<div class="flex items-center gap-4">
									<div class="flex items-center gap-2">
										<span class="text-xs text-muted-foreground whitespace-nowrap">Rows per page:</span>
										<select
											bind:value={pageSize}
											onchange={() => (currentPage = 1)}
											class="bg-background border border-border rounded-xl px-2.5 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
										>
											<option value={10}>10</option>
											<option value={15}>15</option>
											<option value={25}>25</option>
											<option value={50}>50</option>
											<option value={100}>100</option>
											<option value={200}>200</option>
											<option value={500}>500</option>
											<option value={1000}>1000 (All)</option>
										</select>
									</div>
									<div class="flex items-center gap-2">
										<Button
											variant="outline"
											size="sm"
											class="h-8 rounded-xl"
											onclick={() => (currentPage = Math.max(1, currentPage - 1))}
											disabled={currentPage <= 1}
										>
											<ChevronLeft class="h-3.5 w-3.5 mr-1" /> Previous
										</Button>
										<Button
											variant="outline"
											size="sm"
											class="h-8 rounded-xl"
											onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))}
											disabled={currentPage >= totalPages}
										>
											Next <ChevronRight class="h-3.5 w-3.5 ml-1" />
										</Button>
									</div>
								</div>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		{/if}

		<!-- ── TAB 3: SUPPLIER PAYMENTS LOG ───────────────────────────────────────────────── -->
		{#if activeTab === 'payments'}
			<div class="mt-6 space-y-4 print:hidden">
				<div class="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-bold text-foreground flex items-center gap-2">
							<CreditCard class="h-4 w-4 text-primary" /> Supplier Payments Log ({supplierPayments.length})
						</h3>
						<Button
							size="sm"
							class="h-8 rounded-xl text-xs font-semibold bg-primary text-primary-foreground cursor-pointer"
							onclick={() => goto(`/payments/new?supplierId=${supplierId}&type=supplier_wallet`)}
						>
							<Plus class="h-3.5 w-3.5 mr-1" /> New Payment / Top-up
						</Button>
					</div>

					{#if supplierPayments.length === 0}
						<div class="p-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
							No supplier payment payouts logged for this supplier yet.
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full text-left border-collapse text-xs">
								<thead>
									<tr class="bg-muted/40 border-b border-border text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">
										<th class="p-3.5">Payment ID</th>
										<th class="p-3.5 text-right">Amount</th>
										<th class="p-3.5">Method</th>
										<th class="p-3.5">Ref Number</th>
										<th class="p-3.5">Description</th>
										<th class="p-3.5">Status</th>
										<th class="p-3.5">Requested At</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-border/60">
									{#each supplierPayments as sp}
										<tr class="hover:bg-muted/10 transition-colors">
											<td class="p-3.5 font-mono font-bold text-foreground">#{sp.id}</td>
											<td class="p-3.5 text-right font-mono font-bold text-foreground">
												<MoneyDisplay amount={sp.amount} />
											</td>
											<td class="p-3.5 uppercase font-semibold text-foreground">
												{(sp as any).sourceBankName || (sp as any).sourceAccountName ? `${sp.paymentMethod} (${(sp as any).sourceBankName || (sp as any).sourceAccountName})` : sp.paymentMethod}
											</td>
											<td class="p-3.5 font-mono text-muted-foreground">{sp.referenceNumber || '—'}</td>
											<td class="p-3.5 text-muted-foreground max-w-xs truncate">{sp.description || '—'}</td>
											<td class="p-3.5"><StatusBadge status={sp.status} /></td>
											<td class="p-3.5 text-muted-foreground"><DateDisplay value={sp.createdAt || (sp as any).requestedAt} /></td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- ── TAB 4: PURCHASE RETURNS LOG ────────────────────────────────────────────────── -->
		{#if activeTab === 'returns'}
			<div class="mt-6 space-y-4 print:hidden">
				<div class="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-bold text-foreground flex items-center gap-2">
							<RotateCcw class="h-4 w-4 text-primary" /> Purchase Returns Log ({purchaseReturns.length})
						</h3>
					</div>

					{#if purchaseReturns.length === 0}
						<div class="p-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
							No purchase returns recorded for this supplier yet.
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full text-left border-collapse text-xs">
								<thead>
									<tr class="bg-muted/40 border-b border-border text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">
										<th class="p-3.5">Return ID</th>
										<th class="p-3.5 text-right">Amount</th>
										<th class="p-3.5">Reason</th>
										<th class="p-3.5">Status</th>
										<th class="p-3.5">Requested At</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-border/60">
									{#each purchaseReturns as pr}
										<tr class="hover:bg-muted/10 transition-colors">
											<td class="p-3.5 font-mono font-bold text-foreground">#{pr.id}</td>
											<td class="p-3.5 text-right font-mono font-bold text-emerald-600">
												<MoneyDisplay amount={pr.amount} />
											</td>
											<td class="p-3.5 text-muted-foreground">{pr.reason || 'Supplier Purchase Return'}</td>
											<td class="p-3.5"><StatusBadge status={pr.status} /></td>
											<td class="p-3.5 text-muted-foreground"><DateDisplay value={pr.requestedAt} /></td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- ── PRINT FOOTER (Visible only in print / export PDF mode) ─────────────────────── -->
		<div class="hidden print:block mt-12 pt-6 border-t border-gray-300 text-xs text-gray-600">
			<div class="flex justify-between items-end">
				<div>
					<p class="font-bold text-black">Texas Travels Accounts Management</p>
					<p>Confidential & Proprietary Statement Document</p>
				</div>
				<div class="text-right border-t border-black pt-2 w-48">
					<p class="font-bold text-black text-center">Authorized Signature</p>
				</div>
			</div>
		</div>
	{/if}
</PageContainer>
