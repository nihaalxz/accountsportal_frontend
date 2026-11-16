<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { apiFetch } from '$lib/api/api-client';
	import { DateDisplay } from '$lib/components';
	import { Button } from '$lib/components/ui/button';
	import { SalesEntriesRealtimeController } from '$lib/realtime/realtime-controller';
	import { hasRole } from '$lib/stores/auth';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import {
		Search,
		ChevronLeft,
		ChevronRight,
		RefreshCw,
		Download,
		Printer,
		Bell
	} from 'lucide-svelte';

	let leadsData = $state<any>(null);
	let loading = $state(false);
	let currentPage = $state(1);
	let pageSize = $state(20);
	let searchVal = $state('');
	let statusFilter = $state('all');

	let realtimeController: SalesEntriesRealtimeController | null = null;
	let searchTimeout: any;

	function handleSearchInput(val: string) {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			searchVal = val;
			currentPage = 1;
			fetchLeads();
		}, 400);
	}

	async function fetchLeads() {
		if (!hasRole('master_accountant')) return;
		loading = true;
		try {
			const params: any = {
				page: currentPage,
				pageSize: pageSize
			};

			if (statusFilter !== 'all') params.status = statusFilter;
			if (searchVal.trim()) params.search = searchVal.trim();

			const res = await apiFetch<any>('api/sales-entries/leads', { params });
			leadsData = res;
		} catch (err) {
			console.error('Failed to load leads list:', err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (hasRole('master_accountant')) {
			fetchLeads();
			realtimeController = new SalesEntriesRealtimeController(() => fetchLeads(), 200);
			realtimeController.mount();
		}
	});

	onDestroy(() => {
		realtimeController?.unmount();
	});

	import { exportToCSV as downloadCSV } from '$lib/utils/csv-exporter';
	import { formatDateOnly, getBahrainDateString } from '$lib/formatters/date';
	import { toast } from '$lib/stores/toast';

	let exportingCSV = $state(false);

	async function exportToCSV() {
		exportingCSV = true;
		try {
			const params: any = { page: 1, pageSize: 10000 };
			if (statusFilter !== 'all') params.status = statusFilter;
			if (searchVal.trim()) params.search = searchVal.trim();

			const res = await apiFetch<any>('api/sales-entries/leads', { params }).catch((err) => {
				console.warn('apiFetch leads failed, falling back to leadsData:', err);
				return null;
			});
			const items = res?.items || leadsData?.items || [];
			if (items.length === 0) {
				toast.info('No lead records available to export.');
				return;
			}

			const headers = ['ID', 'Lead Name', 'Phone Number', 'Services Interested', 'Source', 'Status', 'Salesman', 'Reminder Date', 'Logged Date'];
			const rows = items.map((row: any) => [
				row.id,
				row.name || '',
				`${row.countryCode || ''} ${row.mobileNo || ''}`.trim(),
				row.services || '',
				row.leadSource || '',
				row.status || '',
				row.createdByName || '',
				row.reminderDate ? formatDateOnly(row.reminderDate) : '',
				row.createdAt ? formatDateOnly(row.createdAt) : ''
			]);
			downloadCSV(`sales_leads_export_${getBahrainDateString()}.csv`, headers, rows);
			toast.success('CSV exported successfully.');
		} catch (err: any) {
			console.error('Failed to export leads CSV:', err);
			toast.error('Failed to export CSV: ' + (err?.message || 'Unknown error'));
		} finally {
			exportingCSV = false;
		}
	}

	import { previewDocument } from '$lib/utils/preview-document';

	function handlePrint() {
		previewDocument('list', 'leads', { searchTerm: searchVal, status: statusFilter });
		toast.info('Generating print document...');
	}

	function statusColor(status: string) {
		switch (status?.toLowerCase()) {
			case 'converted': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
			case 'lost': return 'bg-red-50 text-red-700 border border-red-200';
			case 'contacted': return 'bg-blue-50 text-blue-700 border border-blue-200';
			default: return 'bg-zinc-100 text-zinc-700 border border-zinc-200';
		}
	}
</script>

<svelte:head>
	<title>Sales Leads — Accounts Portal</title>
</svelte:head>

{#if !hasRole('master_accountant')}
	<div class="space-y-4">
		<EmptyState
			title="Access Restricted"
			description="This section is restricted to Master Accountants only."
		/>
	</div>
{:else}
	<div class="space-y-6 print:space-y-0 print:p-0">
		<!-- Page Header -->
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
			<div class="flex flex-col gap-1">
				<h1 class="text-xl font-bold text-foreground font-sans">
					Sales Leads
				</h1>
				<p class="text-xs text-muted-foreground">
					View all leads logged across all salesmen. Filter by status or search by name or phone number.
				</p>
			</div>

			<!-- Actions -->
			<div class="flex flex-wrap gap-2.5">
				<Button variant="outline" class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold" onclick={exportToCSV} disabled={exportingCSV}>
					<Download class={['h-3.5 w-3.5', exportingCSV ? 'animate-spin' : ''].join(' ')} />
					<span>{exportingCSV ? 'Exporting...' : 'CSV Export'}</span>
				</Button>
				<Button variant="outline" class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold" onclick={handlePrint}>
					<Printer class="h-3.5 w-3.5" />
					<span>Print</span>
				</Button>
				<Button variant="outline" class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold" onclick={fetchLeads}>
					<RefreshCw class="h-3.5 w-3.5" />
					<span>Reload</span>
				</Button>
			</div>
		</div>

		<!-- Filters -->
		<div class="bg-card border border-border rounded-2xl p-4 flex flex-col md:flex-row gap-3 print:hidden">
			<!-- Search -->
			<div class="relative flex-1">
				<Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
				<input
					type="text"
					placeholder="Search by name or phone number..."
					oninput={(e) => handleSearchInput((e.target as HTMLInputElement).value)}
					class="w-full text-xs pl-10 pr-4 py-2 border border-border rounded-xl bg-background text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
			</div>

			<!-- Status Filter -->
			<select
				bind:value={statusFilter}
				onchange={() => { currentPage = 1; fetchLeads(); }}
				class="text-xs p-2 border border-border rounded-xl bg-background text-foreground w-full md:w-44 focus:outline-none"
			>
				<option value="all">All Statuses</option>
				<option value="new">New</option>
				<option value="contacted">Contacted</option>
				<option value="converted">Converted</option>
				<option value="lost">Lost</option>
			</select>
		</div>

		<!-- Leads Table -->
		{#if loading}
			<div class="bg-card border border-border rounded-2xl p-6 h-96 flex items-center justify-center animate-pulse">
				<RefreshCw class="h-8 w-8 text-primary animate-spin" />
			</div>
		{:else if leadsData && leadsData.items && leadsData.items.length > 0}
			<div class="bg-card border border-border rounded-2xl overflow-x-auto shadow-xs print:border-none print:shadow-none max-w-full">
				<table class="w-full min-w-[750px] text-left border-collapse text-xs">
					<thead>
						<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold print:bg-transparent">
							<th class="p-4 w-16">#</th>
							<th class="p-4">Lead</th>
							<th class="p-4">Services Interested</th>
							<th class="p-4">Source</th>
							<th class="p-4">Salesman</th>
							<th class="p-4">Status</th>
							<th class="p-4">Reminder</th>
							<th class="p-4 w-32">Logged Date</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/60">
						{#each leadsData.items as row}
							<tr class="hover:bg-muted/10 transition-colors">
								<td class="p-4 font-mono font-medium text-muted-foreground">#{row.id}</td>
								<td class="p-4">
									<span class="font-bold text-foreground block">{row.name}</span>
									<span class="block font-mono text-[10px] text-muted-foreground mt-0.5">{row.countryCode} {row.mobileNo}</span>
								</td>
								<td class="p-4 text-muted-foreground">{row.services || '—'}</td>
								<td class="p-4 text-muted-foreground capitalize">{row.leadSource || '—'}</td>
								<td class="p-4 font-semibold text-foreground">{row.createdByName || '—'}</td>
								<td class="p-4">
									<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold capitalize {statusColor(row.status)}">
										{row.status}
									</span>
								</td>
								<td class="p-4">
									{#if row.reminderActive && row.reminderDate}
										<span class="inline-flex items-center gap-1 text-amber-600 font-semibold">
											<Bell class="h-3 w-3 fill-current" />
											<DateDisplay value={row.reminderDate} />
										</span>
									{:else}
										<span class="text-muted-foreground">—</span>
									{/if}
								</td>
								<td class="p-4 text-muted-foreground font-mono"><DateDisplay value={row.createdAt} /></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Paging -->
			<div class="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs pt-4 print:hidden">
				<span class="text-muted-foreground">
					Page {leadsData.page} of {leadsData.totalPages} ({leadsData.totalCount} leads)
				</span>
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-2">
						<span class="text-xs text-muted-foreground whitespace-nowrap">Rows per page:</span>
						<select
							value={pageSize}
							onchange={(e) => {
								pageSize = Number((e.target as HTMLSelectElement).value);
								currentPage = 1;
								fetchLeads();
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
							class="h-8.5 cursor-pointer rounded-xl px-2.5"
							disabled={currentPage <= 1}
							onclick={() => { currentPage--; fetchLeads(); }}
						>
							<ChevronLeft class="h-3 w-3 mr-1" /> Prev
						</Button>
						<Button
							variant="outline"
							class="h-8.5 cursor-pointer rounded-xl px-2.5"
							disabled={currentPage >= leadsData.totalPages}
							onclick={() => { currentPage++; fetchLeads(); }}
						>
							Next <ChevronRight class="h-3 w-3 ml-1" />
						</Button>
					</div>
				</div>
			</div>
		{:else}
			<div class="bg-card border border-border rounded-2xl p-16 text-center text-muted-foreground text-xs print:hidden">
				No leads found matching the selected filters.
			</div>
		{/if}
	</div>
{/if}
