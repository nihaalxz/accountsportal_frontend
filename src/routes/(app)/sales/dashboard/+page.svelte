<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { apiFetch } from '$lib/api/api-client';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { DateDisplay } from '$lib/components';
	import { getBahrainDateString, parseDate } from '$lib/formatters/date';
	import { Button } from '$lib/components/ui/button';
	import {
		ShoppingBag,
		DollarSign,
		Wallet,
		Landmark,
		Users,
		Award,
		Clock,
		ArrowUpRight,
		RefreshCw,
		BarChart3,
		Receipt,
		ArrowRight
	} from 'lucide-svelte';

	let loading = $state(true);
	let dashboardData = $state<any>(null);
	let reconciliationSummary = $state<any>(null);
	let recentTransactions = $state<any[]>([]);
	let salesmenList = $state<any[]>([]);
	let pendingReceiptsCount = $state(0);

	// Today's Date (Bahrain AST)
	const todayStr = getBahrainDateString();

	// Derived values for today
	let todaysBookingsCount = $derived(() => {
		return 0;
	});

	let todaysCollections = $derived(() => {
		if (!recentTransactions) return 0;
		// Sum of incoming transactions approved today in Bahrain
		return recentTransactions
			.filter(t => {
				if (t.transactionType !== 'incoming' || !t.createdAt) return false;
				const p = parseDate(t.createdAt);
				return p && getBahrainDateString(p) === todayStr;
			})
			.reduce((sum, t) => sum + t.amount, 0);
	});

	let todaysRevenue = $derived(() => {
		return 0;
	});

	let totalReceivables = $derived(() => {
		if (!dashboardData) return 0;
		return dashboardData.totalReceivables ?? 0;
	});

	let totalCustomerWallets = $derived(() => {
		if (!dashboardData) return 0;
		return dashboardData.totalCustomerWallets ?? 0;
	});

	let pendingPostingsCount = $derived(() => {
		return recentTransactions.filter(t => t.status === 'pending').length;
	});

	let pendingSupplierPaymentsCount = $derived(() => {
		return recentTransactions.filter(t => t.referenceType === 'supplierpayment' && t.status === 'pending').length;
	});

	let totalBookings = $derived(() => {
		if (!dashboardData) return 0;
		return (
			dashboardData.totalFlightBookings +
			dashboardData.totalHotelBookings +
			dashboardData.totalVisaApplications +
			dashboardData.totalVfsAppointments +
			dashboardData.totalHolidayPackages +
			dashboardData.totalTransportations +
			dashboardData.totalOtherServices
		);
	});

	let topSalesmen = $derived(() => {
		return [...salesmenList]
			.sort((a, b) => b.totalProfit - a.totalProfit)
			.slice(0, 5);
	});

	async function loadDashboardData() {
		loading = true;
		try {
			// Run parallel fetches
			const [dash, recon, txns, salesmen, receiptsRes] = await Promise.all([
				apiFetch<any>('api/sales-entries/dashboard'),
				apiFetch<any>('api/reconciliation/summary'),
				apiFetch<any[]>('api/Transaction?pageSize=10'),
				apiFetch<any[]>('api/sales-entries/salesmen/report'),
				apiFetch<any>('api/sales-entries/receipts?pageSize=100').catch(() => null)
			]);

			dashboardData = dash;
			reconciliationSummary = recon;
			recentTransactions = txns || [];
			salesmenList = salesmen || [];

			if (receiptsRes && receiptsRes.items) {
				pendingReceiptsCount = receiptsRes.items.filter((r: any) => (r.status || '').toLowerCase() === 'pending').length;
			}
		} catch (err) {
			console.error('Failed to load modernized dashboard data:', err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadDashboardData();
	});
</script>

<svelte:head>
	<title>Sales Integration Dashboard — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-bold text-foreground font-sans flex items-center gap-2">
				<ShoppingBag class="h-5 w-5 text-primary" />
				Sales Entries Dashboard
			</h1>
			<p class="text-xs text-muted-foreground">
				Real-time sales performance indicators, operational metrics, and linked accounting ledger standings.
			</p>
		</div>
		<Button
			variant="outline"
			class="h-8.5 rounded-xl cursor-pointer self-start sm:self-auto flex items-center gap-1.5 text-xs font-semibold"
			onclick={loadDashboardData}
			disabled={loading}
		>
			<RefreshCw class={['h-3.5 w-3.5', loading ? 'animate-spin' : ''].join(' ')} />
			<span>Refresh Dashboard</span>
		</Button>
	</div>

	{#if loading}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			{#each Array(8) as _}
				<div class="bg-card border border-border rounded-2xl p-5 h-24 animate-pulse flex flex-col justify-between">
					<div class="h-3 w-1/3 bg-muted rounded"></div>
					<div class="h-6 w-2/3 bg-muted rounded"></div>
				</div>
			{/each}
		</div>
	{:else if dashboardData}
		<!-- Metrics Grid: Row 1 (Today's Analytics & Outstanding) -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			<!-- Today's Bookings -->
			<div class="bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center gap-4 hover:border-primary/30 transition-colors">
				<div class="p-3 bg-primary/10 text-primary rounded-xl">
					<ShoppingBag class="h-6 w-6" />
				</div>
				<div>
					<p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Today's Bookings</p>
					<h3 class="text-lg font-bold mt-1 text-foreground">{todaysBookingsCount()}</h3>
					<p class="text-[9px] text-muted-foreground mt-0.5">New sales entries registered</p>
				</div>
			</div>

			<!-- Today's Collections -->
			<div class="bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center gap-4 hover:border-emerald-500/20 transition-colors">
				<div class="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
					<DollarSign class="h-6 w-6" />
				</div>
				<div>
					<p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Today's Collections</p>
					<h3 class="text-lg font-bold mt-1 text-foreground"><MoneyDisplay amount={todaysCollections()} /></h3>
					<p class="text-[9px] text-emerald-600 font-semibold mt-0.5">Cleared customer payments</p>
				</div>
			</div>

			<!-- Today's Revenue -->
			<div class="bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center gap-4 hover:border-blue-500/20 transition-colors">
				<div class="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
					<Award class="h-6 w-6" />
				</div>
				<div>
					<p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Today's Revenue</p>
					<h3 class="text-lg font-bold mt-1 text-foreground"><MoneyDisplay amount={todaysRevenue()} /></h3>
					<p class="text-[9px] text-muted-foreground mt-0.5">Net markup margin today</p>
				</div>
			</div>

			<!-- Outstanding Receivables -->
			<div class="bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center gap-4 hover:border-red-500/20 transition-colors">
				<div class="p-3 bg-red-500/10 text-red-600 rounded-xl">
					<Clock class="h-6 w-6" />
				</div>
				<div>
					<p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Outstanding Receivables</p>
					<h3 class="text-lg font-bold mt-1 text-foreground"><MoneyDisplay amount={totalReceivables()} /></h3>
					<p class="text-[9px] text-red-600 font-semibold mt-0.5">Unpaid customer accounts</p>
				</div>
			</div>
		</div>

		<!-- Metrics Grid: Row 2 (Liquidity Indicators) -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			<!-- Outstanding Payables -->
			<div class="bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center gap-4 hover:border-amber-500/20 transition-colors">
				<div class="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
					<Wallet class="h-6 w-6" />
				</div>
				<div>
					<p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Outstanding Payables</p>
					<h3 class="text-lg font-bold mt-1 text-foreground">
						<MoneyDisplay amount={reconciliationSummary?.totalSupplierPayableBalance ?? 0} />
					</h3>
					<p class="text-[9px] text-muted-foreground mt-0.5">Total supplier debt owed</p>
				</div>
			</div>

			<!-- Cash Balance -->
			<div class="bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center gap-4 hover:border-teal-500/20 transition-colors">
				<div class="p-3 bg-teal-500/10 text-teal-600 rounded-xl">
					<Landmark class="h-6 w-6" />
				</div>
				<div>
					<p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Cash Balance</p>
					<h3 class="text-lg font-bold mt-1 text-foreground">
						<MoneyDisplay amount={reconciliationSummary?.totalAccountBalance ?? dashboardData.cashInHand} />
					</h3>
					<p class="text-[9px] text-muted-foreground mt-0.5">Liquidity in physical drawers</p>
				</div>
			</div>

			<!-- Bank Balance -->
			<div class="bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center gap-4 hover:border-indigo-500/20 transition-colors">
				<div class="p-3 bg-indigo-500/10 text-indigo-600 rounded-xl">
					<Landmark class="h-6 w-6" />
				</div>
				<div>
					<p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Bank Balance</p>
					<h3 class="text-lg font-bold mt-1 text-foreground">
						<MoneyDisplay amount={reconciliationSummary?.totalBankBalance ?? 0} />
					</h3>
					<p class="text-[9px] text-muted-foreground mt-0.5">Liquidity in verified bank accounts</p>
				</div>
			</div>

			<!-- Wallet Balance -->
			<div class="bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center gap-4 hover:border-purple-500/20 transition-colors">
				<div class="p-3 bg-purple-500/10 text-purple-600 rounded-xl">
					<Users class="h-6 w-6" />
				</div>
				<div>
					<p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Customer Wallet Balance</p>
					<h3 class="text-lg font-bold mt-1 text-foreground">
						<MoneyDisplay amount={totalCustomerWallets()} />
					</h3>
					<p class="text-[9px] text-purple-600 font-semibold mt-0.5">Pre-funded customer credit</p>
				</div>
			</div>
		</div>

		<!-- Pending Receipts Interactive Card -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<!-- Pending Receipts Card -->
			<div
				onclick={() => goto('/sales/receipts')}
				class="bg-card border border-border hover:border-emerald-500/50 rounded-2xl p-5 shadow-xs flex items-center justify-between cursor-pointer transition-all hover:shadow-md group"
				role="button"
				tabindex="0"
				onkeydown={(e) => e.key === 'Enter' && goto('/sales/receipts')}
			>
				<div class="flex items-center gap-4">
					<div class="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-105 transition-transform">
						<Receipt class="h-6 w-6" />
					</div>
					<div>
						<div class="flex items-center gap-2">
							<h3 class="text-sm font-bold text-foreground group-hover:text-emerald-600 transition-colors">
								Pending Receipts
							</h3>
							<span class="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-600 text-white">
								{pendingReceiptsCount}
							</span>
						</div>
						<p class="text-xs text-muted-foreground mt-0.5">
							{pendingReceiptsCount} customer payment collection{pendingReceiptsCount === 1 ? '' : 's'} awaiting posting
						</p>
					</div>
				</div>
				<div class="flex items-center text-xs font-semibold text-emerald-600 group-hover:translate-x-1 transition-transform shrink-0">
					<span>Manage ({pendingReceiptsCount})</span>
					<ArrowRight class="h-4 w-4 ml-1" />
				</div>
			</div>
		</div>



		<!-- Charts & Activity Row -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Chart: Revenue by Service Type -->
			<div class="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
				<h3 class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
					<BarChart3 class="h-4 w-4 text-primary" />
					Revenue by Service Type
				</h3>
				
				<!-- Responsive CSS Bars -->
				<div class="space-y-3 pt-2 text-xs">
					{#each [
						{ name: 'Flights', value: dashboardData.totalFlightBookings, color: 'bg-primary' },
						{ name: 'Hotels', value: dashboardData.totalHotelBookings, color: 'bg-emerald-500' },
						{ name: 'Visas', value: dashboardData.totalVisaApplications, color: 'bg-blue-500' },
						{ name: 'VFS', value: dashboardData.totalVfsAppointments, color: 'bg-amber-500' },
						{ name: 'Holidays', value: dashboardData.totalHolidayPackages, color: 'bg-purple-500' },
						{ name: 'Transport', value: dashboardData.totalTransportations, color: 'bg-teal-500' },
						{ name: 'Other', value: dashboardData.totalOtherServices, color: 'bg-zinc-500' }
					] as s}
						<div>
							<div class="flex justify-between font-semibold mb-1">
								<span>{s.name}</span>
								<span class="text-muted-foreground">{s.value} bookings</span>
							</div>
							<div class="w-full bg-muted rounded-full h-2">
								<div class="h-2 rounded-full {s.color}" style="width: {Math.min(100, Math.max(5, (s.value / (totalBookings() || 1)) * 100))}%"></div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Top Salesmen Leaderboard -->
			<div class="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
				<h3 class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
					<Award class="h-4 w-4 text-primary" />
					Sales Performance Leaderboard
				</h3>

				<div class="divide-y divide-border/60 text-xs">
					{#if topSalesmen().length > 0}
						{#each topSalesmen() as rep, index}
							<div class="py-3 flex items-center justify-between first:pt-0 last:pb-0">
								<div class="flex items-center gap-3">
									<span class="h-5 w-5 bg-muted text-[10px] font-bold rounded-full flex items-center justify-center border border-border">
										#{index + 1}
									</span>
									<div>
										<h4 class="font-bold text-foreground">{rep.name}</h4>
										<p class="text-[10px] text-muted-foreground truncate max-w-[150px]">{rep.email}</p>
									</div>
								</div>
								<div class="text-right">
									<span class="font-bold text-foreground font-mono"><MoneyDisplay amount={rep.totalProfit} /></span>
									<p class="text-[10px] text-muted-foreground">{rep.bookingsCount} bookings</p>
								</div>
							</div>
						{/each}
					{:else}
						<p class="text-center text-muted-foreground py-10">No sales performance data found.</p>
					{/if}
				</div>
			</div>

			<!-- Recent Activity Streams -->
			<div class="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
						Recent Postings Log
					</h3>
					<a href="/sales/receipts" class="text-[11px] font-semibold text-primary hover:underline">View Receipts</a>
				</div>

				<div class="space-y-3.5 max-h-[300px] overflow-y-auto text-xs pr-1">
					{#if recentTransactions.length > 0}
						{#each recentTransactions.slice(0, 5) as tx}
							<div class="flex items-start gap-2.5">
								<div class={['p-1.5 rounded-lg shrink-0 mt-0.5', 
									tx.transactionType === 'incoming' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'].join(' ')}>
									<ArrowUpRight class={['h-3.5 w-3.5', tx.transactionType === 'incoming' ? '' : 'rotate-90'].join(' ')} />
								</div>
								<div class="flex-1 min-w-0">
									<div class="flex justify-between items-center gap-2">
										<p class="font-bold text-foreground truncate">{tx.description || 'Posting Record'}</p>
										<span class="font-bold text-foreground font-mono"><MoneyDisplay amount={tx.amount} /></span>
									</div>
									<div class="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
										<span class="capitalize">{tx.paymentMethod} • Status: 
											<strong class={tx.status === 'approved' ? 'text-emerald-600' : 'text-amber-600'}>{tx.status}</strong>
										</span>
										<DateDisplay value={tx.createdAt} />
									</div>
								</div>
							</div>
						{/each}
					{:else}
						<p class="text-center text-muted-foreground py-10">No recent activity found.</p>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
