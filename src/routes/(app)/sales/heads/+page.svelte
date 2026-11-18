<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { apiFetch } from '$lib/api/api-client';
	import { currentUser, hasRole } from '$lib/stores/auth';
	import { toast } from '$lib/stores/toast';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { DateDisplay } from '$lib/components';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		Users,
		User,
		Briefcase,
		Wallet,
		Search,
		RefreshCw,
		Pencil,
		ExternalLink,
		Copy,
		Check,
		X,
		ChevronLeft,
		ChevronRight,
		Phone,
		Mail,
		MapPin,
		Filter,
		ShieldAlert,
		Lock,
		CheckCircle2,
		Trash2,
		AlertTriangle
	} from 'lucide-svelte';

	// ─── Interfaces ─────────────────────────────────────────────────────────────
	interface HeadSummary {
		id: number;
		firstName: string;
		lastName?: string | null;
		email?: string | null;
		mobileNo?: string | null;
		nationality?: string | null;
		type: string;
		status: string;
		wallet: number;
		createdAt: string;
		salesmanName?: string | null;
		address?: string | null;
		salesmanId?: number | null;
	}

	interface SalesmanOption {
		id: number;
		name: string;
	}

	interface HeadSummaryStats {
		totalCount: number;
		customerCount: number;
		agentCount: number;
		totalWallet: number;
	}

	interface PagedResponse<T> {
		items: T[];
		totalCount: number;
		pageNumber: number;
		pageSize: number;
		totalPages: number;
	}

	// ─── Component State ────────────────────────────────────────────────────────
	let heads = $state<HeadSummary[]>([]);
	let salesmen = $state<SalesmanOption[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	let summaryStats = $state<HeadSummaryStats>({
		totalCount: 0,
		customerCount: 0,
		agentCount: 0,
		totalWallet: 0
	});

	// Filters
	let search = $state('');
	let selectedSalesmanId = $state<string>('all');
	let selectedType = $state<'all' | 'customer' | 'agent'>('all');
	let currentPage = $state(1);
	let pageSize = $state(25);
	let totalCount = $state(0);
	let totalPages = $state(1);

	// Salesman Options for Searchable Select
	const salesmanOptions = $derived([
		{ id: 'all', name: 'All Salesmen' },
		...salesmen.map((s) => ({
			id: String(s.id),
			name: s.name
		}))
	]);

	// Edit Modal State (Master Accountant)
	let showEditModal = $state(false);
	let editingHead = $state<HeadSummary | null>(null);
	let editFirstName = $state('');
	let editLastName = $state('');
	let editType = $state('customer');
	let editMobileNo = $state('');
	let editEmail = $state('');
	let editNationality = $state('');
	let editAddress = $state('');
	let savingEdit = $state(false);
	let editError = $state<string | null>(null);

	// Delete Modal State (Master Accountant)
	let showDeleteModal = $state(false);
	let deletingHead = $state<HeadSummary | null>(null);
	let isDeleting = $state(false);
	let deleteError = $state<string | null>(null);

	// Copy feedback state
	let copiedMobileId = $state<number | null>(null);

	// ─── Role / Authorization Computed State ────────────────────────────────────
	const isMasterAccountant = $derived.by(() => {
		const userType = ($currentUser?.userType ?? '').toLowerCase().replace(/\s+/g, '_');
		return userType === 'master_accountant' || userType === 'master accountant' || hasRole('master_accountant');
	});

	// Metrics derived from authoritative server summary
	const totalWalletSum = $derived.by(() => summaryStats.totalWallet);
	const customerCount = $derived.by(() => summaryStats.customerCount);
	const agentCount = $derived.by(() => summaryStats.agentCount);
	const overallTotalCount = $derived.by(() => summaryStats.totalCount);

	// ─── Data Fetching ──────────────────────────────────────────────────────────
	async function loadSalesmen() {
		try {
			const res = await apiFetch<SalesmanOption[]>('api/sales-entries/salesmen');
			salesmen = res || [];
		} catch (err) {
			console.error('Failed to load salesmen list:', err);
		}
	}

	async function fetchHeads() {
		loading = true;
		error = null;
		try {
			const params = new URLSearchParams({
				page: currentPage.toString(),
				pageSize: pageSize.toString()
			});

			if (search.trim()) {
				params.append('search', search.trim());
			}

			if (selectedType && selectedType !== 'all') {
				params.append('type', selectedType);
			}

			if (selectedSalesmanId && selectedSalesmanId !== 'all') {
				params.append('salesmanId', selectedSalesmanId);
			}

			const res = await apiFetch<PagedResponse<HeadSummary>>(`api/sales-entries/heads?${params.toString()}`);
			if (res) {
				heads = res.items || [];
				totalCount = res.totalCount || 0;
				totalPages = res.totalPages || Math.ceil((res.totalCount || 0) / pageSize) || 1;

				if (summaryStats.totalCount === 0 && totalCount > 0 && selectedType === 'all' && (!selectedSalesmanId || selectedSalesmanId === 'all')) {
					summaryStats.totalCount = totalCount;
				}
			}
		} catch (err: any) {
			error = err?.message || 'Failed to fetch client heads.';
			toast.error(error ?? 'An unexpected error occurred.');
		} finally {
			loading = false;
		}
	}

	async function fetchSummary() {
		try {
			const url = selectedSalesmanId && selectedSalesmanId !== 'all'
				? `api/sales-entries/heads/summary?salesmanId=${selectedSalesmanId}`
				: 'api/sales-entries/heads/summary';
			const res = await apiFetch<HeadSummaryStats>(url);
			if (res) {
				summaryStats = res;
				return;
			}
		} catch (err) {
			console.warn('Failed to load heads summary stats from endpoint, falling back to calculation:', err);
		}

		// Fallback: calculate summary stats from heads directory so KPI cards are never 0
		try {
			let fallbackUrl = 'api/sales-entries/heads?page=1&pageSize=5000';
			if (selectedSalesmanId && selectedSalesmanId !== 'all') {
				fallbackUrl += `&salesmanId=${selectedSalesmanId}`;
			}
			const allHeadsRes = await apiFetch<PagedResponse<HeadSummary>>(fallbackUrl);
			if (allHeadsRes && allHeadsRes.items && allHeadsRes.items.length > 0) {
				const items = allHeadsRes.items;
				const total = allHeadsRes.totalCount > 0 ? allHeadsRes.totalCount : items.length;
				const customers = items.filter(
					(h) => !h.type || h.type.toLowerCase() === 'customer' || h.type.toLowerCase() === 'head'
				).length;
				const agents = items.filter((h) => h.type && h.type.toLowerCase() === 'agent').length;
				const walletSum = items.reduce((sum, h) => sum + (Number(h.wallet) || 0), 0);

				summaryStats = {
					totalCount: total,
					customerCount: customers,
					agentCount: agents,
					totalWallet: walletSum
				};
			} else {
				summaryStats = {
					totalCount: 0,
					customerCount: 0,
					agentCount: 0,
					totalWallet: 0
				};
			}
		} catch (fallbackErr) {
			console.error('Failed to calculate fallback summary stats:', fallbackErr);
		}
	}

	let debounceTimer: any = null;
	function handleSearchInput() {
		currentPage = 1;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			fetchHeads();
		}, 300);
	}

	function handleFilterChange() {
		currentPage = 1;
		fetchHeads();
		fetchSummary();
	}

	function handleSalesmanChange(val: string | number) {
		selectedSalesmanId = String(val);
		currentPage = 1;
		fetchHeads();
		fetchSummary();
	}

	function handleTypeChange(type: 'all' | 'customer' | 'agent') {
		selectedType = type;
		currentPage = 1;
		fetchHeads();
	}

	function resetAllFilters() {
		search = '';
		selectedSalesmanId = 'all';
		selectedType = 'all';
		currentPage = 1;
		fetchHeads();
		fetchSummary();
	}

	function copyToClipboard(text: string, headId: number) {
		if (!text) return;
		navigator.clipboard.writeText(text);
		copiedMobileId = headId;
		setTimeout(() => {
			copiedMobileId = null;
		}, 2000);
	}

	// ─── Modal Actions (Master Accountant) ──────────────────────────────────────
	function openEditModal(head: HeadSummary) {
		if (!isMasterAccountant) {
			toast.error('Only Master Accountants are authorized to edit client details.');
			return;
		}

		editingHead = head;
		editFirstName = head.firstName || '';
		editLastName = head.lastName || '';
		editType = (head.type || 'customer').toLowerCase() === 'agent' ? 'agent' : 'customer';
		editMobileNo = head.mobileNo || '';
		editEmail = head.email || '';
		editNationality = head.nationality || 'Bahraini';
		editAddress = head.address || '';
		editError = null;
		showEditModal = true;
	}

	function closeEditModal() {
		showEditModal = false;
		editingHead = null;
		editError = null;
	}

	async function handleSaveEdit() {
		if (!editingHead) return;
		if (!editFirstName.trim()) {
			editError = 'First Name is required.';
			return;
		}
		if (!editMobileNo.trim()) {
			editError = 'Mobile Number is required.';
			return;
		}
		if (!editEmail.trim()) {
			editError = 'Email Address is required.';
			return;
		}

		savingEdit = true;
		editError = null;

		try {
			const payload = {
				firstName: editFirstName.trim(),
				lastName: editLastName.trim() || null,
				type: editType,
				mobileNo: editMobileNo.trim(),
				email: editEmail.trim(),
				nationality: editNationality.trim() || 'Bahraini',
				address: editAddress.trim() || ''
			};

			await apiFetch(`api/sales-entries/heads/${editingHead.id}`, {
				method: 'PUT',
				body: JSON.stringify(payload)
			});

			toast.success(`Client head #${editingHead.id} updated successfully.`);
			closeEditModal();
			await Promise.all([fetchHeads(), fetchSummary()]);
		} catch (err: any) {
			editError = err?.message || 'Failed to update head details. Please check the fields and try again.';
			toast.error(editError ?? 'Update failed.');
		} finally {
			savingEdit = false;
		}
	}

	function openDeleteModal(head: HeadSummary) {
		if (!isMasterAccountant) {
			toast.error('Only Master Accountants are authorized to delete client heads.');
			return;
		}

		deletingHead = head;
		deleteError = null;
		showDeleteModal = true;
	}

	function closeDeleteModal() {
		showDeleteModal = false;
		deletingHead = null;
		deleteError = null;
		isDeleting = false;
	}

	async function handleDeleteHead() {
		if (!deletingHead) return;
		isDeleting = true;
		deleteError = null;

		try {
			await apiFetch(`api/sales-entries/heads/${deletingHead.id}`, {
				method: 'DELETE'
			});

			toast.success(`Client head #${deletingHead.id} (${deletingHead.firstName}) and all linked records deleted successfully.`);
			closeDeleteModal();
			await Promise.all([fetchHeads(), fetchSummary()]);
		} catch (err: any) {
			deleteError = err?.message || 'Failed to delete client head. Please try again.';
			toast.error(deleteError ?? 'Deletion failed.');
		} finally {
			isDeleting = false;
		}
	}

	onMount(async () => {
		const qSalesman = $page.url.searchParams.get('salesmanId');
		if (qSalesman) {
			selectedSalesmanId = qSalesman;
		}
		const qType = $page.url.searchParams.get('type');
		if (qType && ['all', 'customer', 'agent'].includes(qType.toLowerCase())) {
			selectedType = qType.toLowerCase() as any;
		}
		const qSearch = $page.url.searchParams.get('search');
		if (qSearch) {
			search = qSearch;
		}

		await Promise.all([loadSalesmen(), fetchHeads(), fetchSummary()]);
	});
