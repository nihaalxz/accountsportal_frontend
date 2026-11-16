<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/api/api-client';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { DateDisplay } from '$lib/components';
	import { getBahrainPresetRanges, formatDateOnly } from '$lib/formatters/date';
	import { Button } from '$lib/components/ui/button';
	import { toast } from '$lib/stores/toast';
	import {
		BookOpen,
		RefreshCw,
		FileSpreadsheet,
		FileDown,
		TrendingUp,
		ShieldCheck,
		Search,
		ChevronRight,
		ChevronDown,
		AlertTriangle,
		Landmark,
		Calendar,
		Briefcase,
		ShieldAlert
	} from 'lucide-svelte';

	// ─── Interfaces ───────────────────────────────────────────────────────────────
	interface ChartOfAccountResponse {
		id: number;
		code: string;
		name: string;
		parentId: number | null;
		isControlAccount: boolean;
	}

	interface GeneralLedgerReportItem {
		id: number;
		postingDate: string;
		debit: number;
		credit: number;
		description: string;
		sourceType: string;
		sourceId: string;
		sourceReference: string | null;
		correlationId: string;
		createdAt: string;
	}

	interface GeneralLedgerReportResponse {
		accountId: number;
		accountCode: string;
		accountName: string;
		openingBalance: number;
		endingBalance: number;
		totalDebit: number;
		totalCredit: number;
		items: GeneralLedgerReportItem[];
	}

	interface TrialBalanceItem {
		accountId: number;
		accountCode: string;
		accountName: string;
		accountType: string;
		normalBalance: string;
		totalDebit: number;
		totalCredit: number;
		endingBalance: number;
	}

	interface TrialBalanceResponse {
		items: TrialBalanceItem[];
		totalDebitSum: number;
		totalCreditSum: number;
		isBalanced: boolean;
	}

	interface BalanceSheetItem {
		accountId: number;
		accountCode: string;
		accountName: string;
		parentId: number | null;
		balance: number;
		isControlAccount: boolean;
	}

	interface BalanceSheetResponse {
		assets: BalanceSheetItem[];
		totalAssets: number;
		liabilities: BalanceSheetItem[];
		totalLiabilities: number;
		equity: BalanceSheetItem[];
		totalEquity: number;
		isBalanced: boolean;
	}

	interface ProfitAndLossItem {
		accountId: number;
		accountCode: string;
		accountName: string;
		parentId: number | null;
		balance: number;
		isControlAccount: boolean;
	}

	interface ProfitAndLossResponse {
		revenues: ProfitAndLossItem[];
		totalRevenues: number;
		expenses: ProfitAndLossItem[];
		totalExpenses: number;
		netProfit: number;
	}

	interface LedgerDashboardResponse {
		agentWalletsSum: number;
		supplierWalletsSum: number;
		pendingSupplierPaymentsCount: number;
		pendingPurchaseReturnsCount: number;
		pendingSalesReturnsCount: number;
		pendingExpensesCount: number;
		unpaidPayrollCount: number;
		draftJournalEntriesCount: number;
	}

	// ─── States ──────────────────────────────────────────────────────────────────
	let activeTab = $state<'dashboard' | 'statement' | 'trial-balance' | 'balance-sheet' | 'profit-loss'>('dashboard');

	// Date setups
	const { thisMonth } = getBahrainPresetRanges();
	const firstDay = thisMonth.startDate;
	const today = thisMonth.endDate;

	// Dropdowns & general data
	let accountsList = $state<ChartOfAccountResponse[]>([]);

	// Dashboard state
	let dashboardData = $state<LedgerDashboardResponse | null>(null);
	let loadingDashboard = $state(false);

	// Statement state
	let statementAccountId = $state<string>('');
	let statementStart = $state(firstDay);
	let statementEnd = $state(today);
	let statementData = $state<GeneralLedgerReportResponse | null>(null);
	let loadingStatement = $state(false);

	// Trial balance state
	let tbAsOf = $state(today);
	let trialBalanceData = $state<TrialBalanceResponse | null>(null);
	let loadingTB = $state(false);

	// Balance sheet state
	let bsAsOf = $state(today);
	let balanceSheetData = $state<BalanceSheetResponse | null>(null);
	let loadingBS = $state(false);
	let collapsedBS = $state<Record<number, boolean>>({});

	// Profit & loss state
	let plStart = $state(firstDay);
	let plEnd = $state(today);
	let profitLossData = $state<ProfitAndLossResponse | null>(null);
	let loadingPL = $state(false);
	let collapsedPL = $state<Record<number, boolean>>({});

	// ─── API Loaders ─────────────────────────────────────────────────────────────
	async function loadAccounts() {
		try {
			const res = await apiFetch<ChartOfAccountResponse[]>('api/ChartOfAccounts');
			accountsList = res || [];
			if (accountsList.length > 0 && !statementAccountId && accountsList[0]?.id) {
				statementAccountId = String(accountsList[0].id);
			}
		} catch (err: any) {
			toast.error(err.message || 'Failed to load chart of accounts.');
		}
	}

	async function fetchDashboard() {
		loadingDashboard = true;
		try {
			dashboardData = await apiFetch<LedgerDashboardResponse>('api/Reporting/ledger-dashboard');
		} catch (err: any) {
			toast.error(err.message || 'Failed to load ledger dashboard.');
		} finally {
			loadingDashboard = false;
		}
	}

	async function fetchStatement() {
		if (!statementAccountId) return;
		loadingStatement = true;
		try {
			statementData = await apiFetch<GeneralLedgerReportResponse>(
				`api/Reporting/ledger-statement/${statementAccountId}?startDate=${statementStart}&endDate=${statementEnd}`
			);
		} catch (err: any) {
			toast.error(err.message || 'Failed to fetch ledger statement.');
		} finally {
			loadingStatement = false;
		}
	}

	async function fetchTrialBalance() {
		loadingTB = true;
		try {
			trialBalanceData = await apiFetch<TrialBalanceResponse>(
				`api/Reporting/trial-balance?asOfDate=${tbAsOf}`
			);
		} catch (err: any) {
			toast.error(err.message || 'Failed to fetch trial balance.');
		} finally {
			loadingTB = false;
		}
	}

	async function fetchBalanceSheet() {
		loadingBS = true;
		try {
			balanceSheetData = await apiFetch<BalanceSheetResponse>(
				`api/Reporting/balance-sheet?asOfDate=${bsAsOf}`
			);
		} catch (err: any) {
			toast.error(err.message || 'Failed to fetch balance sheet.');
		} finally {
			loadingBS = false;
		}
	}

	async function fetchProfitLoss() {
		loadingPL = true;
		try {
			profitLossData = await apiFetch<ProfitAndLossResponse>(
				`api/Reporting/profit-loss?startDate=${plStart}&endDate=${plEnd}`
			);
		} catch (err: any) {
			toast.error(err.message || 'Failed to fetch profit & loss.');
		} finally {
			loadingPL = false;
		}
	}

	function handleTabChange(tab: typeof activeTab) {
		activeTab = tab;
		if (tab === 'dashboard') fetchDashboard();
		else if (tab === 'statement') fetchStatement();
		else if (tab === 'trial-balance') fetchTrialBalance();
		else if (tab === 'balance-sheet') fetchBalanceSheet();
		else if (tab === 'profit-loss') fetchProfitLoss();
	}

	// ─── CSV/PDF Exports ─────────────────────────────────────────────────────────
	import { exportToCSV as downloadCSV } from '$lib/utils/csv-exporter';

	function exportCSV(title: string, headers: string[], rows: any[][]) {
		downloadCSV(`${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${today}.csv`, headers, rows);
		toast.success('CSV exported successfully.');
	}

	import { previewDocument } from '$lib/utils/preview-document';

	function exportPDF(title: string, subtitle: string, headers: string[], rows: any[][]) {
		previewDocument('report', 'accounting-ledger', { title, subtitle });
	}

	// ─── Specific Exports Helpers ────────────────────────────────────────────────
	function exportStatement(type: 'csv' | 'pdf') {
		if (!statementData) return;
		const title = `Ledger Statement — ${statementData.accountName}`;
		const subtitle = `Account: ${statementData.accountCode} | Range: ${statementStart} to ${statementEnd}`;
		const headers = ['Date', 'Description', 'Debit', 'Credit', 'Running Balance', 'Source'];
		
		let bal = statementData.openingBalance;
		const rows = statementData.items.map(item => {
			bal += (item.debit - item.credit);
			return [
				formatDateOnly(item.postingDate),
				item.description,
				item.debit > 0 ? item.debit.toFixed(3) : '0.000',
				item.credit > 0 ? item.credit.toFixed(3) : '0.000',
				bal.toFixed(3),
				`${item.sourceType} #${item.sourceId}`
			];
		});

		if (type === 'csv') exportCSV(title, headers, rows);
		else exportPDF(title, subtitle, headers, rows);
	}

	function exportTrialBalance(type: 'csv' | 'pdf') {
		if (!trialBalanceData) return;
		const title = `Trial Balance`;
		const subtitle = `As of Date: ${tbAsOf}`;
		const headers = ['Code', 'Account Name', 'Type', 'Debit Balance', 'Credit Balance'];
		const rows = trialBalanceData.items.map(i => [
			i.accountCode,
			i.accountName,
			i.accountType.toUpperCase(),
			i.totalDebit > 0 ? i.totalDebit.toFixed(3) : '0.000',
			i.totalCredit > 0 ? i.totalCredit.toFixed(3) : '0.000'
		]);

		if (type === 'csv') exportCSV(title, headers, rows);
		else exportPDF(title, subtitle, headers, rows);
	}

	function exportBalanceSheet(type: 'csv' | 'pdf') {
		if (!balanceSheetData) return;
		const title = `Balance Sheet`;
		const subtitle = `As of Date: ${bsAsOf}`;
		const headers = ['Account Code', 'Account Name', 'Classification', 'Balance (BHD)'];
		
		const rows: any[][] = [];
		balanceSheetData.assets.forEach(i => rows.push([i.accountCode, i.accountName, 'ASSET', i.balance.toFixed(3)]));
		balanceSheetData.liabilities.forEach(i => rows.push([i.accountCode, i.accountName, 'LIABILITY', i.balance.toFixed(3)]));
		balanceSheetData.equity.forEach(i => rows.push([i.accountCode, i.accountName, 'EQUITY', i.balance.toFixed(3)]));

		if (type === 'csv') exportCSV(title, headers, rows);
		else exportPDF(title, subtitle, headers, rows);
	}

	function exportProfitLoss(type: 'csv' | 'pdf') {
		if (!profitLossData) return;
		const title = `Profit & Loss Statement`;
		const subtitle = `Period: ${plStart} to ${plEnd}`;
		const headers = ['Account Code', 'Account Name', 'Classification', 'Balance (BHD)'];
		
		const rows: any[][] = [];
		profitLossData.revenues.forEach(i => rows.push([i.accountCode, i.accountName, 'REVENUE', i.balance.toFixed(3)]));
		profitLossData.expenses.forEach(i => rows.push([i.accountCode, i.accountName, 'EXPENSE', i.balance.toFixed(3)]));

		if (type === 'csv') exportCSV(title, headers, rows);
		else exportPDF(title, subtitle, headers, rows);
	}

	// ─── Svelte Hierarchical Groupings ───────────────────────────────────────────
	function buildTree(items: (BalanceSheetItem | ProfitAndLossItem)[]) {
		const map: Record<number, any> = {};
		const roots: any[] = [];
		
		items.forEach(item => {
			map[item.accountId] = { ...item, children: [] };
		});

		items.forEach(item => {
			const node = map[item.accountId];
			if (item.parentId && map[item.parentId]) {
				map[item.parentId].children.push(node);
			} else {
				roots.push(node);
			}
		});

		return roots;
	}

	onMount(() => {
		loadAccounts();
		fetchDashboard();
	});
