<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { apiFetch } from '$lib/api/api-client';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { toast } from '$lib/stores/toast';
	import { formatDateTime, getBahrainDateString, getBahrainPresetRanges, parseDate } from '$lib/formatters/date';
	import { exportToCSV } from '$lib/utils/csv-exporter';
	import { fetchAccountsStaff, fetchOperationalStaff } from '$features/staffs/api/staffs-api';
	import {
		Building2,
		CreditCard,
		Search,
		Filter,
		RefreshCw,
		Download,
		Calendar,
		ArrowRight,
		ExternalLink,
		User,
		Tag,
		Clock,
		Layers,
		AlertCircle,
		CheckCircle2,
		ChevronRight,
		ChevronDown,
		Sparkles,
		RotateCcw,
		FolderGit2
	} from 'lucide-svelte';

	interface SupplierPaymentItem {
		id: number;
		supplierId: number;
		amount: number;
		currency: string;
		paymentMethod: string;
		sourceType: string | null;
		sourceBankId: number | null;
		sourceAccountId: number | null;
		referenceNumber: string | null;
		externalReference: string | null;
		serviceType: string | null;
		description: string | null;
		status: string;
		requestedByUserId: number;
		requestedAt: string;
		rowVersion: string | null;
		creatorName?: string | null;
		requestedByName?: string | null;
		documentNumber?: string | null;
		applicationDocumentNumber?: string | null;
	}

	let loading = $state(true);
	let rawPayments = $state<SupplierPaymentItem[]>([]);
	let suppliersList = $state<any[]>([]);
	let staffMap = $state<Record<number, string>>({});
	let opsStaffMap = $state<Record<number, string>>({});
	let searchQuery = $state('');
	let selectedSupplier = $state('all');
	let selectedServiceType = $state('all');
	let datePreset = $state<'all' | 'today' | 'yesterday' | 'this_week' | 'this_month'>('all');
	let startDate = $state('');
	let endDate = $state('');

	// View Mode: 'list' (itemized) or 'grouped' (by booking reference)
	let viewMode = $state<'list' | 'grouped'>('list');
	let expandedGroups = $state<Record<string, boolean>>({});

	function handleDatePresetChange(preset: 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month') {
		datePreset = preset;

		if (preset === 'all') {
			startDate = '';
			endDate = '';
		} else if (preset === 'today') {
			const ranges = getBahrainPresetRanges();
			startDate = ranges.today.startDate;
			endDate = ranges.today.endDate;
		} else if (preset === 'yesterday') {
			const now = new Date();
			const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bahrain', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
			const year = parseInt(parts.find((p) => p.type === 'year')?.value || '2026', 10);
			const month = parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10);
			const day = parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10);
			const d = new Date(year, month - 1, day);
			d.setDate(d.getDate() - 1);
			const yestStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
			startDate = yestStr;
			endDate = yestStr;
		} else if (preset === 'this_week') {
			const ranges = getBahrainPresetRanges();
			startDate = ranges.thisWeek.startDate;
			endDate = ranges.thisWeek.endDate;
		} else if (preset === 'this_month') {
			const ranges = getBahrainPresetRanges();
			startDate = ranges.thisMonth.startDate;
			endDate = ranges.thisMonth.endDate;
		}
	}

	function resetFilters() {
		searchQuery = '';
		selectedSupplier = 'all';
		selectedServiceType = 'all';
		datePreset = 'all';
		startDate = '';
		endDate = '';
	}

	function getSupplierName(id: number): string {
		const s = suppliersList.find((sup: any) => Number(sup.id) === Number(id));
		return s ? (s.name || s.supplierName || `Supplier #${id}`) : `Supplier #${id}`;
	}

	function getServiceLabel(type: string | null | undefined): string {
		if (!type) return 'Operational Log';
		const clean = type.toLowerCase().replace(/_/g, ' ').trim();
		if (clean.includes('flight')) return 'Flight Booking';
		if (clean.includes('hotel')) return 'Hotel Booking';
		if (clean.includes('visa')) return 'Visa Application';
		if (clean.includes('vfs')) return 'VFS Appointment';
		if (clean.includes('holiday')) return 'Holiday Package';
		if (clean.includes('transport')) return 'Transportation';
		if (clean.includes('government') || clean.includes('govt')) return 'Government Fee';
		if (clean.includes('wallet')) return 'Prepaid Wallet';
		if (clean.includes('credit')) return 'Credit Debt Settlement';
		if (clean.includes('advance')) return 'Advance Payout';
		return type;
	}

	function getOperatorName(p: SupplierPaymentItem): string {
		// Operational Portal operators take priority since pending bookings originate from the Operations Portal
		if (p.requestedByUserId) {
			const foundOp = opsStaffMap[p.requestedByUserId];
			if (foundOp) return foundOp;
		}
		if (p.requestedByName && !p.requestedByName.toLowerCase().startsWith('user #') && p.requestedByName !== 'Master Accountant') {
			return p.requestedByName;
		}
		if (p.creatorName && !p.creatorName.toLowerCase().startsWith('user #') && p.creatorName !== 'Master Accountant') {
			return p.creatorName;
		}
		if (p.requestedByUserId) {
			const found = staffMap[p.requestedByUserId];
			if (found && found !== 'Master Accountant') {
				return found;
			}
		}
		return p.requestedByUserId === 1 ? 'Admin' : (p.requestedByName || `Operator #${p.requestedByUserId}`);
	}

	function getApplicationDocNo(p: SupplierPaymentItem): string {
		return p.applicationDocumentNumber || p.documentNumber || (p.externalReference ? `Ref: ${p.externalReference}` : `Payment #${p.id}`);
	}

	function getApplicationUrl(item: { serviceType?: string | null; externalReference?: string | null }): string | null {
		if (!item.externalReference) return null;
		const ref = item.externalReference.trim();
		if (!ref) return null;

		const st = (item.serviceType || '').toLowerCase();
		if (st.includes('flight')) return `/sales/bookings/flights/${ref}`;
		if (st.includes('hotel')) return `/sales/bookings/hotels/${ref}`;
		if (st.includes('visa')) return `/sales/bookings/visa/${ref}`;
		if (st.includes('vfs')) return `/sales/bookings/vfs/${ref}`;
		if (st.includes('holiday')) return `/sales/bookings/holiday/${ref}`;
		if (st.includes('transport')) return `/sales/bookings/transportation/${ref}`;
		if (st.includes('other')) return `/sales/bookings/other-services/${ref}`;
		return `/sales/bookings/visa/${ref}`;
	}

	async function loadPendingPayments() {
		loading = true;
		try {
			const [bookingGroupsRes, directPaymentsRes, suppliersRes, opsStaff, accStaff] = await Promise.all([
				apiFetch<any[]>('api/supplier-payments/pending-bookings').catch(() => []),
				apiFetch<SupplierPaymentItem[]>('api/supplier-payments?status=Pending').catch(() => []),
				apiFetch<any[]>('api/supplier').catch(() => []),
				fetchOperationalStaff().catch(() => []),
				fetchAccountsStaff().catch(() => [])
			]);

			// Populate operational staff lookup dictionary
			const oMap: Record<number, string> = {};
			for (const u of opsStaff || []) {
				if (u?.id && u?.name) oMap[u.id] = u.name;
			}
			opsStaffMap = oMap;

			// Populate general staff lookup dictionary
			const sMap: Record<number, string> = {};
			for (const u of accStaff || []) {
				if (u?.id && u?.name) sMap[u.id] = u.name;
			}
			for (const u of opsStaff || []) {
				if (u?.id && u?.name) sMap[u.id] = u.name;
			}
			staffMap = sMap;

			suppliersList = Array.isArray(suppliersRes) ? suppliersRes : ((suppliersRes as any)?.items || []);

			// Build items using pending-bookings where document numbers of applications are pre-resolved
			if (Array.isArray(bookingGroupsRes) && bookingGroupsRes.length > 0) {
				const items: SupplierPaymentItem[] = [];
				for (const group of bookingGroupsRes) {
					for (const p of group.payments || []) {
						const resolvedOpName = (p.requestedByUserId && oMap[p.requestedByUserId])
							? oMap[p.requestedByUserId]
							: (p.requestedByName && p.requestedByName !== 'Master Accountant' ? p.requestedByName : (p.requestedByUserId === 1 ? 'Admin' : `Operator #${p.requestedByUserId}`));

						items.push({
							...p,
							documentNumber: group.documentNumber || p.documentNumber,
							applicationDocumentNumber: group.documentNumber,
							externalReference: group.externalReference || p.externalReference,
							serviceType: group.serviceType || p.serviceType,
							requestedByName: resolvedOpName
						});
					}
				}
				rawPayments = items;
			} else {
				rawPayments = (directPaymentsRes || []).map((p) => {
					const resolvedOpName = (p.requestedByUserId && oMap[p.requestedByUserId])
						? oMap[p.requestedByUserId]
						: (p.requestedByName && p.requestedByName !== 'Master Accountant' ? p.requestedByName : (p.requestedByUserId === 1 ? 'Admin' : `Operator #${p.requestedByUserId}`));
					return {
						...p,
						requestedByName: resolvedOpName
					};
				});
			}
		} catch (err: any) {
			toast.error(err.message || 'Failed to load pending supplier payments.');
		} finally {
			loading = false;
		}
	}

	// Filtered list derivation
	const filteredPayments = $derived(() => {
		return rawPayments.filter((p) => {
			// Supplier filter
			if (selectedSupplier !== 'all' && String(p.supplierId) !== selectedSupplier) {
				return false;
			}

			// Service type filter
			if (selectedServiceType !== 'all') {
				const pType = (p.serviceType || '').toLowerCase();
				if (!pType.includes(selectedServiceType.toLowerCase())) {
					return false;
				}
			}

			// Date filter
			if (startDate || endDate) {
				const dateStr = p.requestedAt || '';
				if (dateStr) {
					const parsed = parseDate(dateStr);
					const dateOnly = parsed ? getBahrainDateString(parsed) : '';
					if (startDate && dateOnly < startDate) return false;
					if (endDate && dateOnly > endDate) return false;
				}
			}

			// Search query
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase().trim();
				const supName = getSupplierName(p.supplierId).toLowerCase();
				const appDocNo = getApplicationDocNo(p).toLowerCase();
				const refNo = (p.referenceNumber || '').toLowerCase();
				const extRef = (p.externalReference || '').toLowerCase();
				const desc = (p.description || '').toLowerCase();
				const creator = getOperatorName(p).toLowerCase();
				const sType = (p.serviceType || '').toLowerCase();
				const amountStr = String(p.amount);

				const match =
					supName.includes(q) ||
					appDocNo.includes(q) ||
					refNo.includes(q) ||
					extRef.includes(q) ||
					desc.includes(q) ||
					creator.includes(q) ||
					sType.includes(q) ||
					amountStr.includes(q);

				if (!match) return false;
			}

			return true;
		});
	});

	// Grouped by External Reference (Booking Reference)
	const groupedPayments = $derived(() => {
		const groups: Record<string, { key: string; externalRef: string; serviceType: string; documentNumber: string; totalAmount: number; items: SupplierPaymentItem[] }> = {};

		for (const p of filteredPayments()) {
			const refKey = p.externalReference?.trim() || 'Direct / Unreferenced';
			if (!groups[refKey]) {
				groups[refKey] = {
					key: refKey,
					externalRef: p.externalReference?.trim() || '',
					serviceType: p.serviceType || '',
					documentNumber: p.applicationDocumentNumber || p.documentNumber || '',
					totalAmount: 0,
					items: []
				};
			}
			groups[refKey].totalAmount += p.amount;
			groups[refKey].items.push(p);
		}

		return Object.values(groups).sort((a, b) => b.items.length - a.items.length);
	});

	// Metrics
	const metrics = $derived(() => {
		const items = filteredPayments();
		const totalCount = items.length;
		const totalAmount = items.reduce((sum, p) => sum + (p.amount || 0), 0);
		const uniqueSuppliers = new Set(items.map((p) => p.supplierId)).size;
		const uniqueBookings = new Set(items.map((p) => p.externalReference).filter(Boolean)).size;

		return {
			totalCount,
			totalAmount,
			uniqueSuppliers,
			uniqueBookings
		};
	});

	function toggleGroup(key: string) {
		expandedGroups[key] = !expandedGroups[key];
	}

	// CSV Export
	function handleExportCSV() {
		const headers = [
			'Application Document #',
			'Supplier',
			'Amount (BHD)',
			'Currency',
			'Booking Reference',
			'Service Type',
			'Description',
			'Submitted By',
			'Submitted Date',
			'Status'
		];

		const rows = filteredPayments().map((p) => [
			getApplicationDocNo(p),
			getSupplierName(p.supplierId),
			p.amount.toFixed(3),
			p.currency,
			p.externalReference || '—',
			p.serviceType || '—',
			p.description || '—',
			getOperatorName(p),
			formatDateTime(p.requestedAt),
			p.status
		]);

		exportToCSV('Pending_Supplier_Payments_Operational.csv', headers, rows);
	}

	onMount(() => {
		loadPendingPayments();
	});