</script>

<svelte:head>
	<title>All heads | Texas Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
		<div>
			<div class="flex items-center gap-3">
				<div class="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
					<Users class="w-6 h-6" />
				</div>
				<div>
					<h1 class="text-2xl font-bold tracking-tight text-foreground">All heads</h1>
					<p class="text-xs text-muted-foreground mt-0.5">
						Directory of all customer and agent heads, contact details, assigned salesmen, and live wallet balances.
					</p>
				</div>
			</div>
		</div>

		<div class="flex items-center gap-2.5">
			<Button
				variant="outline"
				size="sm"
				class="gap-2 h-9 text-xs"
				onclick={() => { loadSalesmen(); fetchHeads(); fetchSummary(); }}
				disabled={loading}
			>
				<RefreshCw class="w-3.5 h-3.5 {loading ? 'animate-spin' : ''}" />
				Refresh
			</Button>
		</div>
	</div>

	<!-- Top Metric Cards -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
		<!-- Total Heads -->
		<div class="bg-card border border-border rounded-xl p-4 shadow-sm relative overflow-hidden">
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium text-muted-foreground">Total Client Heads</span>
				<div class="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
					<Users class="w-4 h-4" />
				</div>
			</div>
			<div class="mt-2 flex items-baseline gap-2">
				<span class="text-2xl font-bold tracking-tight text-foreground">{overallTotalCount.toLocaleString()}</span>
				<span class="text-[11px] text-muted-foreground">registered parties</span>
			</div>
		</div>

		<!-- Customers -->
		<div class="bg-card border border-border rounded-xl p-4 shadow-sm relative overflow-hidden">
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium text-muted-foreground">Customers (Direct)</span>
				<div class="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center">
					<User class="w-4 h-4" />
				</div>
			</div>
			<div class="mt-2 flex items-baseline gap-2">
				<span class="text-2xl font-bold tracking-tight text-foreground">{customerCount.toLocaleString()}</span>
				<span class="text-[11px] text-muted-foreground">direct customers</span>
			</div>
		</div>

		<!-- Agents -->
		<div class="bg-card border border-border rounded-xl p-4 shadow-sm relative overflow-hidden">
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium text-muted-foreground">Agents / Partners</span>
				<div class="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
					<Briefcase class="w-4 h-4" />
				</div>
			</div>
			<div class="mt-2 flex items-baseline gap-2">
				<span class="text-2xl font-bold tracking-tight text-foreground">{agentCount.toLocaleString()}</span>
				<span class="text-[11px] text-muted-foreground">agency partners</span>
			</div>
		</div>

		<!-- Wallet Sum -->
		<div class="bg-card border border-border rounded-xl p-4 shadow-sm relative overflow-hidden">
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium text-muted-foreground">Total Live Net Wallet</span>
				<div class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
					<Wallet class="w-4 h-4" />
				</div>
			</div>
			<div class="mt-2 flex items-baseline gap-2">
				<div class="text-xl font-bold">
					<MoneyDisplay amount={totalWalletSum} currency="BHD" />
				</div>
			</div>
		</div>
	</div>

	<!-- Filter Controls Card -->
	<div class="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
		<div class="flex flex-col lg:flex-row lg:items-center gap-3">
			<!-- Client Type Segmented Tabs -->
			<div class="inline-flex items-center p-1 bg-muted/60 border border-border rounded-lg text-xs self-start lg:self-auto shrink-0">
				<button
					type="button"
					class="px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 {selectedType === 'all' ? 'bg-background text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}"
					onclick={() => handleTypeChange('all')}
				>
					<Users class="w-3.5 h-3.5" />
					<span>All</span>
					<span class="ml-1 text-[10px] px-1.5 py-0.2 rounded-full {selectedType === 'all' ? 'bg-primary/10 text-primary font-bold' : 'bg-muted text-muted-foreground'}">{overallTotalCount}</span>
				</button>
				<button
					type="button"
					class="px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 {selectedType === 'customer' ? 'bg-background text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}"
					onclick={() => handleTypeChange('customer')}
				>
					<User class="w-3.5 h-3.5" />
					<span>Customers</span>
					<span class="ml-1 text-[10px] px-1.5 py-0.2 rounded-full {selectedType === 'customer' ? 'bg-sky-500/10 text-sky-600 font-bold' : 'bg-muted text-muted-foreground'}">{customerCount}</span>
				</button>
				<button
					type="button"
					class="px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 {selectedType === 'agent' ? 'bg-background text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}"
					onclick={() => handleTypeChange('agent')}
				>
					<Briefcase class="w-3.5 h-3.5" />
					<span>Agents</span>
					<span class="ml-1 text-[10px] px-1.5 py-0.2 rounded-full {selectedType === 'agent' ? 'bg-purple-500/10 text-purple-600 font-bold' : 'bg-muted text-muted-foreground'}">{agentCount}</span>
				</button>
			</div>

			<!-- Search -->
			<div class="relative flex-1">
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
				<Input
					type="text"
					placeholder="Search by client name, mobile phone, or email..."
					bind:value={search}
					oninput={handleSearchInput}
					class="pl-9 h-10 text-xs bg-background w-full"
				/>
			</div>

			<!-- Salesman Filter Dropdown -->
			<div class="w-full lg:w-64 shrink-0">
				<SearchableSelect
					options={salesmanOptions}
					value={selectedSalesmanId}
					onchange={handleSalesmanChange}
					placeholder="Filter by salesman..."
					searchPlaceholder="Search salesmen..."
				/>
			</div>
		</div>

		<!-- Active Filters Indicator -->
		<div class="flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50 gap-2">
			<div class="flex flex-wrap items-center gap-2">
				<span>
					Showing <span class="font-semibold text-foreground">{heads.length}</span> of{' '}
					<span class="font-semibold text-foreground">{totalCount}</span> heads
				</span>

				{#if selectedSalesmanId && selectedSalesmanId !== 'all'}
					{@const currentSalesman = salesmen.find((s) => String(s.id) === String(selectedSalesmanId))}
					<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[11px] font-medium">
						<User class="w-3 h-3" />
						Salesman: {currentSalesman?.name || `ID #${selectedSalesmanId}`}
						<button
							type="button"
							class="hover:text-destructive transition-colors ml-0.5"
							onclick={() => {
								selectedSalesmanId = 'all';
								currentPage = 1;
								fetchHeads();
								fetchSummary();
							}}
							title="Clear salesman filter"
						>
							<X class="w-3 h-3" />
						</button>
					</span>
				{/if}

				{#if selectedType !== 'all'}
					<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted border border-border text-[11px] font-medium text-foreground capitalize">
						Type: {selectedType === 'customer' ? 'Direct Customers' : 'Agents / Partners'}
						<button
							type="button"
							class="hover:text-destructive transition-colors ml-0.5"
							onclick={() => {
								selectedType = 'all';
								currentPage = 1;
								fetchHeads();
							}}
							title="Clear type filter"
						>
							<X class="w-3 h-3" />
						</button>
					</span>
				{/if}

				{#if search}
					<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted border border-border text-[11px] font-medium text-foreground">
						Search: "{search}"
						<button
							type="button"
							class="hover:text-destructive transition-colors ml-0.5"
							onclick={() => {
								search = '';
								currentPage = 1;
								fetchHeads();
							}}
							title="Clear search"
						>
							<X class="w-3 h-3" />
						</button>
					</span>
				{/if}

				{#if (selectedSalesmanId && selectedSalesmanId !== 'all') || selectedType !== 'all' || search}
					<Button
						variant="ghost"
						size="sm"
						class="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
						onclick={resetAllFilters}
					>
						<X class="w-3 h-3" />
						Reset all filters
					</Button>
				{/if}
			</div>

			{#if isMasterAccountant}
				<span class="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
					<CheckCircle2 class="w-3.5 h-3.5" />
					Master Accountant: Full Edit Permissions Enabled
				</span>
			{:else}
				<span class="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
					<Lock class="w-3.5 h-3.5" />
					Normal Accountant: Read-Only Access
				</span>
			{/if}
		</div>
	</div>

	<!-- Data Table Section -->
	<div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
		{#if loading && heads.length === 0}
			<div class="py-20 flex flex-col items-center justify-center gap-3">
				<RefreshCw class="w-8 h-8 animate-spin text-primary" />
				<span class="text-xs text-muted-foreground">Loading client heads...</span>
			</div>
		{:else if error && heads.length === 0}
			<div class="py-20 flex flex-col items-center justify-center gap-3 text-destructive">
				<ShieldAlert class="w-8 h-8" />
				<span class="text-xs font-medium">{error}</span>
				<Button size="sm" variant="outline" onclick={fetchHeads}>Try Again</Button>
			</div>
		{:else if heads.length === 0}
			<div class="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
				<Users class="w-10 h-10 stroke-[1.5]" />
				<span class="text-xs">No client heads match your current search or filters.</span>
				<Button
					size="sm"
					variant="outline"
					onclick={resetAllFilters}
				>
					Reset Filters
				</Button>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs border-collapse">
					<thead>
						<tr class="border-b border-border bg-muted/40 text-muted-foreground font-medium">
							<th class="py-3 px-4 w-16">ID</th>
							<th class="py-3 px-4">Client / Party</th>
							<th class="py-3 px-4">Contact Information</th>
							<th class="py-3 px-4">Address</th>
							<th class="py-3 px-4">Assigned Salesman</th>
							<th class="py-3 px-4 text-right">Wallet Balance</th>
							<th class="py-3 px-4">Created Date</th>
							<th class="py-3 px-4 text-center w-28">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each heads as head (head.id)}
							{@const isAgent = (head.type ?? '').toLowerCase() === 'agent'}
							<tr class="hover:bg-muted/30 transition-colors group">
								<!-- ID -->
								<td class="py-3 px-4 font-mono text-[11px] text-muted-foreground">
									#{head.id}
								</td>

								<!-- Client / Party -->
								<td class="py-3 px-4">
									<div class="flex items-center gap-2">
										<div>
											<div class="font-semibold text-foreground text-xs flex items-center gap-2">
												<span>{head.firstName} {head.lastName || ''}</span>
												{#if isAgent}
													<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-600 border border-purple-200 dark:border-purple-800">
														Agent
													</span>
												{:else}
													<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-200 dark:border-blue-800">
														Customer
													</span>
												{/if}
											</div>
											{#if head.nationality}
												<div class="text-[11px] text-muted-foreground mt-0.5">
													{head.nationality}
												</div>
											{/if}
										</div>
									</div>
								</td>

								<!-- Contact Details -->
								<td class="py-3 px-4 space-y-1">
									<!-- Phone -->
									{#if head.mobileNo}
										<div class="flex items-center gap-1.5">
											<Phone class="w-3.5 h-3.5 text-muted-foreground shrink-0" />
											<span class="font-mono text-[11px] text-foreground">{head.mobileNo}</span>
											<button
												type="button"
												title="Copy phone number"
												onclick={() => copyToClipboard(head.mobileNo || '', head.id)}
												class="text-muted-foreground hover:text-foreground p-0.5 rounded"
											>
												{#if copiedMobileId === head.id}
													<Check class="w-3 h-3 text-emerald-500" />
												{:else}
													<Copy class="w-3 h-3" />
												{/if}
											</button>
										</div>
									{/if}

									<!-- Email -->
									{#if head.email}
										<div class="flex items-center gap-1.5">
											<Mail class="w-3.5 h-3.5 text-muted-foreground shrink-0" />
											<a
												href="mailto:{head.email}"
												class="text-primary hover:underline text-[11px] truncate max-w-[180px]"
											>
												{head.email}
											</a>
										</div>
									{/if}
								</td>

								<!-- Address -->
								<td class="py-3 px-4">
									{#if head.address && head.address.trim() !== ''}
										<div class="flex items-start gap-1 max-w-[200px]" title={head.address}>
											<MapPin class="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
											<span class="text-[11px] text-muted-foreground line-clamp-2">
												{head.address}
											</span>
										</div>
									{:else}
										<span class="text-[11px] text-muted-foreground italic">None</span>
									{/if}
								</td>

								<!-- Assigned Salesman -->
								<td class="py-3 px-4">
									{#if head.salesmanName}
										<button
											type="button"
											class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-foreground border border-border hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
											onclick={() => {
												if (head.salesmanId) {
													handleSalesmanChange(String(head.salesmanId));
												}
											}}
											title="Filter heads by {head.salesmanName}"
										>
											{head.salesmanName}
										</button>
									{:else}
										<span class="text-[11px] text-muted-foreground italic">Inhouse / Direct</span>
									{/if}
								</td>

								<!-- Wallet Balance -->
								<td class="py-3 px-4 text-right">
									<div class="inline-block px-2.5 py-1 rounded-md font-mono text-xs font-semibold
										{head.wallet > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
										 head.wallet < 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
										 'bg-muted text-muted-foreground'}">
										<MoneyDisplay amount={head.wallet} currency="BHD" />
									</div>
								</td>

								<!-- Created Date -->
								<td class="py-3 px-4 text-[11px] text-muted-foreground whitespace-nowrap">
									<DateDisplay date={head.createdAt} />
								</td>

								<!-- Actions -->
								<td class="py-3 px-4 text-center">
									<div class="flex items-center justify-center gap-1.5">
										<!-- View Ledger -->
										<a
											href="/sales/ledger?headId={head.id}"
											title="Explore Client Ledger"
											class="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
										>
											<ExternalLink class="w-4 h-4" />
										</a>

										<!-- Edit Button -->
										{#if isMasterAccountant}
											<button
												type="button"
												title="Edit client details (Master Accountant)"
												onclick={() => openEditModal(head)}
												class="p-1.5 rounded-md hover:bg-primary/10 text-primary transition-colors"
											>
												<Pencil class="w-4 h-4" />
											</button>
										{:else}
											<button
												type="button"
												disabled
												title="Only Master Accountants can edit client details"
												class="p-1.5 rounded-md text-muted-foreground/40 cursor-not-allowed"
											>
												<Lock class="w-4 h-4" />
											</button>
										{/if}

										<!-- Delete Button (Disabled - Coming Soon Tooltip) -->
										<div class="relative group inline-flex" title="Coming Soon">
											<button
												type="button"
												disabled
												class="p-1.5 rounded-md text-muted-foreground/30 hover:text-muted-foreground/40 cursor-not-allowed transition-colors"
												aria-label="Delete head (Coming Soon)"
											>
												<Trash2 class="w-4 h-4" />
											</button>
											<div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex items-center justify-center px-2 py-0.5 text-[10px] font-medium text-white bg-foreground/90 rounded shadow-md whitespace-nowrap z-50 pointer-events-none">
												Coming Soon
											</div>
										</div>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination Footer -->
			<div class="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border bg-muted/20">
				<div class="flex items-center gap-2 text-xs text-muted-foreground">
					<span>Rows per page:</span>
					<select
						bind:value={pageSize}
						onchange={handleFilterChange}
						class="h-8 px-2 text-xs bg-background border border-input rounded-md text-foreground"
					>
						<option value={10}>10</option>
						<option value={25}>25</option>
						<option value={50}>50</option>
						<option value={100}>100</option>
					</select>
					<span class="ml-2">
						Page <span class="font-medium text-foreground">{currentPage}</span> of{' '}
						<span class="font-medium text-foreground">{totalPages}</span>
					</span>
				</div>

				<div class="flex items-center gap-1">
					<Button
						variant="outline"
						size="sm"
						class="h-8 w-8 p-0"
						disabled={currentPage <= 1 || loading}
						onclick={() => {
							currentPage--;
							fetchHeads();
						}}
					>
						<ChevronLeft class="w-4 h-4" />
					</Button>
					<Button
						variant="outline"
						size="sm"
						class="h-8 w-8 p-0"
						disabled={currentPage >= totalPages || loading}
						onclick={() => {
							currentPage++;
							fetchHeads();
						}}
					>
						<ChevronRight class="w-4 h-4" />
					</Button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Edit Client Head Modal (Master Accountant Only) -->
{#if showEditModal && editingHead}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
		<div class="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
			<!-- Modal Header -->
			<div class="flex items-center justify-between p-4 border-b border-border bg-muted/30">
				<div class="flex items-center gap-2.5">
					<div class="p-2 rounded-lg bg-primary/10 text-primary">
						<Pencil class="w-4 h-4" />
					</div>
					<div>
						<h2 class="text-sm font-bold text-foreground">Edit Client Head #{editingHead.id}</h2>
						<p class="text-[11px] text-muted-foreground">
							Modify party contact info, category, and address.
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={closeEditModal}
					class="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<!-- Modal Body -->
			<div class="p-5 space-y-4 overflow-y-auto text-xs">
				{#if editError}
					<div class="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
						<ShieldAlert class="w-4 h-4 shrink-0" />
						<span>{editError}</span>
					</div>
				{/if}

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="edit-fn" class="block font-medium text-foreground mb-1">First Name *</label>
						<Input
							id="edit-fn"
							type="text"
							bind:value={editFirstName}
							placeholder="First Name"
							class="h-9 text-xs"
							required
						/>
					</div>
					<div>
						<label for="edit-ln" class="block font-medium text-foreground mb-1">Last Name</label>
						<Input
							id="edit-ln"
							type="text"
							bind:value={editLastName}
							placeholder="Last Name"
							class="h-9 text-xs"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="edit-type" class="block font-medium text-foreground mb-1">Party Type</label>
						<select
							id="edit-type"
							bind:value={editType}
							class="w-full h-9 px-3 text-xs bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
						>
							<option value="customer">Customer</option>
							<option value="agent">Agent</option>
						</select>
					</div>
					<div>
						<label for="edit-nat" class="block font-medium text-foreground mb-1">Nationality</label>
						<Input
							id="edit-nat"
							type="text"
							bind:value={editNationality}
							placeholder="e.g. Bahraini, Indian"
							class="h-9 text-xs"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="edit-mobile" class="block font-medium text-foreground mb-1">Mobile / Phone *</label>
						<Input
							id="edit-mobile"
							type="text"
							bind:value={editMobileNo}
							placeholder="e.g. 97333000000"
							class="h-9 text-xs"
							required
						/>
					</div>
					<div>
						<label for="edit-email" class="block font-medium text-foreground mb-1">Email Address *</label>
						<Input
							id="edit-email"
							type="email"
							bind:value={editEmail}
							placeholder="client@example.com"
							class="h-9 text-xs"
							required
						/>
					</div>
				</div>

				<div>
					<label for="edit-addr" class="block font-medium text-foreground mb-1">Address *</label>
					<textarea
						id="edit-addr"
						bind:value={editAddress}
						rows="3"
						placeholder="Full client address..."
						class="w-full p-2.5 text-xs bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
					></textarea>
				</div>
			</div>

			<!-- Modal Footer -->
			<div class="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="h-8 text-xs"
					onclick={closeEditModal}
					disabled={savingEdit}
				>
					Cancel
				</Button>
				<Button
					type="button"
					size="sm"
					class="h-8 text-xs gap-1.5"
					onclick={handleSaveEdit}
					disabled={savingEdit}
				>
					{#if savingEdit}
						<RefreshCw class="w-3.5 h-3.5 animate-spin" />
						Saving...
					{:else}
						Save Changes
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Modal (Master Accountant) -->
{#if showDeleteModal && deletingHead}
	<div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
		<div class="bg-card border border-destructive/30 rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in-0 zoom-in-95">
			<!-- Modal Header -->
			<div class="flex items-center justify-between p-4 border-b border-border bg-destructive/10">
				<div class="flex items-center gap-2 text-destructive">
					<AlertTriangle class="w-5 h-5" />
					<h3 class="font-semibold text-sm">Delete Client Head & Linked Records</h3>
				</div>
				<button
					type="button"
					onclick={closeDeleteModal}
					class="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<!-- Modal Body -->
			<div class="p-5 space-y-4 text-xs">
				<div class="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed space-y-1">
					<div class="font-semibold flex items-center gap-1.5">
						<AlertTriangle class="w-4 h-4 shrink-0" />
						Warning: This action is permanent and cannot be undone!
					</div>
					<p class="text-[11px] text-destructive/90">
						Deleting this client head will permanently cascade and remove all associated bookings (visas, flights, hotels, holidays, VFS, transport, other services), passenger/applicant records, profit calculations, receipts, payment allocations, credit receivables, and ledger transactions across both portals.
					</p>
				</div>

				{#if deleteError}
					<div class="p-3 rounded-md bg-destructive/10 text-destructive text-xs border border-destructive/20">
						{deleteError}
					</div>
				{/if}

				<!-- Head Summary Details -->
				<div class="p-3.5 rounded-lg bg-muted/40 border border-border space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-muted-foreground">Client ID:</span>
						<span class="font-mono font-semibold text-foreground">#{deletingHead.id}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-muted-foreground">Name:</span>
						<span class="font-medium text-foreground">{deletingHead.firstName} {deletingHead.lastName ?? ''}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-muted-foreground">Type:</span>
						<span class="capitalize px-2 py-0.5 rounded text-[10px] font-medium {deletingHead.type === 'agent' ? 'bg-purple-500/10 text-purple-600' : 'bg-sky-500/10 text-sky-600'}">
							{deletingHead.type}
						</span>
					</div>
					{#if deletingHead.salesmanName}
						<div class="flex items-center justify-between">
							<span class="text-muted-foreground">Assigned Salesman:</span>
							<span class="font-medium text-foreground">{deletingHead.salesmanName}</span>
						</div>
					{/if}
					<div class="flex items-center justify-between border-t border-border/50 pt-2">
						<span class="text-muted-foreground">Current Wallet Balance:</span>
						<div class="font-mono font-bold">
							<MoneyDisplay amount={deletingHead.wallet} currency="BHD" />
						</div>
					</div>
				</div>

				<p class="text-muted-foreground text-[11px]">
					Please confirm that you intend to permanently delete this head and all corresponding operational records.
				</p>
			</div>

			<!-- Modal Footer -->
			<div class="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="h-8 text-xs"
					onclick={closeDeleteModal}
					disabled={isDeleting}
				>
					Cancel
				</Button>
				<Button
					type="button"
					variant="destructive"
					size="sm"
					class="h-8 text-xs gap-1.5"
					onclick={handleDeleteHead}
					disabled={isDeleting}
				>
					{#if isDeleting}
						<RefreshCw class="w-3.5 h-3.5 animate-spin" />
						Deleting All Records...
					{:else}
						<Trash2 class="w-3.5 h-3.5" />
						Permanently Delete Head
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}
