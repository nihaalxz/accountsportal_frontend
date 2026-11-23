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
	import { exportToCSV as downloadCSV } from '$lib/utils/csv-exporter';
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
		ShieldAlert,
		Lock,
		CheckCircle2,
		Trash2,
		AlertTriangle,
		FileSpreadsheet
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

	function handleExportCSV() {
		if (heads.length === 0) return;
		const headers = [
			'Head ID',
			'Full Name',
			'Type',
			'Mobile Phone',
			'Email',
			'Nationality',
			'Assigned Salesman',
			'Wallet Balance (BHD)',
			'Address',
			'Created Date'
		];
		const rows = heads.map((h) => [
			h.id,
			`${h.firstName} ${h.lastName || ''}`.trim(),
			h.type ? (h.type.toLowerCase() === 'agent' ? 'Agent' : 'Customer') : 'Customer',
			h.mobileNo || '',
			h.email || '',
			h.nationality || '',
			h.salesmanName || 'Inhouse / Direct',
			(Number(h.wallet) || 0).toFixed(3),
			h.address || '',
			h.createdAt ? new Date(h.createdAt).toLocaleDateString('en-GB') : ''
		]);
		downloadCSV(`client_heads_directory_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
		toast.success('Client heads exported to CSV.');
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
	<title>Client Heads Directory — Texas Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-bold text-foreground flex items-center gap-2 font-sans">
				<Users class="h-5 w-5 text-primary" />
				Client Heads Directory
			</h1>
			<p class="text-xs text-muted-foreground">
				Authoritative directory of customer and agent heads, linked sales ledger accounts, contact profiles, and live wallet balances.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<Button
				variant="outline"
				class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
				onclick={() => { loadSalesmen(); fetchHeads(); fetchSummary(); }}
				disabled={loading}
			>
				<RefreshCw class={['h-3.5 w-3.5', loading ? 'animate-spin' : ''].join(' ')} />
				<span>Refresh</span>
			</Button>
		</div>
	</div>

	<!-- Top Metric Cards Grid (Matching reports/salesmen & profit-loss) -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
		<!-- Card 1: Total Client Heads -->
		<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-1">
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Total Client Heads</span>
				<div class="p-2 rounded-xl bg-primary/10 text-primary">
					<Users class="h-4 w-4" />
				</div>
			</div>
			<span class="text-2xl font-bold tracking-tight text-foreground block">{overallTotalCount.toLocaleString()}</span>
			<span class="text-[10px] text-muted-foreground block">Registered customer & agent parties</span>
		</div>

		<!-- Card 2: Customers -->
		<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-1">
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Direct Customers</span>
				<div class="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
					<User class="h-4 w-4" />
				</div>
			</div>
			<span class="text-2xl font-bold tracking-tight text-sky-600 dark:text-sky-400 block">{customerCount.toLocaleString()}</span>
			<span class="text-[10px] text-muted-foreground block">
				{overallTotalCount > 0 ? ((customerCount / overallTotalCount) * 100).toFixed(1) : 0}% of client base
			</span>
		</div>

		<!-- Card 3: Agents -->
		<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-1">
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Agency Partners</span>
				<div class="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
					<Briefcase class="h-4 w-4" />
				</div>
			</div>
			<span class="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400 block">{agentCount.toLocaleString()}</span>
			<span class="text-[10px] text-muted-foreground block">
				{overallTotalCount > 0 ? ((agentCount / overallTotalCount) * 100).toFixed(1) : 0}% partner network
			</span>
		</div>

		<!-- Card 4: Wallet Sum -->
		<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-1">
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Total Net Wallet Standing</span>
				<div class="p-2 rounded-xl {totalWalletSum >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}">
					<Wallet class="h-4 w-4" />
				</div>
			</div>
			<span class="text-lg font-bold font-mono block {totalWalletSum >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
				<MoneyDisplay amount={totalWalletSum} currency="BHD" />
			</span>
			<span class="text-[10px] text-muted-foreground block">
				{totalWalletSum >= 0 ? 'Pre-funded client credit' : 'Net customer receivable debit'}
			</span>
		</div>
	</div>

	<!-- Filter Controls Card (Matching reports/salesmen & profit-loss) -->
	<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3">
		<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
			<!-- Segmented Type Selector -->
			<div class="flex items-center gap-1.5 text-xs overflow-x-auto flex-nowrap pb-0.5 scrollbar-thin">
				<button
					type="button"
					onclick={() => handleTypeChange('all')}
					class="px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap flex items-center gap-1.5 {selectedType === 'all' ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
				>
					<Users class="h-3.5 w-3.5" />
					<span>All Heads</span>
					<span class="text-[10px] px-1.5 py-0.2 rounded-full {selectedType === 'all' ? 'bg-primary-foreground/20 text-primary-foreground font-bold' : 'bg-muted text-muted-foreground'}">{overallTotalCount}</span>
				</button>
				<button
					type="button"
					onclick={() => handleTypeChange('customer')}
					class="px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap flex items-center gap-1.5 {selectedType === 'customer' ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
				>
					<User class="h-3.5 w-3.5" />
					<span>Customers</span>
					<span class="text-[10px] px-1.5 py-0.2 rounded-full {selectedType === 'customer' ? 'bg-primary-foreground/20 text-primary-foreground font-bold' : 'bg-muted text-muted-foreground'}">{customerCount}</span>
				</button>
				<button
					type="button"
					onclick={() => handleTypeChange('agent')}
					class="px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap flex items-center gap-1.5 {selectedType === 'agent' ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
				>
					<Briefcase class="h-3.5 w-3.5" />
					<span>Agents</span>
					<span class="text-[10px] px-1.5 py-0.2 rounded-full {selectedType === 'agent' ? 'bg-primary-foreground/20 text-primary-foreground font-bold' : 'bg-muted text-muted-foreground'}">{agentCount}</span>
				</button>
			</div>

			<!-- Salesman Filter & Export Controls -->
			<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
				<div class="w-full sm:w-60">
					<SearchableSelect
						options={salesmanOptions}
						value={selectedSalesmanId}
						onchange={handleSalesmanChange}
						placeholder="Filter by salesman..."
						searchPlaceholder="Search salesmen..."
					/>
				</div>

				<Button
					variant="outline"
					class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0"
					onclick={handleExportCSV}
					disabled={heads.length === 0}
				>
					<FileSpreadsheet class="h-3.5 w-3.5" />
					<span>Export CSV</span>
				</Button>
			</div>
		</div>

		<!-- Search Input Row with Active Filter Chips & Role Indicator -->
		<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-border/40 text-xs">
			<div class="relative flex-1">
				<span class="absolute inset-y-0 left-3 flex items-center text-muted-foreground/60 pointer-events-none">
					<Search class="h-3.5 w-3.5" />
				</span>
				<input
					type="text"
					placeholder="Search by client name, mobile phone number, email, or nationality..."
					bind:value={search}
					oninput={handleSearchInput}
					class="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60"
				/>
				{#if search}
					<button
						type="button"
						onclick={() => { search = ''; currentPage = 1; fetchHeads(); }}
						class="absolute inset-y-0 right-2.5 flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
						title="Clear search"
					>
						<X class="h-3.5 w-3.5" />
					</button>
				{/if}
			</div>

			<!-- Status Badges & Reset Controls -->
			<div class="flex items-center gap-2 shrink-0">
				{#if isMasterAccountant}
					<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
						<CheckCircle2 class="h-3 w-3" />
						Master Accountant
					</span>
				{:else}
					<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted text-muted-foreground border border-border text-[11px] font-medium">
						<Lock class="h-3 w-3" />
						Read-Only
					</span>
				{/if}

				{#if (selectedSalesmanId && selectedSalesmanId !== 'all') || selectedType !== 'all' || search}
					<Button
						variant="ghost"
						size="sm"
						class="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
						onclick={resetAllFilters}
					>
						<X class="h-3 w-3" />
						<span>Reset</span>
					</Button>
				{/if}
			</div>
		</div>

		<!-- Active Filters Chips row -->
		{#if (selectedSalesmanId && selectedSalesmanId !== 'all') || selectedType !== 'all' || search}
			<div class="flex flex-wrap items-center gap-2 pt-1 border-t border-border/30 text-[11px]">
				<span class="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Active:</span>

				{#if selectedSalesmanId && selectedSalesmanId !== 'all'}
					{@const currentSalesman = salesmen.find((s) => String(s.id) === String(selectedSalesmanId))}
					<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20 font-medium">
						<User class="w-3 h-3" />
						Salesman: {currentSalesman?.name || `ID #${selectedSalesmanId}`}
						<button
							type="button"
							class="hover:text-destructive transition-colors ml-0.5 cursor-pointer"
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
					<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted border border-border font-medium text-foreground capitalize">
						Type: {selectedType === 'customer' ? 'Direct Customers' : 'Agency Partners'}
						<button
							type="button"
							class="hover:text-destructive transition-colors ml-0.5 cursor-pointer"
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
					<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted border border-border font-medium text-foreground">
						Query: "{search}"
						<button
							type="button"
							class="hover:text-destructive transition-colors ml-0.5 cursor-pointer"
							onclick={() => {
								search = '';
								currentPage = 1;
								fetchHeads();
							}}
							title="Clear search query"
						>
							<X class="w-3 h-3" />
						</button>
					</span>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Data Table Section (Matching reports/salesmen & profit-loss) -->
	<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
		{#if loading && heads.length === 0}
			<div class="py-20 flex flex-col items-center justify-center gap-3">
				<RefreshCw class="w-8 h-8 animate-spin text-primary" />
				<span class="text-xs text-muted-foreground">Loading client heads directory...</span>
			</div>
		{:else if error && heads.length === 0}
			<div class="py-20 flex flex-col items-center justify-center gap-3 text-destructive">
				<ShieldAlert class="w-8 h-8" />
				<span class="text-xs font-medium">{error}</span>
				<Button size="sm" variant="outline" class="rounded-xl" onclick={fetchHeads}>Try Again</Button>
			</div>
		{:else if heads.length === 0}
			<div class="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
				<Users class="w-10 h-10 stroke-[1.5]" />
				<span class="text-xs">No client heads match your current search or filters.</span>
				<Button
					size="sm"
					variant="outline"
					class="rounded-xl"
					onclick={resetAllFilters}
				>
					Reset Filters
				</Button>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full min-w-[850px] text-left border-collapse text-xs">
					<thead>
						<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold">
							<th class="p-4 w-16 font-semibold">ID</th>
							<th class="p-4 font-semibold">Client / Party</th>
							<th class="p-4 font-semibold">Contact Details</th>
							<th class="p-4 font-semibold">Address</th>
							<th class="p-4 font-semibold">Assigned Salesman</th>
							<th class="p-4 font-semibold text-right">Wallet Balance</th>
							<th class="p-4 font-semibold">Created Date</th>
							<th class="p-4 font-semibold text-center w-28">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/60">
						{#each heads as head (head.id)}
							{@const isAgent = (head.type ?? '').toLowerCase() === 'agent'}
							<tr class="hover:bg-muted/20 transition-colors group">
								<!-- ID -->
								<td class="p-4 font-mono text-[11px] text-muted-foreground">
									#{head.id}
								</td>

								<!-- Client / Party -->
								<td class="p-4">
									<div class="flex items-center gap-3">
										<div class="h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 {isAgent ? 'bg-purple-500/10 text-purple-600' : 'bg-sky-500/10 text-sky-600'}">
											{head.firstName ? head.firstName.charAt(0).toUpperCase() : 'C'}
										</div>
										<div>
											<div class="font-bold text-foreground text-xs flex items-center gap-1.5">
												<span>{head.firstName} {head.lastName || ''}</span>
												{#if isAgent}
													<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 border border-purple-500/20">
														Agent
													</span>
												{:else}
													<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-600 border border-sky-500/20">
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
								<td class="p-4 space-y-1">
									<!-- Phone -->
									{#if head.mobileNo}
										<div class="flex items-center gap-1.5">
											<Phone class="w-3.5 h-3.5 text-muted-foreground shrink-0" />
											<span class="font-mono text-[11px] text-foreground">{head.mobileNo}</span>
											<button
												type="button"
												title="Copy phone number"
												onclick={() => copyToClipboard(head.mobileNo || '', head.id)}
												class="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer transition-colors"
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
								<td class="p-4">
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
								<td class="p-4">
									{#if head.salesmanName}
										<button
											type="button"
											class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-muted/60 text-foreground border border-border/60 hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
											onclick={() => {
												if (head.salesmanId) {
													handleSalesmanChange(String(head.salesmanId));
												}
											}}
											title="Filter heads by {head.salesmanName}"
										>
											<User class="w-3 h-3 text-muted-foreground" />
											<span>{head.salesmanName}</span>
										</button>
									{:else}
										<span class="text-[11px] text-muted-foreground italic">Inhouse / Direct</span>
									{/if}
								</td>

								<!-- Wallet Balance -->
								<td class="p-4 text-right">
									<div class="inline-block px-2.5 py-1 rounded-xl font-mono text-xs font-bold
										{head.wallet > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
										 head.wallet < 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
										 'bg-muted text-muted-foreground border border-border/40'}">
										<MoneyDisplay amount={head.wallet} currency="BHD" />
									</div>
								</td>

								<!-- Created Date -->
								<td class="p-4 text-[11px] text-muted-foreground whitespace-nowrap font-mono">
									<DateDisplay value={head.createdAt} />
								</td>

								<!-- Actions -->
								<td class="p-4 text-center">
									<div class="flex items-center justify-center gap-1.5">
										<!-- View Ledger -->
										<a
											href="/sales/ledger?headId={head.id}"
											title="Explore Client Ledger"
											class="h-7.5 w-7.5 rounded-lg border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground inline-flex items-center justify-center transition-colors cursor-pointer"
										>
											<ExternalLink class="w-3.5 h-3.5" />
										</a>

										<!-- Edit Button -->
										{#if isMasterAccountant}
											<button
												type="button"
												title="Edit client details (Master Accountant)"
												onclick={() => openEditModal(head)}
												class="h-7.5 w-7.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/15 text-primary inline-flex items-center justify-center transition-colors cursor-pointer"
											>
												<Pencil class="w-3.5 h-3.5" />
											</button>
										{:else}
											<button
												type="button"
												disabled
												title="Only Master Accountants can edit client details"
												class="h-7.5 w-7.5 rounded-lg border border-border/40 text-muted-foreground/30 cursor-not-allowed inline-flex items-center justify-center"
											>
												<Lock class="w-3.5 h-3.5" />
											</button>
										{/if}

										<!-- Delete Button (Disabled - Coming Soon Tooltip) -->
										<div class="relative group inline-flex" title="Coming Soon">
											<button
												type="button"
												disabled
												class="h-7.5 w-7.5 rounded-lg border border-border/40 text-muted-foreground/30 cursor-not-allowed inline-flex items-center justify-center transition-colors"
												aria-label="Delete head (Coming Soon)"
											>
												<Trash2 class="w-3.5 h-3.5" />
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

			<!-- Pagination Footer (Matching reports/salesmen & profit-loss) -->
			<div class="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border/60 bg-muted/10">
				<div class="flex items-center gap-2 text-xs text-muted-foreground">
					<span>Rows per page:</span>
					<select
						bind:value={pageSize}
						onchange={handleFilterChange}
						class="h-8 px-2.5 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
					>
						<option value={10}>10</option>
						<option value={25}>25</option>
						<option value={50}>50</option>
						<option value={100}>100</option>
					</select>
					<span class="ml-2">
						Showing <strong class="text-foreground">{heads.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> - <strong class="text-foreground">{Math.min(currentPage * pageSize, totalCount)}</strong> of <strong class="text-foreground">{totalCount}</strong>
					</span>
				</div>

				<div class="flex items-center gap-1.5">
					<Button
						variant="outline"
						class="h-8 rounded-xl px-2.5 text-xs flex items-center gap-1 cursor-pointer"
						disabled={currentPage <= 1 || loading}
						onclick={() => {
							currentPage--;
							fetchHeads();
						}}
					>
						<ChevronLeft class="h-3.5 w-3.5" />
						<span>Previous</span>
					</Button>
					<div class="px-2.5 py-1 rounded-xl bg-muted text-[11px] font-mono font-semibold text-foreground">
						{currentPage} / {totalPages}
					</div>
					<Button
						variant="outline"
						class="h-8 rounded-xl px-2.5 text-xs flex items-center gap-1 cursor-pointer"
						disabled={currentPage >= totalPages || loading}
						onclick={() => {
							currentPage++;
							fetchHeads();
						}}
					>
						<span>Next</span>
						<ChevronRight class="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Edit Client Head Modal (Master Accountant Only - Modernized) -->
{#if showEditModal && editingHead}
	<div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
			<!-- Modal Header -->
			<div class="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
				<div class="flex items-center gap-2.5">
					<div class="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-xs text-white">
						<Pencil class="h-4.5 w-4.5" />
					</div>
					<div>
						<h2 class="text-sm font-bold text-foreground">Edit Client Head #{editingHead.id}</h2>
						<p class="text-[10px] text-muted-foreground">
							Modify party contact info, category, and address.
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={closeEditModal}
					class="h-8 w-8 rounded-lg bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<!-- Modal Body -->
			<div class="p-6 space-y-4 overflow-y-auto text-xs">
				{#if editError}
					<div class="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium flex items-center gap-2">
						<ShieldAlert class="w-4 h-4 shrink-0" />
						<span>{editError}</span>
					</div>
				{/if}

				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<label for="edit-fn" class="text-xs font-semibold text-foreground flex items-center gap-1">First Name <span class="text-destructive">*</span></label>
						<input
							id="edit-fn"
							type="text"
							bind:value={editFirstName}
							placeholder="First Name"
							class="w-full h-9 px-3 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
							required
						/>
					</div>
					<div class="space-y-1.5">
						<label for="edit-ln" class="text-xs font-semibold text-foreground">Last Name</label>
						<input
							id="edit-ln"
							type="text"
							bind:value={editLastName}
							placeholder="Last Name"
							class="w-full h-9 px-3 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<label for="edit-type" class="text-xs font-semibold text-foreground">Party Type</label>
						<select
							id="edit-type"
							bind:value={editType}
							class="w-full h-9 px-3 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
						>
							<option value="customer">Customer</option>
							<option value="agent">Agent</option>
						</select>
					</div>
					<div class="space-y-1.5">
						<label for="edit-nat" class="text-xs font-semibold text-foreground">Nationality</label>
						<input
							id="edit-nat"
							type="text"
							bind:value={editNationality}
							placeholder="e.g. Bahraini, Indian"
							class="w-full h-9 px-3 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<label for="edit-mobile" class="text-xs font-semibold text-foreground flex items-center gap-1">Mobile / Phone <span class="text-destructive">*</span></label>
						<input
							id="edit-mobile"
							type="text"
							bind:value={editMobileNo}
							placeholder="e.g. 97333000000"
							class="w-full h-9 px-3 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
							required
						/>
					</div>
					<div class="space-y-1.5">
						<label for="edit-email" class="text-xs font-semibold text-foreground flex items-center gap-1">Email Address <span class="text-destructive">*</span></label>
						<input
							id="edit-email"
							type="email"
							bind:value={editEmail}
							placeholder="client@example.com"
							class="w-full h-9 px-3 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
							required
						/>
					</div>
				</div>

				<div class="space-y-1.5">
					<label for="edit-addr" class="text-xs font-semibold text-foreground">Address</label>
					<textarea
						id="edit-addr"
						bind:value={editAddress}
						rows="3"
						placeholder="Full client address..."
						class="w-full p-3 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
					></textarea>
				</div>
			</div>

			<!-- Modal Footer -->
			<div class="px-6 py-4 border-t border-border flex items-center justify-end gap-2 bg-muted/20">
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="rounded-xl font-semibold text-xs py-2 px-4 cursor-pointer"
					onclick={closeEditModal}
					disabled={savingEdit}
				>
					Cancel
				</Button>
				<Button
					type="button"
					size="sm"
					class="rounded-xl font-semibold text-xs py-2 px-4 cursor-pointer gap-1.5"
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

<!-- Delete Confirmation Modal (Master Accountant - Modernized) -->
{#if showDeleteModal && deletingHead}
	<div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
		<div class="bg-card border border-destructive/30 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
			<!-- Modal Header -->
			<div class="px-6 py-4 border-b border-border flex items-center justify-between bg-destructive/10">
				<div class="flex items-center gap-2.5 text-destructive">
					<div class="h-9 w-9 rounded-xl bg-destructive/20 flex items-center justify-center shadow-xs">
						<AlertTriangle class="h-5 w-5" />
					</div>
					<div>
						<h3 class="font-bold text-sm">Delete Client Head & Linked Records</h3>
						<p class="text-[10px] text-destructive/80">Permanent cascading deletion</p>
					</div>
				</div>
				<button
					type="button"
					onclick={closeDeleteModal}
					class="h-8 w-8 rounded-lg bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<!-- Modal Body -->
			<div class="p-6 space-y-4 text-xs">
				<div class="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed space-y-1">
					<div class="font-bold flex items-center gap-1.5">
						<AlertTriangle class="w-4 h-4 shrink-0" />
						Warning: This action is permanent and cannot be undone!
					</div>
					<p class="text-[11px] text-destructive/90">
						Deleting this client head will permanently cascade and remove all associated bookings (visas, flights, hotels, holidays, VFS, transport, other services), passenger/applicant records, profit calculations, receipts, payment allocations, credit receivables, and ledger transactions across both portals.
					</p>
				</div>

				{#if deleteError}
					<div class="p-3 rounded-xl bg-destructive/10 text-destructive text-xs border border-destructive/20">
						{deleteError}
					</div>
				{/if}

				<!-- Head Summary Details -->
				<div class="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-muted-foreground">Client ID:</span>
						<span class="font-mono font-bold text-foreground">#{deletingHead.id}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-muted-foreground">Name:</span>
						<span class="font-semibold text-foreground">{deletingHead.firstName} {deletingHead.lastName ?? ''}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-muted-foreground">Type:</span>
						<span class="capitalize px-2 py-0.5 rounded-full text-[10px] font-semibold {deletingHead.type === 'agent' ? 'bg-purple-500/10 text-purple-600' : 'bg-sky-500/10 text-sky-600'}">
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
			<div class="px-6 py-4 border-t border-border flex items-center justify-end gap-2 bg-muted/20">
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="rounded-xl font-semibold text-xs py-2 px-4 cursor-pointer"
					onclick={closeDeleteModal}
					disabled={isDeleting}
				>
					Cancel
				</Button>
				<Button
					type="button"
					variant="destructive"
					size="sm"
					class="rounded-xl font-semibold text-xs py-2 px-4 cursor-pointer gap-1.5"
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
