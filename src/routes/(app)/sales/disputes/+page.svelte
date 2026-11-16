<script lang="ts">
	import { onMount } from 'svelte';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import DateDisplay from '$lib/components/DateDisplay.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		getDisputes,
		getDisputesDashboard,
		getDisputeById,
		submitDisputeDecision
	} from '$features/disputes/api';
	import type {
		DisputeResponse,
		DisputesDashboardResponse,
		PagedResponse
	} from '$features/disputes/types';
	import {
		Search,
		ChevronLeft,
		ChevronRight,
		RefreshCw,
		AlertTriangle,
		CheckCircle2,
		XCircle,
		Clock,
		DollarSign,
		Eye,
		ShieldAlert,
		FileText,
		User,
		ArrowRight,
		X
	} from 'lucide-svelte';

	let disputesData = $state<PagedResponse<DisputeResponse> | null>(null);
	let dashboardData = $state<DisputesDashboardResponse | null>(null);
	let loading = $state(false);
	let dashboardLoading = $state(false);

	let currentPage = $state(1);
	let pageSize = $state(10);
	let selectedStatus = $state('all');
	let searchVal = $state('');
	let sortVal = $state('pending_first');

	let searchTimeout: any;

	// Modal State
	let selectedDispute = $state<DisputeResponse | null>(null);
	let isModalOpen = $state(false);
	let loadingDetail = $state(false);
	let submittingDecision = $state(false);
	let decisionError = $state<string | null>(null);

	// Decision Form State
	let decisionAction = $state<'approve' | 'reject'>('approve');
	let approvedAmountInput = $state<number>(0);
	let resolutionInput = $state('');

	function handleSearchInput(val: string) {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			searchVal = val;
			currentPage = 1;
			fetchDisputes();
		}, 400);
	}

	async function fetchDashboard() {
		dashboardLoading = true;
		try {
			dashboardData = await getDisputesDashboard();
		} catch (err) {
			console.error('Failed to load disputes dashboard stats:', err);
		} finally {
			dashboardLoading = false;
		}
	}

	async function fetchDisputes() {
		loading = true;
		try {
			const res = await getDisputes({
				page: currentPage,
				pageSize: pageSize,
				status: selectedStatus === 'all' ? undefined : selectedStatus,
				search: searchVal.trim() ? searchVal.trim() : undefined,
				sort: sortVal
			});
			disputesData = res;
		} catch (err) {
			console.error('Failed to load disputes list:', err);
		} finally {
			loading = false;
		}
	}

	function refreshAll() {
		fetchDashboard();
		fetchDisputes();
	}

	onMount(() => {
		refreshAll();
	});

	async function openDisputeModal(id: number) {
		isModalOpen = true;
		loadingDetail = true;
		decisionError = null;
		selectedDispute = null;
		try {
			const detail = await getDisputeById(id);
			selectedDispute = detail;
			decisionAction = 'approve';
			approvedAmountInput = detail.refundAmount ?? 0;
			resolutionInput = '';
		} catch (err) {
			console.error('Failed to fetch dispute detail:', err);
			decisionError = 'Failed to load dispute detail.';
		} finally {
			loadingDetail = false;
		}
	}

	function closeModal() {
		isModalOpen = false;
		selectedDispute = null;
		decisionError = null;
	}

	async function handleDecisionSubmit() {
		if (!selectedDispute) return;
		if (!resolutionInput.trim()) {
			decisionError = 'Resolution note is required.';
			return;
		}

		submittingDecision = true;
		decisionError = null;
		try {
			await submitDisputeDecision(selectedDispute.id, {
				decision: decisionAction,
				approvedRefundAmount: decisionAction === 'approve' && selectedDispute.isRefund ? approvedAmountInput : 0,
				resolution: resolutionInput.trim()
			});
			closeModal();
			refreshAll();
		} catch (err: any) {
			console.error('Failed to submit dispute decision:', err);
			decisionError = err?.message || 'Failed to submit decision. Please try again.';
		} finally {
			submittingDecision = false;
		}
	}

	function getStatusBadge(status: string) {
		const st = (status || '').toLowerCase();
		if (st === 'open' || st === 'pending') {
			return { label: 'Pending Review', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
		}
		if (st === 'resolved' || st === 'accepted') {
			return { label: 'Resolved', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
		}
		if (st === 'rejected') {
			return { label: 'Rejected', cls: 'bg-rose-500/10 text-rose-600 border-rose-500/20' };
		}
		return { label: status, cls: 'bg-muted text-muted-foreground border-border' };
	}

	function formatServiceRoute(serviceType: string, disputableId: number): string {
		const st = (serviceType || '').toLowerCase();
		if (st.includes('flight')) return `/sales/bookings/flights/${disputableId}`;
		if (st.includes('hotel')) return `/sales/bookings/hotels/${disputableId}`;
		if (st.includes('visa')) return `/sales/bookings/visa/${disputableId}`;
		if (st.includes('vfs')) return `/sales/bookings/vfs/${disputableId}`;
		if (st.includes('holiday')) return `/sales/bookings/holiday/${disputableId}`;
		if (st.includes('transport')) return `/sales/bookings/transportation/${disputableId}`;
		if (st.includes('other')) return `/sales/bookings/other-services/${disputableId}`;
		return `/sales/bookings/flights/${disputableId}`;
	}
</script>

<svelte:head>
	<title>Disputes & Chargebacks — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Title & Top Actions -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex flex-col gap-1">
			<div class="flex items-center gap-2">
				<ShieldAlert class="h-6 w-6 text-primary" />
				<h1 class="text-xl font-bold text-foreground font-sans">
					Disputes & Chargebacks Workspace
				</h1>
			</div>
			<p class="text-xs text-muted-foreground">
				Review and approve operational disputes, chargebacks, and refund claims submitted from the Sales Portal.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<Button
				variant="outline"
				class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
				onclick={refreshAll}
			>
				<RefreshCw class="h-3.5 w-3.5 {loading || dashboardLoading ? 'animate-spin' : ''}" />
				<span>Reload</span>
			</Button>
		</div>
	</div>

	<!-- Dashboard Metric Cards -->
	<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
		<div class="bg-card border border-border rounded-2xl p-3.5 space-y-1">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-[10px] uppercase tracking-wider font-semibold">Total Cases</span>
				<FileText class="h-4 w-4" />
			</div>
			<span class="text-lg font-bold block text-foreground">
				{dashboardData ? dashboardData.total : '—'}
			</span>
		</div>

		<div class="bg-card border border-border rounded-2xl p-3.5 space-y-1">
			<div class="flex items-center justify-between text-amber-600">
				<span class="text-[10px] uppercase tracking-wider font-semibold">Pending Review</span>
				<Clock class="h-4 w-4" />
			</div>
			<span class="text-lg font-bold block text-amber-600">
				{dashboardData ? dashboardData.pending : '—'}
			</span>
		</div>

		<div class="bg-card border border-border rounded-2xl p-3.5 space-y-1">
			<div class="flex items-center justify-between text-emerald-600">
				<span class="text-[10px] uppercase tracking-wider font-semibold">Resolved</span>
				<CheckCircle2 class="h-4 w-4" />
			</div>
			<span class="text-lg font-bold block text-emerald-600">
				{dashboardData ? dashboardData.resolved : '—'}
			</span>
		</div>

		<div class="bg-card border border-border rounded-2xl p-3.5 space-y-1">
			<div class="flex items-center justify-between text-rose-600">
				<span class="text-[10px] uppercase tracking-wider font-semibold">Rejected</span>
				<XCircle class="h-4 w-4" />
			</div>
			<span class="text-lg font-bold block text-rose-600">
				{dashboardData ? dashboardData.rejected : '—'}
			</span>
		</div>

		<div class="bg-card border border-border rounded-2xl p-3.5 space-y-1">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-[10px] uppercase tracking-wider font-semibold">Requested Refund</span>
				<DollarSign class="h-4 w-4" />
			</div>
			<span class="text-sm font-bold block text-foreground font-mono">
				{#if dashboardData}
					<MoneyDisplay amount={dashboardData.requestedRefundAmount} />
				{:else}
					—
				{/if}
			</span>
		</div>

		<div class="bg-card border border-border rounded-2xl p-3.5 space-y-1">
			<div class="flex items-center justify-between text-emerald-600">
				<span class="text-[10px] uppercase tracking-wider font-semibold">Approved Refund</span>
				<DollarSign class="h-4 w-4" />
			</div>
			<span class="text-sm font-bold block text-emerald-600 font-mono">
				{#if dashboardData}
					<MoneyDisplay amount={dashboardData.approvedRefundAmount} />
				{:else}
					—
				{/if}
			</span>
		</div>
	</div>

	<!-- Controls Toolbar: Tabs, Search & Sort -->
	<div class="bg-card border border-border rounded-2xl p-4 space-y-3">
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
			<!-- Status Tabs -->
			<div class="flex bg-muted/40 p-1 rounded-xl w-full md:w-auto">
				<button
					onclick={() => { selectedStatus = 'all'; currentPage = 1; fetchDisputes(); }}
					class="flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer {selectedStatus === 'all' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
				>
					All Cases
				</button>
				<button
					onclick={() => { selectedStatus = 'pending'; currentPage = 1; fetchDisputes(); }}
					class="flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 {selectedStatus === 'pending' ? 'bg-card text-amber-600 shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
				>
					<span>Pending Review</span>
					{#if dashboardData && dashboardData.pending > 0}
						<span class="px-1.5 py-0.2 text-[9px] font-bold bg-amber-500/20 text-amber-700 rounded-md">
							{dashboardData.pending}
						</span>
					{/if}
				</button>
				<button
					onclick={() => { selectedStatus = 'resolved'; currentPage = 1; fetchDisputes(); }}
					class="flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer {selectedStatus === 'resolved' ? 'bg-card text-emerald-600 shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
				>
					Resolved
				</button>
				<button
					onclick={() => { selectedStatus = 'rejected'; currentPage = 1; fetchDisputes(); }}
					class="flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer {selectedStatus === 'rejected' ? 'bg-card text-rose-600 shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
				>
					Rejected
				</button>
			</div>

			<!-- Search & Sort Controls -->
			<div class="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
				<div class="relative w-full sm:w-64">
					<Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
					<input
						type="text"
						placeholder="Search ID, booking, subject, salesman, IBAN..."
						oninput={(e) => handleSearchInput((e.target as HTMLInputElement).value)}
						class="w-full text-xs pl-10 pr-4 py-2 border border-border rounded-xl bg-background text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
					/>
				</div>

				<select
					bind:value={sortVal}
					onchange={() => { currentPage = 1; fetchDisputes(); }}
					class="w-full sm:w-auto text-xs px-3 py-2 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
				>
					<option value="pending_first">Pending First</option>
					<option value="newest">Newest First</option>
					<option value="oldest">Oldest First</option>
					<option value="highest_refund">Highest Refund</option>
					<option value="lowest_refund">Lowest Refund</option>
				</select>
			</div>
		</div>
	</div>

	<!-- Data Table -->
	{#if loading}
		<div class="bg-card border border-border rounded-2xl p-6 h-96 flex items-center justify-center">
			<RefreshCw class="h-8 w-8 text-primary animate-spin" />
		</div>
	{:else if disputesData && disputesData.items && disputesData.items.length > 0}
		<div class="bg-card border border-border rounded-2xl overflow-x-auto shadow-xs max-w-full">
			<table class="w-full min-w-[850px] text-left border-collapse text-xs">
				<thead>
					<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold">
						<th class="p-4 w-32">Dispute No</th>
						<th class="p-4 w-36">Booking Ref</th>
						<th class="p-4">Subject & Customer</th>
						<th class="p-4">Salesman</th>
						<th class="p-4">Service</th>
						<th class="p-4 text-right">Requested Refund</th>
						<th class="p-4 text-right">Approved Refund</th>
						<th class="p-4 text-center">Status</th>
						<th class="p-4 w-32">Logged Date</th>
						<th class="p-4 w-24 text-center">Action</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border/60">
					{#each disputesData.items as row}
						{@const badge = getStatusBadge(row.status)}
						<tr class="hover:bg-muted/10 transition-colors">
							<td class="p-4 font-mono font-bold text-foreground">
								{row.documentNumber || `TXSDISP-${String(row.id).padStart(6, '0')}`}
							</td>
							<td class="p-4 font-mono font-medium">
								<a
									href={formatServiceRoute(row.disputableType, row.disputableId)}
									class="text-primary hover:underline font-semibold"
								>
									{row.disputableDocumentNumber || `#${row.disputableId}`} ({row.disputableType})
								</a>
							</td>
							<td class="p-4">
								<span class="font-bold text-foreground block">{row.subject}</span>
								<span class="text-[10px] text-muted-foreground block truncate max-w-xs">
									Customer: {row.headName || '—'}
								</span>
								{#if row.name || row.iban}
									<div class="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
										{#if row.name}
											<span class="font-medium text-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/60">
												{row.name}
											</span>
										{/if}
										{#if row.iban}
											<span class="font-mono text-primary font-bold bg-primary/5 px-1.5 py-0.5 rounded border border-primary/20">
												{row.iban}
											</span>
										{/if}
									</div>
								{/if}
							</td>
							<td class="p-4 text-foreground font-medium">
								{row.salesmanName || 'Salesman'}
							</td>
							<td class="p-4 font-semibold capitalize text-muted-foreground">
								{row.disputableType.replace(/_/g, ' ')}
							</td>
							<td class="p-4 font-mono font-bold text-right text-foreground">
								{#if row.isRefund && row.refundAmount}
									<MoneyDisplay amount={row.refundAmount} />
								{:else}
									<span class="text-muted-foreground/40">—</span>
								{/if}
							</td>
							<td class="p-4 font-mono font-bold text-right text-emerald-600">
								{#if row.isRefund && row.approvedRefundAmount}
									<MoneyDisplay amount={row.approvedRefundAmount} />
								{:else if row.isRefund && row.status === 'rejected'}
									<span class="text-rose-500">$0.00</span>
								{:else}
									<span class="text-muted-foreground/40">—</span>
								{/if}
							</td>
							<td class="p-4 text-center">
								<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold border capitalize {badge.cls}">
									{badge.label}
								</span>
							</td>
							<td class="p-4 font-mono text-muted-foreground">
								<DateDisplay value={row.createdAt} />
							</td>
							<td class="p-4 text-center">
								<Button
									variant="outline"
									size="sm"
									class="h-7 px-2.5 text-[11px] rounded-lg cursor-pointer flex items-center gap-1 font-semibold"
									onclick={() => openDisputeModal(row.id)}
								>
									<Eye class="h-3.5 w-3.5" />
									<span>{row.status === 'open' || row.status === 'pending' ? 'Review' : 'View'}</span>
								</Button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Paging -->
		<div class="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs pt-2">
			<span class="text-muted-foreground">
				Page {disputesData.page} of {disputesData.totalPages} ({disputesData.totalCount} total cases)
			</span>
			<div class="flex items-center gap-4">
				<div class="flex items-center gap-2">
					<span class="text-xs text-muted-foreground whitespace-nowrap">Rows per page:</span>
					<select
						value={pageSize}
						onchange={(e) => {
							pageSize = Number((e.target as HTMLSelectElement).value);
							currentPage = 1;
							fetchDisputes();
						}}
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
				<div class="flex gap-2">
					<Button
						variant="outline"
						class="h-8 rounded-xl cursor-pointer px-3"
						disabled={currentPage <= 1}
						onclick={() => { currentPage--; fetchDisputes(); }}
					>
						<ChevronLeft class="h-3 w-3 mr-1" /> Prev
					</Button>
					<Button
						variant="outline"
						class="h-8 rounded-xl cursor-pointer px-3"
						disabled={currentPage >= disputesData.totalPages}
						onclick={() => { currentPage++; fetchDisputes(); }}
					>
						Next <ChevronRight class="h-3 w-3 ml-1" />
					</Button>
				</div>
			</div>
		</div>
	{:else}
		<div class="bg-card border border-border rounded-2xl p-16 text-center text-muted-foreground text-xs">
			<AlertTriangle class="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
			No dispute cases found matching filters.
		</div>
	{/if}
</div>

<!-- Dispute Detail & Decision Modal -->
{#if isModalOpen}
	<div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
		<div class="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
			<!-- Modal Header -->
			<div class="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
				<div class="flex items-center gap-2">
					<ShieldAlert class="h-5 w-5 text-primary" />
					<h3 class="font-bold text-sm text-foreground">
						Dispute Case {selectedDispute?.documentNumber || (selectedDispute ? `TXSDISP${String(selectedDispute.id).padStart(6, '0')}` : '...')}
					</h3>
					{#if selectedDispute}
						{@const badge = getStatusBadge(selectedDispute.status)}
						<span class="px-2 py-0.5 text-[9px] font-bold rounded-full border capitalize {badge.cls}">
							{badge.label}
						</span>
					{/if}
				</div>
				<button
					onclick={closeModal}
					class="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<!-- Modal Body -->
			<div class="p-5 space-y-5 flex-1">
				{#if loadingDetail}
					<div class="p-12 flex items-center justify-center">
						<RefreshCw class="h-6 w-6 text-primary animate-spin" />
					</div>
				{:else if selectedDispute}
					<!-- Case Overview -->
					<div class="bg-muted/20 border border-border/60 rounded-xl p-4 space-y-2">
						<div class="flex items-start justify-between gap-2">
							<div>
								<span class="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Subject</span>
								<h4 class="text-sm font-bold text-foreground">{selectedDispute.subject}</h4>
							</div>
							<div class="text-right">
								<span class="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Logged Date</span>
								<span class="text-xs text-muted-foreground font-mono">
									<DateDisplay value={selectedDispute.createdAt} />
								</span>
							</div>
						</div>
						<div>
							<span class="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Description</span>
							<p class="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed mt-0.5">
								{selectedDispute.description}
							</p>
						</div>
					</div>

					<!-- Key Info Grid -->
					<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
						<div class="bg-card border border-border p-3 rounded-xl">
							<span class="text-[10px] text-muted-foreground uppercase font-semibold block">Service Type</span>
							<span class="text-xs font-bold text-foreground capitalize">{selectedDispute.disputableType.replace(/_/g, ' ')}</span>
						</div>

						<div class="bg-card border border-border p-3 rounded-xl">
							<span class="text-[10px] text-muted-foreground uppercase font-semibold block">Booking Reference</span>
							<a
								href={formatServiceRoute(selectedDispute.disputableType, selectedDispute.disputableId)}
								class="text-xs font-bold text-primary hover:underline font-mono"
							>
								{selectedDispute.disputableDocumentNumber || `#${selectedDispute.disputableId}`}
							</a>
						</div>

						<div class="bg-card border border-border p-3 rounded-xl">
							<span class="text-[10px] text-muted-foreground uppercase font-semibold block">Customer / Head</span>
							<span class="text-xs font-bold text-foreground truncate block">{selectedDispute.headName || '—'}</span>
						</div>

						<div class="bg-card border border-border p-3 rounded-xl">
							<span class="text-[10px] text-muted-foreground uppercase font-semibold block">Salesman</span>
							<span class="text-xs font-bold text-foreground truncate block">{selectedDispute.salesmanName || '—'}</span>
						</div>
					</div>

					<!-- Financial Details -->
					<div class="bg-card border border-border rounded-xl p-4 space-y-3">
						<h5 class="text-xs font-bold text-foreground border-b border-border/60 pb-2">
							Financial Details & Refund Request
						</h5>

						<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
							<div>
								<span class="text-[10px] text-muted-foreground block">Booking Amount</span>
								<span class="font-bold font-mono text-foreground">
									{#if selectedDispute.bookingPayableAmount}
										<MoneyDisplay amount={selectedDispute.bookingPayableAmount} />
									{:else}
										—
									{/if}
								</span>
							</div>

							<div>
								<span class="text-[10px] text-muted-foreground block">Supplier Cost</span>
								<span class="font-bold font-mono text-foreground">
									{#if selectedDispute.bookingSupplierCost}
										<MoneyDisplay amount={selectedDispute.bookingSupplierCost} />
									{:else}
										—
									{/if}
								</span>
							</div>

							<div>
								<span class="text-[10px] text-muted-foreground block">Is Refund Claim</span>
								<span class="font-bold {selectedDispute.isRefund ? 'text-amber-600' : 'text-muted-foreground'}">
									{selectedDispute.isRefund ? 'Yes (Financial)' : 'No (Operational)'}
								</span>
							</div>

							<div>
								<span class="text-[10px] text-muted-foreground block">Requested Refund</span>
								<span class="font-bold font-mono text-foreground">
									{#if selectedDispute.isRefund && selectedDispute.refundAmount}
										<MoneyDisplay amount={selectedDispute.refundAmount} />
									{:else}
										—
									{/if}
								</span>
							</div>
							{#if selectedDispute.name}
								<div>
									<span class="text-[10px] text-muted-foreground block">Beneficiary Name</span>
									<span class="font-bold text-foreground">{selectedDispute.name}</span>
								</div>
							{/if}
							{#if selectedDispute.iban}
								<div class="sm:col-span-2">
									<span class="text-[10px] text-muted-foreground block">IBAN</span>
									<span class="font-bold font-mono text-foreground">{selectedDispute.iban}</span>
								</div>
							{/if}
						</div>
					</div>

					<!-- Wallet Preview (Informational) -->
					{#if selectedDispute.isRefund && selectedDispute.headWallet !== null && selectedDispute.headWallet !== undefined}
						<div class="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
							<span class="text-xs font-bold text-primary block">
								Informational Wallet Balance Preview
							</span>
							<div class="flex items-center justify-between text-xs font-mono bg-card p-3 rounded-lg border border-border">
								<div>
									<span class="text-[10px] text-muted-foreground block font-sans">Current Customer Wallet</span>
									<span class="font-bold text-foreground">
										<MoneyDisplay amount={selectedDispute.headWallet} />
									</span>
								</div>

								<ArrowRight class="h-4 w-4 text-muted-foreground" />

								<div>
									<span class="text-[10px] text-muted-foreground block font-sans">Approved Refund</span>
									<span class="font-bold text-emerald-600">
										+<MoneyDisplay amount={decisionAction === 'approve' ? approvedAmountInput : 0} />
									</span>
								</div>

								<ArrowRight class="h-4 w-4 text-muted-foreground" />

								<div>
									<span class="text-[10px] text-muted-foreground block font-sans">Wallet After Approval</span>
									<span class="font-bold text-primary">
										<MoneyDisplay amount={selectedDispute.headWallet + (decisionAction === 'approve' ? (approvedAmountInput || 0) : 0)} />
									</span>
								</div>
							</div>
							<p class="text-[10px] text-muted-foreground">
								Note: The wallet mutation will be executed authoritatively by Sales Portal upon decision submission.
							</p>
						</div>
					{/if}

					<!-- Historical Decision Details if Resolved or Rejected -->
					{#if selectedDispute.status !== 'open' && selectedDispute.status !== 'pending'}
						<div class="bg-muted/30 border border-border rounded-xl p-4 space-y-2">
							<h5 class="text-xs font-bold text-foreground">Decision & Resolution History</h5>
							<div class="text-xs space-y-1 text-muted-foreground">
								<div><span class="font-semibold text-foreground">Resolved By:</span> {selectedDispute.resolvedBy || '—'}</div>
								<div><span class="font-semibold text-foreground">Resolved At:</span> <DateDisplay value={selectedDispute.resolvedAt} /></div>
								{#if selectedDispute.approvedRefundAmount !== null}
									<div><span class="font-semibold text-foreground">Approved Refund:</span> <MoneyDisplay amount={selectedDispute.approvedRefundAmount} /></div>
								{/if}
								{#if selectedDispute.resolution || selectedDispute.resolutionNote}
									<div class="mt-2 p-2.5 bg-card rounded-lg border border-border text-foreground">
										<span class="text-[10px] font-bold uppercase text-muted-foreground block">Resolution Note</span>
										{selectedDispute.resolution || selectedDispute.resolutionNote}
									</div>
								{/if}
							</div>
						</div>
					{:else}
						<!-- Action & Decision Submission Form -->
						<div class="bg-card border border-border rounded-xl p-4 space-y-4">
							<h5 class="text-xs font-bold text-foreground border-b border-border pb-2">
								Submit Decision & Resolution
							</h5>

							<!-- Decision Choice -->
							<div class="flex gap-3">
								<button
									type="button"
									onclick={() => { decisionAction = 'approve'; }}
									class="flex-1 p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all {decisionAction === 'approve' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 shadow-xs' : 'bg-background border-border text-muted-foreground hover:text-foreground'}"
								>
									<CheckCircle2 class="h-4 w-4" />
									<span>Approve (Accept)</span>
								</button>

								<button
									type="button"
									onclick={() => { decisionAction = 'reject'; }}
									class="flex-1 p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all {decisionAction === 'reject' ? 'bg-rose-500/10 border-rose-500 text-rose-600 shadow-xs' : 'bg-background border-border text-muted-foreground hover:text-foreground'}"
								>
									<XCircle class="h-4 w-4" />
									<span>Reject Case</span>
								</button>
							</div>

							<!-- Approved Refund Amount Input (if approving and is refund) -->
							{#if decisionAction === 'approve' && selectedDispute.isRefund}
								<div class="space-y-1.5">
									<label for="approvedAmountInput" class="text-xs font-semibold text-foreground block">
										Approved Refund Amount ($)
									</label>
									<input
										id="approvedAmountInput"
										type="number"
										step="0.01"
										bind:value={approvedAmountInput}
										class="w-full text-xs px-3.5 py-2 border border-border rounded-xl bg-background font-mono font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
									/>
								</div>
							{/if}

							<!-- Resolution Notes -->
							<div class="space-y-1.5">
								<label for="resolutionInput" class="text-xs font-semibold text-foreground block">
									Resolution Notes & Audit Summary <span class="text-rose-500">*</span>
								</label>
								<textarea
									id="resolutionInput"
									rows="3"
									bind:value={resolutionInput}
									placeholder="Provide clear rationale for approval or rejection..."
									class="w-full text-xs p-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
								></textarea>
							</div>

							{#if decisionError}
								<div class="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs rounded-xl flex items-center gap-2">
									<AlertTriangle class="h-4 w-4 shrink-0" />
									<span>{decisionError}</span>
								</div>
							{/if}
						</div>
					{/if}
				{/if}
			</div>

			<!-- Modal Footer -->
			<div class="p-4 border-t border-border flex items-center justify-end gap-2 bg-muted/20 sticky bottom-0">
				<Button
					variant="outline"
					class="h-8.5 rounded-xl cursor-pointer text-xs"
					onclick={closeModal}
				>
					Close
				</Button>

				{#if selectedDispute && (selectedDispute.status === 'open' || selectedDispute.status === 'pending')}
					<Button
						variant={decisionAction === 'approve' ? 'default' : 'destructive'}
						class="h-8.5 rounded-xl cursor-pointer text-xs font-bold"
						disabled={submittingDecision}
						onclick={handleDecisionSubmit}
					>
						{#if submittingDecision}
							<RefreshCw class="h-3.5 w-3.5 animate-spin mr-1.5" />
							<span>Submitting...</span>
						{:else}
							<span>Confirm & Submit Decision</span>
						{/if}
					</Button>
				{/if}
			</div>
		</div>
	</div>
{/if}
