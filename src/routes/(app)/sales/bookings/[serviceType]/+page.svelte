<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { apiFetch } from '$lib/api/api-client';
	import { previewDocument } from '$lib/utils/preview-document';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { DateDisplay } from '$lib/components';
	import { Button } from '$lib/components/ui/button';
	import { SalesEntriesRealtimeController } from '$lib/realtime/realtime-controller';
	import { exportToCSV as downloadCSV } from '$lib/utils/csv-exporter';
	import { formatDateOnly, getBahrainDateString } from '$lib/formatters/date';
	import { toast } from '$lib/stores/toast';
	import {
		Search,
		ChevronLeft,
		ChevronRight,
		RefreshCw,
		Download,
		Printer,
		SlidersHorizontal,
		Eye
	} from 'lucide-svelte';

	// Svelte 5 page route params
	const serviceType = $derived($page.params.serviceType || 'flights');

	// Grid states
	let dataList = $state<any>(null);
	let loading = $state(false);
	let currentPage = $state(1);
	let pageSize = $state(10);
	let searchVal = $state($page.url.searchParams.get('search') || '');
	let statusFilter = $state('all');
	let sortBy = $state('Id');
	let sortDesc = $state(true);
	let exportingCSV = $state(false);

	let realtimeController: SalesEntriesRealtimeController | null = null;

	onMount(() => {
		realtimeController = new SalesEntriesRealtimeController(() => fetchBookings(), 200);
		realtimeController.mount();
	});

	onDestroy(() => {
		realtimeController?.unmount();
	});

	// Date filters
	let startDate = $state('');
	let endDate = $state('');

	// Column chooser states
	let showColumnChooser = $state(false);
	let columns = $state<Record<string, { label: string; visible: boolean }>>({
		id: { label: 'Booking ID', visible: true },
		headName: { label: 'Customer Head', visible: true },
		salesmanName: { label: 'Salesman', visible: true },
		mainDetails: { label: 'Main Specifications', visible: true },
		payableAmount: { label: 'Payable Sale', visible: true },
		processingStatus: { label: 'Process Status', visible: true },
		isDealClosed: { label: 'Deal Status', visible: true },
		createdAt: { label: 'Date Logged', visible: true }
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

	function getBackendSegment(type: string): string {
		const t = (type || '').toLowerCase();
		if (t === 'holiday' || t === 'holidays') return 'holiday-packages';
		if (t === 'visa' || t === 'visas') return 'visa';
		if (t === 'flight' || t === 'flights') return 'flights';
		if (t === 'hotel' || t === 'hotels') return 'hotels';
		if (t === 'transport' || t === 'transportation') return 'transportation';
		if (t === 'other' || t === 'other-services') return 'other-services';
		return t;
	}

	async function fetchBookings() {
		loading = true;
		try {
			const segment = getBackendSegment(serviceType);
			const params: any = {
				page: currentPage,
				pageSize: pageSize
			};

			if (statusFilter !== 'all') params.status = statusFilter;
			if (searchVal.trim()) params.search = searchVal.trim();
			if (startDate) params.startDate = startDate;
			if (endDate) params.endDate = endDate;

			const res = await apiFetch<any>(`api/sales-entries/${segment}`, { params });
			dataList = res;
		} catch (err) {
			console.error('Failed to load bookings list:', err);
		} finally {
			loading = false;
		}
	}

	// Trigger reload when serviceType changes or auto-redirect if ?id= query param is present
	$effect(() => {
		const targetId = $page.url.searchParams.get('id') || $page.url.searchParams.get('bookingId');
		if (targetId) {
			const rawType = (serviceType || '').toLowerCase();
			let canonicalType = rawType;
			if (rawType === 'visas' || rawType === 'visa') canonicalType = 'visa';
			else if (rawType === 'holidays' || rawType === 'holiday') canonicalType = 'holiday';
			else if (rawType === 'transport' || rawType === 'transportation') canonicalType = 'transportation';
			else if (rawType === 'flights' || rawType === 'flight') canonicalType = 'flights';
			else if (rawType === 'hotels' || rawType === 'hotel') canonicalType = 'hotels';
			else if (rawType === 'vfs') canonicalType = 'vfs';
			else if (rawType === 'other' || rawType === 'other-services') canonicalType = 'other-services';
			goto(`/sales/bookings/${canonicalType}/${encodeURIComponent(targetId)}`, { replaceState: true });
			return;
		}

		if (serviceType) {
			untrack(() => {
				const urlSearch = $page.url.searchParams.get('search');
				if (urlSearch && searchVal !== urlSearch) {
					searchVal = urlSearch;
				}
				currentPage = 1;
				fetchBookings();
			});
		}
	});

	function handleSort(colName: string) {
		if (sortBy === colName) {
			sortDesc = !sortDesc;
		} else {
			sortBy = colName;
			sortDesc = true;
		}
		// Sort the current client list as sorting parameters are applied
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
			const segment = getBackendSegment(serviceType);
			const params: any = {
				page: 1,
				pageSize: 10000
			};
			if (statusFilter !== 'all') params.status = statusFilter;
			if (searchVal.trim()) params.search = searchVal.trim();
			if (startDate) params.startDate = startDate;
			if (endDate) params.endDate = endDate;

			const res = await apiFetch<any>(`api/sales-entries/${segment}`, { params }).catch((err) => {
				console.warn('apiFetch bookings failed, falling back to active list:', err);
				return null;
			});
			const items = res?.items || dataList?.items || [];
			if (items.length === 0) {
				toast.info('No booking records available to export.');
				return;
			}

			const activeKeys = Object.keys(columns).filter(k => columns[k]?.visible);
			const headers = activeKeys.map(k => columns[k]?.label || k);

			const rows = items.map((row: any) => {
				return activeKeys.map(k => {
					if (k === 'id') return row.documentNumber || `#${row.id}`;
					if (k === 'payableAmount') return row.payableAmount ?? 0;
					if (k === 'profit') return row.profit ?? 0;
					if (k === 'isDealClosed') return row.isDealClosed ? 'Closed' : 'Open Deal';
					if (k === 'createdAt') return row.createdAt ? formatDateOnly(row.createdAt) : '';
					if (k === 'mainDetails') {
						if (serviceType === 'flights') return `${row.passengerNames ? 'Pax: ' + row.passengerNames + ' - ' : ''}${row.fromLocation || ''} to ${row.toLocation || ''} (${row.passengerCount || 1} pax)`;
						if (serviceType === 'hotels') return `Guest: ${row.guestName || ''} in ${row.country || ''}`;
						if (serviceType === 'visa') return `${row.applicantNames ? 'Applicant: ' + row.applicantNames + ' - ' : ''}${row.visaPackName || ''} (${row.applicantCount || 1} applicants)`;
						if (serviceType === 'vfs') return `Applicant: ${row.name || ''} - ${row.visaType || ''}`;
						if (serviceType === 'holiday') return `Passenger: ${row.passengerName || ''} in ${row.country || ''}`;
						if (serviceType === 'transportation') return `Passenger: ${row.name || ''} - ${row.pickup || ''} to ${row.drop || ''}`;
						return `Client: ${row.name || ''} - Service: ${row.serviceName || ''}`;
					}
					return row[k] ?? '';
				});
			});

			downloadCSV(`${serviceType}_bookings_export_${getBahrainDateString()}.csv`, headers, rows);
			toast.success('CSV exported successfully.');
		} catch (err: any) {
			console.error('Failed to export bookings CSV:', err);
			toast.error('Failed to export CSV: ' + (err?.message || 'Unknown error'));
		} finally {
			exportingCSV = false;
		}
	}

	function handlePrint() {
		const type = serviceType === 'holiday' ? 'holiday' : serviceType === 'flights' ? 'flight' : serviceType === 'hotels' ? 'hotel' : serviceType === 'transportation' ? 'transport' : serviceType;
		previewDocument('list', type, { searchTerm: searchVal, paymentStatus: statusFilter });
		toast.info('Generating print document...');
	}

	function toggleColumn(key: string) {
		const col = columns[key];
		if (col) {
			col.visible = !col.visible;
		}
	}
</script>

<svelte:head>
	<title>{serviceType.toUpperCase()} Bookings — Accounts Portal</title>
</svelte:head>

<div class="space-y-6 print:space-y-0 print:p-0">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-bold text-foreground font-sans capitalize">
				{serviceType} Bookings
			</h1>
			<p class="text-xs text-muted-foreground">
				Workspace tracking operational details, payment schedules, and general ledger journal postings.
			</p>
		</div>

		<!-- Action Buttons -->
		<div class="flex flex-wrap gap-2.5">
			<Button variant="outline" class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold" onclick={exportToCSV} disabled={exportingCSV}>
				<Download class={['h-3.5 w-3.5', exportingCSV ? 'animate-spin' : ''].join(' ')} />
				<span>{exportingCSV ? 'Exporting...' : 'CSV Export'}</span>
			</Button>
			<Button variant="outline" class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold" onclick={handlePrint}>
				<Printer class="h-3.5 w-3.5" />
				<span>Print Document</span>
			</Button>
			<Button variant="outline" class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold" onclick={fetchBookings}>
				<RefreshCw class="h-3.5 w-3.5" />
				<span>Reload</span>
			</Button>
		</div>
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

			<!-- Status Filter -->
			<select
				bind:value={statusFilter}
				onchange={fetchBookings}
				class="text-xs p-2 border border-border rounded-xl bg-background text-foreground w-full md:w-44 focus:outline-none"
			>
				<option value="all">All Payment Statuses</option>
				<option value="paid">Paid</option>
				<option value="pending">Pending</option>
				<option value="failed">Failed</option>
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

		<!-- Date Filtering Drawer (Checkpoint 3) -->
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
					onclick={() => { startDate = ''; endDate = ''; fetchBookings(); }}
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
							<th class="p-4 w-32 cursor-pointer hover:text-foreground select-none" onclick={() => handleSort('id')}>
								Document Ref
								{#if sortBy === 'id'}
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
						{#if columns.processingStatus?.visible}
							<th class="p-4 cursor-pointer hover:text-foreground select-none" onclick={() => handleSort('processingStatus')}>
								Status
								{#if sortBy === 'processingStatus'}
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
							{#if columns.id?.visible}
								<td class="p-4 font-mono font-medium text-foreground font-bold">{row.documentNumber || `#${row.id}`}</td>
							{/if}
							{#if columns.headName?.visible}
								<td class="p-4 font-semibold text-foreground">{row.headName || '—'}</td>
							{/if}
							{#if columns.salesmanName?.visible}
								<td class="p-4 text-muted-foreground">{row.salesmanName || '—'}</td>
							{/if}
							{#if columns.mainDetails?.visible}
								<td class="p-4 text-muted-foreground">
									{#if serviceType === 'flights'}
										{#if row.passengerNames}
											<span class="block text-foreground font-medium text-xs mb-0.5">Pax: <strong>{row.passengerNames}</strong></span>
										{/if}
										<strong>{row.fromLocation} → {row.toLocation}</strong> ({row.passengerCount} {row.passengerCount === 1 ? 'passenger' : 'passengers'})
									{:else if serviceType === 'hotels'}
										Guest: <strong>{row.guestName}</strong> • {row.country} ({row.days} days)
									{:else if serviceType === 'visa'}
										{#if row.applicantNames}
											<span class="block text-foreground font-medium text-xs mb-0.5">Applicant: <strong>{row.applicantNames}</strong></span>
										{/if}
										Package: <strong>{row.visaPackName}</strong> ({row.applicantCount} {row.applicantCount === 1 ? 'applicant' : 'applicants'})
									{:else if serviceType === 'vfs'}
										Applicant: <strong>{row.name}</strong> • {row.visaType}
									{:else if serviceType === 'holiday'}
										Passenger: <strong>{row.passengerName}</strong> ({row.days} days in {row.country})
									{:else if serviceType === 'transportation'}
										{#if row.name}
											<span class="block text-foreground font-medium text-xs mb-0.5">Passenger: <strong>{row.name}</strong></span>
										{/if}
										Pickup: <strong>{row.pickup} → {row.drop}</strong>
									{:else}
										Service: <strong>{row.serviceName}</strong> ({row.name})
									{/if}
								</td>
							{/if}
							{#if columns.payableAmount?.visible}
								<td class="p-4 font-mono font-bold text-foreground"><MoneyDisplay amount={row.payableAmount} /></td>
							{/if}
							{#if columns.processingStatus?.visible}
								<td class="p-4 capitalize text-muted-foreground font-semibold">{row.processingStatus || '—'}</td>
							{/if}
							{#if columns.isDealClosed?.visible}
								<td class="p-4">
									{#if row.isDealClosed}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
											Closed
										</span>
									{:else}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
											Open Deal
										</span>
									{/if}
								</td>
							{/if}
							{#if columns.createdAt?.visible}
								<td class="p-4 font-mono text-muted-foreground"><DateDisplay value={row.createdAt} /></td>
							{/if}
							<td class="p-4 text-center print:hidden">
								<a
									href="/sales/bookings/{serviceType}/{row.id}"
									class="inline-flex p-1.5 hover:bg-muted text-muted-foreground hover:text-primary rounded-lg transition-colors"
									title="View details"
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
						disabled={currentPage <= 1}
						onclick={() => { currentPage--; fetchBookings(); }}
					>
						<ChevronLeft class="h-3 w-3 mr-1" /> Prev
					</Button>
					<Button
						variant="outline"
						class="h-8.5 cursor-pointer rounded-xl px-2.5"
						disabled={currentPage >= dataList.totalPages}
						onclick={() => { currentPage++; fetchBookings(); }}
					>
						Next <ChevronRight class="h-3 w-3 ml-1" />
					</Button>
				</div>
			</div>
		</div>
	{:else}
		<div class="bg-card border border-border rounded-2xl p-16 text-center text-muted-foreground text-xs print:hidden">
			No {serviceType} bookings registered matching current filters.
		</div>
	{/if}
</div>
