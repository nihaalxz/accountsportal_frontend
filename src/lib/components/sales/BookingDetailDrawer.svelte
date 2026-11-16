<script lang="ts">
	import { apiFetch } from '$lib/api/api-client';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { DateDisplay } from '$lib/components';
	import {
		X,
		ShoppingBag,
		User,
		DollarSign,
		FileText,
		BookOpen,
		ArrowLeftRight,
		Clock,
		RefreshCw,
		History,
		AlertCircle,
		CheckCircle2,
		ShieldCheck
	} from 'lucide-svelte';

import { getSuppliers } from '$features/suppliers/api';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		bookingId: number | null;
		serviceType: string;
	}

	let { isOpen, onClose, bookingId, serviceType }: Props = $props();

	let activeTab = $state<'overview' | 'customer' | 'financial' | 'receipts' | 'supplier' | 'timeline' | 'sync' | 'audit'>('overview');
	let loading = $state(false);
	let detailData = $state<any>(null);
	let receiptsData = $state<any[]>([]);
	let suppliersList = $state<any[]>([]);

	function getSupplierLabel(supplierId: number): string {
		const sup = suppliersList.find((s) => Number(s.id) === Number(supplierId));
		if (sup) {
			return `${sup.name} (${sup.code})`;
		}
		return `Supplier #${supplierId}`;
	}

	// Helper to resolve the correct plural/singular segments for backend calls
	function getBackendSegment(type: string): string {
		return type === 'holiday' ? 'holiday-packages' : type;
	}

	async function fetchDetails() {
		if (!bookingId) return;
		loading = true;
		detailData = null;
		receiptsData = [];

		try {
			const segment = getBackendSegment(serviceType);
			// Fetch the aggregated BFF details
			const response = await apiFetch<any>(`api/sales-entries/${segment}/${bookingId}`);
			detailData = response;

			// Fetch suppliers list & receipts linked to this booking
			const [receiptsRes, supsRes] = await Promise.all([
				apiFetch<any>(`api/sales-entries/receipts?search=${bookingId}`).catch(() => null),
				getSuppliers().catch(() => [])
			]);

			if (supsRes) {
				suppliersList = supsRes;
			}
			if (receiptsRes && receiptsRes.items) {
				receiptsData = receiptsRes.items.filter((r: any) => r.bookingId === bookingId || r.service === serviceType.toUpperCase());
			}
		} catch (err) {
			console.error('Failed to load booking detail aggregation:', err);
		} finally {
			loading = false;
		}
	}

	// Reactively fetch details when bookingId changes
	$effect(() => {
		if (isOpen && bookingId) {
			fetchDetails();
		}
	});

	// Chronological Timeline events constructor
	const timelineEvents = $derived(() => {
		if (!detailData) return [];
		const events: { title: string; date: string; icon: any; color: string; desc: string }[] = [];

		const salesDetail = detailData.salesDetail;

		// 1. Booking Creation
		if (salesDetail.createdAt) {
			events.push({
				title: 'Booking Logged',
				date: salesDetail.createdAt,
				icon: ShoppingBag,
				color: 'bg-primary/10 text-primary border-primary/20',
				desc: `Booking #${salesDetail.id} created by user ID ${salesDetail.createdBy || salesDetail.userId || 'System'}`
			});
		}

		// 2. Supplier Payments
		if (detailData.supplierPayments) {
			detailData.supplierPayments.forEach((p: any) => {
				events.push({
					title: `Supplier Payment ${p.status}`,
					date: p.requestedAt || p.createdAt,
					icon: DollarSign,
					color: p.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200',
					desc: `Amount: ${p.amount} ${p.currency} for Supplier ID: ${p.supplierId}. Method: ${p.paymentMethod}`
				});
			});
		}

		// 3. Sales Returns
		if (detailData.salesReturns) {
			detailData.salesReturns.forEach((r: any) => {
				events.push({
					title: `Sales Return ${r.status}`,
					date: r.requestedAt || r.createdAt,
					icon: ArrowLeftRight,
					color: 'bg-orange-50 text-orange-600 border-orange-200',
					desc: `Return credit note of ${r.amount} ${r.currency} requested. Reason: ${r.reason}`
				});
			});
		}

		// 4. Outbox Messages
		if (detailData.outboxMessages) {
			detailData.outboxMessages.forEach((m: any) => {
				events.push({
					title: `Outbox Cost Synced`,
					date: m.availableAt,
					icon: RefreshCw,
					color: m.status === 'processed' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-amber-50 text-amber-600 border-amber-200',
					desc: `Type: ${m.messageType} successfully queued with status: ${m.status}`
				});
			});
		}

		// Sort chronologically (oldest to newest or newest to oldest)
		return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	});
