<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { apiFetch } from '$lib/api/api-client';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { DateDisplay } from '$lib/components';
	import { Button } from '$lib/components/ui/button';
	import { toast } from '$lib/stores/toast';
	import { previewDocument } from '$lib/utils/preview-document';
	import { exportToCSV as downloadCSV } from '$lib/utils/csv-exporter';
	import { getBahrainPresetRanges, formatDateOnly } from '$lib/formatters/date';
	import {
		TrendingUp,
		TrendingDown,
		BarChart3,
		DollarSign,
		CreditCard,
		Wallet,
		Calendar,
		RefreshCw,
		FileSpreadsheet,
		FileDown,
		ChevronDown,
		ChevronRight,
		AlertCircle,
		CheckCircle2,
		ShieldCheck,
		Layers,
		Plane,
		Building2,
		FileText,
		Compass,
		Clock,
		Car,
		Briefcase,
		ArrowRight,
		ExternalLink,
		BookOpen
	} from 'lucide-svelte';

	interface ServiceFinancialLineItem {
		serviceType: string;
		serviceLabel: string;
		bookingCount: number;
		salesAmount: number;
		costAmount: number;
		profitAmount: number;
		finalProfitAmount: number;
		marginPercentage: number;
	}

	interface ExpenseCategorySummaryItem {
		categoryId: number;
		categoryName: string;
		expenseCount: number;
		totalAmount: number;
	}

	interface OperationalProfitAndLossResponse {
		startDate: string;
		endDate: string;
		dealStatus: string;
		salesmanId: number | null;
		salesmanName: string | null;
		revenueItems: ServiceFinancialLineItem[];
		grossBookingRevenue: number;
		approvedSalesReturns: number;
		netRevenue: number;
		costOfSalesItems: ServiceFinancialLineItem[];
		grossSupplierCost: number;
		approvedPurchaseReturns: number;
		netCostOfSales: number;
		grossProfit: number;
		grossMarginPercentage: number;
		finalizedGrossProfit: number;
		estimatedGrossProfit: number;
		expenseItems: ExpenseCategorySummaryItem[];
		totalApprovedExpenses: number;
		totalPayrollExpenses: number;
		totalOperatingExpenses: number;
		netProfit: number;
		netMarginPercentage: number;
		finalizedNetProfit: number;
		finalizedNetMarginPercentage: number;
		isProfitable: boolean;
		reconciled: boolean;
		reconciliationDifference: number;
		reconciliationMessage: string;
		generatedAt: string;
		dataSourcesStatus: string;
	}

	// ─── States ───────────────────────────────────────────────────────────────────
	let loading = $state(true);
	let error = $state<string | null>(null);
	let pnlData = $state<OperationalProfitAndLossResponse | null>(null);

	// Filters
	const presets = getBahrainPresetRanges();
	let selectedPreset = $state<string>('thisMonth');
	let startDate = $state<string>(presets.thisMonth.startDate);
	let endDate = $state<string>(presets.thisMonth.endDate);

	// View Tabs
	let activeTab = $state<'performance' | 'statement' | 'gl'>('performance');

	// Section collapsible toggles in Income Statement
	let showRevenueDetails = $state(true);
	let showCostDetails = $state(true);
	let showExpenseDetails = $state(true);

	// Service Icons Map
	function getServiceIcon(serviceType: string) {
		const lower = (serviceType || '').toLowerCase();
		if (lower.includes('flight')) return Plane;
		if (lower.includes('hotel')) return Building2;
		if (lower.includes('visa')) return FileText;
		if (lower.includes('holiday')) return Compass;
		if (lower.includes('vfs')) return Clock;
		if (lower.includes('transport')) return Car;
		return Briefcase;
	}

	// ─── API Loaders ─────────────────────────────────────────────────────────────
	async function loadReport() {
		loading = true;
		error = null;

		try {
			const params: Record<string, string> = {};
			if (startDate) params.startDate = startDate;
			if (endDate) params.endDate = endDate;

			const query = new URLSearchParams(params).toString();
			pnlData = await apiFetch<OperationalProfitAndLossResponse>(
				`api/reporting/profit-loss/summary?${query}`
			);
		} catch (err: any) {
			error = err?.message || 'Failed to load Profit & Loss report. Please retry.';
			pnlData = null;
			if (error) toast.error(error);
		} finally {
			loading = false;
		}
	}

	// ─── Preset Handlers ─────────────────────────────────────────────────────────
	function handlePresetChange(presetKey: string) {
		selectedPreset = presetKey;
		const range = (presets as Record<string, { startDate: string; endDate: string }>)[presetKey];
		if (range) {
			startDate = range.startDate;
			endDate = range.endDate;
			loadReport();
		}
	}

	function handleCustomDateApply() {
		selectedPreset = 'custom';
		loadReport();
	}

	// ─── Export Handlers ─────────────────────────────────────────────────────────
	function handleExportCSV() {
		if (!pnlData) {
			toast.error('No report data available to export.');
			return;
		}

		const headers = [
			'Section',
			'Line Item',
			'Classification',
			'Count',
			'Gross Sales (BHD)',
			'Supplier Cost (BHD)',
			'Gross Profit (BHD)',
			'Margin %',
			'Finalized Profit (BHD)'
		];

		const rows: (string | number)[][] = [];

		// Revenue items
		pnlData.revenueItems.forEach((r) => {
			rows.push([
				'1. Revenues',
				`Sales — ${r.serviceLabel}`,
				'Gross Booking Sale',
				r.bookingCount,
				r.salesAmount.toFixed(3),
				r.costAmount.toFixed(3),
				r.profitAmount.toFixed(3),
				`${r.marginPercentage.toFixed(1)}%`,
				r.finalProfitAmount.toFixed(3)
			]);
		});

		if (pnlData.approvedSalesReturns > 0) {
			rows.push([
				'1. Revenues',
				'Less: Approved Sales Returns',
				'Revenue Deduction',
				'—',
				`-${pnlData.approvedSalesReturns.toFixed(3)}`,
				'0.000',
				`-${pnlData.approvedSalesReturns.toFixed(3)}`,
				'—',
				'0.000'
			]);
		}

		rows.push([
			'1. Revenues Subtotal',
			'TOTAL NET REVENUE',
			'Operating Inflow',
			pnlData.revenueItems.reduce((acc, x) => acc + x.bookingCount, 0),
			pnlData.netRevenue.toFixed(3),
			'—',
			'—',
			'—',
			'—'
		]);

		// Cost items
		pnlData.costOfSalesItems.forEach((c) => {
			rows.push([
				'2. Cost of Sales',
				`COGS — ${c.serviceLabel}`,
				'Direct Supplier Cost',
				c.bookingCount,
				'—',
				c.costAmount.toFixed(3),
				'—',
				'—',
				'—'
			]);
		});

		if (pnlData.approvedPurchaseReturns > 0) {
			rows.push([
				'2. Cost of Sales',
				'Less: Approved Purchase Returns',
				'Supplier Credit Offset',
				'—',
				'—',
				`-${pnlData.approvedPurchaseReturns.toFixed(3)}`,
				'—',
				'—',
				'—'
			]);
		}

		rows.push([
			'2. COGS Subtotal',
			'TOTAL COST OF GOODS SOLD (COGS)',
			'Direct Cost',
			'—',
			'—',
			pnlData.netCostOfSales.toFixed(3),
			'—',
			'—',
			'—'
		]);

		// Gross Profit
		rows.push([
			'3. Gross Margin',
			'GROSS PROFIT',
			'Trading Margin',
			'—',
			'—',
			'—',
			pnlData.grossProfit.toFixed(3),
			`${pnlData.grossMarginPercentage.toFixed(1)}%`,
			pnlData.finalizedGrossProfit.toFixed(3)
		]);

		// Expenses
		pnlData.expenseItems.forEach((e) => {
			rows.push([
				'4. Operating Expenses',
				`Expense — ${e.categoryName}`,
				'Overhead',
				e.expenseCount,
				'—',
				'—',
				`-${e.totalAmount.toFixed(3)}`,
				'—',
				'—'
			]);
		});

		if (pnlData.totalPayrollExpenses > 0) {
			rows.push([
				'4. Operating Expenses',
				'Staff Salaries & Payroll Allowances',
				'Payroll',
				'—',
				'—',
				'—',
				`-${pnlData.totalPayrollExpenses.toFixed(3)}`,
				'—',
				'—'
			]);
		}

		rows.push([
			'4. Expenses Subtotal',
			'TOTAL OPERATING EXPENSES',
			'Overheads & SG&A',
			'—',
			'—',
			'—',
			`-${pnlData.totalOperatingExpenses.toFixed(3)}`,
			'—',
			'—'
		]);

		// Net Profit
		rows.push([
			'5. Net Bottom Line',
			'NET OPERATING PROFIT / (LOSS)',
			pnlData.isProfitable ? 'Surplus' : 'Deficit',
			'—',
			'—',
			'—',
			pnlData.netProfit.toFixed(3),
			`${pnlData.netMarginPercentage.toFixed(1)}%`,
			pnlData.finalizedNetProfit.toFixed(3)
		]);

		const filename = `profit_loss_${startDate || 'start'}_to_${endDate || 'end'}.csv`;
		downloadCSV(filename, headers, rows);
		toast.success('Profit & Loss CSV exported successfully.');
	}

	function handleExportPDF() {
		const params: Record<string, any> = {
			startDate,
			endDate
		};

		previewDocument('report', 'profit-loss', params);
		toast.info('Generating Profit & Loss Statement PDF...');
	}

	onMount(() => {
		loadReport();
	});
