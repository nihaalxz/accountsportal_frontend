<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { apiFetch } from '$lib/api/api-client';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { DateDisplay } from '$lib/components';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { currentUser, hasRole } from '$lib/stores/auth';
	import { toast } from '$lib/stores/toast';
	import {
		Users, RefreshCw, Plus, Pencil, X, ShieldCheck, Wallet,
		Clock, Check, Trash2, AlertTriangle, Tag, ArrowRight, CornerDownRight, MessageSquare, Search
	} from 'lucide-svelte';
	import {
		getPurchaseReturns,
		approvePurchaseReturn,
		rejectPurchaseReturn,
		getSalesReturns,
		approveSalesReturn,
		rejectSalesReturn
	} from '$features/suppliers/api';
	import type {
		PurchaseReturnResponse,
		SalesReturnResponse
	} from '$features/suppliers/types';

	// ─── Types ────────────────────────────────────────────────────────────────────
	interface SupplierResponse {
		id: number;
		name: string;
		code: string;
		wallet: number;
		isVerified: boolean;
		categories: string[];
		createdAt: string;
	}

	interface PendingItem {
		id: number;
		entityType: string;
		payloadJson: string;
		submittedByName: string;
		submittedByUserId: number;
		submittedAt: string;
		status: string;
		reviewedByName: string | null;
		reviewedAt: string | null;
	}

	const CATEGORY_OPTIONS = [
		'Visa Application',
		'Flight Bookings',
		'Holiday Packages',
		'VFS Appointments',
		'Hotel Booking',
		'Transportation',
		'Other Services'
	];

	interface SupplierPayload {
		name: string;
		code: string;
		categories: string[];
		wallet?: number;
	}

	// ─── State ────────────────────────────────────────────────────────────────────
	let suppliers = $state<SupplierResponse[]>([]);
	let pending = $state<PendingItem[]>([]);
	let pendingPurchaseReturns = $state<PurchaseReturnResponse[]>([]);
	let pendingSalesReturns = $state<SalesReturnResponse[]>([]);

	let isLoading = $state(false);
	let loadingPending = $state(false);
	let loadingPurchaseReturns = $state(false);
	let loadingSalesReturns = $state(false);
	let isSaving = $state(false);
	
	let activeTab = $state<'list' | 'pending' | 'purchase-returns' | 'sales-returns'>('list');

	// Form state
	let showForm = $state(false);
	let isEditing = $state(false);
	let editingId = $state<number | null>(null);
	let name = $state('');
	let code = $state('');
	let selectedCategories = $state<string[]>([]);
	let walletStr = $state('');

	let actioningId = $state<number | null>(null);
	let searchQuery = $state('');

	let filteredSuppliers = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return suppliers;
		return suppliers.filter(s =>
			s.name.toLowerCase().includes(q) ||
			s.code.toLowerCase().includes(q) ||
			s.categories.some(cat => cat.toLowerCase().includes(q))
		);
	});

	// Rejection modal
	let showRejectModal = $state(false);
	let rejectReason = $state('');
	let itemToReject = $state<{ id: number; type: 'purchase' | 'sales' } | null>(null);

	// ─── API ─────────────────────────────────────────────────────────────────────
	async function loadSuppliers() {
		isLoading = true;
		try {
			suppliers = (await apiFetch<SupplierResponse[]>('api/supplier')) || [];
		} catch (err: any) {
			toast.error(err.message || 'Failed to load suppliers.');
		} finally {
			isLoading = false;
		}
	}

	async function loadPending() {
		loadingPending = true;
		try {
			pending = (await apiFetch<PendingItem[]>('api/pending-approvals?entityType=supplier&status=pending')) || [];
		} catch (err: any) {
			toast.error(err.message || 'Failed to load pending requests.');
		} finally {
			loadingPending = false;
		}
	}

	let prFilter = $state<'all' | 'pending' | 'approved' | 'rejected'>('all');
	let srFilter = $state<'all' | 'pending' | 'approved' | 'rejected'>('all');

	async function loadPendingPurchaseReturns() {
		loadingPurchaseReturns = true;
		try {
			const params: any = {};
			if (prFilter !== 'all') params.status = prFilter;
			pendingPurchaseReturns = await getPurchaseReturns(params);
		} catch (err: any) {
			toast.error(err.message || 'Failed to load purchase returns.');
		} finally {
			loadingPurchaseReturns = false;
		}
	}

	let headsList = $state<any[]>([]);
	let agentsList = $state<any[]>([]);

	async function loadHeadsAndAgents() {
		try {
			const [headsRes, agentsRes] = await Promise.all([
				apiFetch<any>('api/sales-entries/heads?pageSize=500').catch(() => null),
				apiFetch<any>('api/agent').catch(() => null)
			]);
			if (headsRes && headsRes.items) headsList = headsRes.items;
			if (agentsRes) agentsList = Array.isArray(agentsRes) ? agentsRes : (agentsRes.items || []);
		} catch (err) {
			console.error('Failed to load heads and agents', err);
		}
	}

	function getRecipientLabel(type: string | undefined, id: number | string | undefined, item?: any): string {
		if (item?.recipientName) return item.recipientName;
		if (!id) return 'N/A';
		const rType = (type || '').toLowerCase().trim();
		const numericId = Number(id);

		if (rType === 'agent') {
			const ag = agentsList.find((a: any) => Number(a.id) === numericId);
			if (ag) {
				const name = ag.agencyName || ag.name || ag.fullName || `${ag.firstName || ''} ${ag.lastName || ''}`.trim();
				if (name) return name;
			}
			return `Agent #${id}`;
		}

		if (rType === 'head') {
			const hd = headsList.find((h: any) => Number(h.id) === numericId);
			if (hd) {
				const name = hd.fullName || hd.headName || hd.name || `${hd.firstName || ''} ${hd.lastName || ''}`.trim();
				if (name) return name;
			}
			return `Head #${id}`;
		}

		return `${type || 'Recipient'} #${id}`;
	}

	async function loadPendingSalesReturns() {
		loadingSalesReturns = true;
		try {
			const params: any = {};
			if (srFilter !== 'all') params.status = srFilter;
			const [sReturns] = await Promise.all([
				getSalesReturns(params),
				loadHeadsAndAgents()
			]);
			pendingSalesReturns = sReturns;
		} catch (err: any) {
			toast.error(err.message || 'Failed to load sales returns.');
		} finally {
			loadingSalesReturns = false;
		}
	}

	async function loadAllData() {
		await Promise.all([
			loadSuppliers(),
			loadPending(),
			loadPendingPurchaseReturns(),
			loadPendingSalesReturns()
		]);
	}

	// ─── Form submit ─────────────────────────────────────────────────────────────
	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!name.trim()) return;
		isSaving = true;
		const cats = selectedCategories.filter(Boolean);
		const isMaster = hasRole('master_accountant');
		const initialWallet = parseFloat(walletStr) || 0;

		try {
			if (isEditing && editingId !== null) {
				await apiFetch(`api/supplier/${editingId}`, {
					method: 'PUT',
					body: JSON.stringify({ name: name.trim(), categories: cats }),
					headers: { 'Content-Type': 'application/json' }
				});
				toast.success('Supplier updated successfully.');
				resetForm();
				await loadSuppliers();
			} else if (isMaster) {
				if (!code.trim()) { toast.error('Supplier Code is required.'); isSaving = false; return; }
				await apiFetch('api/supplier', {
					method: 'POST',
					body: JSON.stringify({ name: name.trim(), code: code.trim(), categories: cats, wallet: initialWallet }),
					headers: { 'Content-Type': 'application/json' }
				});
				toast.success('Supplier registered successfully.');
				resetForm();
				await loadSuppliers();
			} else {
				if (!code.trim()) { toast.error('Supplier Code is required for the request.'); isSaving = false; return; }
				const payload: SupplierPayload = { name: name.trim(), code: code.trim(), categories: cats, wallet: initialWallet };
				await apiFetch('api/pending-approvals', {
					method: 'POST',
					body: JSON.stringify({
						entityType: 'supplier',
						payloadJson: JSON.stringify(payload),
						submittedByName: $currentUser?.name ?? 'Accountant'
					}),
					headers: { 'Content-Type': 'application/json' }
				});
				toast.success('Supplier registration submitted for master accountant approval.');
				resetForm();
				await loadPending();
			}
		} catch (err: any) {
			toast.error(err.message || 'Failed to save supplier.');
		} finally {
			isSaving = false;
		}
	}

	// ─── Supplier Approvals ───────────────────────────────────────────────────────
	async function approveSupplier(item: PendingItem) {
		actioningId = item.id;
		try {
			await apiFetch(`api/pending-approvals/${item.id}/approve`, { method: 'POST' });
			toast.success('Supplier approved and registered.');
			await loadAllData();
		} catch (err: any) {
			toast.error(err.message || 'Approval failed.');
		} finally {
			actioningId = null;
		}
	}

	async function rejectSupplier(item: PendingItem) {
		actioningId = item.id;
		try {
			await apiFetch(`api/pending-approvals/${item.id}/reject`, { method: 'POST' });
			toast.success('Request rejected.');
			await loadPending();
		} catch (err: any) {
			toast.error(err.message || 'Rejection failed.');
		} finally {
			actioningId = null;
		}
	}

	// ─── Settlement Approvals ─────────────────────────────────────────────────────
	async function handleApprovePurchaseReturn(item: PurchaseReturnResponse) {
		actioningId = item.id;
		try {
			await approvePurchaseReturn(item.id, item.rowVersion);
			toast.success('Purchase Return approved successfully.');
			await loadAllData();
		} catch (err: any) {
			toast.error(err.message || 'Failed to approve purchase return.');
		} finally {
			actioningId = null;
		}
	}

	async function handleApproveSalesReturn(item: SalesReturnResponse) {
		actioningId = item.id;
		try {
			await approveSalesReturn(item.id, item.rowVersion);
			toast.success('Sales Return approved successfully.');
			await loadAllData();
		} catch (err: any) {
			toast.error(err.message || 'Failed to approve sales return.');
		} finally {
			actioningId = null;
		}
	}

	// Reject settlements
	function openRejectModal(id: number, type: 'purchase' | 'sales') {
		itemToReject = { id, type };
		rejectReason = '';
		showRejectModal = true;
	}

	async function submitRejection() {
		if (!itemToReject || !rejectReason.trim()) return;
		const { id, type } = itemToReject;
		actioningId = id;
		showRejectModal = false;

		try {
			if (type === 'purchase') {
				await rejectPurchaseReturn(id, rejectReason.trim());
				toast.success('Purchase Return rejected.');
			} else if (type === 'sales') {
				await rejectSalesReturn(id, rejectReason.trim());
				toast.success('Sales Return rejected.');
			}
			await loadAllData();
		} catch (err: any) {
			toast.error(err.message || 'Failed to reject transaction.');
		} finally {
			actioningId = null;
			itemToReject = null;
		}
	}

	// ─── Edit helpers ─────────────────────────────────────────────────────────────
	function startEdit(s: SupplierResponse) {
		isEditing = true; editingId = s.id; showForm = true;
		name = s.name; code = s.code;
		selectedCategories = s.categories.map(cat => {
			if (cat === 'Flights') return 'Flight Bookings';
			if (cat === 'Visa Services') return 'Visa Application';
			if (cat === 'VFS Appointment') return 'VFS Appointments';
			return cat;
		});
		walletStr = '';
	}

	function resetForm() {
		showForm = false; isEditing = false; editingId = null;
		name = ''; code = ''; selectedCategories = []; walletStr = '';
	}

	function addCategory() {
		selectedCategories = [...selectedCategories, CATEGORY_OPTIONS[0] ?? ''];
	}

	function removeCategory(index: number) {
		selectedCategories = selectedCategories.filter((_, idx) => idx !== index);
	}

	onMount(() => { loadAllData(); });
