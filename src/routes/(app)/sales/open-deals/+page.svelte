<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/api/api-client';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { DateDisplay } from '$lib/components';
	import { Button } from '$lib/components/ui/button';
	import { exportToCSV as downloadCSV } from '$lib/utils/csv-exporter';
	import { formatDateOnly, getBahrainDateString } from '$lib/formatters/date';
	import { toast } from '$lib/stores/toast';
	import {
		Search,
		ChevronLeft,
		ChevronRight,
		RefreshCw,
		Download,
		SlidersHorizontal,
		Eye,
		Layers,
		Plane,
		Building2,
		FileText,
		Compass,
		Clock,
		Car,
		Briefcase
	} from 'lucide-svelte';

	// ─── Interfaces ─────────────────────────────────────────────────────────────
	interface OpenDealEntry {
		id: number;
		serviceType: string;
		documentNumber: string;
		createdAt: string;
		headId?: number | null;
		headName?: string | null;
		clientType?: string | null;
		salesmanId: number;
		salesmanName?: string | null;
		mainDetails?: string | null;
		payableAmount: number;
		expectedSupplierCost: number;
		expectedProfit: number;
		paymentMethod?: string | null;
		paymentStatus?: string | null;
		processingStatus?: string | null;
		isDealClosed: boolean;
		operationClosed: boolean;
	}

	interface SalesmanOption {
		id: number;
		name: string;
	}

	interface OpenDealsSummaryResponse {
		totalOpenDeals: number;
		totalSalesValue: number;
		totalExpectedCost: number;
		totalExpectedProfit: number;
		serviceBreakdown: Record<string, number>;
	}

	interface PagedResponse<T> {
		items: T[];
		totalCount: number;
		page: number;
		pageSize: number;
		totalPages: number;
	}

	// ─── Component State ────────────────────────────────────────────────────────
	let dataList = $state<PagedResponse<OpenDealEntry> | null>(null);
	let summary = $state<OpenDealsSummaryResponse | null>(null);
	let salesmen = $state<SalesmanOption[]>([]);
	let loading = $state(false);
	let currentPage = $state(1);
	let pageSize = $state(10);
	let searchVal = $state('');
	let selectedService = $state('all');
	let selectedSalesman = $state('');
	let sortBy = $state('createdAt');
	let sortDesc = $state(true);
	let exportingCSV = $state(false);

	const serviceFilters = [
		{ id: 'all', label: 'All Services', icon: Layers },
		{ id: 'flight', label: 'Flights', icon: Plane },
		{ id: 'hotel', label: 'Hotels', icon: Building2 },
		{ id: 'visa', label: 'Visas', icon: FileText },
		{ id: 'holiday', label: 'Holidays', icon: Compass },
		{ id: 'vfs', label: 'VFS Appointments', icon: Clock },
		{ id: 'transport', label: 'Transportation', icon: Car },
		{ id: 'other', label: 'Other Services', icon: Briefcase }
	];

	let startDate = $state('');
	let endDate = $state('');

	// Column chooser states
	let showColumnChooser = $state(false);
	let columns = $state<Record<string, { label: string; visible: boolean }>>({
		id: { label: 'Document Ref', visible: true },
		serviceType: { label: 'Service', visible: true },
		headName: { label: 'Customer Head', visible: true },
		salesmanName: { label: 'Salesman', visible: true },
		mainDetails: { label: 'Specifications', visible: true },
		payableAmount: { label: 'Payable Sale', visible: true },
		isDealClosed: { label: 'Deal Status', visible: true },
		createdAt: { label: 'Logged Date', visible: true }
	});

	let searchTimeout: any;

	function handleSearchInput(val: string) {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			searchVal = val;
			currentPage = 1;
			fetchBookings();
		}, 400);
	}

	async function loadSalesmen() {
		try {
			const res = await apiFetch<SalesmanOption[]>('api/sales-entries/salesmen');
			if (res && Array.isArray(res)) {
				salesmen = res;
			}
		} catch (err) {
			console.error('Failed to load salesmen list:', err);
		}
	}

	async function fetchBookings() {
		loading = true;
		try {
			const params: Record<string, any> = {
				page: currentPage,
				pageSize: pageSize
			};

			if (selectedService !== 'all') params.serviceType = selectedService;
			if (selectedSalesman) params.salesmanId = Number(selectedSalesman);
			if (searchVal.trim()) params.search = searchVal.trim();
			if (startDate) params.startDate = startDate;
			if (endDate) params.endDate = endDate;

			const res = await apiFetch<PagedResponse<OpenDealEntry>>('api/sales-entries/open-deals', { params });
			dataList = res;
		} catch (err) {
			console.error('Failed to load open deals list:', err);
			toast.error('Failed to load open deals.');
		} finally {
			loading = false;
		}
	}

	function handleSort(colName: string) {
		if (sortBy === colName) {
			sortDesc = !sortDesc;
		} else {
			sortBy = colName;
			sortDesc = true;
		}
		if (dataList && dataList.items) {
			dataList.items = [...dataList.items].sort((a: any, b: any) => {
				let valA = a[colName] ?? '';
				let valB = b[colName] ?? '';
				if (typeof valA === 'string') valA = valA.toLowerCase();
				if (typeof valB === 'string') valB = valB.toLowerCase();

				if (valA < valB) return sortDesc ? 1 : -1;
				if (valA > valB) return sortDesc ? -1 : 1;
				return 0;
			});
		}
	}

	async function exportToCSV() {
		exportingCSV = true;
		try {
			const params: Record<string, any> = {
				page: 1,
				pageSize: 10000
			};
			if (selectedService !== 'all') params.serviceType = selectedService;
			if (selectedSalesman) params.salesmanId = Number(selectedSalesman);
			if (searchVal.trim()) params.search = searchVal.trim();
			if (startDate) params.startDate = startDate;
			if (endDate) params.endDate = endDate;

			const res = await apiFetch<PagedResponse<OpenDealEntry>>('api/sales-entries/open-deals', { params }).catch((err) => {
				console.warn('apiFetch open deals export failed, falling back to active list:', err);
				return null;
			});
			const items = res?.items || dataList?.items || [];
			if (items.length === 0) {
				toast.info('No open deal records available to export.');
				return;
			}

			const activeKeys = Object.keys(columns).filter((k) => columns[k]?.visible);
			const headers = activeKeys.map((k) => columns[k]?.label || k);

			const rows = items.map((row: any) => {
				return activeKeys.map((k) => {
					if (k === 'id') return row.documentNumber || `#${row.id}`;
					if (k === 'payableAmount') return row.payableAmount != null ? Number(row.payableAmount).toFixed(3) : '0.000';
					if (k === 'isDealClosed') return row.isDealClosed ? 'Closed' : 'Open Deal';
					if (k === 'createdAt') return row.createdAt ? formatDateOnly(row.createdAt) : '';
					return row[k] ?? '';
				});
			});

			downloadCSV(`open_deals_export_${getBahrainDateString()}.csv`, headers, rows);
			toast.success('CSV exported successfully.');
		} catch (err: any) {
			console.error('Failed to export open deals CSV:', err);
			toast.error('Failed to export CSV: ' + (err?.message || 'Unknown error'));
		} finally {
			exportingCSV = false;
		}
	}

	function toggleColumn(key: string) {
		const col = columns[key];
		if (col) {
			col.visible = !col.visible;
		}
	}

	function getServiceDetailRoute(serviceType: string, id: number): string {
		const s = (serviceType || '').toLowerCase();
		if (s.includes('flight')) return `/sales/bookings/flights/${id}`;
		if (s.includes('hotel')) return `/sales/bookings/hotels/${id}`;
		if (s.includes('visa')) return `/sales/bookings/visa/${id}`;
		if (s.includes('holiday')) return `/sales/bookings/holiday/${id}`;
		if (s.includes('vfs')) return `/sales/bookings/vfs/${id}`;
		if (s.includes('transport')) return `/sales/bookings/transportation/${id}`;
		return `/sales/bookings/other-services/${id}`;
	}

	function getServiceBadgeClass(serviceType: string): string {
		const s = (serviceType || '').toLowerCase();
		if (s.includes('flight')) return 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
		if (s.includes('hotel')) return 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
		if (s.includes('visa')) return 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
		if (s.includes('holiday')) return 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
		if (s.includes('vfs')) return 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800';
		if (s.includes('transport')) return 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
		return 'bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800';
	}

	function handleServiceSelect(serviceId: string) {
		selectedService = serviceId;
		currentPage = 1;
		fetchBookings();
	}

	async function fetchSummary() {
		try {
			const res = await apiFetch<OpenDealsSummaryResponse>('api/sales-entries/open-deals/summary');
			if (res) {
				summary = res;
			}
		} catch (err) {
			console.error('Failed to load open deals summary:', err);
		}
	}

	onMount(() => {
		loadSalesmen();
		fetchBookings();
		fetchSummary();
	});