</script>

<svelte:head>
	<title>Profit & Loss Report (Income Statement) — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- ─── PAGE HEADER & ACTIONS ─────────────────────────────────────────────── -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
		<div class="space-y-1">
			<div class="flex items-center gap-2">
				<h1 class="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
					<TrendingUp class="h-6 w-6 text-primary" />
					Profit & Loss Report
				</h1>
				<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
					Income Statement
				</span>
			</div>
			<p class="text-xs text-muted-foreground">
				Executive operational income statement aggregating 7 travel service revenues, supplier costs, operating overheads, and net margins.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				onclick={loadReport}
				disabled={loading}
				class="h-9 gap-1.5 rounded-xl cursor-pointer"
			>
				<RefreshCw class="h-3.5 w-3.5 {loading ? 'animate-spin' : ''}" />
				<span>Refresh</span>
			</Button>

			<Button
				variant="outline"
				size="sm"
				onclick={handleExportCSV}
				disabled={loading || !pnlData}
				class="h-9 gap-1.5 rounded-xl cursor-pointer"
			>
				<FileSpreadsheet class="h-3.5 w-3.5 text-emerald-600" />
				<span>Export CSV</span>
			</Button>

			<Button
				variant="default"
				size="sm"
				onclick={handleExportPDF}
				disabled={loading || !pnlData}
				class="h-9 gap-1.5 rounded-xl cursor-pointer shadow-xs"
			>
				<FileDown class="h-3.5 w-3.5" />
				<span>Print / PDF</span>
			</Button>
		</div>
	</div>

	<!-- ─── FILTER TOOLBAR ─────────────────────────────────────────────────────── -->
	<div class="bg-card border border-border rounded-2xl p-4 shadow-2xs space-y-3">
		<!-- Row 1: Bahrain Date Preset Pills -->
		<div class="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-border/50 text-xs">
			<div class="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-1 scrollbar-thin">
				<span class="text-[11px] font-bold text-muted-foreground mr-1 shrink-0">Period:</span>
				{#each [
					{ id: 'today', label: 'Today' },
					{ id: 'thisWeek', label: 'This Week' },
					{ id: 'thisMonth', label: 'This Month' },
					{ id: 'thisQuarter', label: 'This Quarter' },
					{ id: 'thisYear', label: 'This Year (2026)' },
					{ id: 'allTime', label: 'All Time' }
				] as p}
					<button
						type="button"
						onclick={() => handlePresetChange(p.id)}
						class="px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap {selectedPreset === p.id
							? 'bg-primary text-primary-foreground shadow-2xs'
							: 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40'}"
					>
						{p.label}
					</button>
				{/each}
			</div>

			<div class="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
				<Calendar class="h-3 w-3 text-primary" />
				<span>Bahrain Time (UTC+3)</span>
			</div>
		</div>

		<!-- Row 2: Date Inputs -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 sm:max-w-md">
			<div class="space-y-1">
				<label for="pnl-start" class="block font-semibold text-muted-foreground text-[11px]">Start Date</label>
				<input
					id="pnl-start"
					type="date"
					bind:value={startDate}
					onchange={handleCustomDateApply}
					class="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary outline-hidden"
				/>
			</div>

			<div class="space-y-1">
				<label for="pnl-end" class="block font-semibold text-muted-foreground text-[11px]">End Date</label>
				<input
					id="pnl-end"
					type="date"
					bind:value={endDate}
					onchange={handleCustomDateApply}
					class="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary outline-hidden"
				/>
			</div>
		</div>
	</div>

	<!-- ─── ERROR STATE ────────────────────────────────────────────────────────── -->
	{#if error}
		<div class="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex flex-col sm:flex-row items-center justify-between gap-4">
			<div class="flex items-center gap-3">
				<AlertCircle class="h-6 w-6 shrink-0" />
				<div>
					<h3 class="text-sm font-bold">Failed to generate Profit & Loss Report</h3>
					<p class="text-xs opacity-90 mt-0.5">{error}</p>
				</div>
			</div>
			<Button variant="outline" size="sm" onclick={loadReport} class="h-9 gap-1.5 rounded-xl cursor-pointer shrink-0">
				<RefreshCw class="h-3.5 w-3.5" />
				<span>Retry</span>
			</Button>
		</div>
	{/if}

	<!-- ─── 5 TOP EXECUTIVE KPI CARDS ──────────────────────────────────────────── -->
	{#if loading && !pnlData}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
			{#each Array(5) as _}
				<div class="h-28 rounded-2xl bg-muted/40 animate-pulse border border-border/40"></div>
			{/each}
		</div>
	{:else if pnlData}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
			<!-- KPI 1: Operating Revenue -->
			<div class="bg-card border border-border rounded-2xl p-4 shadow-2xs space-y-2 border-l-4 border-l-blue-500">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-[11px] font-bold uppercase tracking-wider">Operating Revenue</span>
					<DollarSign class="h-4 w-4 text-blue-500" />
				</div>
				<div class="space-y-0.5">
					<div class="text-xl font-bold font-mono text-foreground">
						<MoneyDisplay amount={pnlData.netRevenue} />
					</div>
					<div class="text-[11px] text-muted-foreground flex items-center justify-between">
						<span>{pnlData.revenueItems.reduce((acc, x) => acc + x.bookingCount, 0)} Bookings</span>
						{#if pnlData.approvedSalesReturns > 0}
							<span class="text-rose-500 font-mono text-[10px]">-{pnlData.approvedSalesReturns.toFixed(3)} Ret</span>
						{/if}
					</div>
				</div>
			</div>

			<!-- KPI 2: Cost of Sales -->
			<div class="bg-card border border-border rounded-2xl p-4 shadow-2xs space-y-2 border-l-4 border-l-amber-500">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-[11px] font-bold uppercase tracking-wider">Cost of Sales (COGS)</span>
					<CreditCard class="h-4 w-4 text-amber-500" />
				</div>
				<div class="space-y-0.5">
					<div class="text-xl font-bold font-mono text-foreground">
						<MoneyDisplay amount={pnlData.netCostOfSales} />
					</div>
					<div class="text-[11px] text-muted-foreground flex items-center justify-between">
						<span>Supplier Costs</span>
						{#if pnlData.approvedPurchaseReturns > 0}
							<span class="text-emerald-500 font-mono text-[10px]">-{pnlData.approvedPurchaseReturns.toFixed(3)} Ret</span>
						{/if}
					</div>
				</div>
			</div>

			<!-- KPI 3: Gross Profit -->
			<div class="bg-card border border-border rounded-2xl p-4 shadow-2xs space-y-2 border-l-4 border-l-teal-500">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-[11px] font-bold uppercase tracking-wider">Gross Profit</span>
					<span class="text-xs font-bold font-mono text-teal-600 bg-teal-500/10 px-1.5 py-0.5 rounded">
						{pnlData.grossMarginPercentage.toFixed(1)}%
					</span>
				</div>
				<div class="space-y-0.5">
					<div class="text-xl font-bold font-mono text-teal-600">
						<MoneyDisplay amount={pnlData.grossProfit} />
					</div>
					<div class="text-[10px] text-muted-foreground flex items-center justify-between">
						<span class="text-emerald-600 font-semibold">Final: {pnlData.finalizedGrossProfit.toFixed(3)}</span>
						<span class="text-muted-foreground">Est: {pnlData.estimatedGrossProfit.toFixed(3)}</span>
					</div>
				</div>
			</div>

			<!-- KPI 4: Operating Expenses -->
			<div class="bg-card border border-border rounded-2xl p-4 shadow-2xs space-y-2 border-l-4 border-l-rose-500">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-[11px] font-bold uppercase tracking-wider">Operating Expenses</span>
					<Wallet class="h-4 w-4 text-rose-500" />
				</div>
				<div class="space-y-0.5">
					<div class="text-xl font-bold font-mono text-foreground">
						<MoneyDisplay amount={pnlData.totalOperatingExpenses} />
					</div>
					<div class="text-[10px] text-muted-foreground flex items-center justify-between">
						<span>Overheads: {pnlData.totalApprovedExpenses.toFixed(3)}</span>
						<span>Payroll: {pnlData.totalPayrollExpenses.toFixed(3)}</span>
					</div>
				</div>
			</div>

			<!-- KPI 5: Net Profit / Loss -->
			<div class="bg-card border border-border rounded-2xl p-4 shadow-2xs space-y-2 border-l-4 {pnlData.isProfitable ? 'border-l-emerald-500 bg-emerald-500/5' : 'border-l-rose-500 bg-rose-500/5'}">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-[11px] font-bold uppercase tracking-wider {pnlData.isProfitable ? 'text-emerald-600' : 'text-rose-600'}">
						{pnlData.isProfitable ? 'Net Operating Profit' : 'Net Operating Loss'}
					</span>
					<span class="text-xs font-bold font-mono {pnlData.isProfitable ? 'text-emerald-600 bg-emerald-500/10' : 'text-rose-600 bg-rose-500/10'} px-1.5 py-0.5 rounded">
						{pnlData.netMarginPercentage.toFixed(1)}%
					</span>
				</div>
				<div class="space-y-0.5">
					<div class="text-xl font-bold font-mono {pnlData.isProfitable ? 'text-emerald-600' : 'text-rose-600'}">
						<MoneyDisplay amount={pnlData.netProfit} />
					</div>
					<div class="text-[10px] text-muted-foreground flex items-center justify-between">
						<span class="font-semibold {pnlData.finalizedNetProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
							Finalized Net: {pnlData.finalizedNetProfit.toFixed(3)}
						</span>
						<span>{pnlData.isProfitable ? 'Surplus' : 'Deficit'}</span>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- ─── NAVIGATION VIEW TABS ───────────────────────────────────────────────── -->
	<div class="flex items-center gap-1 border-b border-border text-xs font-semibold overflow-x-auto flex-nowrap pb-1 scrollbar-thin">
		<button
			type="button"
			onclick={() => (activeTab = 'performance')}
			class="px-4 py-2.5 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 whitespace-nowrap {activeTab === 'performance'
				? 'border-primary text-primary font-bold'
				: 'border-transparent text-muted-foreground hover:text-foreground'}"
		>
			<Layers class="h-4 w-4" />
			<span>Service Performance Table</span>
		</button>

		<button
			type="button"
			onclick={() => (activeTab = 'statement')}
			class="px-4 py-2.5 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 whitespace-nowrap {activeTab === 'statement'
				? 'border-primary text-primary font-bold'
				: 'border-transparent text-muted-foreground hover:text-foreground'}"
		>
			<FileText class="h-4 w-4" />
			<span>Income Statement View</span>
		</button>

		<button
			type="button"
			onclick={() => (activeTab = 'gl')}
			class="px-4 py-2.5 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 whitespace-nowrap {activeTab === 'gl'
				? 'border-primary text-primary font-bold'
				: 'border-transparent text-muted-foreground hover:text-foreground'}"
		>
			<BookOpen class="h-4 w-4" />
			<span>Formal General Ledger P&L</span>
		</button>
	</div>

	<!-- ─── TAB 1: SERVICE PERFORMANCE TABLE ───────────────────────────────────── -->
	{#if activeTab === 'performance'}
		<div class="bg-card border border-border rounded-2xl shadow-2xs overflow-hidden">
			<div class="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
				<div>
					<h3 class="font-bold text-foreground">Operational Breakdown by Service</h3>
					<p class="text-[11px] text-muted-foreground">
						Comparative gross revenue, supplier buying costs, and finalized profits across the 7 operational service modules.
					</p>
				</div>
				<div class="text-[11px] text-muted-foreground font-mono">
					Period: {startDate || '—'} → {endDate || '—'}
				</div>
			</div>

			<div class="overflow-x-auto">
				<table class="w-full text-xs text-left">
					<thead class="bg-muted/30 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
						<tr>
							<th class="py-3 px-4">Service</th>
							<th class="py-3 px-4 text-center">Bookings</th>
							<th class="py-3 px-4 text-right">Gross Sales (BHD)</th>
							<th class="py-3 px-4 text-right">Supplier Cost (BHD)</th>
							<th class="py-3 px-4 text-right">Gross Profit (BHD)</th>
							<th class="py-3 px-4 text-center">Margin %</th>
							<th class="py-3 px-4 text-right">Finalized Profit (BHD)</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/60">
						{#if loading && !pnlData}
							{#each Array(7) as _}
								<tr class="animate-pulse">
									<td colspan="7" class="py-3 px-4"><div class="h-4 bg-muted/50 rounded"></div></td>
								</tr>
							{/each}
						{:else if pnlData && pnlData.revenueItems.length > 0}
							{#each pnlData.revenueItems as srv}
								{@const IconComponent = getServiceIcon(srv.serviceType)}
								<tr class="hover:bg-muted/15 transition-colors">
									<td class="py-3 px-4 font-semibold text-foreground flex items-center gap-2">
										<div class="p-1.5 rounded-lg bg-primary/10 text-primary">
											<IconComponent class="h-3.5 w-3.5" />
										</div>
										<span>{srv.serviceLabel}</span>
									</td>
									<td class="py-3 px-4 text-center font-mono">
										<span class="px-2 py-0.5 rounded-md bg-muted text-foreground text-[11px] font-bold">
											{srv.bookingCount}
										</span>
									</td>
									<td class="py-3 px-4 text-right font-mono font-bold text-foreground">
										<MoneyDisplay amount={srv.salesAmount} />
									</td>
									<td class="py-3 px-4 text-right font-mono text-muted-foreground">
										<MoneyDisplay amount={srv.costAmount} />
									</td>
									<td class="py-3 px-4 text-right font-mono font-bold {srv.profitAmount >= 0 ? 'text-teal-600' : 'text-rose-600'}">
										<MoneyDisplay amount={srv.profitAmount} />
									</td>
									<td class="py-3 px-4 text-center font-mono">
										<span class="px-2 py-0.5 rounded text-[11px] font-bold {srv.marginPercentage >= 30 ? 'bg-emerald-500/10 text-emerald-600' : srv.marginPercentage > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'}">
											{srv.salesAmount > 0 ? `${srv.marginPercentage.toFixed(1)}%` : '—'}
										</span>
									</td>
									<td class="py-3 px-4 text-right font-mono font-bold text-emerald-600">
										<MoneyDisplay amount={srv.finalProfitAmount} />
									</td>
								</tr>
							{/each}
						{:else}
							<tr>
								<td colspan="7" class="py-8 text-center text-muted-foreground">
									No booking financial records found in the selected date range.
								</td>
							</tr>
						{/if}
					</tbody>

					{#if pnlData}
						<tfoot class="bg-muted/40 border-t-2 border-border font-bold text-xs">
							<tr>
								<td class="py-3 px-4 uppercase text-foreground">Totals Across Services</td>
								<td class="py-3 px-4 text-center font-mono text-primary">
									{pnlData.revenueItems.reduce((acc, x) => acc + x.bookingCount, 0)}
								</td>
								<td class="py-3 px-4 text-right font-mono text-foreground text-sm">
									<MoneyDisplay amount={pnlData.grossBookingRevenue} />
								</td>
								<td class="py-3 px-4 text-right font-mono text-muted-foreground text-sm">
									<MoneyDisplay amount={pnlData.grossSupplierCost} />
								</td>
								<td class="py-3 px-4 text-right font-mono text-teal-600 text-sm">
									<MoneyDisplay amount={pnlData.grossProfit + pnlData.approvedSalesReturns - pnlData.approvedPurchaseReturns} />
								</td>
								<td class="py-3 px-4 text-center font-mono text-teal-600 text-sm">
									{pnlData.grossBookingRevenue > 0
										? `${Math.round(((pnlData.grossProfit + pnlData.approvedSalesReturns - pnlData.approvedPurchaseReturns) / pnlData.grossBookingRevenue) * 100).toFixed(1)}%`
										: '—'}
								</td>
								<td class="py-3 px-4 text-right font-mono text-emerald-600 text-sm">
									<MoneyDisplay amount={pnlData.finalizedGrossProfit} />
								</td>
							</tr>
						</tfoot>
					{/if}
				</table>
			</div>
		</div>
	{/if}

	<!-- ─── TAB 2: DETAILED INCOME STATEMENT VIEW ──────────────────────────────── -->
	{#if activeTab === 'statement'}
		<div class="bg-card border border-border rounded-2xl shadow-2xs overflow-hidden p-6 space-y-6">
			<div class="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
				<div>
					<h3 class="text-base font-bold text-foreground">Operational Income Statement</h3>
					<p class="text-xs text-muted-foreground">
						Cascading formal financial presentation from Operating Gross Revenues down to Bottom Line Net Operating Profit.
					</p>
				</div>
				<div class="text-xs text-muted-foreground font-mono bg-muted/40 px-3 py-1.5 rounded-xl border border-border/40">
					Period: {startDate || '—'} → {endDate || '—'}
				</div>
			</div>

			{#if loading && !pnlData}
				<div class="space-y-4 animate-pulse">
					{#each Array(6) as _}
						<div class="h-10 bg-muted/40 rounded-xl"></div>
					{/each}
				</div>
			{:else if pnlData}
				<div class="space-y-6 text-xs">
					<!-- SECTION 1: OPERATING REVENUES -->
					<div class="border border-border rounded-2xl overflow-hidden shadow-2xs">
						<button
							type="button"
							onclick={() => (showRevenueDetails = !showRevenueDetails)}
							class="w-full px-5 py-3.5 bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-between cursor-pointer border-b border-border"
						>
							<div class="flex items-center gap-2">
								{#if showRevenueDetails}
									<ChevronDown class="h-4 w-4 text-muted-foreground" />
								{:else}
									<ChevronRight class="h-4 w-4 text-muted-foreground" />
								{/if}
								<span class="font-bold text-sm text-foreground uppercase tracking-wider">1. Operating Revenue (Gross Sales)</span>
							</div>
							<span class="font-mono font-bold text-foreground text-sm">
								<MoneyDisplay amount={pnlData.netRevenue} />
							</span>
						</button>

						{#if showRevenueDetails}
							<div class="p-4 space-y-2.5 divide-y divide-border/40">
								{#each pnlData.revenueItems as rev}
									<div class="pt-2 flex items-center justify-between hover:bg-muted/10 px-2 rounded-lg">
										<span class="text-muted-foreground flex items-center gap-2">
											<span class="w-2 h-2 rounded-full bg-blue-500"></span>
											Booking Revenue — {rev.serviceLabel} ({rev.bookingCount} bookings)
										</span>
										<span class="font-mono font-medium text-foreground"><MoneyDisplay amount={rev.salesAmount} /></span>
									</div>
								{/each}

								{#if pnlData.approvedSalesReturns > 0}
									<div class="pt-2 flex items-center justify-between text-rose-500 font-medium px-2">
										<span class="flex items-center gap-2">
											<span class="w-2 h-2 rounded-full bg-rose-500"></span>
											Less: Approved Sales Returns & Customer Refunds
										</span>
										<span class="font-mono font-bold">-<MoneyDisplay amount={pnlData.approvedSalesReturns} /></span>
									</div>
								{/if}

								<div class="pt-3 flex items-center justify-between font-bold text-foreground text-xs px-2 bg-muted/20 py-2 rounded-lg">
									<span>Total Net Operating Revenue</span>
									<span class="font-mono text-sm"><MoneyDisplay amount={pnlData.netRevenue} /></span>
								</div>
							</div>
						{/if}
					</div>

					<!-- SECTION 2: COST OF GOODS SOLD -->
					<div class="border border-border rounded-2xl overflow-hidden shadow-2xs">
						<button
							type="button"
							onclick={() => (showCostDetails = !showCostDetails)}
							class="w-full px-5 py-3.5 bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-between cursor-pointer border-b border-border"
						>
							<div class="flex items-center gap-2">
								{#if showCostDetails}
									<ChevronDown class="h-4 w-4 text-muted-foreground" />
								{:else}
									<ChevronRight class="h-4 w-4 text-muted-foreground" />
								{/if}
								<span class="font-bold text-sm text-foreground uppercase tracking-wider">2. Cost of Sales (Direct Supplier Costs)</span>
							</div>
							<span class="font-mono font-bold text-foreground text-sm">
								<MoneyDisplay amount={pnlData.netCostOfSales} />
							</span>
						</button>

						{#if showCostDetails}
							<div class="p-4 space-y-2.5 divide-y divide-border/40">
								{#each pnlData.costOfSalesItems as cost}
									<div class="pt-2 flex items-center justify-between hover:bg-muted/10 px-2 rounded-lg">
										<span class="text-muted-foreground flex items-center gap-2">
											<span class="w-2 h-2 rounded-full bg-amber-500"></span>
											Supplier Cost — {cost.serviceLabel}
										</span>
										<span class="font-mono font-medium text-foreground"><MoneyDisplay amount={cost.costAmount} /></span>
									</div>
								{/each}

								{#if pnlData.approvedPurchaseReturns > 0}
									<div class="pt-2 flex items-center justify-between text-emerald-600 font-medium px-2">
										<span class="flex items-center gap-2">
											<span class="w-2 h-2 rounded-full bg-emerald-500"></span>
											Less: Approved Purchase Returns (Supplier Credits)
										</span>
										<span class="font-mono font-bold">-<MoneyDisplay amount={pnlData.approvedPurchaseReturns} /></span>
									</div>
								{/if}

								<div class="pt-3 flex items-center justify-between font-bold text-foreground text-xs px-2 bg-muted/20 py-2 rounded-lg">
									<span>Total Cost of Goods Sold (COGS)</span>
									<span class="font-mono text-sm"><MoneyDisplay amount={pnlData.netCostOfSales} /></span>
								</div>
							</div>
						{/if}
					</div>

					<!-- SECTION: GROSS PROFIT BANNER -->
					<div class="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div class="space-y-0.5">
							<span class="text-xs font-bold text-teal-700 uppercase tracking-wider block">
								Gross Trading Margin
							</span>
							<h4 class="text-xl font-bold font-mono text-teal-600">
								<MoneyDisplay amount={pnlData.grossProfit} />
							</h4>
							<p class="text-[11px] text-teal-700/80">
								Gross Margin: <strong>{pnlData.grossMarginPercentage.toFixed(1)}%</strong>
								(Revenue: {pnlData.netRevenue.toFixed(3)} - COGS: {pnlData.netCostOfSales.toFixed(3)})
							</p>
						</div>

						<div class="text-xs font-mono space-y-1 sm:text-right">
							<div class="text-emerald-700 font-semibold">
								Finalized Profit (Closed Deals): <strong>{pnlData.finalizedGrossProfit.toFixed(3)} BHD</strong>
							</div>
							<div class="text-muted-foreground">
								Estimated Profit (Open Deals): <strong>{pnlData.estimatedGrossProfit.toFixed(3)} BHD</strong>
							</div>
						</div>
					</div>

					<!-- SECTION 3: OPERATING EXPENSES -->
					<div class="border border-border rounded-2xl overflow-hidden shadow-2xs">
						<button
							type="button"
							onclick={() => (showExpenseDetails = !showExpenseDetails)}
							class="w-full px-5 py-3.5 bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-between cursor-pointer border-b border-border"
						>
							<div class="flex items-center gap-2">
								{#if showExpenseDetails}
									<ChevronDown class="h-4 w-4 text-muted-foreground" />
								{:else}
									<ChevronRight class="h-4 w-4 text-muted-foreground" />
								{/if}
								<span class="font-bold text-sm text-foreground uppercase tracking-wider">3. Operating Expenses (Overheads & Payroll)</span>
							</div>
							<span class="font-mono font-bold text-foreground text-sm">
								<MoneyDisplay amount={pnlData.totalOperatingExpenses} />
							</span>
						</button>

						{#if showExpenseDetails}
							<div class="p-4 space-y-2.5 divide-y divide-border/40">
								{#if pnlData.expenseItems.length === 0 && pnlData.totalPayrollExpenses === 0}
									<div class="py-4 text-center text-muted-foreground text-xs">
										No operational expenses or salary payouts recorded in this period.
									</div>
								{:else}
									{#each pnlData.expenseItems as exp}
										<div class="pt-2 flex items-center justify-between hover:bg-muted/10 px-2 rounded-lg">
											<span class="text-muted-foreground flex items-center gap-2">
												<span class="w-2 h-2 rounded-full bg-rose-500"></span>
												Operating Expense — {exp.categoryName} ({exp.expenseCount} claims)
											</span>
											<span class="font-mono font-medium text-foreground"><MoneyDisplay amount={exp.totalAmount} /></span>
										</div>
									{/each}

									{#if pnlData.totalPayrollExpenses > 0}
										<div class="pt-2 flex items-center justify-between hover:bg-muted/10 px-2 rounded-lg">
											<span class="text-muted-foreground flex items-center gap-2">
												<span class="w-2 h-2 rounded-full bg-indigo-500"></span>
												Staff Salaries, Allowances & Commissions (Payroll)
											</span>
											<span class="font-mono font-medium text-foreground"><MoneyDisplay amount={pnlData.totalPayrollExpenses} /></span>
										</div>
									{/if}
								{/if}

								<div class="pt-3 flex items-center justify-between font-bold text-foreground text-xs px-2 bg-muted/20 py-2 rounded-lg">
									<span>Total Operating Expenses</span>
									<span class="font-mono text-sm"><MoneyDisplay amount={pnlData.totalOperatingExpenses} /></span>
								</div>
							</div>
						{/if}
					</div>

					<!-- SECTION 4: NET OPERATING PROFIT BOTTOM LINE -->
					<div class="p-6 rounded-2xl border-2 {pnlData.isProfitable ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-950' : 'bg-rose-500/10 border-rose-500/40 text-rose-950'} flex flex-col md:flex-row md:items-center justify-between gap-4">
						<div class="space-y-1">
							<span class="text-xs font-bold uppercase tracking-wider block opacity-80">
								Bottom Line Result
							</span>
							<h3 class="text-2xl font-bold font-mono {pnlData.isProfitable ? 'text-emerald-600' : 'text-rose-600'}">
								{pnlData.isProfitable ? 'NET OPERATING PROFIT:' : 'NET OPERATING LOSS:'}
								<MoneyDisplay amount={pnlData.netProfit} />
							</h3>
							<p class="text-xs text-muted-foreground">
								Net Profit Margin: <strong class="font-mono {pnlData.isProfitable ? 'text-emerald-600' : 'text-rose-600'}">{pnlData.netMarginPercentage.toFixed(1)}%</strong>
								(Gross Profit {pnlData.grossProfit.toFixed(3)} - Operating Expenses {pnlData.totalOperatingExpenses.toFixed(3)})
							</p>
						</div>

						<div class="bg-card/80 backdrop-blur-xs p-3.5 rounded-xl border border-border/60 text-xs space-y-1 font-mono">
							<div class="flex justify-between gap-4">
								<span class="text-muted-foreground">Finalized Net Profit:</span>
								<strong class={pnlData.finalizedNetProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
									{pnlData.finalizedNetProfit.toFixed(3)} BHD
								</strong>
							</div>
							<div class="flex justify-between gap-4">
								<span class="text-muted-foreground">Finalized Margin:</span>
								<strong>{pnlData.finalizedNetMarginPercentage.toFixed(1)}%</strong>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- ─── TAB 3: FORMAL GENERAL LEDGER P&L (ACCRUAL COA) ─────────────────────── -->
	{#if activeTab === 'gl'}
		<div class="bg-card border border-border rounded-2xl p-6 shadow-2xs space-y-6">
			<div class="space-y-2">
				<h3 class="text-base font-bold text-foreground flex items-center gap-2">
					<BookOpen class="h-5 w-5 text-primary" />
					Formal General Ledger Income Statement (GAAP Accrual)
				</h3>
				<p class="text-xs text-muted-foreground leading-relaxed max-w-2xl">
					Texas Portals incorporates a complete double-entry General Ledger engine based on Chart of Accounts (COA) 4000-series (Revenues) and 5000-series (Expenses).
				</p>
			</div>

			<div class="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 space-y-2 text-xs">
				<div class="flex items-center gap-2 font-bold text-amber-800">
					<AlertCircle class="h-4 w-4" />
					<span>Chart of Accounts (COA) Status</span>
				</div>
				<p class="leading-relaxed text-amber-800/90">
					The Chart of Accounts in the current database is unseeded. The accounting system operates with <code>BypassValidationWhenCoaEmpty: true</code>, utilizing the live <strong>Operational Income Statement</strong> (Tabs 1 & 2) as the single source of truth for business profitability across all 7 travel modules.
				</p>
			</div>

			<div class="flex items-center gap-3">
				<Button
					variant="default"
					size="sm"
					onclick={() => goto('/accounting/ledger')}
					class="h-9 gap-1.5 rounded-xl cursor-pointer"
				>
					<span>Open General Ledger Explorer</span>
					<ArrowRight class="h-3.5 w-3.5" />
				</Button>

				<Button
					variant="outline"
					size="sm"
					onclick={() => goto('/accounting/chart-of-accounts')}
					class="h-9 gap-1.5 rounded-xl cursor-pointer"
				>
					<span>View Chart of Accounts Hierarchy</span>
					<ExternalLink class="h-3.5 w-3.5" />
				</Button>
			</div>
		</div>
	{/if}

	<!-- ─── RECONCILIATION & DATA AUDIT FOOTER ─────────────────────────────────── -->
	{#if pnlData}
		<div class="p-4 rounded-2xl bg-card border border-border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-2xs">
			<div class="flex items-center gap-2.5">
				{#if pnlData.reconciled}
					<div class="p-1 rounded-full bg-emerald-500/10 text-emerald-600">
						<ShieldCheck class="h-4 w-4" />
					</div>
					<div class="space-y-0.5">
						<span class="font-bold text-foreground">Reconciliation Status: Verified</span>
						<p class="text-[11px] text-muted-foreground">
							Totals match Salesmen report and Sales Entries for the selected period (Variance: 0.000 BHD).
						</p>
					</div>
				{:else}
					<div class="p-1 rounded-full bg-amber-500/10 text-amber-600">
						<AlertCircle class="h-4 w-4" />
					</div>
					<div class="space-y-0.5">
						<span class="font-bold text-amber-600">Reconciliation Variance</span>
						<p class="text-[11px] text-muted-foreground">{pnlData.reconciliationMessage}</p>
					</div>
				{/if}
			</div>

			<div class="text-[11px] text-muted-foreground font-mono space-y-0.5 md:text-right">
				<div>Data Sources: {pnlData.dataSourcesStatus}</div>
				<div>Generated At: {new Date(pnlData.generatedAt).toLocaleString()}</div>
			</div>
		</div>
	{/if}
</div>

<style>
	@media print {
		:global(body) {
			background: white !important;
			color: black !important;
		}
		:global(header),
		:global(nav),
		:global(aside),
		button,
		select,
		input {
			display: none !important;
		}
		.bg-card {
			background: white !important;
			border: 1px solid #e2e8f0 !important;
		}
	}
</style>
