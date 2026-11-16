<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { apiFetch } from '$lib/api/api-client';
	import { ReceiptRealtimeController } from '$lib/realtime/receipt-realtime-controller';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { DateDisplay } from '$lib/components';
	import { Button } from '$lib/components/ui/button';
	import { exportToCSV as downloadCSV } from '$lib/utils/csv-exporter';
	import { formatDateOnly, formatDateTime, getBahrainDateString } from '$lib/formatters/date';
	import { previewDocument } from '$lib/utils/preview-document';
	import { toast } from '$lib/stores/toast';
	import {
		Search,
		ChevronLeft,
		ChevronRight,
		RefreshCw,
		Download,
		Printer,
		Eye,
		Plus,
		Receipt,
		Building2,
		Coins,
		Landmark,
		CheckCircle2,
		X,
		FileText,
		AlertTriangle,
		Clock,
		RotateCw,
		UserCheck,
		Users,
		Wallet
	} from 'lucide-svelte';

	// ─── Active Tab State ────────────────────────────────────────────────────────
	let activeTab = $state<'sales_portal' | 'accounts_portal'>(
		($page.url.searchParams.get('tab') as 'sales_portal' | 'accounts_portal') || 'sales_portal'
	);

	// ─── Sales Portal Receipts State ─────────────────────────────────────────────
	let receiptsData = $state<any>(null);
	let loadingSales = $state(false);
	let currentSalesPage = $state(1);
	let salesPageSize = $state(10);
	let salesSearchInput = $state($page.url.searchParams.get('search') || '');
	let salesSearchVal = $state($page.url.searchParams.get('search') || '');
	let salesStartDate = $state('');
	let salesEndDate = $state('');

	// ─── Accounts Portal Receipts State ──────────────────────────────────────────
	let accountsReceiptsData = $state<any>(null);
	let loadingAccounts = $state(false);
	let currentAccountsPage = $state(1);
	let accountsPageSize = $state(10);
	let accountsSearchInput = $state('');
	let accountsSearchVal = $state('');
	let accountsStartDate = $state('');
	let accountsEndDate = $state('');

	// Modal / Inspection state for Accounts Receipt
	let selectedAccountsReceipt = $state<any | null>(null);
	let retryingReceiptId = $state<number | null>(null);

	async function handleRetryAccountsReceipt(id: number) {
		retryingReceiptId = id;
		try {
			const retried = await apiFetch<any>(`api/sales-entries/accounts-receipts/${id}/retry`, {
				method: 'POST'
			});
			if (retried.syncStatus === 'Synced') {
				toast.success(`Receipt synced successfully! Sales Portal Doc: ${retried.salesPortalDocumentNumber || retried.salesPortalReceiptId}`);
				await fetchSalesReceipts();
			} else {
				toast.error(retried.failureReason || 'Sync attempt failed.');
				await fetchSalesReceipts();
			}
		} catch (err: any) {
			console.error('Failed to retry sync:', err);
			toast.error(err?.message || 'Failed to retry sync.');
		} finally {
			retryingReceiptId = null;
		}
	}

	let realtimeController: ReceiptRealtimeController | null = null;
	let searchTimeoutSales: any;
	let searchTimeoutAccounts: any;
	let exportingCSV = $state(false);

	// ─── Sales Portal Receipts Loader ────────────────────────────────────────────
	function handleSalesSearch(val: string) {
		salesSearchInput = val;
		clearTimeout(searchTimeoutSales);
		searchTimeoutSales = setTimeout(() => {
			salesSearchVal = val;
			currentSalesPage = 1;
			fetchSalesReceipts();
		}, 300);
	}

	function triggerSalesSearchImmediate() {
		clearTimeout(searchTimeoutSales);
		salesSearchVal = salesSearchInput;
		currentSalesPage = 1;
		fetchSalesReceipts();
	}

	function clearSalesSearch() {
		salesSearchInput = '';
		salesSearchVal = '';
		currentSalesPage = 1;
		fetchSalesReceipts();
	}

	async function fetchSalesReceipts() {
		loadingSales = true;
		try {
			const params: any = {
				page: currentSalesPage,
				pageSize: salesPageSize
			};
			if (salesSearchVal.trim()) {
				params.search = salesSearchVal.trim();
			}
			if (salesStartDate) params.startDate = salesStartDate;
			if (salesEndDate) params.endDate = salesEndDate;

			const res = await apiFetch<any>('api/sales-entries/receipts', { params });
			receiptsData = res;
		} catch (err) {
			console.error('Failed to load Sales Portal receipts:', err);
		} finally {
			loadingSales = false;
		}
	}

	// ─── Accounts Portal Receipts Loader ─────────────────────────────────────────
	function handleAccountsSearch(val: string) {
		accountsSearchInput = val;
		clearTimeout(searchTimeoutAccounts);
		searchTimeoutAccounts = setTimeout(() => {
			accountsSearchVal = val;
			currentAccountsPage = 1;
			fetchAccountsReceipts();
		}, 300);
	}

	function triggerAccountsSearchImmediate() {
		clearTimeout(searchTimeoutAccounts);
		accountsSearchVal = accountsSearchInput;
		currentAccountsPage = 1;
		fetchAccountsReceipts();
	}

	function clearAccountsSearch() {
		accountsSearchInput = '';
		accountsSearchVal = '';
		currentAccountsPage = 1;
		fetchAccountsReceipts();
	}

	async function fetchAccountsReceipts() {
		loadingAccounts = true;
		try {
			const params: any = {
				page: currentAccountsPage,
				pageSize: accountsPageSize
			};
			if (accountsSearchVal.trim()) params.search = accountsSearchVal.trim();
			if (accountsStartDate) params.startDate = accountsStartDate;
			if (accountsEndDate) params.endDate = accountsEndDate;

			const res = await apiFetch<any>('api/sales-entries/accounts-receipts', { params });
			accountsReceiptsData = res;
		} catch (err) {
			console.error('Failed to load Accounts Portal receipts:', err);
		} finally {
			loadingAccounts = false;
		}
	}

	function switchTab(tab: 'sales_portal' | 'accounts_portal') {
		activeTab = tab;
		try {
			const url = new URL(window.location.href);
			url.searchParams.set('tab', tab);
			window.history.replaceState({}, '', url.toString());
		} catch {}

		if (tab === 'sales_portal') {
			fetchSalesReceipts();
		} else if (tab === 'accounts_portal') {
			fetchAccountsReceipts();
		}
	}

	onMount(() => {
		const tabParam = $page.url.searchParams.get('tab');
		if (tabParam === 'accounts_portal' || tabParam === 'sales_portal') {
			activeTab = tabParam;
		}

		fetchSalesReceipts();
		fetchAccountsReceipts();

		realtimeController = new ReceiptRealtimeController({
			isGlobalList: true,
			onReceiptChanged: () => {
				fetchSalesReceipts();
				fetchAccountsReceipts();
			}
		});
		realtimeController.mount();
	});

	onDestroy(() => {
		realtimeController?.unmount();
	});

	// ─── CSV Export ──────────────────────────────────────────────────────────────
	async function exportToCSV() {
		exportingCSV = true;
		try {
			if (activeTab === 'sales_portal') {
				const params: any = { page: 1, pageSize: 10000 };
				if (salesSearchVal.trim()) params.search = salesSearchVal.trim();
				if (salesStartDate) params.startDate = salesStartDate;
				if (salesEndDate) params.endDate = salesEndDate;

				const res = await apiFetch<any>('api/sales-entries/receipts', { params }).catch(() => null);
				const items = res?.items || receiptsData?.items || [];
				if (items.length === 0) {
					toast.info('No client receipt records available to export.');
					return;
				}

				const headers = [
					'Receipt Number',
					'Source',
					'Client Name',
					'Client Type',
					'Salesman',
					'Service Type',
					'Amount (BHD)',
					'Payment Method',
					'Status',
					'Sync Status',
					'Logged Date'
				];
				const rows = items.map((row: any) => [
					row.documentNumber || row.receiptId,
					row.source || (row.clientType === 'agent' ? 'Accounts' : 'Salesman'),
					row.headName || row.agentName || '',
					row.clientType || 'customer',
					row.salesmanName || '',
					row.service === 'wallet_deposit' ? 'Wallet Deposit' : (row.service || ''),
					row.amount,
					row.paymentMode || '',
					row.status || '',
					row.syncStatus || 'Synced',
					row.createdAt ? formatDateTime(row.createdAt) : ''
				]);
				downloadCSV(`client_receipts_${getBahrainDateString()}.csv`, headers, rows);
				toast.success('Client receipts exported successfully.');
			} else {
				const params: any = { page: 1, pageSize: 10000 };
				if (accountsSearchVal.trim()) params.search = accountsSearchVal.trim();
				if (accountsStartDate) params.startDate = accountsStartDate;
				if (accountsEndDate) params.endDate = accountsEndDate;

				const res = await apiFetch<any>('api/sales-entries/accounts-receipts', { params }).catch(() => null);
				const items = res?.items || accountsReceiptsData?.items || [];
				if (items.length === 0) {
					toast.info('No general receipt records available to export.');
					return;
				}

				const headers = [
					'Receipt Ref',
					'Document Number',
					'Destination Account',
					'Payment Method',
					'Amount (BHD)',
					'Description',
					'Posting Status',
					'Logged Date'
				];
				const rows = items.map((row: any) => [
					row.referenceId || `TXN-${row.id}`,
					row.documentNumber || `Tx #${row.id}`,
					row.destinationAccountName || row.destinationBankName || 'General Account',
					row.paymentMethod || 'cash',
					row.amount,
					row.description || '',
					row.status || 'Posted',
					row.createdAt ? formatDateTime(row.createdAt) : ''
				]);
				downloadCSV(`accounts_general_receipts_${getBahrainDateString()}.csv`, headers, rows);
				toast.success('General receipts exported successfully.');
			}
		} catch (err: any) {
			console.error('Failed to export CSV:', err);
			toast.error('Failed to export CSV: ' + (err?.message || 'Unknown error'));
		} finally {
			exportingCSV = false;
		}
	}

	function handlePrint() {
		if (activeTab === 'sales_portal') {
			previewDocument('list', 'receipt', { searchTerm: salesSearchVal, startDate: salesStartDate, endDate: salesEndDate });
			toast.info('Generating print document for client receipts...');
		} else {
			previewDocument('list', 'accounts-receipt', { search: accountsSearchVal, startDate: accountsStartDate, endDate: accountsEndDate });
			toast.info('Generating print document for general receipts...');
		}
	}