</script>

<svelte:head>
	<title>Open Deals — Accounts Portal</title>
</svelte:head>

<div class="space-y-6 print:space-y-0 print:p-0">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
		<div class="flex flex-col gap-1">
			<div class="flex items-center gap-2">
				<h1 class="text-xl font-bold text-foreground font-sans">
					Open Deals
				</h1>
				<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
					Active Unclosed Deals
				</span>
			</div>
			<p class="text-xs text-muted-foreground">
				Workspace tracking all active bookings pending deal closure across all services.
			</p>
		</div>

		<!-- Action Buttons -->
		<div class="flex flex-wrap gap-2.5">
			<Button
				variant="outline"
				class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
				onclick={exportToCSV}
				disabled={exportingCSV}
			>
				<Download class={['h-3.5 w-3.5', exportingCSV ? 'animate-spin' : ''].join(' ')} />
				<span>{exportingCSV ? 'Exporting...' : 'CSV Export'}</span>
			</Button>
			<Button
				variant="outline"
				class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
				onclick={() => { fetchBookings(); fetchSummary(); }}
				disabled={loading}
			>
				<RefreshCw class={['h-3.5 w-3.5', loading ? 'animate-spin' : ''].join(' ')} />
				<span>Reload</span>
			</Button>
		</div>
	</div>

	<!-- Service Type Quick Filter Pills (Single Non-wrapping Row) -->
	<div class="flex items-center gap-2 overflow-x-auto pb-1 flex-nowrap scrollbar-thin print:hidden">
		{#each serviceFilters as svc}
			{@const isSelected = selectedService === svc.id}
			{@const SvcIcon = svc.icon}
			{@const count = svc.id === 'all'
				? summary?.totalOpenDeals ?? 0
				: (summary?.serviceBreakdown?.[svc.label] ??
				   summary?.serviceBreakdown?.[svc.id.charAt(0).toUpperCase() + svc.id.slice(1)] ??
				   summary?.serviceBreakdown?.[svc.id.toUpperCase()] ?? 
				   (svc.id === 'flight' ? summary?.serviceBreakdown?.['Flight'] ?? 0 :
				    svc.id === 'hotel' ? summary?.serviceBreakdown?.['Hotel'] ?? 0 :
				    svc.id === 'visa' ? summary?.serviceBreakdown?.['Visa'] ?? 0 :
				    svc.id === 'holiday' ? summary?.serviceBreakdown?.['Holiday'] ?? 0 :
				    svc.id === 'vfs' ? summary?.serviceBreakdown?.['VFS'] ?? 0 :
				    svc.id === 'transport' ? summary?.serviceBreakdown?.['Transport'] ?? 0 :
				    svc.id === 'other' ? summary?.serviceBreakdown?.['Other'] ?? 0 : 0))}
			<button
				type="button"
				class="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer {isSelected
					? 'border-primary bg-primary text-primary-foreground shadow-2xs font-bold'
					: 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'}"
				onclick={() => handleServiceSelect(svc.id)}
			>
				<SvcIcon class="h-3.5 w-3.5" />
				<span>{svc.label}</span>
				{#if count > 0}
					<span class="ml-1 rounded-full px-1.5 py-0.2 text-[10px] {isSelected ? 'bg-primary-foreground/20 text-primary-foreground font-bold' : 'bg-muted-foreground/15 text-foreground'}">
						{count}
					</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Filters & Tools Bar -->
	<div class="bg-card border border-border rounded-2xl p-4 flex flex-col gap-4 print:hidden">
		<div class="flex flex-col md:flex-row gap-3">
			<!-- Search -->
			<div class="relative flex-1">
				<Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
				<input
					type="text"
					placeholder="Search Document Ref, Passenger, Route, Customer Head..."
					value={searchVal}
					oninput={(e) => handleSearchInput((e.target as HTMLInputElement).value)}
					class="w-full text-xs pl-10 pr-4 py-2 border border-border rounded-xl bg-background text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
			</div>

			<!-- Service Filter Dropdown -->
			<select
				bind:value={selectedService}
				onchange={() => { currentPage = 1; fetchBookings(); }}
				class="text-xs p-2 border border-border rounded-xl bg-background text-foreground w-full md:w-44 focus:outline-none"
			>
				<option value="all">All Services</option>
				<option value="flight">Flights</option>
				<option value="hotel">Hotels</option>
				<option value="visa">Visas</option>
				<option value="holiday">Holiday Packages</option>
				<option value="vfs">VFS Appointments</option>
				<option value="transport">Transportation</option>
				<option value="other">Other Services</option>
			</select>

			<!-- Salesman Filter Dropdown -->
			<select
				bind:value={selectedSalesman}
				onchange={() => { currentPage = 1; fetchBookings(); }}
				class="text-xs p-2 border border-border rounded-xl bg-background text-foreground w-full md:w-44 focus:outline-none"
			>
				<option value="">All Salesmen</option>
				{#each salesmen as sm}
					<option value={sm.id}>{sm.name}</option>
				{/each}
			</select>

			<!-- Column Chooser Trigger -->
			<div class="relative">
				<Button
					variant="outline"
					class="h-9 w-full md:w-auto rounded-xl flex items-center gap-1.5 text-xs font-semibold"
					onclick={() => showColumnChooser = !showColumnChooser}
				>
					<SlidersHorizontal class="h-4 w-4" />
					<span>Columns</span>
				</Button>

				{#if showColumnChooser}
					<div class="absolute right-0 mt-2 w-52 bg-card border border-border rounded-xl shadow-xl p-3.5 z-50 space-y-2 text-xs">
						<p class="font-bold text-foreground mb-2">Display Columns</p>
						{#each Object.keys(columns) as key}
							<label class="flex items-center gap-2 cursor-pointer select-none py-1 hover:bg-muted/50 rounded px-1">
								<input
									type="checkbox"
									checked={columns[key]?.visible}
									onclick={() => toggleColumn(key)}
									class="rounded border-border text-primary focus:ring-primary/20 h-3.5 w-3.5 cursor-pointer"
								/>
								<span class="text-foreground">{columns[key]?.label}</span>
							</label>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Date Filtering Drawer -->
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2.5 border-t border-border/40 text-xs">
			<div>
				<label for="created-from" class="block text-muted-foreground mb-1 font-semibold">Created From</label>
				<input
					id="created-from"
					type="date"
					bind:value={startDate}
					onchange={() => { currentPage = 1; fetchBookings(); }}
					class="w-full p-2 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
				/>
			</div>
			<div>
				<label for="created-to" class="block text-muted-foreground mb-1 font-semibold">Created To</label>
				<input
					id="created-to"
					type="date"
					bind:value={endDate}
					onchange={() => { currentPage = 1; fetchBookings(); }}
					class="w-full p-2 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
				/>
			</div>
			<div class="flex items-end">
				<Button
					variant="outline"
					class="w-full h-9 rounded-xl text-xs font-semibold"
					onclick={() => { startDate = ''; endDate = ''; currentPage = 1; fetchBookings(); }}
				>
					Clear Dates
				</Button>
			</div>
		</div>
	</div>

	<!-- Booking Data Grid -->
	{#if loading}
		<div class="bg-card border border-border rounded-2xl p-6 h-96 flex items-center justify-center animate-pulse">
			<RefreshCw class="h-8 w-8 text-primary animate-spin" />
		</div>
	{:else if dataList && dataList.items && dataList.items.length > 0}
		<div class="bg-card border border-border rounded-2xl overflow-x-auto shadow-xs print:border-none print:shadow-none max-w-full">
			<table class="w-full min-w-[800px] text-left border-collapse text-xs">
				<thead>
					<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold print:bg-transparent">
						{#if columns.id?.visible}
							<th class="p-4 w-32 cursor-pointer hover:text-foreground select-none" onclick={() => handleSort('documentNumber')}>
								Document Ref
								{#if sortBy === 'documentNumber'}
									{sortDesc ? '↓' : '↑'}
								{/if}
							</th>
						{/if}
						{#if columns.serviceType?.visible}
							<th class="p-4 cursor-pointer hover:text-foreground select-none" onclick={() => handleSort('serviceType')}>
								Service
								{#if sortBy === 'serviceType'}
									{sortDesc ? '↓' : '↑'}
								{/if}
							</th>
						{/if}
						{#if columns.headName?.visible}
							<th class="p-4 cursor-pointer hover:text-foreground select-none" onclick={() => handleSort('headName')}>
								Customer Head
								{#if sortBy === 'headName'}
									{sortDesc ? '↓' : '↑'}
								{/if}
							</th>
						{/if}
						{#if columns.salesmanName?.visible}
							<th class="p-4 cursor-pointer hover:text-foreground select-none" onclick={() => handleSort('salesmanName')}>
								Salesman
								{#if sortBy === 'salesmanName'}
									{sortDesc ? '↓' : '↑'}
								{/if}
							</th>
						{/if}
						{#if columns.mainDetails?.visible}
							<th class="p-4">Specifications</th>
						{/if}
						{#if columns.payableAmount?.visible}
							<th class="p-4 cursor-pointer hover:text-foreground select-none" onclick={() => handleSort('payableAmount')}>
								Payable Sale
								{#if sortBy === 'payableAmount'}
									{sortDesc ? '↓' : '↑'}
								{/if}
							</th>
						{/if}
						{#if columns.isDealClosed?.visible}
							<th class="p-4 cursor-pointer hover:text-foreground select-none" onclick={() => handleSort('isDealClosed')}>
								Deal Status
								{#if sortBy === 'isDealClosed'}
									{sortDesc ? '↓' : '↑'}
								{/if}
							</th>
						{/if}
						{#if columns.createdAt?.visible}
							<th class="p-4 w-32 cursor-pointer hover:text-foreground select-none" onclick={() => handleSort('createdAt')}>
								Logged Date
								{#if sortBy === 'createdAt'}
									{sortDesc ? '↓' : '↑'}
								{/if}
							</th>
						{/if}
						<th class="p-4 w-20 text-center print:hidden">View</th>
					</tr>
				</thead>

				<tbody class="divide-y divide-border/60">
					{#each dataList.items as row}
						<tr class="hover:bg-muted/10 transition-colors">
							<!-- Document Ref -->
							{#if columns.id?.visible}
								<td class="p-4 font-mono font-medium text-foreground font-bold">
									<a
										href={getServiceDetailRoute(row.serviceType, row.id)}
										target="_blank"
										rel="noopener noreferrer"
										class="hover:underline text-primary"
									>
										{row.documentNumber || `#${row.id}`}
									</a>
								</td>
							{/if}

							<!-- Service -->
							{#if columns.serviceType?.visible}
								<td class="p-4">
									<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold {getServiceBadgeClass(row.serviceType)}">
										{row.serviceType}
									</span>
								</td>
							{/if}

							<!-- Customer Head -->
							{#if columns.headName?.visible}
								<td class="p-4 font-semibold text-foreground">
									{row.headName || '—'}
									{#if row.clientType}
										<span class="block text-[10px] font-normal text-muted-foreground capitalize">
											{row.clientType}
										</span>
									{/if}
								</td>
							{/if}

							<!-- Salesman -->
							{#if columns.salesmanName?.visible}
								<td class="p-4 text-muted-foreground">
									{row.salesmanName || `Salesman #${row.salesmanId}`}
								</td>
							{/if}

							<!-- Specifications -->
							{#if columns.mainDetails?.visible}
								<td class="p-4 text-muted-foreground max-w-xs truncate" title={row.mainDetails || ''}>
									{row.mainDetails || '—'}
								</td>
							{/if}

							<!-- Payable Sale -->
							{#if columns.payableAmount?.visible}
								<td class="p-4 font-mono font-bold text-foreground">
									<MoneyDisplay amount={row.payableAmount} />
								</td>
							{/if}

							<!-- Deal Status -->
							{#if columns.isDealClosed?.visible}
								<td class="p-4">
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
										Open Deal
									</span>
								</td>
							{/if}

							<!-- Logged Date -->
							{#if columns.createdAt?.visible}
								<td class="p-4 font-mono text-muted-foreground">
									<DateDisplay value={row.createdAt} />
								</td>
							{/if}

							<!-- View Action -->
							<td class="p-4 w-20 text-center print:hidden">
								<a
									href={getServiceDetailRoute(row.serviceType, row.id)}
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex p-1.5 hover:bg-muted text-muted-foreground hover:text-primary rounded-lg transition-colors"
									title="View details in new tab"
								>
									<Eye class="h-4 w-4" />
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination Footer -->
		<div class="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs pt-4 print:hidden">
			<span class="text-muted-foreground">
				Page {dataList.page} of {dataList.totalPages} ({dataList.totalCount} items)
			</span>
			<div class="flex items-center gap-4">
				<div class="flex items-center gap-2">
					<span class="text-xs text-muted-foreground whitespace-nowrap">Rows per page:</span>
					<select
						value={pageSize}
						onchange={(e) => {
							pageSize = Number((e.target as HTMLSelectElement).value);
							currentPage = 1;
							fetchBookings();
						}}
						class="text-xs p-1 border border-border rounded-lg bg-background text-foreground focus:outline-none"
					>
						<option value={10}>10</option>
						<option value={20}>20</option>
						<option value={50}>50</option>
						<option value={100}>100</option>
					</select>
				</div>
				<div class="flex items-center gap-1">
					<Button
						variant="outline"
						size="sm"
						class="h-8 rounded-xl"
						disabled={currentPage <= 1 || loading}
						onclick={() => {
							if (currentPage > 1) {
								currentPage--;
								fetchBookings();
							}
						}}
					>
						<ChevronLeft class="h-4 w-4" />
					</Button>
					<Button
						variant="outline"
						size="sm"
						class="h-8 rounded-xl"
						disabled={!dataList || currentPage >= dataList.totalPages || loading}
						onclick={() => {
							if (dataList && currentPage < dataList.totalPages) {
								currentPage++;
								fetchBookings();
							}
						}}
					>
						<ChevronRight class="h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	{:else}
		<div class="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground text-xs">
			No open deals match your search criteria.
		</div>
	{/if}
</div>
