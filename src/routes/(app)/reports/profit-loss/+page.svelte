<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/api/api-client';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { getBahrainDateString } from '$lib/formatters/date';
	import { Button } from '$lib/components/ui/button';
	import { toast } from '$lib/stores/toast';
	import { previewDocument } from '$lib/utils/preview-document';
	import { exportToCSV as downloadCSV } from '$lib/utils/csv-exporter';
	import {
		BarChart3,
		RefreshCw,
		FileSpreadsheet,
		FileDown,
		Calendar,
		X,
		Layers,
		FileText,
		ChevronDown,
		ChevronRight,
		AlertCircle,
		Plane,
		Building2,
		Compass,
		Clock,
		Car,
		Briefcase
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

	// ─── Preset Helper & Date State ──────────────────────────────────────────────
	type PresetType = 'all' | 'today' | 'this_week' | 'this_month' | 'last_30' | 'this_year';

	function formatDateForInput(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function calculatePresetRange(preset: PresetType): { start: string; end: string } {
		const now = new Date();
		const todayStr = getBahrainDateString(now);

		if (preset === 'today') {
			return { start: todayStr, end: todayStr };
		} else if (preset === 'this_week') {
			const startOfWeek = new Date(now);
			const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0
			startOfWeek.setDate(now.getDate() - dayOfWeek);
			return { start: getBahrainDateString(startOfWeek), end: todayStr };
		} else if (preset === 'this_month') {
			const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
			const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
			return { start: getBahrainDateString(startOfMonth), end: getBahrainDateString(endOfMonth) };
		} else if (preset === 'last_30') {
			const past30 = new Date();
			past30.setDate(now.getDate() - 30);
			return { start: getBahrainDateString(past30), end: todayStr };
		} else if (preset === 'this_year') {
			const startOfYear = new Date(now.getFullYear(), 0, 1);
			return { start: getBahrainDateString(startOfYear), end: todayStr };
		} else {
			return { start: '', end: '' };
		}
	}

	const initialDates = calculatePresetRange('this_month');
	let activePreset = $state<PresetType>('this_month');
	let startDate = $state<string>(initialDates.start);
	let endDate = $state<string>(initialDates.end);

	function setPreset(preset: PresetType) {
		activePreset = preset;
		const { start, end } = calculatePresetRange(preset);
		startDate = start;
		endDate = end;
		loadReport();
	}

	function handleCustomDateChange() {
		activePreset = 'all';
		loadReport();
	}

	// ─── States ──────────────────────────────────────────────────────────────────
	let loading = $state(true);
	let error = $state<string | null>(null);
	let pnlData = $state<OperationalProfitAndLossResponse | null>(null);

	// Navigation Tabs: 'performance' | 'statement'
	let activeTab = $state<'performance' | 'statement'>('performance');

	// Collapsible toggles in Income Statement
	let showRevenueDetails = $state(true);
	let showCostDetails = $state(true);
	let showExpenseDetails = $state(true);

	// Filter out non-operational contra items (e.g. Head Balance Withdrawal, Internal Contra Transfer)
	const operationalExpenseItems = $derived.by(() => {
		return (pnlData?.expenseItems ?? []).filter((e) => {
			const name = (e.categoryName || '').toLowerCase();
			return !name.includes('contra') && !name.includes('head balance withdrawal') && !name.includes('wallet withdrawal');
		});
	});

	const totalApprovedExpenses = $derived.by(() => {
		return operationalExpenseItems.reduce((acc, x) => acc + x.totalAmount, 0);
	});

	const totalOperatingExpenses = $derived.by(() => {
		return totalApprovedExpenses + (pnlData?.totalPayrollExpenses ?? 0);
	});

	// Derived calculations driven by finalized profit
	const finalGrossProfit = $derived(pnlData?.finalizedGrossProfit ?? 0);
	const finalGrossMargin = $derived(
		pnlData && pnlData.netRevenue > 0
			? (pnlData.finalizedGrossProfit / pnlData.netRevenue) * 100
			: 0
	);
	const finalNetProfit = $derived(
		pnlData ? pnlData.finalizedGrossProfit - totalOperatingExpenses : 0
	);
	const isFinalNetProfitable = $derived(finalNetProfit >= 0);
	const finalNetMargin = $derived(
		pnlData && pnlData.netRevenue > 0
			? (finalNetProfit / pnlData.netRevenue) * 100
			: 0
	);

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

	// ─── API Loader ─────────────────────────────────────────────────────────────
	async function loadReport() {
		loading = true;
		error = null;

		try {
			const params: Record<string, string> = {};
			if (startDate) params.startDate = startDate;
			if (endDate) params.endDate = endDate;

			const query = new URLSearchParams(params).toString();
			pnlData = await apiFetch<OperationalProfitAndLossResponse>(
				`api/reporting/profit-loss/summary${query ? `?${query}` : ''}`
			);
		} catch (err: any) {
			error = err?.message || 'Failed to load Profit & Loss report. Please retry.';
			pnlData = null;
			if (error) toast.error(error);
		} finally {
			loading = false;
		}
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
			const srvMargin = r.salesAmount > 0 ? (r.finalProfitAmount / r.salesAmount) * 100 : 0;
			rows.push([
				'1. Revenues',
				`Sales — ${r.serviceLabel}`,
				'Gross Booking Sale',
				r.bookingCount,
				r.salesAmount.toFixed(3),
				r.costAmount.toFixed(3),
				r.finalProfitAmount.toFixed(3),
				`${srvMargin.toFixed(1)}%`,
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
				'Cost Deduction',
				'—',
				'0.000',
				`-${pnlData.approvedPurchaseReturns.toFixed(3)}`,
				'—',
				'—',
				'—'
			]);
		}

		rows.push([
			'2. Cost of Sales Subtotal',
			'TOTAL NET COST OF SALES (COGS)',
			'Operating Outflow',
			pnlData.costOfSalesItems.reduce((acc, x) => acc + x.bookingCount, 0),
			'—',
			pnlData.netCostOfSales.toFixed(3),
			'—',
			'—',
			'—'
		]);

		// Gross Profit (Finalized)
		const csvFinalGross = pnlData.finalizedGrossProfit;
		const csvFinalGrossMargin = pnlData.netRevenue > 0 ? (csvFinalGross / pnlData.netRevenue) * 100 : 0;
		rows.push([
			'3. Gross Margin',
			'GROSS PROFIT (FINALIZED)',
			'Trading Margin',
			'—',
			'—',
			'—',
			csvFinalGross.toFixed(3),
			`${csvFinalGrossMargin.toFixed(1)}%`,
			csvFinalGross.toFixed(3)
		]);

		// Expenses
		operationalExpenseItems.forEach((e) => {
			rows.push([
				'4. Operating Expenses',
				`Expense — ${e.categoryName}`,
				'Overhead',
				e.expenseCount,
				'—',
				e.totalAmount.toFixed(3),
				'—',
				'—',
				'—'
			]);
		});

		if (pnlData.totalPayrollExpenses > 0) {
			rows.push([
				'4. Operating Expenses',
				'Staff Salaries & Payroll',
				'Payroll & Commissions',
				'—',
				'—',
				pnlData.totalPayrollExpenses.toFixed(3),
				'—',
				'—',
				'—'
			]);
		}

		rows.push([
			'4. Operating Expenses Subtotal',
			'TOTAL OPERATING EXPENSES',
			'Operating Overhead',
			operationalExpenseItems.reduce((acc, x) => acc + x.expenseCount, 0),
			'—',
			totalOperatingExpenses.toFixed(3),
			'—',
			'—',
			'—'
		]);

		// Net Profit (Finalized)
		const csvFinalNet = finalNetProfit;
		const csvFinalNetMargin = pnlData.netRevenue > 0 ? (csvFinalNet / pnlData.netRevenue) * 100 : 0;
		rows.push([
			'5. Net Bottom Line',
			'NET OPERATING PROFIT / (LOSS) [FINALIZED]',
			csvFinalNet >= 0 ? 'Surplus' : 'Deficit',
			'—',
			'—',
			'—',
			csvFinalNet.toFixed(3),
			`${csvFinalNetMargin.toFixed(1)}%`,
			csvFinalNet.toFixed(3)
		]);

		const filename = `profit_loss_${startDate || 'start'}_to_${endDate || 'end'}.csv`;
		downloadCSV(filename, headers, rows);
		toast.success('P&L Report CSV exported successfully.');
	}

	function handleExportPDF() {
		if (!pnlData) return;
		previewDocument('report', 'profit-loss-operational', { startDate, endDate });
		toast.info('Generating Operational P&L Statement PDF...');
	}

	onMount(() => {
		loadReport();
	});
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-bold text-foreground flex items-center gap-2">
				<BarChart3 class="h-5 w-5 text-primary" /> Operational Profit & Loss Report
			</h1>
			<p class="text-xs text-muted-foreground">Aggregated booking sales, supplier COGS, finalized gross margins, and net operating profit across all service modules.</p>
		</div>
		<div class="flex items-center gap-2">
			<Button variant="outline" class="h-8.5 rounded-xl cursor-pointer" onclick={loadReport} disabled={loading}>
				<RefreshCw class={['h-3.5 w-3.5 mr-1.5', loading ? 'animate-spin' : ''].join(' ')} />
				<span>Refresh</span>
			</Button>
		</div>
	</div>

	<!-- Date Filter Controls -->
	<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3">
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
			<div class="flex items-center gap-2">
				<Calendar class="h-4 w-4 text-primary" />
				<span class="text-xs font-bold text-foreground">Date Range Filter</span>
				{#if startDate || endDate}
					<span class="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary font-mono text-[11px] font-semibold">
						{startDate || 'Start'} &rarr; {endDate || 'End'}
					</span>
				{:else}
					<span class="px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono text-[11px]">
						All Time
					</span>
				{/if}
			</div>

			<!-- Preset Buttons -->
			<div class="flex items-center gap-1.5 text-xs overflow-x-auto flex-nowrap pb-1 scrollbar-thin">
				<button
					type="button"
					onclick={() => setPreset('all')}
					class="px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap {activePreset === 'all' && !startDate && !endDate ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
				>
					All Time
				</button>
				<button
					type="button"
					onclick={() => setPreset('today')}
					class="px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap {activePreset === 'today' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
				>
					Today
				</button>
				<button
					type="button"
					onclick={() => setPreset('this_week')}
					class="px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap {activePreset === 'this_week' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
				>
					This Week
				</button>
				<button
					type="button"
					onclick={() => setPreset('this_month')}
					class="px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap {activePreset === 'this_month' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
				>
					This Month
				</button>
				<button
					type="button"
					onclick={() => setPreset('last_30')}
					class="px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap {activePreset === 'last_30' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
				>
					Last 30 Days
				</button>
				<button
					type="button"
					onclick={() => setPreset('this_year')}
					class="px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap {activePreset === 'this_year' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
				>
					This Year
				</button>
			</div>
		</div>

		<!-- Custom Date Pickers -->
		<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-border/40 text-xs">
			<div class="flex items-center gap-2">
				<label for="pnl-startDate" class="text-muted-foreground font-medium text-[11px]">From:</label>
				<input
					id="pnl-startDate"
					type="date"
					bind:value={startDate}
					onchange={handleCustomDateChange}
					class="px-2.5 py-1 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
			</div>

			<div class="flex items-center gap-2">
				<label for="pnl-endDate" class="text-muted-foreground font-medium text-[11px]">To:</label>
				<input
					id="pnl-endDate"
					type="date"
					bind:value={endDate}
					onchange={handleCustomDateChange}
					class="px-2.5 py-1 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
			</div>

			{#if startDate || endDate}
				<Button
					variant="ghost"
					class="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 sm:ml-auto"
					onclick={() => setPreset('all')}
				>
					<X class="h-3 w-3" />
					<span>Clear Dates</span>
				</Button>
			{/if}
		</div>
	</div>

	<!-- Error Alert -->
	{#if error}
		<div class="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex flex-col sm:flex-row items-center justify-between gap-4 text-xs shadow-xs">
			<div class="flex items-center gap-2.5">
				<AlertCircle class="h-5 w-5 shrink-0" />
				<div>
					<h3 class="font-bold">Failed to generate Profit & Loss Report</h3>
					<p class="opacity-90 mt-0.5">{error}</p>
				</div>
			</div>
			<Button variant="outline" size="sm" onclick={loadReport} class="h-8.5 rounded-xl cursor-pointer shrink-0">
				<RefreshCw class="h-3.5 w-3.5 mr-1" />
				<span>Retry</span>
			</Button>
		</div>
	{/if}

	{#if loading && !pnlData}
		<!-- Loading Skeleton State matching Salesmen Report -->
		<div class="animate-pulse space-y-6">
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
				{#each Array(5) as _}
					<div class="h-24 bg-muted rounded-2xl"></div>
				{/each}
			</div>
			<div class="h-96 bg-muted rounded-2xl"></div>
		</div>
	{:else if pnlData}
		<!-- 5 Executive KPI Cards -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
			<!-- Card 1: Operating Revenue -->
			<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-1">
				<div class="flex items-center justify-between">
					<span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Operating Revenue</span>
					<span class="text-[10px] font-mono text-muted-foreground">{pnlData.revenueItems.reduce((acc, x) => acc + x.bookingCount, 0)} Bookings</span>
				</div>
				<span class="text-lg font-bold font-mono text-foreground block">
					<MoneyDisplay amount={pnlData.netRevenue} />
				</span>
				<div class="text-[10px] text-muted-foreground flex items-center justify-between">
					<span>Gross Sales</span>
					{#if pnlData.approvedSalesReturns > 0}
						<span class="text-rose-500 font-mono">-{pnlData.approvedSalesReturns.toFixed(3)} Ret</span>
					{:else}
						<span class="text-muted-foreground/70">Inflow</span>
					{/if}
				</div>
			</div>

			<!-- Card 2: Cost of Sales -->
			<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-1">
				<span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Cost of Sales (COGS)</span>
				<span class="text-lg font-bold font-mono text-foreground block">
					<MoneyDisplay amount={pnlData.netCostOfSales} />
				</span>
				<div class="text-[10px] text-muted-foreground flex items-center justify-between">
					<span>Supplier Buying Costs</span>
					{#if pnlData.approvedPurchaseReturns > 0}
						<span class="text-emerald-600 font-mono">-{pnlData.approvedPurchaseReturns.toFixed(3)} Ret</span>
					{:else}
						<span class="text-muted-foreground/70">Direct Costs</span>
					{/if}
				</div>
			</div>

			<!-- Card 3: Final Profit (Gross Margin) -->
			<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-1">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-1">
						<span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Final Profit</span>
						<span class="text-[10px] text-muted-foreground/70 cursor-help" title="Realized profit from confirmed/completed accounts profit records">ⓘ</span>
					</div>
					<span class="text-[10px] font-bold font-mono text-teal-600 dark:text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded">
						{finalGrossMargin.toFixed(1)}%
					</span>
				</div>
				<span class="text-lg font-bold font-mono text-teal-600 dark:text-teal-400 block">
					<MoneyDisplay amount={finalGrossProfit} />
				</span>
				<div class="text-[10px] text-muted-foreground flex items-center justify-between">
					<span>Realized Margin</span>
					{#if pnlData.estimatedGrossProfit > 0}
						<span class="text-muted-foreground/80 font-mono">Open: {pnlData.estimatedGrossProfit.toFixed(3)}</span>
					{/if}
				</div>
			</div>

			<!-- Card 4: Operating Expenses -->
			<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-1">
				<span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Operating Expenses</span>
				<span class="text-lg font-bold font-mono text-foreground block">
					<MoneyDisplay amount={totalOperatingExpenses} />
				</span>
				<div class="text-[10px] text-muted-foreground flex items-center justify-between">
					<span>Overhead: {totalApprovedExpenses.toFixed(3)}</span>
					<span>Payroll: {pnlData.totalPayrollExpenses.toFixed(3)}</span>
				</div>
			</div>

			<!-- Card 5: Net Profit / Loss -->
			<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-1">
				<div class="flex items-center justify-between">
					<span class="text-[11px] font-bold uppercase tracking-wider block {isFinalNetProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
						{isFinalNetProfitable ? 'Net Profit' : 'Net Loss'}
					</span>
					<span class="text-[10px] font-bold font-mono {isFinalNetProfitable ? 'text-emerald-600 bg-emerald-500/10' : 'text-rose-600 bg-rose-500/10'} px-1.5 py-0.5 rounded">
						{finalNetMargin.toFixed(1)}%
					</span>
				</div>
				<span class="text-lg font-bold font-mono {isFinalNetProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} block">
					<MoneyDisplay amount={finalNetProfit} />
				</span>
				<div class="text-[10px] text-muted-foreground flex items-center justify-between">
					<span>Bottom Line</span>
					<span class="font-semibold {isFinalNetProfitable ? 'text-emerald-600' : 'text-rose-600'}">{isFinalNetProfitable ? 'Surplus' : 'Deficit'}</span>
				</div>
			</div>
		</div>

		<!-- Table Filter / Navigation Tabs Bar -->
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-3">
			<div class="flex items-center gap-1 bg-muted/40 rounded-xl p-1 border border-border/50">
				<button
					type="button"
					onclick={() => (activeTab = 'performance')}
					class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer {activeTab === 'performance' ? 'bg-card text-foreground shadow-xs border border-border/30' : 'text-muted-foreground hover:text-foreground'}"
				>
					<Layers class="h-3.5 w-3.5" />
					<span>Service Performance Table</span>
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'statement')}
					class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer {activeTab === 'statement' ? 'bg-card text-foreground shadow-xs border border-border/30' : 'text-muted-foreground hover:text-foreground'}"
				>
					<FileText class="h-3.5 w-3.5" />
					<span>Income Statement View</span>
				</button>
			</div>

			<div class="flex items-center gap-2 text-xs">
				<Button
					variant="outline"
					class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5"
					onclick={handleExportCSV}
					disabled={loading || !pnlData}
				>
					<FileSpreadsheet class="h-3.5 w-3.5" />
					<span>CSV</span>
				</Button>
				<Button
					variant="outline"
					class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5"
					onclick={handleExportPDF}
					disabled={loading || !pnlData}
				>
					<FileDown class="h-3.5 w-3.5" />
					<span>PDF</span>
				</Button>
			</div>
		</div>

		<!-- TAB 1: SERVICE PERFORMANCE TABLE -->
		{#if activeTab === 'performance'}
			<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
				<div class="overflow-x-auto">
					<table class="w-full min-w-[750px] text-left border-collapse text-xs">
						<thead>
							<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold">
								<th class="p-4">Service</th>
								<th class="p-4 text-center">Bookings</th>
								<th class="p-4 text-right">Sales Value</th>
								<th class="p-4 text-right">Supplier Cost</th>
								<th class="p-4 text-right">Final Profit</th>
								<th class="p-4 text-center">Margin %</th>
								<th class="p-4 text-right">Open Deals Est.</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/60">
							{#if pnlData.revenueItems.length > 0}
								{#each pnlData.revenueItems as srv}
									{@const IconComponent = getServiceIcon(srv.serviceType)}
									{@const srvFinalMargin = srv.salesAmount > 0 ? (srv.finalProfitAmount / srv.salesAmount) * 100 : 0}
									{@const srvOpenEst = Math.max(0, srv.profitAmount - srv.finalProfitAmount)}
									<tr class="hover:bg-muted/10 transition-colors">
										<td class="p-4 font-medium text-foreground">
											<div class="flex items-center gap-2">
												<div class="p-1.5 rounded-lg bg-primary/10 text-primary">
													<IconComponent class="h-3.5 w-3.5" />
												</div>
												<span class="font-bold text-foreground">{srv.serviceLabel}</span>
											</div>
										</td>
										<td class="p-4 text-center font-mono font-bold text-foreground">{srv.bookingCount}</td>
										<td class="p-4 text-right font-mono font-bold text-foreground">
											<MoneyDisplay amount={srv.salesAmount} />
										</td>
										<td class="p-4 text-right font-mono text-muted-foreground">
											<MoneyDisplay amount={srv.costAmount} />
										</td>
										<td class="p-4 text-right font-mono font-bold text-teal-600 dark:text-teal-400">
											<MoneyDisplay amount={srv.finalProfitAmount} />
										</td>
										<td class="p-4 text-center font-mono">
											<span class="px-2 py-0.5 rounded text-[11px] font-bold {srv.salesAmount > 0 && srvFinalMargin >= 30 ? 'bg-emerald-500/10 text-emerald-600' : srv.finalProfitAmount > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'}">
												{srv.salesAmount > 0 ? `${srvFinalMargin.toFixed(1)}%` : '—'}
											</span>
										</td>
										<td class="p-4 text-right font-mono text-muted-foreground">
											{#if srvOpenEst > 0}
												<MoneyDisplay amount={srvOpenEst} />
											{:else}
												<span class="text-muted-foreground/40">—</span>
											{/if}
										</td>
									</tr>
								{/each}
							{:else}
								<tr>
									<td colspan="7" class="p-12 text-center text-muted-foreground">
										No booking financial records found in the selected date range.
									</td>
								</tr>
							{/if}
						</tbody>

						<tfoot class="bg-muted/40 border-t-2 border-border font-bold text-xs">
							<tr>
								<td class="p-4 uppercase text-foreground">Totals Across Services</td>
								<td class="p-4 text-center font-mono text-foreground font-bold">
									{pnlData.revenueItems.reduce((acc, x) => acc + x.bookingCount, 0)}
								</td>
								<td class="p-4 text-right font-mono text-foreground font-bold">
									<MoneyDisplay amount={pnlData.grossBookingRevenue} />
								</td>
								<td class="p-4 text-right font-mono text-muted-foreground font-bold">
									<MoneyDisplay amount={pnlData.grossSupplierCost} />
								</td>
								<td class="p-4 text-right font-mono text-teal-600 dark:text-teal-400 font-bold">
									<MoneyDisplay amount={pnlData.finalizedGrossProfit} />
								</td>
								<td class="p-4 text-center font-mono text-teal-600 dark:text-teal-400 font-bold">
									{pnlData.grossBookingRevenue > 0
										? `${((pnlData.finalizedGrossProfit / pnlData.grossBookingRevenue) * 100).toFixed(1)}%`
										: '—'}
								</td>
								<td class="p-4 text-right font-mono text-muted-foreground font-bold">
									{#if pnlData.estimatedGrossProfit > 0}
										<MoneyDisplay amount={pnlData.estimatedGrossProfit} />
									{:else}
										<span class="text-muted-foreground/40">—</span>
									{/if}
								</td>
							</tr>
						</tfoot>
					</table>
				</div>
			</div>
		{/if}

		<!-- TAB 2: DETAILED INCOME STATEMENT VIEW -->
		{#if activeTab === 'statement'}
			<div class="bg-card border border-border rounded-2xl shadow-xs overflow-hidden p-5 space-y-5">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
					<div>
						<h3 class="text-sm font-bold text-foreground">Operational Income Statement</h3>
						<p class="text-xs text-muted-foreground">
							Cascading formal financial breakdown from Gross Revenue to Net Operating Profit.
						</p>
					</div>
					<div class="text-xs text-muted-foreground font-mono bg-muted/40 px-2.5 py-1 rounded-lg border border-border/40">
						{startDate || 'Start'} &rarr; {endDate || 'End'}
					</div>
				</div>

				<div class="space-y-4 text-xs">
					<!-- Section 1: Operating Revenues -->
					<div class="border border-border rounded-2xl overflow-hidden shadow-xs">
						<button
							type="button"
							onclick={() => (showRevenueDetails = !showRevenueDetails)}
							class="w-full px-4 py-3 bg-muted/20 hover:bg-muted/30 transition-colors flex items-center justify-between cursor-pointer border-b border-border/80"
						>
							<div class="flex items-center gap-2">
								{#if showRevenueDetails}
									<ChevronDown class="h-4 w-4 text-muted-foreground" />
								{:else}
									<ChevronRight class="h-4 w-4 text-muted-foreground" />
								{/if}
								<span class="font-bold text-xs uppercase tracking-wider text-foreground">1. Operating Revenue (Gross Sales)</span>
							</div>
							<span class="font-mono font-bold text-foreground">
								<MoneyDisplay amount={pnlData.netRevenue} />
							</span>
						</button>

						{#if showRevenueDetails}
							<div class="p-4 space-y-2 divide-y divide-border/40">
								{#each pnlData.revenueItems as rev}
									<div class="pt-2 flex items-center justify-between hover:bg-muted/10 px-2 rounded-lg">
										<span class="text-muted-foreground flex items-center gap-2">
											<span class="w-2 h-2 rounded-full bg-blue-500"></span>
											Booking Revenue — {rev.serviceLabel} ({rev.bookingCount} bookings)
										</span>
										<span class="font-mono font-bold text-foreground"><MoneyDisplay amount={rev.salesAmount} /></span>
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
									<span class="font-mono font-bold"><MoneyDisplay amount={pnlData.netRevenue} /></span>
								</div>
							</div>
						{/if}
					</div>

					<!-- Section 2: Cost of Sales -->
					<div class="border border-border rounded-2xl overflow-hidden shadow-xs">
						<button
							type="button"
							onclick={() => (showCostDetails = !showCostDetails)}
							class="w-full px-4 py-3 bg-muted/20 hover:bg-muted/30 transition-colors flex items-center justify-between cursor-pointer border-b border-border/80"
						>
							<div class="flex items-center gap-2">
								{#if showCostDetails}
									<ChevronDown class="h-4 w-4 text-muted-foreground" />
								{:else}
									<ChevronRight class="h-4 w-4 text-muted-foreground" />
								{/if}
								<span class="font-bold text-xs uppercase tracking-wider text-foreground">2. Cost of Sales (Direct Supplier Costs)</span>
							</div>
							<span class="font-mono font-bold text-foreground">
								<MoneyDisplay amount={pnlData.netCostOfSales} />
							</span>
						</button>

						{#if showCostDetails}
							<div class="p-4 space-y-2 divide-y divide-border/40">
								{#each pnlData.costOfSalesItems as cost}
									<div class="pt-2 flex items-center justify-between hover:bg-muted/10 px-2 rounded-lg">
										<span class="text-muted-foreground flex items-center gap-2">
											<span class="w-2 h-2 rounded-full bg-amber-500"></span>
											Supplier Cost — {cost.serviceLabel}
										</span>
										<span class="font-mono font-bold text-foreground"><MoneyDisplay amount={cost.costAmount} /></span>
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
									<span class="font-mono font-bold"><MoneyDisplay amount={pnlData.netCostOfSales} /></span>
								</div>
							</div>
						{/if}
					</div>

					<!-- Banner: Gross Trading Margin -->
					<div class="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div class="space-y-0.5">
							<span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
								Gross Trading Margin (Finalized)
							</span>
							<h4 class="text-lg font-bold font-mono text-teal-600 dark:text-teal-400">
								<MoneyDisplay amount={finalGrossProfit} />
							</h4>
							<p class="text-[11px] text-muted-foreground">
								Finalized Margin: <strong class="font-mono text-teal-600 dark:text-teal-400">{finalGrossMargin.toFixed(1)}%</strong>
								(Finalized Profit: {finalGrossProfit.toFixed(3)} BHD)
							</p>
						</div>

						<div class="text-xs font-mono space-y-1 sm:text-right">
							<div class="text-teal-600 dark:text-teal-400 font-bold">
								Finalized Profit (Closed Deals): <strong>{finalGrossProfit.toFixed(3)} BHD</strong>
							</div>
							{#if pnlData.estimatedGrossProfit > 0}
								<div class="text-muted-foreground">
									Estimated Profit (Open Deals): <strong>{pnlData.estimatedGrossProfit.toFixed(3)} BHD</strong>
								</div>
							{/if}
						</div>
					</div>

					<!-- Section 3: Operating Expenses -->
					<div class="border border-border rounded-2xl overflow-hidden shadow-xs">
						<button
							type="button"
							onclick={() => (showExpenseDetails = !showExpenseDetails)}
							class="w-full px-4 py-3 bg-muted/20 hover:bg-muted/30 transition-colors flex items-center justify-between cursor-pointer border-b border-border/80"
						>
							<div class="flex items-center gap-2">
								{#if showExpenseDetails}
									<ChevronDown class="h-4 w-4 text-muted-foreground" />
								{:else}
									<ChevronRight class="h-4 w-4 text-muted-foreground" />
								{/if}
								<span class="font-bold text-xs uppercase tracking-wider text-foreground">3. Operating Expenses (Overheads & Payroll)</span>
							</div>
							<span class="font-mono font-bold text-foreground">
								<MoneyDisplay amount={totalOperatingExpenses} />
							</span>
						</button>

						{#if showExpenseDetails}
							<div class="p-4 space-y-2 divide-y divide-border/40">
								{#if operationalExpenseItems.length === 0 && pnlData.totalPayrollExpenses === 0}
									<div class="py-4 text-center text-muted-foreground text-xs">
										No operational expenses or salary payouts recorded in this period.
									</div>
								{:else}
									{#each operationalExpenseItems as exp}
										<div class="pt-2 flex items-center justify-between hover:bg-muted/10 px-2 rounded-lg">
											<span class="text-muted-foreground flex items-center gap-2">
												<span class="w-2 h-2 rounded-full bg-rose-500"></span>
												Operating Expense — {exp.categoryName} ({exp.expenseCount} claims)
											</span>
											<span class="font-mono font-bold text-foreground"><MoneyDisplay amount={exp.totalAmount} /></span>
										</div>
									{/each}

									{#if pnlData.totalPayrollExpenses > 0}
										<div class="pt-2 flex items-center justify-between hover:bg-muted/10 px-2 rounded-lg">
											<span class="text-muted-foreground flex items-center gap-2">
												<span class="w-2 h-2 rounded-full bg-indigo-500"></span>
												Staff Salaries, Allowances & Commissions (Payroll)
											</span>
											<span class="font-mono font-bold text-foreground"><MoneyDisplay amount={pnlData.totalPayrollExpenses} /></span>
										</div>
									{/if}
								{/if}

								<div class="pt-3 flex items-center justify-between font-bold text-foreground text-xs px-2 bg-muted/20 py-2 rounded-lg">
									<span>Total Operating Expenses</span>
									<span class="font-mono font-bold"><MoneyDisplay amount={totalOperatingExpenses} /></span>
								</div>
							</div>
						{/if}
					</div>

					<!-- Section 4: Net Operating Profit Bottom Line -->
					<div class="p-5 rounded-2xl border {isFinalNetProfitable ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-rose-500/5 border-rose-500/30'} flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
						<div class="space-y-1">
							<span class="text-[11px] font-bold uppercase tracking-wider block opacity-80 {isFinalNetProfitable ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}">
								Bottom Line Result (Finalized)
							</span>
							<h3 class="text-xl font-bold font-mono {isFinalNetProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
								{isFinalNetProfitable ? 'NET OPERATING PROFIT:' : 'NET OPERATING LOSS:'}
								<MoneyDisplay amount={finalNetProfit} />
							</h3>
							<p class="text-xs text-muted-foreground">
								Net Profit Margin: <strong class="font-mono {isFinalNetProfitable ? 'text-emerald-600' : 'text-rose-600'}">{finalNetMargin.toFixed(1)}%</strong>
								(Finalized Profit {finalGrossProfit.toFixed(3)} - Operating Expenses {totalOperatingExpenses.toFixed(3)})
							</p>
						</div>

						<div class="bg-card p-3 rounded-xl border border-border text-xs space-y-1 font-mono shadow-xs">
							<div class="flex justify-between gap-4">
								<span class="text-muted-foreground">Finalized Net Profit:</span>
								<strong class={isFinalNetProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
									{finalNetProfit.toFixed(3)} BHD
								</strong>
							</div>
							<div class="flex justify-between gap-4">
								<span class="text-muted-foreground">Finalized Margin:</span>
								<strong>{finalNetMargin.toFixed(1)}%</strong>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
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