</script>

<svelte:head>
	<title>General Ledger — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-bold text-foreground flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-primary" /> General Ledger Explorer
			</h1>
			<p class="text-xs text-muted-foreground">Comprehensive Double-Entry Ledger queries, Trial Balances, Balance Sheets, and Profit & Loss.</p>
		</div>
	</div>

	<!-- Tab Selection -->
	<div class="flex flex-wrap gap-1 bg-muted/40 rounded-xl p-1 w-fit border border-border/50">
		<button onclick={() => handleTabChange('dashboard')} class="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer {activeTab === 'dashboard' ? 'bg-card text-foreground shadow-sm border border-border/30' : 'text-muted-foreground hover:text-foreground'}">
			Dashboard
		</button>
		<button onclick={() => handleTabChange('statement')} class="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer {activeTab === 'statement' ? 'bg-card text-foreground shadow-sm border border-border/30' : 'text-muted-foreground hover:text-foreground'}">
			Ledger Statements
		</button>
		<button onclick={() => handleTabChange('trial-balance')} class="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer {activeTab === 'trial-balance' ? 'bg-card text-foreground shadow-sm border border-border/30' : 'text-muted-foreground hover:text-foreground'}">
			Trial Balance
		</button>
		<button onclick={() => handleTabChange('balance-sheet')} class="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer {activeTab === 'balance-sheet' ? 'bg-card text-foreground shadow-sm border border-border/30' : 'text-muted-foreground hover:text-foreground'}">
			Balance Sheet
		</button>
		<button onclick={() => handleTabChange('profit-loss')} class="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer {activeTab === 'profit-loss' ? 'bg-card text-foreground shadow-sm border border-border/30' : 'text-muted-foreground hover:text-foreground'}">
			Profit & Loss
		</button>
	</div>

	<!-- ─── TAB 1: DASHBOARD ─────────────────────────────────────────── -->
	{#if activeTab === 'dashboard'}
		{#if loadingDashboard}
			<div class="bg-card border border-border rounded-2xl h-48 flex items-center justify-center"><RefreshCw class="h-7 w-7 text-primary animate-spin" /></div>
		{:else if dashboardData}
			<!-- Financial Health Cards -->
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				<div class="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-1">
					<span class="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Agent Outstanding Balance</span>
					<span class="text-xl font-bold font-mono text-foreground"><MoneyDisplay amount={dashboardData.agentWalletsSum} /></span>
				</div>
				<div class="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-1">
					<span class="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Supplier Outstanding Balance</span>
					<span class="text-xl font-bold font-mono text-foreground"><MoneyDisplay amount={dashboardData.supplierWalletsSum} /></span>
				</div>
			</div>

			<!-- Operational Alerts & Pending Requests Dashboard -->
			<div class="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
				<h2 class="text-sm font-bold text-foreground flex items-center gap-1.5">
					<ShieldCheck class="h-4.5 w-4.5 text-primary" /> Active Workflow Pending Tasks
				</h2>
				<p class="text-xs text-muted-foreground">List of draft or pending approval transactions awaiting accountant review before ledger posting.</p>
				
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-2">
					<div class="bg-muted/30 rounded-xl p-4 space-y-1 text-center border border-border/30">
						<span class="text-[10px] text-muted-foreground uppercase font-semibold">Pending Payouts</span>
						<span class="text-lg font-bold block text-rose-600">{dashboardData.pendingSupplierPaymentsCount}</span>
					</div>
					<div class="bg-muted/30 rounded-xl p-4 space-y-1 text-center border border-border/30">
						<span class="text-[10px] text-muted-foreground uppercase font-semibold">Pending Purchase Returns</span>
						<span class="text-lg font-bold block text-emerald-600">{dashboardData.pendingPurchaseReturnsCount}</span>
					</div>
					<div class="bg-muted/30 rounded-xl p-4 space-y-1 text-center border border-border/30">
						<span class="text-[10px] text-muted-foreground uppercase font-semibold">Pending Sales Returns</span>
						<span class="text-lg font-bold block text-sky-600">{dashboardData.pendingSalesReturnsCount}</span>
					</div>
					<div class="bg-muted/30 rounded-xl p-4 space-y-1 text-center border border-border/30">
						<span class="text-[10px] text-muted-foreground uppercase font-semibold">Pending Expense Claims</span>
						<span class="text-lg font-bold block text-amber-600">{dashboardData.pendingExpensesCount}</span>
					</div>
					<div class="bg-muted/30 rounded-xl p-4 space-y-1 text-center border border-border/30">
						<span class="text-[10px] text-muted-foreground uppercase font-semibold">Draft Journal Entries</span>
						<span class="text-lg font-bold block text-slate-600">{dashboardData.draftJournalEntriesCount}</span>
					</div>
				</div>
			</div>
		{/if}
	{/if}

	<!-- ─── TAB 2: GENERAL LEDGER STATEMENTS ──────────────────────── -->
	{#if activeTab === 'statement'}
		<div class="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
			<div class="flex flex-wrap items-end gap-3 text-xs">
				<div class="space-y-1.5 flex-1 min-w-48">
					<label for="gl-account" class="block font-semibold text-muted-foreground">Select Ledger Account</label>
					<select id="gl-account" bind:value={statementAccountId} class="h-9.5 w-full bg-background border border-border rounded-xl px-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" required>
						{#each accountsList as acc}
							<option value={String(acc.id)}>{acc.code} — {acc.name} {acc.isControlAccount ? '[Control]' : ''}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-1.5">
					<label for="gl-start" class="block font-semibold text-muted-foreground">Start Date</label>
					<input id="gl-start" type="date" bind:value={statementStart} class="h-9.5 p-2 rounded-xl border border-border bg-background text-foreground" />
				</div>
				<div class="space-y-1.5">
					<label for="gl-end" class="block font-semibold text-muted-foreground">End Date</label>
					<input id="gl-end" type="date" bind:value={statementEnd} class="h-9.5 p-2 rounded-xl border border-border bg-background text-foreground" />
				</div>
				<Button onclick={fetchStatement} disabled={loadingStatement} class="h-9.5 rounded-xl cursor-pointer">
					{#if loadingStatement}<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />{/if}
					Query Ledger
				</Button>
				{#if statementData && statementData.items.length > 0}
					<Button variant="outline" onclick={() => exportStatement('csv')} class="h-9.5 rounded-xl cursor-pointer flex items-center gap-1">
						<FileSpreadsheet class="h-3.5 w-3.5" /> CSV
					</Button>
					<Button variant="outline" onclick={() => exportStatement('pdf')} class="h-9.5 rounded-xl cursor-pointer flex items-center gap-1">
						<FileDown class="h-3.5 w-3.5" /> PDF
					</Button>
				{/if}
			</div>

			{#if loadingStatement}
				<div class="h-40 flex items-center justify-center"><RefreshCw class="h-7 w-7 text-primary animate-spin" /></div>
			{:else if statementData}
				<!-- Aggregation info -->
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/15 p-4 rounded-2xl border border-border/50 text-xs">
					<div>
						<span class="text-muted-foreground block font-semibold mb-0.5">Opening Balance</span>
						<span class="font-bold"><MoneyDisplay amount={statementData.openingBalance} /></span>
					</div>
					<div>
						<span class="text-emerald-700 block font-semibold mb-0.5">Total Debits</span>
						<span class="font-bold text-emerald-600"><MoneyDisplay amount={statementData.totalDebit} /></span>
					</div>
					<div>
						<span class="text-red-700 block font-semibold mb-0.5">Total Credits</span>
						<span class="font-bold text-red-600"><MoneyDisplay amount={statementData.totalCredit} /></span>
					</div>
					<div>
						<span class="text-muted-foreground block font-semibold mb-0.5">Ending Balance</span>
						<span class="font-bold"><MoneyDisplay amount={statementData.endingBalance} /></span>
					</div>
				</div>

				<!-- Table of postings -->
				{#if statementData.items.length === 0}
					<div class="p-8 text-center text-muted-foreground text-xs bg-muted/5 border border-border rounded-xl">No transactions posted in this period.</div>
				{:else}
					<div class="bg-card border border-border rounded-2xl overflow-x-auto shadow-xs max-w-full">
						<table class="w-full min-w-[750px] text-left border-collapse text-xs">
							<thead>
								<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold">
									<th class="p-4 w-28">Date</th>
									<th class="p-4">Description</th>
									<th class="p-4 w-28 text-right">Debit</th>
									<th class="p-4 w-28 text-right">Credit</th>
									<th class="p-4 w-28 text-right">Running Balance</th>
									<th class="p-4 w-32">Source Ref</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/50">
								{#each (() => {
									let bal = statementData.openingBalance;
									return statementData.items.map(item => {
										bal += (item.debit - item.credit);
										return { item, bal };
									});
								})() as row}
									<tr class="hover:bg-muted/10 transition-colors">
										<td class="p-4 text-muted-foreground"><DateDisplay value={row.item.postingDate} /></td>
										<td class="p-4 font-semibold text-foreground">{row.item.description}</td>
										<td class="p-4 text-right font-bold text-emerald-600">
											{#if row.item.debit > 0}<MoneyDisplay amount={row.item.debit} />{:else}<span class="text-muted-foreground/20">—</span>{/if}
										</td>
										<td class="p-4 text-right font-bold text-rose-600">
											{#if row.item.credit > 0}<MoneyDisplay amount={row.item.credit} />{:else}<span class="text-muted-foreground/20">—</span>{/if}
										</td>
										<td class="p-4 text-right font-mono font-bold text-foreground"><MoneyDisplay amount={row.bal} /></td>
										<td class="p-4 font-mono text-[10px] text-muted-foreground">
											{row.item.sourceType} #{row.item.sourceId}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{/if}
		</div>
	{/if}

	<!-- ─── TAB 3: TRIAL BALANCE ───────────────────────────────────── -->
	{#if activeTab === 'trial-balance'}
		<div class="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
			<div class="flex flex-wrap items-end gap-3 text-xs">
				<div class="space-y-1.5">
					<label for="tb-asof" class="block font-semibold text-muted-foreground">As Of Date</label>
					<input id="tb-asof" type="date" bind:value={tbAsOf} class="h-9.5 p-2 rounded-xl border border-border bg-background text-foreground" />
				</div>
				<Button onclick={fetchTrialBalance} disabled={loadingTB} class="h-9.5 rounded-xl cursor-pointer">
					{#if loadingTB}<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />{/if}
					Load Trial Balance
				</Button>
				{#if trialBalanceData}
					<Button variant="outline" onclick={() => exportTrialBalance('csv')} class="h-9.5 rounded-xl cursor-pointer flex items-center gap-1">
						<FileSpreadsheet class="h-3.5 w-3.5" /> CSV
					</Button>
					<Button variant="outline" onclick={() => exportTrialBalance('pdf')} class="h-9.5 rounded-xl cursor-pointer flex items-center gap-1">
						<FileDown class="h-3.5 w-3.5" /> PDF
					</Button>
				{/if}
			</div>

			{#if loadingTB}
				<div class="h-40 flex items-center justify-center"><RefreshCw class="h-7 w-7 text-primary animate-spin" /></div>
			{:else if trialBalanceData}
				<!-- Balanced Alert -->
				{#if trialBalanceData.isBalanced}
					<div class="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 text-xs font-semibold">
						<ShieldCheck class="h-4.5 w-4.5 text-emerald-600" />
						Trial Balance is balanced. All debits equal credits.
					</div>
				{:else}
					<div class="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-xs font-semibold">
						<ShieldAlert class="h-4.5 w-4.5 text-rose-600" />
						Trial Balance is UNBALANCED. Total debits differ from credits!
					</div>
				{/if}

				<!-- Data Table -->
				<div class="bg-card border border-border rounded-2xl overflow-x-auto shadow-xs max-w-full">
					<table class="w-full min-w-[750px] text-left border-collapse text-xs">
						<thead>
							<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">
								<th class="p-4 w-28">Code</th>
								<th class="p-4">Account Name</th>
								<th class="p-4">Type</th>
								<th class="p-4 w-32 text-right">Debit Balance</th>
								<th class="p-4 w-32 text-right">Credit Balance</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/50">
							{#each trialBalanceData.items as i}
								<tr class="hover:bg-muted/10 transition-colors">
									<td class="p-4 font-mono font-bold text-foreground">{i.accountCode}</td>
									<td class="p-4 font-semibold text-foreground">{i.accountName}</td>
									<td class="p-4 uppercase text-[10px] text-muted-foreground">{i.accountType}</td>
									<td class="p-4 text-right font-mono font-bold text-emerald-600">
										{#if i.endingBalance > 0 && i.normalBalance === 'debit'}
											<MoneyDisplay amount={i.endingBalance} />
										{:else if i.endingBalance < 0 && i.normalBalance === 'credit'}
											<MoneyDisplay amount={Math.abs(i.endingBalance)} />
										{:else}
											<span class="text-muted-foreground/20">—</span>
										{/if}
									</td>
									<td class="p-4 text-right font-mono font-bold text-rose-600">
										{#if i.endingBalance > 0 && i.normalBalance === 'credit'}
											<MoneyDisplay amount={i.endingBalance} />
										{:else if i.endingBalance < 0 && i.normalBalance === 'debit'}
											<MoneyDisplay amount={Math.abs(i.endingBalance)} />
										{:else}
											<span class="text-muted-foreground/20">—</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr class="bg-muted/20 border-t-2 border-border font-bold">
								<td colspan="3" class="p-4 text-right uppercase text-[10px]">Total Ledger Sum</td>
								<td class="p-4 text-right text-emerald-600 font-mono"><MoneyDisplay amount={trialBalanceData.totalDebitSum} /></td>
								<td class="p-4 text-right text-rose-600 font-mono"><MoneyDisplay amount={trialBalanceData.totalCreditSum} /></td>
							</tr>
						</tfoot>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	<!-- ─── TAB 4: BALANCE SHEET ───────────────────────────────────── -->
	{#if activeTab === 'balance-sheet'}
		<div class="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
			<div class="flex flex-wrap items-end gap-3 text-xs">
				<div class="space-y-1.5">
					<label for="bs-asof" class="block font-semibold text-muted-foreground">As Of Date</label>
					<input id="bs-asof" type="date" bind:value={bsAsOf} class="h-9.5 p-2 rounded-xl border border-border bg-background text-foreground" />
				</div>
				<Button onclick={fetchBalanceSheet} disabled={loadingBS} class="h-9.5 rounded-xl cursor-pointer">
					{#if loadingBS}<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />{/if}
					Load Balance Sheet
				</Button>
				{#if balanceSheetData}
					<Button variant="outline" onclick={() => exportBalanceSheet('csv')} class="h-9.5 rounded-xl cursor-pointer flex items-center gap-1">
						<FileSpreadsheet class="h-3.5 w-3.5" /> CSV
					</Button>
					<Button variant="outline" onclick={() => exportBalanceSheet('pdf')} class="h-9.5 rounded-xl cursor-pointer flex items-center gap-1">
						<FileDown class="h-3.5 w-3.5" /> PDF
					</Button>
				{/if}
			</div>

			{#if loadingBS}
				<div class="h-40 flex items-center justify-center"><RefreshCw class="h-7 w-7 text-primary animate-spin" /></div>
			{:else if balanceSheetData}
				<!-- Balanced Alert -->
				{#if balanceSheetData.isBalanced}
					<div class="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 text-xs font-semibold">
						<ShieldCheck class="h-4.5 w-4.5 text-emerald-600" />
						Assets match Liabilities & Capital correctly.
					</div>
				{:else}
					<div class="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-xs font-semibold">
						<ShieldAlert class="h-4.5 w-4.5 text-rose-600" />
						Equation out of balance: Assets differs from Liabilities + Capital!
					</div>
				{/if}

				<!-- Classification Trees -->
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
					<!-- Assets Column -->
					<div class="space-y-4">
						<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
							<div class="px-5 py-4 border-b border-border bg-muted/20 flex justify-between items-center">
								<h2 class="font-bold text-foreground">Assets</h2>
								<span class="font-mono font-bold text-emerald-600 text-sm"><MoneyDisplay amount={balanceSheetData.totalAssets} /></span>
							</div>
							<div class="p-4 space-y-2">
								{#each buildTree(balanceSheetData.assets) as root}
									{@render renderBSNode(root, 0)}
								{/each}
							</div>
						</div>
					</div>

					<!-- Liabilities & Equity Column -->
					<div class="space-y-4">
						<!-- Liabilities Section -->
						<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
							<div class="px-5 py-4 border-b border-border bg-muted/20 flex justify-between items-center">
								<h2 class="font-bold text-foreground">Liabilities</h2>
								<span class="font-mono font-bold text-rose-600 text-sm"><MoneyDisplay amount={balanceSheetData.totalLiabilities} /></span>
							</div>
							<div class="p-4 space-y-2">
								{#each buildTree(balanceSheetData.liabilities) as root}
									{@render renderBSNode(root, 0)}
								{/each}
							</div>
						</div>

						<!-- Equity Section -->
						<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
							<div class="px-5 py-4 border-b border-border bg-muted/20 flex justify-between items-center">
								<h2 class="font-bold text-foreground">Equity / Capital</h2>
								<span class="font-mono font-bold text-primary text-sm"><MoneyDisplay amount={balanceSheetData.totalEquity} /></span>
							</div>
							<div class="p-4 space-y-2">
								{#each buildTree(balanceSheetData.equity) as root}
									{@render renderBSNode(root, 0)}
								{/each}
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- ─── TAB 5: PROFIT & LOSS ───────────────────────────────────── -->
	{#if activeTab === 'profit-loss'}
		<div class="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
			<div class="flex flex-wrap items-end gap-3 text-xs">
				<div class="space-y-1.5">
					<label for="pl-start" class="block font-semibold text-muted-foreground">Start Date</label>
					<input id="pl-start" type="date" bind:value={plStart} class="h-9.5 p-2 rounded-xl border border-border bg-background text-foreground" />
				</div>
				<div class="space-y-1.5">
					<label for="pl-end" class="block font-semibold text-muted-foreground">End Date</label>
					<input id="pl-end" type="date" bind:value={plEnd} class="h-9.5 p-2 rounded-xl border border-border bg-background text-foreground" />
				</div>
				<Button onclick={fetchProfitLoss} disabled={loadingPL} class="h-9.5 rounded-xl cursor-pointer">
					{#if loadingPL}<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />{/if}
					Load Profit & Loss
				</Button>
				{#if profitLossData}
					<Button variant="outline" onclick={() => exportProfitLoss('csv')} class="h-9.5 rounded-xl cursor-pointer flex items-center gap-1">
						<FileSpreadsheet class="h-3.5 w-3.5" /> CSV
					</Button>
					<Button variant="outline" onclick={() => exportProfitLoss('pdf')} class="h-9.5 rounded-xl cursor-pointer flex items-center gap-1">
						<FileDown class="h-3.5 w-3.5" /> PDF
					</Button>
				{/if}
			</div>

			{#if loadingPL}
				<div class="h-40 flex items-center justify-center"><RefreshCw class="h-7 w-7 text-primary animate-spin" /></div>
			{:else if profitLossData}
				<!-- Net Profit Summary Card -->
				<div class="bg-card border border-border rounded-2xl p-5 shadow-xs border-l-4 {profitLossData.netProfit >= 0 ? 'border-l-emerald-500' : 'border-l-rose-500'} flex items-center justify-between">
					<div class="space-y-1">
						<span class="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Net Period Margin</span>
						<span class="text-2xl font-bold font-mono {profitLossData.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}"><MoneyDisplay amount={profitLossData.netProfit} /></span>
					</div>
					<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
						<TrendingUp class="h-5 w-5 {profitLossData.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}" />
						<span>{profitLossData.netProfit >= 0 ? 'Net Income Surplus' : 'Net Loss Deficit'}</span>
					</div>
				</div>

				<!-- Categorizations -->
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
					<!-- Revenues -->
					<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
						<div class="px-5 py-4 border-b border-border bg-muted/20 flex justify-between items-center">
							<h2 class="font-bold text-foreground">Revenues (Income)</h2>
							<span class="font-mono font-bold text-emerald-600 text-sm"><MoneyDisplay amount={profitLossData.totalRevenues} /></span>
						</div>
						<div class="p-4 space-y-2">
							{#if profitLossData.revenues.length === 0}
								<p class="text-muted-foreground/60 text-center py-4">No revenues generated.</p>
							{:else}
								{#each buildTree(profitLossData.revenues) as root}
									{@render renderPLNode(root, 0)}
								{/each}
							{/if}
						</div>
					</div>

					<!-- Expenses -->
					<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
						<div class="px-5 py-4 border-b border-border bg-muted/20 flex justify-between items-center">
							<h2 class="font-bold text-foreground">Expenses</h2>
							<span class="font-mono font-bold text-rose-600 text-sm"><MoneyDisplay amount={profitLossData.totalExpenses} /></span>
						</div>
						<div class="p-4 space-y-2">
							{#if profitLossData.expenses.length === 0}
								<p class="text-muted-foreground/60 text-center py-4">No expenses recorded.</p>
							{:else}
								{#each buildTree(profitLossData.expenses) as root}
									{@render renderPLNode(root, 0)}
								{/each}
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- ─── REUSABLE NODE SNIPPET RENDERS ────────────────────────────────────────── -->
{#snippet renderBSNode(node: any, depth: number)}
	{@const isCollapsed = collapsedBS[node.accountId] ?? false}
	{@const hasChildren = node.children.length > 0}
	<div class="space-y-1" style="padding-left: {depth * 14}px">
		<div class="flex items-center justify-between hover:bg-muted/10 p-1.5 rounded-lg transition-colors">
			<div class="flex items-center gap-1.5">
				{#if hasChildren}
					<button onclick={() => collapsedBS[node.accountId] = !isCollapsed} class="p-0.5 hover:bg-muted rounded text-muted-foreground cursor-pointer">
						{#if isCollapsed}<ChevronRight class="h-3.5 w-3.5" />{:else}<ChevronDown class="h-3.5 w-3.5" />{/if}
					</button>
				{:else}
					<div class="w-4.5"></div>
				{/if}
				<span class="font-mono text-muted-foreground text-[10px] bg-muted px-1.5 py-0.2 rounded border border-border/40 font-bold">{node.accountCode}</span>
				<span class={node.isControlAccount ? 'font-bold text-foreground' : 'text-muted-foreground font-medium'}>{node.accountName}</span>
			</div>
			<span class="font-mono font-bold text-foreground"><MoneyDisplay amount={node.balance} /></span>
		</div>
		{#if hasChildren && !isCollapsed}
			<div class="space-y-1 border-l border-border/30 ml-2.5">
				{#each node.children as child}
					{@render renderBSNode(child, depth + 1)}
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet renderPLNode(node: any, depth: number)}
	{@const isCollapsed = collapsedPL[node.accountId] ?? false}
	{@const hasChildren = node.children.length > 0}
	<div class="space-y-1" style="padding-left: {depth * 14}px">
		<div class="flex items-center justify-between hover:bg-muted/10 p-1.5 rounded-lg transition-colors">
			<div class="flex items-center gap-1.5">
				{#if hasChildren}
					<button onclick={() => collapsedPL[node.accountId] = !isCollapsed} class="p-0.5 hover:bg-muted rounded text-muted-foreground cursor-pointer">
						{#if isCollapsed}<ChevronRight class="h-3.5 w-3.5" />{:else}<ChevronDown class="h-3.5 w-3.5" />{/if}
					</button>
				{:else}
					<div class="w-4.5"></div>
				{/if}
				<span class="font-mono text-muted-foreground text-[10px] bg-muted px-1.5 py-0.2 rounded border border-border/40 font-bold">{node.accountCode}</span>
				<span class={node.isControlAccount ? 'font-bold text-foreground' : 'text-muted-foreground font-medium'}>{node.accountName}</span>
			</div>
			<span class="font-mono font-bold text-foreground"><MoneyDisplay amount={node.balance} /></span>
		</div>
		{#if hasChildren && !isCollapsed}
			<div class="space-y-1 border-l border-border/30 ml-2.5">
				{#each node.children as child}
					{@render renderPLNode(child, depth + 1)}
				{/each}
			</div>
		{/if}
	</div>
{/snippet}