</script>

<svelte:head>
	<title>Supplier Management — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-bold text-foreground flex items-center gap-2">
				<Users class="h-5 w-5 text-primary" /> Supplier Management
			</h1>
			<p class="text-xs text-muted-foreground">View and manage supplier credentials, categories, wallets, and approve settlements.</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button onclick={() => { showForm = !showForm; if (!showForm) resetForm(); }} class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold">
				{#if showForm}<X class="h-3.5 w-3.5" /> Cancel
				{:else}<Plus class="h-3.5 w-3.5" />{hasRole('master_accountant') ? 'Register Supplier' : 'Submit Supplier Request'}{/if}
			</Button>
			<Button variant="outline" class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold" onclick={loadAllData} disabled={isLoading || loadingPending || loadingPurchaseReturns || loadingSalesReturns}>
				<RefreshCw class="h-3.5 w-3.5 {(isLoading || loadingPending || loadingPurchaseReturns || loadingSalesReturns) ? 'animate-spin' : ''}" /> Reload
			</Button>
		</div>
	</div>

	<!-- Form -->
	{#if showForm}
		<div class="bg-card border border-border rounded-2xl p-6 shadow-xs">
			<h2 class="text-sm font-bold text-foreground mb-1">
				{#if isEditing}Editing Supplier — {name}
				{:else if hasRole('master_accountant')}Register New Supplier
				{:else}Submit Supplier Registration Request{/if}
			</h2>
			{#if !isEditing && !hasRole('master_accountant')}
				<p class="text-[11px] text-amber-600 flex items-center gap-1.5 mb-5">
					<AlertTriangle class="h-3.5 w-3.5 shrink-0" />
					Your request will be stored in the database and needs master accountant approval before the supplier is registered.
				</p>
			{:else}<div class="mb-5"></div>{/if}
			<form onsubmit={handleSubmit}>
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
					<div class="space-y-1.5">
						<label for="s-name" class="block font-semibold text-foreground">Supplier Name <span class="text-red-500">*</span></label>
						<Input id="s-name" type="text" bind:value={name} required placeholder="e.g. Acme Corp" />
					</div>
					<div class="space-y-1.5">
						<label for="s-code" class="block font-semibold text-foreground">
							Supplier Code <span class="text-red-500">*</span>
							{#if isEditing}<span class="text-muted-foreground font-normal">(read-only)</span>{/if}
						</label>
						<Input id="s-code" type="text" bind:value={code} required disabled={isEditing} placeholder="e.g. ACM-01" />
					</div>
					{#if !isEditing}
						<div class="space-y-1.5">
							<label for="s-wallet" class="block font-semibold text-foreground">Opening Balance (negative = owed to supplier)</label>
							<Input id="s-wallet" type="number" step="0.001" bind:value={walletStr} placeholder="e.g. 5000.000 or -500.000" />
						</div>
					{/if}
				</div>

				<div class="mt-4 space-y-2 text-xs">
					<div class="flex items-center justify-between">
						<span class="font-semibold text-foreground">Supplier Categories</span>
						<Button type="button" variant="outline" class="h-7 px-2.5 rounded-lg text-[10px] gap-1 cursor-pointer" onclick={addCategory}>
							<Plus class="h-3 w-3" /> Add Category
						</Button>
					</div>

					{#if selectedCategories.length === 0}
						<div class="text-[11px] text-muted-foreground py-2 px-3 border border-dashed border-border rounded-xl bg-muted/20">
							No categories selected. Click "Add Category" to select categories for this supplier.
						</div>
					{:else}
						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{#each selectedCategories as cat, i}
								<div class="flex items-center gap-2 bg-muted/25 border border-border p-2 rounded-xl">
									<select bind:value={selectedCategories[i]} class="flex-1 h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring">
										{#each CATEGORY_OPTIONS as opt}
											<option value={opt}>{opt}</option>
										{/each}
									</select>
									<Button type="button" variant="ghost" class="h-8 w-8 rounded-lg p-0 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer" onclick={() => removeCategory(i)}>
										<Trash2 class="h-3.5 w-3.5" />
									</Button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
				<div class="flex gap-2.5 mt-5 pt-4 border-t border-border/50">
					<Button type="submit" disabled={isSaving || !name.trim()} class="rounded-xl font-semibold text-xs px-5">
						{#if isSaving}<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />{/if}
						{#if isEditing}Save Changes{:else if hasRole('master_accountant')}Register Supplier{:else}Submit for Approval{/if}
					</Button>
					<Button type="button" variant="outline" onclick={resetForm} class="rounded-xl text-xs">Cancel</Button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Tabs & Search Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
		<div class="flex items-center gap-1 bg-muted/40 rounded-xl p-1 border border-border/50 overflow-x-auto flex-nowrap pb-1 scrollbar-thin">
			<button onclick={() => (activeTab = 'list')} class="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap {activeTab === 'list' ? 'bg-card text-foreground shadow-xs border border-border/30' : 'text-muted-foreground hover:text-foreground'}">
				All Suppliers ({suppliers.length})
			</button>
			<button onclick={() => (activeTab = 'pending')} class="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap {activeTab === 'pending' ? 'bg-card text-foreground shadow-xs border border-border/30' : 'text-muted-foreground hover:text-foreground'}">
				Pending Registration
				{#if pending.length > 0}
					<span class="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[9px] font-bold bg-amber-500 text-white">{pending.length}</span>
				{/if}
			</button>
			<button onclick={() => (activeTab = 'purchase-returns')} class="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap {activeTab === 'purchase-returns' ? 'bg-card text-foreground shadow-xs border border-border/30' : 'text-muted-foreground hover:text-foreground'}">
				Purchase Returns History
				{#if pendingPurchaseReturns.filter((r) => (r.status || '').toLowerCase() === 'pending').length > 0}
					<span class="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[9px] font-bold bg-amber-500 text-white">{pendingPurchaseReturns.filter((r) => (r.status || '').toLowerCase() === 'pending').length}</span>
				{/if}
			</button>
			<button onclick={() => (activeTab = 'sales-returns')} class="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap {activeTab === 'sales-returns' ? 'bg-card text-foreground shadow-xs border border-border/30' : 'text-muted-foreground hover:text-foreground'}">
				Sales Returns History
				{#if pendingSalesReturns.filter((r) => (r.status || '').toLowerCase() === 'pending').length > 0}
					<span class="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[9px] font-bold bg-amber-500 text-white">{pendingSalesReturns.filter((r) => (r.status || '').toLowerCase() === 'pending').length}</span>
				{/if}
			</button>
		</div>

		{#if activeTab === 'list'}
			<div class="relative w-full sm:w-80">
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
				<input
					type="text"
					placeholder="Search suppliers by name, code, or category..."
					bind:value={searchQuery}
					class="w-full text-xs pl-9 pr-8 py-2 border border-border rounded-xl bg-background text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
				{#if searchQuery}
					<button
						type="button"
						onclick={() => searchQuery = ''}
						class="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
					>
						<X class="h-3 w-3" />
					</button>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Pending Registration Tab -->
	{#if activeTab === 'pending'}
		{#if loadingPending}
			<div class="bg-card border border-border rounded-2xl h-40 flex items-center justify-center"><RefreshCw class="h-7 w-7 text-primary animate-spin" /></div>
		{:else if pending.length === 0}
			<div class="bg-card border border-border rounded-2xl p-16 text-center text-muted-foreground text-xs">
				<ShieldCheck class="h-10 w-10 mx-auto mb-3 text-emerald-400 opacity-60" />
				No pending supplier registration requests.
			</div>
		{:else}
			<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
				<div class="px-5 py-4 border-b border-border/50 bg-amber-50/50">
					<h2 class="text-xs font-bold text-amber-800 flex items-center gap-1.5">
						<Clock class="h-3.5 w-3.5" /> Pending Supplier Registration Requests
					</h2>
				</div>
				<div class="divide-y divide-border/50">
					{#each pending as item}
						{@const p = JSON.parse(item.payloadJson) as SupplierPayload}
						<div class="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
							<div class="flex-1 space-y-2">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="font-bold text-sm text-foreground">{p.name}</span>
									<span class="font-mono text-[10px] bg-muted px-2 py-0.5 rounded-lg border border-border font-bold text-muted-foreground">{p.code}</span>
								</div>
								{#if p.categories.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each p.categories as cat}
											<span class="inline-flex items-center gap-1 text-[10px] bg-primary/5 text-primary border border-primary/10 px-2 py-0.5 rounded-full">
												<Tag class="h-2.5 w-2.5" />{cat}
											</span>
										{/each}
									</div>
								{/if}
								<div class="text-[10px] text-muted-foreground/60 flex items-center gap-1.5">
									<Clock class="h-3 w-3" />
									Submitted by <strong class="text-muted-foreground">{item.submittedByName}</strong> at
									<DateDisplay value={item.submittedAt} />
								</div>
							</div>
							{#if hasRole('master_accountant')}
								<div class="flex gap-2 shrink-0">
									<Button onclick={() => approveSupplier(item)} disabled={actioningId === item.id} class="rounded-xl h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer">
										{#if actioningId === item.id}<RefreshCw class="h-3 w-3 animate-spin" />{:else}<Check class="h-3 w-3" />{/if} Approve
									</Button>
									<Button variant="outline" onclick={() => rejectSupplier(item)} disabled={actioningId === item.id} class="rounded-xl h-8 text-xs font-semibold border-red-200 text-red-600 hover:bg-red-50 gap-1.5 cursor-pointer">
										<Trash2 class="h-3 w-3" /> Reject
									</Button>
								</div>
							{:else}
								<span class="text-[10px] text-amber-600 flex items-center gap-1 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl font-semibold">
									<Clock class="h-3 w-3" /> Awaiting Approval
								</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}

	<!-- Purchase Returns Tab -->
	{#if activeTab === 'purchase-returns'}
		<div class="flex items-center justify-between gap-3 mb-3">
			<div class="flex items-center gap-1.5 p-1 bg-muted/40 border border-border/60 rounded-xl text-xs">
				{#each (['all', 'pending', 'approved', 'rejected'] as const) as st}
					<button
						onclick={() => { prFilter = st; loadPendingPurchaseReturns(); }}
						class="px-2.5 py-1 rounded-lg font-semibold transition-all capitalize cursor-pointer {prFilter === st ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
					>
						{st}
					</button>
				{/each}
			</div>
			<span class="text-xs text-muted-foreground font-mono">{pendingPurchaseReturns.length} return(s)</span>
		</div>

		{#if loadingPurchaseReturns}
			<div class="bg-card border border-border rounded-2xl h-40 flex items-center justify-center"><RefreshCw class="h-7 w-7 text-primary animate-spin" /></div>
		{:else if pendingPurchaseReturns.length === 0}
			<div class="bg-card border border-border rounded-2xl p-16 text-center text-muted-foreground text-xs">
				<ShieldCheck class="h-10 w-10 mx-auto mb-3 text-emerald-400 opacity-60" />
				No purchase returns found for filter "{prFilter}".
			</div>
		{:else}
			<div class="bg-card border border-border rounded-2xl overflow-x-auto shadow-xs max-w-full">
				<table class="w-full min-w-[750px] text-left border-collapse text-xs">
					<thead>
						<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">
							<th class="p-4">Refund Info</th>
							<th class="p-4">Booking Ref</th>
							<th class="p-4 text-right">Amount</th>
							<th class="p-4">Details</th>
							<th class="p-4 text-center">Status / Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/50">
						{#each pendingPurchaseReturns as item}
							<tr class="hover:bg-muted/10">
								<td class="p-4 space-y-1">
									<div class="font-semibold text-foreground">Supplier #{item.supplierId}</div>
									<div class="text-[10px] text-muted-foreground flex items-center gap-1">
										<CornerDownRight class="h-3 w-3" /> Refund Dest: {item.destinationType?.toUpperCase()}
									</div>
								</td>
								<td class="p-4">
									{#if item.serviceType && item.originalPurchaseReference}
										<a href="/sales/bookings/{item.serviceType}/{item.originalPurchaseReference}" class="text-primary font-bold hover:underline flex items-center gap-1.5">
											{item.serviceType.toUpperCase()} #{item.originalPurchaseReference}
											<ArrowRight class="h-3 w-3" />
										</a>
									{:else}
										<span class="text-muted-foreground">—</span>
									{/if}
								</td>
								<td class="p-4 text-right font-mono font-bold text-emerald-600">
									<MoneyDisplay amount={item.amount} />
								</td>
								<td class="p-4 space-y-0.5">
									<div class="text-[10px] text-muted-foreground">{item.reason || 'No reason specified'}</div>
									<div class="text-[9px] text-muted-foreground/60">Requested at <DateDisplay value={item.createdAt} /></div>
								</td>
								<td class="p-4 text-center">
									{#if (item.status || '').toLowerCase() === 'pending'}
										{#if hasRole('accountant')}
											<div class="flex items-center justify-center gap-1.5">
												<Button onclick={() => handleApprovePurchaseReturn(item)} disabled={actioningId === item.id} class="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold gap-1 cursor-pointer">
													{#if actioningId === item.id}<RefreshCw class="h-3 w-3 animate-spin" />{:else}<Check class="h-3 w-3" />{/if} Approve
												</Button>
												<Button variant="outline" onclick={() => openRejectModal(item.id, 'purchase')} disabled={actioningId === item.id} class="h-7 px-2.5 rounded-lg border-red-200 text-red-600 hover:bg-red-50 text-[10px] font-bold gap-1 cursor-pointer">
													<Trash2 class="h-3 w-3" /> Reject
												</Button>
											</div>
										{:else}
											<span class="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg font-semibold inline-flex items-center justify-center gap-1">
												<Clock class="h-3 w-3" /> Pending
											</span>
										{/if}
									{:else if (item.status || '').toLowerCase() === 'approved'}
										<span class="text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg font-semibold inline-flex items-center justify-center gap-1">
											<Check class="h-3 w-3" /> Approved
										</span>
									{:else if (item.status || '').toLowerCase() === 'rejected'}
										<span class="text-[9px] text-rose-600 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg font-semibold inline-flex items-center justify-center gap-1">
											<X class="h-3 w-3" /> Rejected
										</span>
									{:else}
										<span class="text-[9px] text-muted-foreground uppercase">{item.status}</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}

	<!-- Sales Returns Tab -->
	{#if activeTab === 'sales-returns'}
		<div class="flex items-center justify-between gap-3 mb-3">
			<div class="flex items-center gap-1.5 p-1 bg-muted/40 border border-border/60 rounded-xl text-xs">
				{#each (['all', 'pending', 'approved', 'rejected'] as const) as st}
					<button
						onclick={() => { srFilter = st; loadPendingSalesReturns(); }}
						class="px-2.5 py-1 rounded-lg font-semibold transition-all capitalize cursor-pointer {srFilter === st ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
					>
						{st}
					</button>
				{/each}
			</div>
			<span class="text-xs text-muted-foreground font-mono">{pendingSalesReturns.length} return(s)</span>
		</div>

		{#if loadingSalesReturns}
			<div class="bg-card border border-border rounded-2xl h-40 flex items-center justify-center"><RefreshCw class="h-7 w-7 text-primary animate-spin" /></div>
		{:else if pendingSalesReturns.length === 0}
			<div class="bg-card border border-border rounded-2xl p-16 text-center text-muted-foreground text-xs">
				<ShieldCheck class="h-10 w-10 mx-auto mb-3 text-emerald-400 opacity-60" />
				No sales returns found for filter "{srFilter}".
			</div>
		{:else}
			<div class="bg-card border border-border rounded-2xl overflow-x-auto shadow-xs max-w-full">
				<table class="w-full min-w-[750px] text-left border-collapse text-xs">
					<thead>
						<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">
							<th class="p-4">Customer Refund Info</th>
							<th class="p-4">Booking Ref</th>
							<th class="p-4 text-right">Amount</th>
							<th class="p-4">Details</th>
							<th class="p-4 text-center">Status / Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/50">
						{#each pendingSalesReturns as item}
							<tr class="hover:bg-muted/10">
								<td class="p-4 space-y-1">
									<div class="font-semibold text-foreground">Recipient: {getRecipientLabel(item.recipientType, item.recipientId, item)}</div>
									<div class="text-[10px] text-muted-foreground flex items-center gap-1">
										<CornerDownRight class="h-3 w-3" /> Wallet balance adjustment requested
									</div>
								</td>
								<td class="p-4">
									{#if item.serviceType && item.originalSaleReference}
										<a href="/sales/bookings/{item.serviceType}/{item.originalSaleReference}" class="text-primary font-bold hover:underline flex items-center gap-1.5">
											{item.serviceType.toUpperCase()} #{item.originalSaleReference}
											<ArrowRight class="h-3 w-3" />
										</a>
									{:else}
										<span class="text-muted-foreground">—</span>
									{/if}
								</td>
								<td class="p-4 text-right font-mono font-bold text-rose-600">
									<MoneyDisplay amount={item.amount} />
								</td>
								<td class="p-4 space-y-0.5">
									<div class="text-[10px] text-muted-foreground">{item.reason || 'No reason specified'}</div>
									<div class="text-[9px] text-muted-foreground/60">Requested at <DateDisplay value={item.createdAt} /></div>
								</td>
								<td class="p-4 text-center">
									{#if (item.status || '').toLowerCase() === 'pending'}
										{#if hasRole('accountant')}
											<div class="flex items-center justify-center gap-1.5">
												<Button onclick={() => handleApproveSalesReturn(item)} disabled={actioningId === item.id} class="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold gap-1 cursor-pointer">
													{#if actioningId === item.id}<RefreshCw class="h-3 w-3 animate-spin" />{:else}<Check class="h-3 w-3" />{/if} Approve
												</Button>
												<Button variant="outline" onclick={() => openRejectModal(item.id, 'sales')} disabled={actioningId === item.id} class="h-7 px-2.5 rounded-lg border-red-200 text-red-600 hover:bg-red-50 text-[10px] font-bold gap-1 cursor-pointer">
													<Trash2 class="h-3 w-3" /> Reject
												</Button>
											</div>
										{:else}
											<span class="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg font-semibold inline-flex items-center justify-center gap-1">
												<Clock class="h-3 w-3" /> Pending
											</span>
										{/if}
									{:else if (item.status || '').toLowerCase() === 'approved'}
										<span class="text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg font-semibold inline-flex items-center justify-center gap-1">
											<Check class="h-3 w-3" /> Approved
										</span>
									{:else if (item.status || '').toLowerCase() === 'rejected'}
										<span class="text-[9px] text-rose-600 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg font-semibold inline-flex items-center justify-center gap-1">
											<X class="h-3 w-3" /> Rejected
										</span>
									{:else}
										<span class="text-[9px] text-muted-foreground uppercase">{item.status}</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}

	<!-- All suppliers tab -->
	{#if activeTab === 'list'}
		{#if isLoading}
			<div class="bg-card border border-border rounded-2xl h-64 flex items-center justify-center"><RefreshCw class="h-8 w-8 text-primary animate-spin" /></div>
		{:else if filteredSuppliers.length === 0}
			<div class="bg-card border border-border rounded-2xl p-16 text-center text-muted-foreground text-xs">
				{searchQuery ? `No suppliers matching "${searchQuery}".` : 'No registered suppliers found.'}
			</div>
		{:else}
			<div class="bg-card border border-border rounded-2xl overflow-x-auto shadow-xs max-w-full">
				<table class="w-full min-w-[750px] text-left border-collapse text-xs">
					<thead>
						<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">
							<th class="p-4 w-28">Code</th>
							<th class="p-4">Name</th>
							<th class="p-4">Categories</th>
							<th class="p-4 w-36 text-right">Wallet Balance</th>
							<th class="p-4 w-20 text-center">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/50">
						{#each filteredSuppliers as s}
							<tr class="hover:bg-muted/10 transition-colors">
								<td class="p-4 font-mono font-bold text-foreground">{s.code}</td>
								<td class="p-4 font-semibold text-foreground">{s.name}</td>
								<td class="p-4">
									<div class="flex flex-wrap gap-1">
										{#each s.categories as cat}
											<span class="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">{cat}</span>
										{:else}
											<span class="text-muted-foreground/40">—</span>
										{/each}
									</div>
								</td>
								<td class="p-4 text-right font-mono font-bold {s.wallet > 0 ? 'text-emerald-600' : s.wallet < 0 ? 'text-rose-500' : 'text-muted-foreground'}">
									{s.wallet > 0 ? '+' : ''}<MoneyDisplay amount={s.wallet} />
								</td>
								<td class="p-4 text-center">
									<div class="flex items-center justify-center gap-1.5">
										<button onclick={() => goto(`/suppliers/${s.id}`)} class="p-1.5 hover:bg-primary/10 text-primary rounded-lg transition-colors cursor-pointer" title="View wallet">
											<Wallet class="h-3.5 w-3.5" />
										</button>
										{#if hasRole('master_accountant')}
											<button onclick={() => startEdit(s)} class="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer" title="Edit supplier">
												<Pencil class="h-3.5 w-3.5" />
											</button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<div class="px-4 py-3 border-t border-border/50 text-[10px] text-muted-foreground bg-muted/10 flex items-center justify-between">
					<span>Showing <strong>{filteredSuppliers.length}</strong> of <strong>{suppliers.length}</strong> suppliers</span>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Rejection Reason Dialog Modal -->
{#if showRejectModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
		<div class="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
			<h3 class="text-sm font-bold text-foreground flex items-center gap-1.5 text-red-600">
				<MessageSquare class="h-4 w-4" /> Reject Request
			</h3>
			<p class="text-xs text-muted-foreground">Please provide a reason for rejecting this supplier request. This description will be logged for audits.</p>
			
			<div class="space-y-1.5">
				<label for="reject-reason" class="block font-semibold text-foreground text-xs">Reason for Rejection <span class="text-red-500">*</span></label>
				<Input id="reject-reason" type="text" bind:value={rejectReason} required placeholder="e.g. Insufficient verification, incorrect amount" />
			</div>

			<div class="flex justify-end gap-2.5 pt-3 border-t border-border/50 text-xs">
				<Button type="button" variant="outline" onclick={() => { showRejectModal = false; itemToReject = null; }} class="rounded-xl">Cancel</Button>
				<Button type="button" disabled={!rejectReason.trim()} onclick={submitRejection} class="rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold">
					Reject Transaction
				</Button>
			</div>
		</div>
	</div>
{/if}