</script>

{#if isOpen}
	<button
		type="button"
		class="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 transition-opacity w-full h-full cursor-default border-none p-0 bg-transparent block"
		onclick={onClose}
		aria-label="Close details"
	></button>
	
	<div class="fixed right-0 top-0 h-screen w-full max-w-4xl bg-card border-l border-border shadow-2xl z-50 flex flex-col transition-all duration-300">
		<!-- Drawer Header -->
		<div class="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/10 shrink-0">
			<div class="flex items-center gap-2.5">
				<div class="p-2 bg-primary/10 text-primary rounded-xl">
					<ShoppingBag class="h-5 w-5" />
				</div>
				<div>
					<h3 class="text-sm font-bold text-foreground capitalize">
						{serviceType} Inspector
					</h3>
					<p class="text-[10px] text-muted-foreground mt-0.5">
						ID: #{bookingId} • Reference Type: <span class="uppercase font-semibold text-primary">{serviceType}</span>
					</p>
				</div>
			</div>
			<button onclick={onClose} class="p-2 hover:bg-muted text-muted-foreground rounded-lg transition-colors cursor-pointer">
				<X class="h-4.5 w-4.5" />
			</button>
		</div>

		<!-- Drawer Inspector Tabs -->
		<div class="flex border-b border-border bg-muted/5 px-4 overflow-x-auto scrollbar-none shrink-0">
			{#each [
				{ id: 'overview', label: 'Overview' },
				{ id: 'customer', label: 'Customer' },
				{ id: 'financial', label: 'Financial' },
				{ id: 'receipts', label: 'Receipts' },
				{ id: 'supplier', label: 'Supplier/Returns' },
				{ id: 'timeline', label: 'Timeline' },
				{ id: 'sync', label: 'Outbox Sync' },
				{ id: 'audit', label: 'Audit Log' }
			] as tab}
				<button
					onclick={() => activeTab = tab.id as any}
					class="px-3.5 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer {activeTab === tab.id ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'}"
				>
					{tab.label}
				</button>
			{/each}
		</div>

		<!-- Drawer Scrollable Content -->
		<div class="flex-1 overflow-y-auto p-6 bg-muted/5">
			{#if loading}
				<div class="flex flex-col items-center justify-center h-full py-20 gap-3">
					<RefreshCw class="h-8 w-8 text-primary animate-spin" />
					<span class="text-xs text-muted-foreground">Aggregating Operational & General Ledger records...</span>
				</div>
			{:else if detailData}
				{@const d = detailData.salesDetail}

				<!-- TAB: OVERVIEW -->
				{#if activeTab === 'overview'}
					<div class="space-y-6">
						<div class="bg-card border border-border rounded-2xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
							<div>
								<span class="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Sale Amount</span>
								<h4 class="text-base font-bold text-foreground mt-1"><MoneyDisplay amount={d.payableAmount} /></h4>
							</div>
							<div>
								<span class="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Payment Status</span>
								<div class="mt-1">
									<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold capitalize
										{d.paymentStatus === 'paid' || d.paymentStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">
										{d.paymentStatus}
									</span>
								</div>
							</div>
							<div>
								<span class="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Order Status</span>
								<div class="mt-1">
									<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold capitalize bg-blue-50 text-blue-700 border border-blue-200">
										{d.processingStatus || d.orderStatus || 'pending'}
									</span>
								</div>
							</div>
							<div>
								<span class="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Date Created</span>
								<h4 class="text-xs font-semibold text-foreground mt-1.5 font-mono"><DateDisplay value={d.createdAt} /></h4>
							</div>
						</div>

						<!-- Service Specific Manifests -->
						<div class="bg-card border border-border rounded-xl p-5 space-y-4">
							<h4 class="text-xs font-bold uppercase tracking-wider text-foreground border-b border-border/60 pb-2">
								Booking Manifest Specifications
							</h4>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
								{#if serviceType === 'flights'}
									<div><span class="text-muted-foreground">Route:</span> <strong class="text-foreground ml-1">{d.fromLocation} → {d.toLocation}</strong></div>
									<div><span class="text-muted-foreground">Payment Method:</span> <span class="capitalize ml-1 font-semibold">{d.paymentMethod}</span></div>
									<div><span class="text-muted-foreground">Passenger Count:</span> <span class="ml-1 font-semibold">{d.passengerCount} Pax</span></div>
								{:else if serviceType === 'hotels'}
									<div><span class="text-muted-foreground">Guest Name:</span> <strong class="text-foreground ml-1">{d.guestName}</strong></div>
									<div><span class="text-muted-foreground">Destination Country:</span> <strong class="text-foreground ml-1">{d.country}</strong></div>
									<div><span class="text-muted-foreground">Stay Duration:</span> <span class="ml-1 font-semibold">{d.days} Days</span></div>
									<div><span class="text-muted-foreground">Check-in Date:</span> <span class="ml-1 font-mono font-semibold"><DateDisplay value={d.checkInDate} /></span></div>
								{:else if serviceType === 'visa'}
									<div><span class="text-muted-foreground">Visa Package:</span> <strong class="text-foreground ml-1">{d.visaPackName}</strong></div>
									<div><span class="text-muted-foreground">Processing Status:</span> <span class="capitalize ml-1 font-semibold">{d.processingStatus}</span></div>
									<div><span class="text-muted-foreground">Rejection Fee:</span> <strong class="text-foreground ml-1"><MoneyDisplay amount={d.rejectionFee} /></strong></div>
								{:else if serviceType === 'vfs'}
									<div><span class="text-muted-foreground">VFS Applicant:</span> <strong class="text-foreground ml-1">{d.name}</strong></div>
									<div><span class="text-muted-foreground">Visa Type:</span> <strong class="text-foreground ml-1">{d.visaType}</strong></div>
									<div><span class="text-muted-foreground">Appointment Date:</span> <span class="ml-1 font-mono font-semibold"><DateDisplay value={d.appointmentDate} /> {d.appointmentTime}</span></div>
								{:else if serviceType === 'holiday'}
									<div><span class="text-muted-foreground">Passenger Name:</span> <strong class="text-foreground ml-1">{d.passengerName}</strong></div>
									<div><span class="text-muted-foreground">Country:</span> <strong class="text-foreground ml-1">{d.country}</strong></div>
								{:else if serviceType === 'transportation'}
									<div><span class="text-muted-foreground">Passenger Name:</span> <strong class="text-foreground ml-1">{d.name}</strong></div>
									<div><span class="text-muted-foreground">Pickup Drop:</span> <strong class="text-foreground ml-1">{d.pickup} → {d.drop}</strong></div>
									<div><span class="text-muted-foreground">Date / Time:</span> <span class="ml-1 font-mono"><DateDisplay value={d.dropDate} /> {d.dropTime}</span></div>
								{:else}
									<div><span class="text-muted-foreground">Service Name:</span> <strong class="text-foreground ml-1">{d.serviceName}</strong></div>
									<div><span class="text-muted-foreground">Beneficiary Name:</span> <strong class="text-foreground ml-1">{d.name}</strong></div>
									<div><span class="text-muted-foreground">Description:</span> <span class="ml-1 text-muted-foreground">{d.narration}</span></div>
								{/if}
							</div>
						</div>

						<!-- Passengers manifest list -->
						{#if serviceType === 'flights' && d.passengers}
							<div class="space-y-2.5">
								<h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Passengers Manifest</h4>
								<div class="border border-border rounded-xl overflow-hidden bg-card">
									<table class="w-full text-left text-xs border-collapse">
										<thead>
											<tr class="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
												<th class="p-3">Passenger Name</th>
												<th class="p-3">Cost Basis</th>
												<th class="p-3">Selling Price</th>
												<th class="p-3">Supplier Agent</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-border/40">
											{#each d.passengers as p}
												<tr class="hover:bg-muted/5">
													<td class="p-3 font-semibold">{p.prefix} {p.passengerName}</td>
													<td class="p-3 font-mono"><MoneyDisplay amount={p.expectedSupplierCost} /></td>
													<td class="p-3 font-mono font-bold text-foreground"><MoneyDisplay amount={p.payableAmount} /></td>
													<td class="p-3 text-muted-foreground">{p.supplierName || 'Inhouse'}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						{/if}
					</div>

				<!-- TAB: CUSTOMER -->
				{:else if activeTab === 'customer'}
					<div class="space-y-6">
						<div class="bg-card border border-border rounded-2xl p-5 space-y-4">
							<div class="flex items-center gap-3 border-b border-border/40 pb-3">
								<div class="h-10 w-10 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold">
									<User class="h-5 w-5" />
								</div>
								<div>
									<h4 class="text-sm font-bold text-foreground">{d.headName || 'No Head Account Linked'}</h4>
									<p class="text-xs text-muted-foreground">Client Type: <strong class="capitalize text-foreground">{d.clientType || 'Direct Customer'}</strong></p>
								</div>
							</div>

							<div class="grid grid-cols-2 gap-4 text-xs pt-1">
								<div><span class="text-muted-foreground">Linked Agent:</span> <span class="ml-1 font-semibold">{d.agent || '—'} (ID: {d.agentId || '—'})</span></div>
								<div><span class="text-muted-foreground">Care of Name:</span> <span class="ml-1">{d.careOf || '—'}</span></div>
								<div><span class="text-muted-foreground">Nationality:</span> <span class="ml-1">{d.nationality || '—'}</span></div>
								<div><span class="text-muted-foreground">Passport ID:</span> <span class="ml-1 font-mono font-semibold">{d.passportNo || '—'}</span></div>
							</div>
						</div>
					</div>

				<!-- TAB: FINANCIAL -->
				{:else if activeTab === 'financial'}
					<div class="space-y-6">
						<div class="bg-card border border-border rounded-2xl p-5 space-y-4">
							<h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">
								Margin Analysis & Supplier Costing
							</h4>
							<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
								<div>
									<span class="text-muted-foreground">Total Selling Price:</span>
									<p class="text-base font-bold text-foreground mt-1"><MoneyDisplay amount={d.payableAmount} /></p>
								</div>
								<div>
									<span class="text-muted-foreground">Expected Supplier Cost:</span>
									<p class="text-base font-bold text-red-600 mt-1"><MoneyDisplay amount={d.isInhouse ? 0 : (d.expectedSupplierCost ?? 0)} /></p>
								</div>
								<div>
									<span class="text-muted-foreground">Sales Margin (Profit):</span>
									<p class="text-base font-bold text-emerald-600 mt-1"><MoneyDisplay amount={d.isInhouse ? 0 : (d.profit ?? (d.payableAmount - (d.expectedSupplierCost ?? 0)))} /></p>
								</div>
							</div>
							<div class="pt-3 border-t border-border/40 text-xs">
								<span class="text-muted-foreground">Supplier Reference:</span>
								<p class="text-foreground font-semibold mt-1">{d.supplierName || 'No Supplier Linked'} (ID: {d.supplierId || '—'})</p>
							</div>
						</div>
					</div>

				<!-- TAB: RECEIPTS -->
				{:else if activeTab === 'receipts'}
					<div class="space-y-4">
						<h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Linked Customer Payment Receipts</h4>
						{#if receiptsData && receiptsData.length > 0}
							<div class="border border-border rounded-xl overflow-hidden bg-card">
								<table class="w-full text-left text-xs border-collapse">
									<thead>
										<tr class="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
											<th class="p-3">Receipt ID</th>
											<th class="p-3">Payment Mode</th>
											<th class="p-3">Amount</th>
											<th class="p-3">Status</th>
											<th class="p-3">Date</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-border/40">
										{#each receiptsData as r}
											<tr class="hover:bg-muted/5">
												<td class="p-3 font-mono font-semibold">{r.documentNumber || r.receiptId}</td>
												<td class="p-3 capitalize">{r.paymentMode}</td>
												<td class="p-3 font-bold font-mono"><MoneyDisplay amount={r.amount} /></td>
												<td class="p-3">
													<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize
														{r.status === 'success' || r.status === 'posted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">
														{r.status}
													</span>
												</td>
												<td class="p-3 text-muted-foreground font-mono"><DateDisplay value={r.createdAt} /></td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{:else}
							<div class="border border-border border-dashed rounded-xl p-8 text-center text-muted-foreground text-xs bg-card">
								No linked payments or receipts found for this booking.
							</div>
						{/if}
					</div>

				<!-- TAB: SUPPLIER / RETURNS -->
				{:else if activeTab === 'supplier'}
					<div class="space-y-6">
						<!-- Supplier Invoices -->
						<div class="space-y-3">
							<h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Supplier Invoices & Deposit Receipts</h4>
							{#if detailData.supplierPayments && detailData.supplierPayments.length > 0}
								<div class="space-y-3">
									{#each detailData.supplierPayments as sp}
										<div class="bg-card border border-border rounded-xl p-4 flex justify-between gap-4 text-xs hover:border-primary/20 transition-all">
											<div class="space-y-1">
												<div class="flex items-center gap-2">
													<span class="font-bold text-foreground">Payment ID: #{sp.id}</span>
													<span class="text-[9px] uppercase font-bold px-1.5 py-0.2 bg-muted text-muted-foreground rounded">{sp.paymentMethod}</span>
												</div>
												<p class="text-muted-foreground">Supplier: <strong class="text-foreground">{getSupplierLabel(sp.supplierId)}</strong></p>
												<p class="text-muted-foreground">Ref No: <span class="font-mono text-foreground">{sp.referenceNumber || '—'}</span></p>
											</div>
											<div class="text-right flex flex-col justify-between items-end">
												<span class="text-sm font-bold text-foreground"><MoneyDisplay amount={sp.amount} /></span>
												<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold capitalize mt-1
													{sp.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">
													{sp.status}
												</span>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="border border-border border-dashed rounded-xl p-6 text-center text-muted-foreground text-xs bg-card">
									No supplier payment records logged.
								</div>
							{/if}
						</div>

						<!-- Reversal returns -->
						<div class="space-y-3">
							<h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reversal Returns & Credit/Debit Notes</h4>
							{#if (detailData.salesReturns && detailData.salesReturns.length > 0) || (detailData.purchaseReturns && detailData.purchaseReturns.length > 0)}
								<div class="space-y-3">
									{#each detailData.salesReturns as sr}
										<div class="border border-orange-200 rounded-xl p-4 bg-orange-50/20 text-xs space-y-1">
											<div class="flex justify-between font-bold text-foreground">
												<span>Sales Return Credit Note #{sr.id}</span>
												<span class="text-orange-600"><MoneyDisplay amount={sr.amount} /></span>
											</div>
											<p class="text-muted-foreground">Reason: <span class="text-foreground">{sr.reason}</span></p>
											<p class="text-[10px] text-muted-foreground">Status: <strong class="capitalize">{sr.status}</strong></p>
										</div>
									{/each}
									{#each detailData.purchaseReturns as pr}
										<div class="border border-blue-200 rounded-xl p-4 bg-blue-50/20 text-xs space-y-1">
											<div class="flex justify-between font-bold text-foreground">
												<span>Purchase Return Debit Note #{pr.id}</span>
												<span class="text-blue-600"><MoneyDisplay amount={pr.amount} /></span>
											</div>
											<p class="text-muted-foreground">Reason: <span class="text-foreground">{pr.reason}</span></p>
											<p class="text-[10px] text-muted-foreground">Status: <strong class="capitalize">{pr.status}</strong></p>
										</div>
									{/each}
								</div>
							{:else}
								<div class="border border-border border-dashed rounded-xl p-6 text-center text-muted-foreground text-xs bg-card">
									No sales or purchase returns recorded.
								</div>
							{/if}
						</div>
					</div>

				<!-- TAB: TIMELINE -->
				{:else if activeTab === 'timeline'}
					<div class="space-y-6">
						<h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Booking Lifecycle History Timeline</h4>
						<div class="relative pl-6 border-l-2 border-border/80 space-y-6">
							{#each timelineEvents() as ev}
								<div class="relative">
									<!-- Timeline dot icon -->
									<span class="absolute -left-10 top-0.5 flex h-8 w-8 items-center justify-center rounded-full border bg-card {ev.color}">
										<ev.icon class="h-4 w-4" />
									</span>
									<div class="bg-card border border-border rounded-xl p-4 shadow-xs text-xs space-y-1">
										<div class="flex justify-between items-center">
											<span class="font-bold text-foreground">{ev.title}</span>
											<span class="font-mono text-[10px] text-muted-foreground"><DateDisplay value={ev.date} /></span>
										</div>
										<p class="text-muted-foreground leading-relaxed mt-1">{ev.desc}</p>
									</div>
								</div>
							{/each}
						</div>
					</div>

				<!-- TAB: SYNC -->
				{:else if activeTab === 'sync'}
					<div class="space-y-4">
						<h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cost Sync Outbox Messaging status</h4>
						{#if detailData.outboxMessages && detailData.outboxMessages.length > 0}
							<div class="space-y-3">
								{#each detailData.outboxMessages as m}
									<div class="border border-border bg-card rounded-xl p-4 text-xs space-y-2 shadow-xs">
										<div class="flex justify-between items-center">
											<span class="font-bold text-foreground">Message Type: {m.messageType}</span>
											<span class="font-mono text-muted-foreground text-[10px]">{m.id}</span>
										</div>
										<div class="grid grid-cols-2 gap-3 text-muted-foreground border-t border-border/40 pt-2 font-mono text-[11px]">
											<div>Sync Status: 
												<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold capitalize ml-1
													{m.status === 'processed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">
													{m.status}
												</span>
											</div>
											<div>Correlation ID: <span class="text-foreground block truncate">{m.correlationId}</span></div>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<div class="border border-border border-dashed rounded-xl p-8 text-center text-muted-foreground text-xs bg-card">
								No outbox synchronization events pending or completed for this booking.
							</div>
						{/if}
					</div>

				<!-- TAB: AUDIT -->
				{:else if activeTab === 'audit'}
					<div class="space-y-4">
						<h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Operational Accountant Audit Records</h4>
						<div class="bg-card border border-border rounded-xl p-5 space-y-3 text-xs leading-relaxed">
							<div class="flex items-center gap-2 text-emerald-600 font-bold">
								<ShieldCheck class="h-4.5 w-4.5" />
								<span>Immutable Ledger Audit Seal Active</span>
							</div>
							<p class="text-muted-foreground">
								All bookings, supplier postings, and general ledger journal changes are linked under cryptographic Correlation ID tracing. Modifications to these details require master accountant validation tokens.
							</p>
							<div class="pt-2 border-t border-border/40 text-[11px] text-muted-foreground font-mono">
								<p>Booking ID: #{d.id}</p>
								<p>Created Date: {new Date(d.createdAt).toLocaleString()}</p>
								<p>Last Sync Verification: {new Date(d.updatedAt || d.createdAt).toLocaleString()}</p>
							</div>
						</div>
					</div>
				{/if}
			{:else}
				<div class="flex items-center justify-center h-full text-muted-foreground py-20 text-xs">
					Failed to load detailed inspector records.
				</div>
			{/if}
		</div>
	</div>
{/if}