</script>

<svelte:head>
	<title>Receipts & Postings — Accounts Portal</title>
</svelte:head>

<div class="space-y-6 print:space-y-0 print:p-0">
	<!-- Page Header -->
	<div class="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 print:hidden">
		<div class="flex flex-col gap-1 min-w-0 max-w-md 2xl:max-w-xl">
			<h1 class="text-xl font-bold text-foreground font-sans flex items-center gap-2">
				<Receipt class="h-6 w-6 text-primary shrink-0" />
				<span>Payment Receipts Workspace</span>
			</h1>
			<p class="text-xs text-muted-foreground">
				Manage customer & agent wallet deposits, booking payments, and general cash/bank treasury receipts.
			</p>
		</div>

		<!-- Action Buttons -->
		<div class="flex items-center gap-1.5 sm:gap-2 flex-wrap xl:flex-nowrap shrink-0 xl:justify-end">
			<Button
				variant="default"
				class="h-8.5 px-3 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs whitespace-nowrap shrink-0"
				onclick={() => goto('/sales/receipts/new')}
				title="Record money received into Cash Drawer or Bank Account (General Receipt)"
			>
				<Plus class="h-3.5 w-3.5" />
				<span>Create Receipt</span>
			</Button>
			<Button
				variant="outline"
				class="h-8.5 px-3 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold border-primary/40 text-primary hover:bg-primary/10 shadow-xs whitespace-nowrap shrink-0"
				onclick={() => goto('/sales/receipts/new-client')}
				title="Record payment against Customer or Agent under a Salesman, immediately crediting their wallet"
			>
				<Wallet class="h-3.5 w-3.5 text-primary" />
				<span>Deposit Client Receipt</span>
			</Button>
			<Button
				variant="outline"
				class="h-8.5 px-3 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold hover:bg-muted whitespace-nowrap shrink-0"
				onclick={exportToCSV}
				disabled={exportingCSV}
			>
				<Download class={['h-3.5 w-3.5', exportingCSV ? 'animate-spin' : ''].join(' ')} />
				<span>{exportingCSV ? 'Exporting...' : 'CSV Export'}</span>
			</Button>
			<Button
				variant="outline"
				class="h-8.5 px-3 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold hover:bg-muted whitespace-nowrap shrink-0"
				onclick={handlePrint}
			>
				<Printer class="h-3.5 w-3.5" />
				<span>Print</span>
			</Button>
			<Button
				variant="outline"
				class="h-8.5 px-3 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold hover:bg-muted whitespace-nowrap shrink-0"
				onclick={() => {
					if (activeTab === 'sales_portal') fetchSalesReceipts();
					else fetchAccountsReceipts();
				}}
			>
				<RefreshCw class={['h-3.5 w-3.5', (loadingSales || loadingAccounts) ? 'animate-spin' : ''].join(' ')} />
				<span>Reload</span>
			</Button>
		</div>
	</div>

	<!-- TOP TABS NAVIGATION: Sales Portal (Client) vs Accounts Portal (General)     -->
	<!-- ════════════════════════════════════════════════════════════════════════════ -->
	<div class="flex items-center gap-2 border-b border-border/80 pb-3 print:hidden">
		<button
			type="button"
			onclick={() => switchTab('sales_portal')}
			class={[
				'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border',
				activeTab === 'sales_portal'
					? 'bg-primary text-primary-foreground border-primary shadow-xs'
					: 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/30'
			].join(' ')}
		>
			<Receipt class="h-4 w-4" />
			<span>Sales Portal Receipts</span>
			{#if receiptsData && receiptsData.totalCount !== undefined}
				<span class={[
					'ml-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold',
					activeTab === 'sales_portal' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
				].join(' ')}>
					{receiptsData.totalCount}
				</span>
			{/if}
		</button>

		<button
			type="button"
			onclick={() => switchTab('accounts_portal')}
			class={[
				'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border',
				activeTab === 'accounts_portal'
					? 'bg-primary text-primary-foreground border-primary shadow-xs'
					: 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/30'
			].join(' ')}
		>
			<Building2 class="h-4 w-4" />
			<span>Accounts Portal Receipts</span>
			{#if accountsReceiptsData && accountsReceiptsData.totalCount !== undefined}
				<span class={[
					'ml-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold',
					activeTab === 'accounts_portal' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
				].join(' ')}>
					{accountsReceiptsData.totalCount}
				</span>
			{/if}
		</button>
	</div>

	<!-- ════════════════════════════════════════════════════════════════════════════ -->
	<!-- TAB 1: SALES PORTAL RECEIPTS (ALL CLIENT WALLET RECEIPTS)                   -->
	<!-- ════════════════════════════════════════════════════════════════════════════ -->
	{#if activeTab === 'sales_portal'}
		<!-- Filters Panel for Sales Portal -->
		<div class="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3 print:hidden">
			<div class="relative flex-1 w-full">
				<Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
				<input
					type="text"
					placeholder="Search Client Receipts by Document Ref, Receipt ID, Client, Salesman..."
					bind:value={salesSearchInput}
					oninput={(e) => handleSalesSearch((e.target as HTMLInputElement).value)}
					onkeydown={(e) => { if (e.key === 'Enter') triggerSalesSearchImmediate(); }}
					class="w-full text-xs pl-10 pr-10 py-2 border border-border rounded-xl bg-background text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
				{#if salesSearchInput}
					<button
						type="button"
						onclick={clearSalesSearch}
						class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-full hover:bg-muted"
						title="Clear search"
					>
						<X class="h-3.5 w-3.5" />
					</button>
				{/if}
			</div>
			<div class="flex items-center gap-2 text-xs w-full sm:w-auto">
				<input
					type="date"
					bind:value={salesStartDate}
					onchange={() => { currentSalesPage = 1; fetchSalesReceipts(); }}
					class="p-2 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
				/>
				<span class="text-muted-foreground font-semibold">to</span>
				<input
					type="date"
					bind:value={salesEndDate}
					onchange={() => { currentSalesPage = 1; fetchSalesReceipts(); }}
					class="p-2 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
				/>
				{#if salesStartDate || salesEndDate || salesSearchInput}
					<Button
						variant="ghost"
						size="xs"
						class="text-xs font-semibold text-muted-foreground hover:text-foreground"
						onclick={() => { salesStartDate = ''; salesEndDate = ''; salesSearchInput = ''; salesSearchVal = ''; currentSalesPage = 1; fetchSalesReceipts(); }}
					>
						Clear
					</Button>
				{/if}
			</div>
		</div>

		<!-- Data Grid for Sales Portal Receipts (Unified Client Receipts) -->
		{#if loadingSales}
			<div class="bg-card border border-border rounded-2xl p-6 h-96 flex items-center justify-center animate-pulse">
				<RefreshCw class="h-8 w-8 text-primary animate-spin" />
			</div>
		{:else if receiptsData && receiptsData.items && receiptsData.items.length > 0}
			<div class="bg-card border border-border rounded-2xl overflow-x-auto shadow-xs print:border-none print:shadow-none max-w-full">
				<table class="w-full min-w-[850px] text-left border-collapse text-xs">
					<thead>
						<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold print:bg-transparent">
							<th class="p-4 w-36">Receipt Number</th>
							<th class="p-4 w-24 text-center">Source</th>
							<th class="p-4">Client</th>
							<th class="p-4">Salesman</th>
							<th class="p-4">Service Type</th>
							<th class="p-4 text-right">Receipt Amount</th>
							<th class="p-4 text-center">Status / Sync</th>
							<th class="p-4 w-32">Logged Date</th>
							<th class="p-4 w-24 text-center print:hidden">Action</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/60">
						{#each receiptsData.items as row}
							<tr class="hover:bg-muted/10 transition-colors">
								<td class="p-4 font-mono font-bold text-foreground">
									<a href={`/sales/receipts/${row.id}`} class="hover:underline hover:text-primary cursor-pointer outline-none text-left font-bold font-mono block">
										{row.documentNumber || row.receiptId}
									</a>
									<span class="text-[9px] text-muted-foreground font-mono font-normal">#{row.id}</span>
								</td>
								<td class="p-4 text-center">
									{#if (row.source || '').toLowerCase() === 'accounts' || row.clientType === 'agent'}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/10 text-purple-700 border border-purple-500/20">
											<Building2 class="h-3 w-3" />
											<span>Accounts</span>
										</span>
									{:else}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/10 text-blue-700 border border-blue-500/20">
											<Users class="h-3 w-3" />
											<span>Salesman</span>
										</span>
									{/if}
								</td>
								<td class="p-4">
									<span class="font-bold text-foreground block">{row.headName || row.agentName || '—'}</span>
									<span class="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold uppercase mt-0.5 {row.clientType === 'agent' ? 'bg-purple-500/10 text-purple-700' : 'bg-emerald-500/10 text-emerald-700'}">
										{row.clientType || 'customer'}
									</span>
								</td>
								<td class="p-4 text-muted-foreground font-medium">{row.salesmanName || '—'}</td>
								<td class="p-4 text-muted-foreground font-semibold">
									{row.service === 'wallet_deposit' ? 'Wallet Deposit' : (row.service || 'Receipt')}
								</td>
								<td class="p-4 font-mono font-bold text-right text-foreground">
									<MoneyDisplay amount={row.amount} />
								</td>
								<td class="p-4 text-center">
									{#if row.syncStatus === 'Failed'}
										<div class="flex flex-col items-center gap-1">
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title={row.failureReason || 'Sales Portal Sync Failed'}>
												<AlertTriangle class="h-3 w-3 text-rose-600" />
												<span>Sync Failed</span>
											</span>
											<button
												type="button"
												onclick={(e) => { e.stopPropagation(); handleRetryAccountsReceipt(row.accountsReceiptId || row.id); }}
												disabled={retryingReceiptId === (row.accountsReceiptId || row.id)}
												class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer transition-colors shadow-2xs"
												title="Retry sync to Sales Portal"
											>
												<RotateCw class="h-2.5 w-2.5 {retryingReceiptId === (row.accountsReceiptId || row.id) ? 'animate-spin' : ''}" />
												<span>{retryingReceiptId === (row.accountsReceiptId || row.id) ? 'Retrying...' : 'Retry'}</span>
											</button>
										</div>
									{:else if row.syncStatus === 'PendingSync'}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
											<Clock class="h-3 w-3 text-amber-600" />
											<span>Pending Sync</span>
										</span>
									{:else}
										<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold capitalize {row.status === 'success' || row.status === 'posted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : row.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">
											{row.status}
										</span>
									{/if}
								</td>
								<td class="p-4 font-mono text-muted-foreground"><DateDisplay value={row.createdAt} /></td>
								<td class="p-4 text-center print:hidden">
									<div class="flex items-center justify-center gap-1">
										<button
											type="button"
											onclick={() => previewDocument('receipt', 'receipt', row.id)}
											class="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer inline-block"
											title="Print receipt PDF"
										>
											<Printer class="h-4 w-4" />
										</button>
										<a
											href={`/sales/receipts/${row.id}`}
											class="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer inline-block"
											title={row.source !== 'Accounts' && row.status?.toLowerCase() === 'pending' ? 'Review & Approve Receipt' : 'Inspect details'}
										>
											{#if row.source !== 'Accounts' && row.status?.toLowerCase() === 'pending'}
												<span class="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500 text-white rounded">Review</span>
											{:else}
												<Eye class="h-4.5 w-4.5" />
											{/if}
										</a>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Paging for Sales Portal -->
			<div class="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs pt-4 print:hidden">
				<span class="text-muted-foreground">
					Page {receiptsData.page} of {receiptsData.totalPages} ({receiptsData.totalCount} items)
				</span>
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-2">
						<span class="text-xs text-muted-foreground whitespace-nowrap">Rows per page:</span>
						<select
							value={salesPageSize}
							onchange={(e) => {
								salesPageSize = Number((e.target as HTMLSelectElement).value);
								currentSalesPage = 1;
								fetchSalesReceipts();
							}}
							class="bg-background border border-border rounded-xl px-2.5 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
						>
							<option value={10}>10</option>
							<option value={25}>25</option>
							<option value={50}>50</option>
							<option value={100}>100</option>
							<option value={200}>200</option>
							<option value={500}>500</option>
							<option value={1000}>1000 (All)</option>
						</select>
					</div>
					<div class="flex gap-2">
						<Button
							variant="outline"
							class="h-8.5 cursor-pointer rounded-xl px-2.5"
							disabled={currentSalesPage <= 1}
							onclick={() => { currentSalesPage--; fetchSalesReceipts(); }}
						>
							<ChevronLeft class="h-3 w-3 mr-1" /> Prev
						</Button>
						<Button
							variant="outline"
							class="h-8.5 cursor-pointer rounded-xl px-2.5"
							disabled={currentSalesPage >= receiptsData.totalPages}
							onclick={() => { currentSalesPage++; fetchSalesReceipts(); }}
						>
							Next <ChevronRight class="h-3 w-3 ml-1" />
						</Button>
					</div>
				</div>
			</div>
		{:else}
			<div class="bg-card border border-border rounded-2xl p-16 text-center text-muted-foreground text-xs print:hidden space-y-3">
				<Receipt class="h-10 w-10 text-muted-foreground/40 mx-auto" />
				<p>No client receipts found matching filters.</p>
				<div class="flex items-center justify-center pt-2">
					<Button
						variant="outline"
						size="sm"
						class="rounded-xl cursor-pointer border-primary/40 text-primary hover:bg-primary/10"
						onclick={() => goto('/sales/receipts/new-client')}
					>
						<Wallet class="h-3.5 w-3.5 mr-1 text-primary" />
						Create Client Receipt (Deposit to Wallet)
					</Button>
				</div>
			</div>
		{/if}

	<!-- ════════════════════════════════════════════════════════════════════════════ -->
	<!-- TAB 2: ACCOUNTS PORTAL RECEIPTS (GENERAL TREASURY RECEIPTS ONLY)            -->
	<!-- ════════════════════════════════════════════════════════════════════════════ -->
	{:else if activeTab === 'accounts_portal'}
		<!-- Filters Panel for Accounts Portal -->
		<div class="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3 print:hidden">
			<div class="relative flex-1 w-full">
				<Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
				<input
					type="text"
					placeholder="Search Accounts Portal by Ref, Account name, Description, Tx ID..."
					bind:value={accountsSearchInput}
					oninput={(e) => handleAccountsSearch((e.target as HTMLInputElement).value)}
					onkeydown={(e) => { if (e.key === 'Enter') triggerAccountsSearchImmediate(); }}
					class="w-full text-xs pl-10 pr-10 py-2 border border-border rounded-xl bg-background text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
				{#if accountsSearchInput}
					<button
						type="button"
						onclick={clearAccountsSearch}
						class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-full hover:bg-muted"
						title="Clear search"
					>
						<X class="h-3.5 w-3.5" />
					</button>
				{/if}
			</div>
			<div class="flex items-center gap-2 text-xs w-full sm:w-auto">
				<input
					type="date"
					bind:value={accountsStartDate}
					onchange={() => { currentAccountsPage = 1; fetchAccountsReceipts(); }}
					class="p-2 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
				/>
				<span class="text-muted-foreground font-semibold">to</span>
				<input
					type="date"
					bind:value={accountsEndDate}
					onchange={() => { currentAccountsPage = 1; fetchAccountsReceipts(); }}
					class="p-2 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
				/>
				{#if accountsStartDate || accountsEndDate || accountsSearchInput}
					<Button
						variant="ghost"
						size="xs"
						class="text-xs font-semibold text-muted-foreground hover:text-foreground"
						onclick={() => { accountsStartDate = ''; accountsEndDate = ''; accountsSearchInput = ''; accountsSearchVal = ''; currentAccountsPage = 1; fetchAccountsReceipts(); }}
					>
						Clear
					</Button>
				{/if}
			</div>
		</div>

		<!-- Data Grid for Accounts Portal General Receipts -->
		{#if loadingAccounts}
			<div class="bg-card border border-border rounded-2xl p-6 h-96 flex items-center justify-center animate-pulse">
				<RefreshCw class="h-8 w-8 text-primary animate-spin" />
			</div>
		{:else if accountsReceiptsData && accountsReceiptsData.items && accountsReceiptsData.items.length > 0}
			<div class="bg-card border border-border rounded-2xl overflow-x-auto shadow-xs print:border-none print:shadow-none max-w-full">
				<table class="w-full min-w-[750px] text-left border-collapse text-xs">
					<thead>
						<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold print:bg-transparent">
							<th class="p-4 w-36">Receipt Ref / Doc</th>
							<th class="p-4">Destination Account</th>
							<th class="p-4 w-24">Method</th>
							<th class="p-4">Description / Narrative</th>
							<th class="p-4 text-right">Receipt Amount</th>
							<th class="p-4 text-center">Status</th>
							<th class="p-4 w-36">Logged Date</th>
							<th class="p-4 w-16 text-center print:hidden">Action</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/60">
						{#each accountsReceiptsData.items as row}
							<tr class="hover:bg-muted/10 transition-colors">
								<td class="p-4 font-mono font-bold text-foreground">
									<button
										type="button"
										onclick={() => selectedAccountsReceipt = row}
										class="hover:underline hover:text-primary cursor-pointer text-left font-bold font-mono block"
									>
										{row.referenceId || `TXN-${row.id}`}
									</button>
									<span class="text-[9px] text-muted-foreground font-mono font-normal">{row.documentNumber || `Tx #${row.id}`}</span>
								</td>
								<td class="p-4">
									{#if row.destinationAccountName}
										<div class="flex items-center gap-1.5 font-bold text-foreground">
											<Coins class="h-3.5 w-3.5 text-emerald-600 shrink-0" />
											<span>{row.destinationAccountName}</span>
										</div>
										<span class="text-[9px] text-muted-foreground">Cash Drawer</span>
									{:else if row.destinationBankName}
										<div class="flex items-center gap-1.5 font-bold text-foreground">
											<Landmark class="h-3.5 w-3.5 text-blue-600 shrink-0" />
											<span>{row.destinationBankName}</span>
										</div>
										<span class="text-[9px] text-muted-foreground">Bank Account</span>
									{:else}
										<span class="font-bold text-foreground">—</span>
									{/if}
								</td>
								<td class="p-4">
									<span class="capitalize px-2 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-foreground border border-border/60">
										{row.paymentMethod || 'cash'}
									</span>
								</td>
								<td class="p-4 text-muted-foreground max-w-[240px] truncate" title={row.description}>
									{row.description || 'General receipt collection'}
								</td>
								<td class="p-4 font-mono font-bold text-right text-foreground">
									<MoneyDisplay amount={row.amount} />
								</td>
								<td class="p-4 text-center">
									<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
										Posted
									</span>
								</td>
								<td class="p-4 font-mono text-muted-foreground">
									<DateDisplay value={row.createdAt} />
								</td>
								<td class="p-4 text-center print:hidden">
									<div class="flex items-center justify-center gap-1">
										<button
											type="button"
											onclick={() => previewDocument('receipt', 'accounts-receipt', row.id)}
											class="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer inline-block"
											title="Print receipt voucher PDF"
										>
											<Printer class="h-4 w-4" />
										</button>
										<button
											type="button"
											onclick={() => selectedAccountsReceipt = row}
											class="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer inline-block"
											title="Inspect receipt voucher"
										>
											<Eye class="h-4.5 w-4.5" />
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Paging for Accounts Portal -->
			<div class="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs pt-4 print:hidden">
				<span class="text-muted-foreground">
					Page {accountsReceiptsData.page} of {accountsReceiptsData.totalPages} ({accountsReceiptsData.totalCount} items)
				</span>
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-2">
						<span class="text-xs text-muted-foreground whitespace-nowrap">Rows per page:</span>
						<select
							value={accountsPageSize}
							onchange={(e) => {
								accountsPageSize = Number((e.target as HTMLSelectElement).value);
								currentAccountsPage = 1;
								fetchAccountsReceipts();
							}}
							class="bg-background border border-border rounded-xl px-2.5 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
						>
							<option value={10}>10</option>
							<option value={25}>25</option>
							<option value={50}>50</option>
							<option value={100}>100</option>
							<option value={200}>200</option>
							<option value={500}>500</option>
							<option value={1000}>1000 (All)</option>
						</select>
					</div>
					<div class="flex gap-2">
						<Button
							variant="outline"
							class="h-8.5 cursor-pointer rounded-xl px-2.5"
							disabled={currentAccountsPage <= 1}
							onclick={() => { currentAccountsPage--; fetchAccountsReceipts(); }}
						>
							<ChevronLeft class="h-3 w-3 mr-1" /> Prev
						</Button>
						<Button
							variant="outline"
							class="h-8.5 cursor-pointer rounded-xl px-2.5"
							disabled={currentAccountsPage >= accountsReceiptsData.totalPages}
							onclick={() => { currentAccountsPage++; fetchAccountsReceipts(); }}
						>
							Next <ChevronRight class="h-3 w-3 ml-1" />
						</Button>
					</div>
				</div>
			</div>
		{:else}
			<div class="bg-card border border-border rounded-2xl p-16 text-center text-muted-foreground text-xs print:hidden space-y-3">
				<Building2 class="h-10 w-10 text-muted-foreground/40 mx-auto" />
				<p>No Accounts Portal general receipts found matching filters.</p>
				<div class="flex items-center justify-center pt-2">
					<Button
						variant="default"
						size="sm"
						class="rounded-xl cursor-pointer"
						onclick={() => goto('/sales/receipts/new')}
					>
						<Plus class="h-3.5 w-3.5 mr-1" />
						Create General Receipt
					</Button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- ════════════════════════════════════════════════════════════════════════════ -->
<!-- ACCOUNTS GENERAL RECEIPT INSPECTION MODAL                                   -->
<!-- ════════════════════════════════════════════════════════════════════════════ -->
{#if selectedAccountsReceipt}
	<div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<div class="flex items-center gap-2">
					<Receipt class="h-5 w-5 text-primary" />
					<h3 class="font-bold text-foreground text-base">General Receipt Voucher</h3>
				</div>
				<button
					type="button"
					onclick={() => selectedAccountsReceipt = null}
					class="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<div class="space-y-3 text-xs">
				<div class="p-3 bg-muted/40 rounded-xl flex items-center justify-between">
					<span class="text-muted-foreground font-medium">Receipt Ref / Number:</span>
					<span class="font-mono font-bold text-foreground text-sm">
						{selectedAccountsReceipt.referenceId || `TXN-${selectedAccountsReceipt.id}`}
					</span>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div class="p-3 bg-muted/30 rounded-xl">
						<span class="text-muted-foreground text-[10px] block font-medium">Destination Account</span>
						<span class="font-bold text-foreground block mt-0.5">
							{selectedAccountsReceipt.destinationAccountName || selectedAccountsReceipt.destinationBankName || 'General Account'}
						</span>
					</div>
					<div class="p-3 bg-muted/30 rounded-xl">
						<span class="text-muted-foreground text-[10px] block font-medium">Payment Mode</span>
						<span class="font-bold text-foreground capitalize block mt-0.5">
							{selectedAccountsReceipt.paymentMethod || 'cash'}
						</span>
					</div>
				</div>

				<div class="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
					<span class="font-bold text-emerald-800 text-xs">Received Amount:</span>
					<span class="text-base font-black font-mono text-emerald-700">
						<MoneyDisplay amount={selectedAccountsReceipt.amount} />
					</span>
				</div>

				<div class="p-3 bg-muted/30 rounded-xl space-y-1">
					<span class="text-muted-foreground text-[10px] block font-medium">Description / Narrative</span>
					<p class="text-foreground leading-relaxed">
						{selectedAccountsReceipt.description || 'General receipt collection'}
					</p>
				</div>

				<div class="grid grid-cols-2 gap-3 text-[11px] text-muted-foreground pt-1">
					<div>
						<span>Logged At: </span>
						<span class="font-mono font-medium text-foreground">
							{selectedAccountsReceipt.createdAt ? selectedAccountsReceipt.createdAt.replace('T', ' ').slice(0, 19) : '—'}
						</span>
					</div>
					<div class="text-right">
						<span>Posting Status: </span>
						<span class="font-bold text-emerald-600 capitalize">
							{selectedAccountsReceipt.status || 'Posted'}
						</span>
					</div>
				</div>
			</div>

			<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
				<Button
					variant="outline"
					size="sm"
					class="rounded-xl cursor-pointer"
					onclick={() => previewDocument('receipt', 'accounts-receipt', selectedAccountsReceipt.id)}
				>
					<Printer class="h-3.5 w-3.5 mr-1" />
					Print Voucher
				</Button>
				<Button
					variant="default"
					size="sm"
					class="rounded-xl cursor-pointer"
					onclick={() => selectedAccountsReceipt = null}
				>
					Close
				</Button>
			</div>
		</div>
	</div>
{/if}