</script>

<svelte:head>
	<title>Pending Supplier Payments — Operational Portal Approvals</title>
</svelte:head>

<div class="space-y-6">
	<!-- Top Executive Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-bold text-foreground flex items-center gap-2.5">
				<CreditCard class="h-6 w-6 text-primary" />
				<span>Pending Supplier Payments</span>
				<span class="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-600 text-white">
					{metrics().totalCount}
				</span>
			</h1>
			<p class="text-xs text-muted-foreground">
				Operational portal supplier payment logs and government fees awaiting accountant review and GL payout.
			</p>
		</div>

		<!-- Action Buttons -->
		<div class="flex flex-wrap items-center gap-2.5">
			<div class="inline-flex rounded-xl bg-muted/60 p-1 border border-border/60">
				<button
					type="button"
					onclick={() => (viewMode = 'list')}
					class={[
						'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
						viewMode === 'list' ? 'bg-card text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
					].join(' ')}
				>
					Itemized List
				</button>
				<button
					type="button"
					onclick={() => (viewMode = 'grouped')}
					class={[
						'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
						viewMode === 'grouped' ? 'bg-card text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
					].join(' ')}
				>
					Group by Booking
				</button>
			</div>

			<Button
				variant="outline"
				class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
				disabled={loading || filteredPayments().length === 0}
				onclick={handleExportCSV}
			>
				<Download class="h-3.5 w-3.5" />
				<span>Export CSV</span>
			</Button>

			<Button
				variant="outline"
				class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
				disabled={loading}
				onclick={loadPendingPayments}
			>
				<RefreshCw class={['h-3.5 w-3.5', loading ? 'animate-spin' : ''].join(' ')} />
				<span>Refresh</span>
			</Button>
		</div>
	</div>

	<!-- Executive KPI Stat Cards -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
		<!-- 1. Total Pending Payments -->
		<div class="bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between">
			<div class="space-y-1">
				<p class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Awaiting Review</p>
				<p class="text-2xl font-black text-foreground font-mono">{metrics().totalCount}</p>
				<p class="text-[11px] text-muted-foreground">Operational payment logs</p>
			</div>
			<div class="p-3 bg-amber-500/10 text-amber-600 rounded-xl shrink-0">
				<Clock class="h-5 w-5" />
			</div>
		</div>

		<!-- 2. Total Pending Amount -->
		<div class="bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between">
			<div class="space-y-1">
				<p class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Amount</p>
				<div class="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
					<MoneyDisplay amount={metrics().totalAmount} />
				</div>
				<p class="text-[11px] text-muted-foreground">Pending disbursement</p>
			</div>
			<div class="p-3 bg-blue-500/10 text-blue-600 rounded-xl shrink-0">
				<CreditCard class="h-5 w-5" />
			</div>
		</div>

		<!-- 3. Unique Suppliers -->
		<div class="bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between">
			<div class="space-y-1">
				<p class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Suppliers Involved</p>
				<p class="text-2xl font-black text-foreground font-mono">{metrics().uniqueSuppliers}</p>
				<p class="text-[11px] text-muted-foreground">Distinct vendor entities</p>
			</div>
			<div class="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl shrink-0">
				<Building2 class="h-5 w-5" />
			</div>
		</div>

		<!-- 4. Associated Bookings -->
		<div class="bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between">
			<div class="space-y-1">
				<p class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Referenced Bookings</p>
				<p class="text-2xl font-black text-foreground font-mono">{metrics().uniqueBookings}</p>
				<p class="text-[11px] text-muted-foreground">Operational booking dossiers</p>
			</div>
			<div class="p-3 bg-violet-500/10 text-violet-600 rounded-xl shrink-0">
				<Layers class="h-5 w-5" />
			</div>
		</div>
	</div>

	<!-- Filter & Search Toolbar -->
	<div class="bg-card border border-border rounded-2xl p-4 shadow-xs">
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center text-xs">
			<!-- Search Box -->
			<div class="relative w-full sm:col-span-2 lg:col-span-4 xl:col-span-5 min-w-0">
				<Search class="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search application document #, supplier, narration, operator..."
					class="w-full h-9 pl-9 pr-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs truncate"
				/>
			</div>

			<!-- Supplier Filter -->
			<div class="w-full sm:col-span-1 lg:col-span-3 min-w-0">
				<select
					bind:value={selectedSupplier}
					class="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs cursor-pointer truncate"
				>
					<option value="all">All Suppliers ({suppliersList.length})</option>
					{#each suppliersList as s (s.id)}
						<option value={String(s.id)}>{s.name || s.supplierName || `Supplier #${s.id}`}</option>
					{/each}
				</select>
			</div>

			<!-- Service Category Filter -->
			<div class="w-full sm:col-span-1 lg:col-span-3 xl:col-span-2 min-w-0">
				<select
					bind:value={selectedServiceType}
					class="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs cursor-pointer truncate"
				>
					<option value="all">All Service Categories</option>
					<option value="visa">Visa Applications</option>
					<option value="flight">Flight Bookings</option>
					<option value="hotel">Hotel Bookings</option>
					<option value="vfs">VFS Appointments</option>
					<option value="holiday">Holiday Packages</option>
					<option value="transport">Transportation</option>
					<option value="government">Government Fees</option>
					<option value="wallet">Prepaid Wallet</option>
				</select>
			</div>

			<!-- Date Preset Filter -->
			<div class="flex items-center gap-2 w-full sm:col-span-2 lg:col-span-2 min-w-0">
				<select
					value={datePreset}
					onchange={(e) => handleDatePresetChange(e.currentTarget.value as any)}
					class="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs cursor-pointer truncate min-w-0"
				>
					<option value="all">All Dates</option>
					<option value="today">Submitted Today</option>
					<option value="yesterday">Submitted Yesterday</option>
					<option value="this_week">This Week</option>
					<option value="this_month">This Month</option>
				</select>

				{#if searchQuery || selectedSupplier !== 'all' || selectedServiceType !== 'all' || datePreset !== 'all'}
					<Button
						variant="ghost"
						size="sm"
						onclick={resetFilters}
						class="h-9 px-2 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
						title="Reset all filters"
					>
						<RotateCcw class="h-3.5 w-3.5" />
					</Button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Content Feed Area -->
	{#if loading}
		<div class="flex flex-col items-center justify-center p-12 space-y-4 bg-card rounded-2xl border border-border shadow-xs">
			<div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center animate-spin">
				<RefreshCw class="h-6 w-6" />
			</div>
			<div class="text-center space-y-1">
				<p class="text-sm font-bold text-foreground">Loading Operational Supplier Payments...</p>
				<p class="text-xs text-muted-foreground">Aggregating cross-portal submission logs and pending vendor payouts</p>
			</div>
		</div>
	{:else if filteredPayments().length === 0}
		<div class="flex flex-col items-center justify-center p-12 space-y-4 bg-card rounded-2xl border border-border shadow-xs text-center">
			<div class="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
				<CheckCircle2 class="h-7 w-7" />
			</div>
			<div class="space-y-1.5 max-w-sm">
				<p class="text-base font-bold text-foreground">No Pending Supplier Payments</p>
				<p class="text-xs text-muted-foreground leading-relaxed">
					All supplier payment logs and government fees submitted from the operational portal have been reviewed and approved.
				</p>
			</div>
			{#if searchQuery || selectedSupplier !== 'all' || selectedServiceType !== 'all' || datePreset !== 'all'}
				<Button variant="outline" size="sm" onclick={resetFilters} class="rounded-xl text-xs font-semibold cursor-pointer mt-2">
					<RotateCcw class="h-3.5 w-3.5 mr-1.5" />
					Reset All Filters
				</Button>
			{/if}
		</div>
	{:else if viewMode === 'grouped'}
		<!-- Grouped by Booking / Reference View -->
		<div class="space-y-4">
			{#each groupedPayments() as group (group.key)}
				{@const isExpanded = expandedGroups[group.key] ?? true}
				<div class="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
					<!-- Group Header Bar -->
					<div
						role="button"
						tabindex="0"
						onclick={() => toggleGroup(group.key)}
						onkeydown={(e) => e.key === 'Enter' && toggleGroup(group.key)}
						class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors border-b border-border/60"
					>
						<div class="flex items-center gap-3">
							<div class="p-2 bg-blue-500/10 text-blue-600 rounded-xl">
								<FolderGit2 class="h-4.5 w-4.5" />
							</div>
							<div>
								<div class="flex items-center gap-2">
									<span class="font-bold text-sm text-foreground">
										{group.externalRef ? `Application: ${group.documentNumber || group.externalRef}` : 'Direct Operational Logs'}
									</span>
									<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
										{group.items.length} log{group.items.length === 1 ? '' : 's'}
									</span>
								</div>
								{#if group.serviceType}
									<p class="text-[11px] text-muted-foreground mt-0.5">
										Category: {getServiceLabel(group.serviceType)}
									</p>
								{/if}
							</div>
						</div>

						<div class="flex items-center gap-3">
							{#if group.externalRef}
								<a
									href={getApplicationUrl({ serviceType: group.serviceType, externalReference: group.externalRef })}
									onclick={(e) => e.stopPropagation()}
									class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-2xs transition-colors"
								>
									<ExternalLink class="h-3.5 w-3.5" />
									<span>Go to Application</span>
								</a>
							{/if}

							<div class="text-right">
								<span class="text-[10px] text-muted-foreground block uppercase tracking-wider font-bold">Group Total</span>
								<span class="font-bold text-blue-600 dark:text-blue-400 text-sm">
									<MoneyDisplay amount={group.totalAmount} />
								</span>
							</div>

							<ChevronDown class={['h-4 w-4 text-muted-foreground transition-transform', isExpanded ? '' : '-rotate-90'].join(' ')} />
						</div>
					</div>

					<!-- Group Items -->
					{#if isExpanded}
						<div class="p-4 space-y-3">
							{#each group.items as p (p.id)}
								<div class="border border-border/60 hover:border-border rounded-2xl p-4 transition-all space-y-3 bg-card">
									<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
										<div class="flex items-center gap-2.5">
											<span class="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-primary/10 text-primary border border-primary/20">
												{getApplicationDocNo(p)}
											</span>
											<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
												Pending Review
											</span>
											{#if p.serviceType}
												<span class="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
													{getServiceLabel(p.serviceType)}
												</span>
											{/if}
										</div>

										<div class="text-[11px] text-muted-foreground">
											Submitted by <span class="font-bold text-foreground">{getOperatorName(p)}</span> · <span class="font-mono">{formatDateTime(p.requestedAt)}</span>
										</div>
									</div>

									<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/20 p-3 rounded-xl text-xs">
										<div>
											<span class="text-muted-foreground block text-[10px] uppercase font-bold">Supplier</span>
											<span class="font-bold text-foreground">{getSupplierName(p.supplierId)}</span>
										</div>
										<div>
											<span class="text-muted-foreground block text-[10px] uppercase font-bold">Payout Amount</span>
											<span class="font-bold text-blue-600 text-sm">
												<MoneyDisplay amount={p.amount} />
											</span>
										</div>
										<div>
											<span class="text-muted-foreground block text-[10px] uppercase font-bold">Narration / Reference</span>
											<span class="text-foreground truncate block font-medium">
												{p.description || p.referenceNumber || 'Operational Supplier Payment'}
											</span>
										</div>
									</div>

									<div class="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
										{#if getApplicationUrl(p)}
											<a
												href={getApplicationUrl(p)}
												class="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold cursor-pointer shadow-xs transition-colors"
											>
												<ExternalLink class="h-3.5 w-3.5" />
												<span>Go to Application</span>
											</a>
										{:else}
											<span class="text-xs text-muted-foreground italic">No application reference</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<!-- Itemized Feed View -->
		<div class="space-y-4">
			{#each filteredPayments() as p (p.id)}
				<div class="bg-card border border-border hover:border-border/90 rounded-3xl p-5 shadow-xs transition-all space-y-4 relative overflow-hidden">
					<!-- Header Bar -->
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-border/60">
						<div class="flex items-center gap-3 flex-wrap">
							<span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20">
								<CreditCard class="h-3.5 w-3.5" />
								Supplier Payout
							</span>

							<!-- Display Application Document Number from API -->
							<span class="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-primary/10 text-primary border border-primary/20">
								{getApplicationDocNo(p)}
							</span>

							<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
								<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
								Pending Review
							</span>

							{#if p.serviceType}
								<span class="px-2 py-0.5 text-[10px] font-medium rounded bg-muted text-muted-foreground border border-border">
									{getServiceLabel(p.serviceType)}
								</span>
							{/if}
						</div>

						<div class="text-[11px] text-muted-foreground flex items-center gap-1.5">
							<span>Submitted by</span>
							<span class="font-bold text-foreground">{getOperatorName(p)}</span>
							<span>·</span>
							<span class="font-mono">{formatDateTime(p.requestedAt)}</span>
						</div>
					</div>

					<!-- Details Grid: 3 columns (Supplier, Payout Amount, Narration / Reference) -->
					<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/20 p-4 rounded-2xl border border-border/50 text-xs">
						<div class="space-y-0.5">
							<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Supplier</span>
							<span class="font-bold text-foreground text-sm">{getSupplierName(p.supplierId)}</span>
						</div>
						<div class="space-y-0.5">
							<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Payout Amount</span>
							<span class="font-bold text-blue-600 dark:text-blue-400 text-base">
								<MoneyDisplay amount={p.amount} />
							</span>
						</div>
						<div class="space-y-0.5">
							<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Narration / Reference</span>
							<span class="text-foreground truncate block font-medium" title={p.description || p.referenceNumber || ''}>
								{p.description || p.referenceNumber || p.externalReference || 'Operational Supplier Payment'}
							</span>
						</div>
					</div>

					<!-- Action Buttons -->
					<div class="flex items-center justify-end gap-2.5 pt-2 border-t border-border/40">
						{#if getApplicationUrl(p)}
							<a
								href={getApplicationUrl(p)}
								class="inline-flex items-center gap-1.5 h-8.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold cursor-pointer shadow-xs transition-colors"
							>
								<ExternalLink class="h-3.5 w-3.5" />
								<span>Go to Application</span>
							</a>
						{:else}
							<span class="text-xs text-muted-foreground italic">No application reference</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
