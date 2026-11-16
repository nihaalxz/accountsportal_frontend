<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { hasRole, currentUser } from '$lib/stores/auth';
	import { apiFetch } from '$lib/api/api-client';
	import { getBanks, toggleBankStatus, createBank, updateBank } from '$features/bank-accounts/api';
	import type { BankResponse } from '$features/bank-accounts/types';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import FinancialTableSkeleton from '$lib/components/financial/FinancialTableSkeleton.svelte';
	import FinancialCardSkeleton from '$lib/components/financial/FinancialCardSkeleton.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { Button } from '$lib/components/ui/button';
	import { addToast } from '$lib/stores/toast';
	import { Landmark, Power, Pencil, Clock, Check, X, Plus, AlertTriangle, Loader2, RefreshCw } from 'lucide-svelte';

	// ── Types ──────────────────────────────────────────────────────────────────
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

	interface BankPayload {
		bankName: string;
		accountNumber: string;
		openingBalance: number;
	}

	// ── State ──────────────────────────────────────────────────────────────────
	let banks = $state<BankResponse[]>([]);
	let pending = $state<PendingItem[]>([]);
	let loading = $state(true);
	let loadingPending = $state(false);
	let errorMsg = $state<string | null>(null);
	let correlationId = $state('');
	let activeTab = $state<'list' | 'pending'>('list');
	let approvingId = $state<number | null>(null);

	// Safe UI Account Number Masking (last 4 digits visible)
	function maskAccountNumber(num: string): string {
		if (!num) return '—';
		const clean = num.trim();
		if (clean.length <= 4) return clean;
		return '•'.repeat(clean.length - 4) + ' ' + clean.slice(-4);
	}

	// ── Load Banks ─────────────────────────────────────────────────────────────
	async function loadBanks() {
		loading = true;
		errorMsg = null;
		correlationId = '';
		try {
			const res = await getBanks();
			banks = res;
		} catch (err: any) {
			errorMsg = err.message || 'Failed to load bank accounts.';
			correlationId = err.correlationId || '';
		} finally {
			loading = false;
		}
	}

	// ── Load Pending ───────────────────────────────────────────────────────────
	async function loadPending() {
		loadingPending = true;
		try {
			pending =
				(await apiFetch<PendingItem[]>('api/pending-approvals?entityType=bank&status=pending')) ||
				[];
		} catch (err: any) {
			addToast(err.message || 'Failed to load pending requests.', 'error');
		} finally {
			loadingPending = false;
		}
	}

	// ── Toggle Status ──────────────────────────────────────────────────────────
	async function handleToggleStatus(bank: BankResponse, e: Event) {
		e.stopPropagation();
		if (!hasRole('master_accountant')) {
			addToast('Only a Master Accountant can toggle bank account status.', 'error');
			return;
		}
		try {
			await toggleBankStatus(bank.id);
			addToast(`Bank account status toggled successfully.`, 'success');
			loadBanks();
		} catch (err: any) {
			addToast(err.message || 'Failed to toggle bank status.', 'error');
		}
	}

	// ── Approve / Reject ───────────────────────────────────────────────────────
	async function approveBank(item: PendingItem) {
		approvingId = item.id;
		try {
			await apiFetch(`api/pending-approvals/${item.id}/approve`, { method: 'POST' });
			addToast('Bank account approved and registered.', 'success');
			await Promise.all([loadBanks(), loadPending()]);
		} catch (err: any) {
			addToast(err.message || 'Approval failed.', 'error');
		} finally {
			approvingId = null;
		}
	}

	async function rejectBank(item: PendingItem) {
		approvingId = item.id;
		try {
			await apiFetch(`api/pending-approvals/${item.id}/reject`, { method: 'POST' });
			addToast('Request rejected.', 'success');
			await loadPending();
		} catch (err: any) {
			addToast(err.message || 'Rejection failed.', 'error');
		} finally {
			approvingId = null;
		}
	}

	function getParsedPayload(item: PendingItem): BankPayload | null {
		try {
			return JSON.parse(item.payloadJson);
		} catch {
			return null;
		}
	}

	// Form state
	let showForm = $state(false);
	let isEditing = $state(false);
	let editingId = $state<number | null>(null);
	let isSaving = $state(false);

	// Form fields
	let bankName = $state('');
	let accountNumber = $state('');
	let openingBalance = $state('');
	let validationErrors = $state<Record<string, string>>({});

	function validate(): boolean {
		const errors: Record<string, string> = {};
		if (!bankName.trim()) {
			errors.bankName = 'Bank Name is required.';
		}
		if (!accountNumber.trim()) {
			errors.accountNumber = 'Account Number is required.';
		}
		if (!isEditing && (openingBalance === '' || isNaN(Number(openingBalance)) || Number(openingBalance) < 0)) {
			errors.openingBalance = 'Opening Balance must be a valid positive number.';
		}
		validationErrors = errors;
		return Object.keys(errors).length === 0;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!validate()) return;

		isSaving = true;
		const isMaster = hasRole('master_accountant');

		try {
			if (isEditing && editingId !== null) {
				await updateBank(editingId, {
					bankName: bankName.trim(),
					accountNumber: accountNumber.trim()
				});
				addToast(`Bank account changes saved successfully.`, 'success');
				resetForm();
				await loadBanks();
			} else if (isMaster) {
				await createBank({
					bankName: bankName.trim(),
					accountNumber: accountNumber.trim(),
					openingBalance: Number(openingBalance)
				});
				addToast(`Bank account "${bankName}" registered successfully.`, 'success');
				resetForm();
				await loadBanks();
			} else {
				const payload = {
					bankName: bankName.trim(),
					accountNumber: accountNumber.trim(),
					openingBalance: Number(openingBalance)
				};
				await apiFetch('api/pending-approvals', {
					method: 'POST',
					body: JSON.stringify({
						entityType: 'bank',
						payloadJson: JSON.stringify(payload),
						submittedByName: $currentUser?.name ?? 'Accountant'
					})
				});
				addToast(`Bank account registration submitted for master accountant approval.`, 'success');
				resetForm();
				await loadPending();
			}
		} catch (err: any) {
			const message =
				err.status === 409
					? 'This Account Number is already registered with another bank profile.'
					: err.message || 'Failed to save bank account.';
			addToast(message, 'error');
		} finally {
			isSaving = false;
		}
	}

	function startEdit(b: BankResponse) {
		isEditing = true;
		editingId = b.id;
		showForm = true;
		bankName = b.bankName;
		accountNumber = b.accountNumber;
		openingBalance = '';
		validationErrors = {};
	}

	function resetForm() {
		showForm = false;
		isEditing = false;
		editingId = null;
		bankName = '';
		accountNumber = '';
		openingBalance = '';
		validationErrors = {};
	}

	onMount(async () => {
		await loadBanks();
		await loadPending();

		// Handle query parameters for edit or new
		const editIdStr = $page.url.searchParams.get('edit');
		if (editIdStr) {
			const editId = parseInt(editIdStr, 10);
			const match = banks.find((b) => b.id === editId);
			if (match && hasRole('master_accountant')) {
				startEdit(match);
			}
		} else if ($page.url.searchParams.get('new') === 'true') {
			showForm = true;
		}
	});
</script>

<svelte:head>
	<title>Bank Accounts — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Title / Action bar -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-bold text-foreground flex items-center gap-2">
				<Landmark class="h-5 w-5 text-primary" /> Bank Accounts
			</h1>
			<p class="text-xs text-muted-foreground">
				Review external bank deposits, reconcile treasury ledgers, and manage bank mappings.
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button
				onclick={() => { showForm = !showForm; if (!showForm) resetForm(); }}
				class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
			>
				{#if showForm}
					<X class="h-3.5 w-3.5" /> Cancel
				{:else}
					<Plus class="h-3.5 w-3.5" />
					{hasRole('master_accountant') ? 'Register Bank Account' : 'Submit Bank Request'}
				{/if}
			</Button>
			<Button
				variant="outline"
				class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
				onclick={() => { loadBanks(); loadPending(); }}
				disabled={loading}
			>
				<RefreshCw class="h-3.5 w-3.5 {loading ? 'animate-spin' : ''}" /> Reload
			</Button>
		</div>
	</div>

	<!-- Pending notice for normal accountant -->
	{#if !hasRole('master_accountant') && pending.length > 0}
		<div class="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-xs text-amber-800 animate-scaleUp">
			<Clock class="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
			<div>
				<span class="font-bold">{pending.length} bank {pending.length === 1 ? 'request' : 'requests'} awaiting master accountant approval.</span>
				<span class="text-amber-700 ml-1">These will be registered once approved.</span>
			</div>
		</div>
	{/if}

	<!-- Inline Create/Edit Form -->
	{#if showForm}
		<div class="bg-card border border-border rounded-2xl p-6 shadow-xs animate-scaleUp">
			<h2 class="text-sm font-bold text-foreground mb-1">
				{#if isEditing}Editing Bank Account — {bankName}
				{:else if hasRole('master_accountant')}Register New Bank Account
				{:else}Submit Bank Registration Request{/if}
			</h2>
			{#if !isEditing && !hasRole('master_accountant')}
				<p class="text-[11px] text-amber-600 flex items-center gap-1.5 mb-5">
					<AlertTriangle class="h-3.5 w-3.5 shrink-0" />
					Your request will be stored in the database and needs master accountant approval before the bank account is registered.
				</p>
			{:else}
				<div class="mb-5"></div>
			{/if}
			<form onsubmit={handleSubmit}>
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
					<div class="space-y-1.5">
						<label for="b-name" class="block font-semibold text-foreground">Bank Name <span class="text-red-500">*</span></label>
						<input
							id="b-name"
							type="text"
							placeholder="e.g. National Bank of Bahrain"
							bind:value={bankName}
							class="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring text-foreground placeholder-muted-foreground/60 font-semibold"
							disabled={isSaving}
						/>
						{#if validationErrors.bankName}
							<p class="text-[10px] text-red-600 mt-1">{validationErrors.bankName}</p>
						{/if}
					</div>
					<div class="space-y-1.5">
						<label for="b-acc" class="block font-semibold text-foreground">
							Account Number <span class="text-red-500">*</span>
							{#if isEditing}<span class="text-muted-foreground font-normal">(read-only)</span>{/if}
						</label>
						<input
							id="b-acc"
							type="text"
							placeholder="e.g. 100200300400"
							bind:value={accountNumber}
							class="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring text-foreground placeholder-muted-foreground/60 font-mono font-semibold"
							disabled={isEditing || isSaving}
						/>
						{#if validationErrors.accountNumber}
							<p class="text-[10px] text-red-600 mt-1">{validationErrors.accountNumber}</p>
						{/if}
					</div>
					{#if !isEditing}
						<div class="space-y-1.5">
							<label for="b-bal" class="block font-semibold text-foreground">Opening/Book Balance (BHD) <span class="text-red-500">*</span></label>
							<input
								id="b-bal"
								type="number"
								step="0.001"
								placeholder="0.000"
								bind:value={openingBalance}
								class="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring text-foreground placeholder-muted-foreground/60 font-semibold"
								disabled={isSaving}
							/>
							{#if validationErrors.openingBalance}
								<p class="text-[10px] text-red-600 mt-1">{validationErrors.openingBalance}</p>
							{/if}
						</div>
					{/if}
				</div>
				<div class="flex gap-2.5 mt-5 pt-4 border-t border-border/50">
					<Button type="submit" disabled={isSaving || !bankName.trim() || !accountNumber.trim()} class="rounded-xl font-semibold text-xs px-5 h-8.5 cursor-pointer">
						{#if isSaving}<Loader2 class="h-3.5 w-3.5 mr-1.5 animate-spin" />{/if}
						{#if isEditing}Save Changes{:else if hasRole('master_accountant')}Register Bank{:else}Submit for Approval{/if}
					</Button>
					<Button type="button" variant="outline" onclick={resetForm} class="rounded-xl text-xs h-8.5 cursor-pointer">Cancel</Button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Tabs -->
	{#if hasRole('master_accountant') || pending.length > 0}
		<div class="flex gap-1 bg-muted/40 rounded-xl p-1 w-fit border border-border/50">
			<button
				class={[
					'px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer',
					activeTab === 'list'
						? 'bg-card text-foreground shadow-sm border border-border/30'
						: 'text-muted-foreground hover:text-foreground'
				].join(' ')}
				onclick={() => (activeTab = 'list')}
			>
				All Banks ({banks.length})
			</button>
			<button
				class={[
					'px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5',
					activeTab === 'pending'
						? 'bg-card text-foreground shadow-sm border border-border/30'
						: 'text-muted-foreground hover:text-foreground'
				].join(' ')}
				onclick={() => { activeTab = 'pending'; loadPending(); }}
			>
				<Clock class="h-3.5 w-3.5" />
				Pending Approvals
				{#if pending.length > 0}
					<span
						class="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold"
					>
						{pending.length}
					</span>
				{/if}
			</button>
		</div>
	{/if}

	<!-- ── Pending Approvals Tab ─────────────────────────────────────────────── -->
	{#if activeTab === 'pending'}
		{#if loadingPending}
			<div class="flex items-center justify-center h-32 text-muted-foreground text-xs gap-2">
				<span class="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></span>
				Loading pending requests...
			</div>
		{:else if pending.length === 0}
			<EmptyState
				title="No pending bank registrations"
				description="All bank account requests have been reviewed."
				icon={Clock}
			/>
		{:else}
			<div class="space-y-3">
				{#each pending as item (item.id)}
					{@const p = getParsedPayload(item)}
					<div
						class="bg-card border border-amber-200 dark:border-amber-800 rounded-2xl p-4 space-y-3"
					>
						<div class="flex items-start justify-between gap-4">
							<div class="space-y-1">
								<div class="flex items-center gap-2">
									<span
										class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-semibold border border-amber-200 dark:border-amber-700"
									>
										<Clock class="h-2.5 w-2.5" /> Pending
									</span>
									<span class="text-xs text-muted-foreground">#{item.id}</span>
								</div>
								<p class="text-sm font-bold text-foreground">{p?.bankName ?? '—'}</p>
								<p class="text-xs font-mono text-muted-foreground">{p?.accountNumber ?? '—'}</p>
								<p class="text-xs text-muted-foreground">
									Opening Balance: <span class="font-semibold text-foreground"
										>{p?.openingBalance?.toFixed(3) ?? '—'} BHD</span
									>
								</p>
								<p class="text-[11px] text-muted-foreground">
									Submitted by <span class="font-semibold">{item.submittedByName}</span> ·
									{new Date(item.submittedAt).toLocaleDateString()}
								</p>
							</div>
							<div class="flex gap-2 shrink-0">
								{#if hasRole('master_accountant')}
									<button
										onclick={() => approveBank(item)}
										disabled={approvingId === item.id}
										class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold cursor-pointer disabled:opacity-50"
									>
										<Check class="h-3.5 w-3.5" />
										Approve
									</button>
									<button
										onclick={() => rejectBank(item)}
										disabled={approvingId === item.id}
										class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold cursor-pointer disabled:opacity-50"
									>
										<X class="h-3.5 w-3.5" />
										Reject
									</button>
								{:else}
									<span class="text-[10px] text-amber-600 flex items-center gap-1 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl font-semibold">
										<Clock class="h-3 w-3" /> Awaiting Approval
									</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}

	<!-- ── Banks List Tab ────────────────────────────────────────────────────── -->
	{:else}
		{#if errorMsg}
			<ErrorState message={errorMsg} {correlationId} retryAction={loadBanks} />
		{:else}
			{#if loading}
				<!-- Skeleton layout -->
				<div class="hidden md:block bg-card border border-border rounded-2xl overflow-hidden">
					<FinancialTableSkeleton rows={4} columns={5} />
				</div>
				<div class="block md:hidden">
					<FinancialCardSkeleton count={2} />
				</div>
			{:else if banks.length === 0}
				<EmptyState
					title="No bank profiles registered"
					description="There are no active or inactive bank accounts mapped in this system."
					icon={Landmark}
				/>
			{:else}
				<!-- Desktop Table View -->
				<div class="bg-card border border-border rounded-2xl overflow-x-auto shadow-xs max-w-full">
					<div class="overflow-x-auto">
						<table class="w-full min-w-[700px] text-left border-collapse text-xs">
							<thead>
								<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">
									<th class="p-4 w-16">ID</th>
									<th class="p-4">Bank Name</th>
									<th class="p-4">Account Number</th>
									<th class="p-4 text-right">Current Balance</th>
									<th class="p-4 w-24">Status</th>
									{#if hasRole('master_accountant')}
										<th class="p-4 w-20 text-center">Actions</th>
									{/if}
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60">
								{#each banks as b (b.id)}
									<tr
										class="hover:bg-muted/10 transition-colors cursor-pointer"
										onclick={() => goto(`/banks/${b.id}`)}
									>
										<td class="p-4 font-mono font-medium text-muted-foreground">#{b.id}</td>
										<td class="p-4 font-semibold text-foreground">{b.bankName}</td>
										<td class="p-4 font-mono tracking-wider">{b.accountNumber}</td>
										<td class="p-4 text-right font-bold text-foreground">
											<MoneyDisplay amount={b.currentBalance} />
										</td>
										<td class="p-4">
											<span
												class={[
													'inline-flex items-center gap-1 font-semibold rounded-full border text-[10px] px-2 py-0.5',
													b.isActive
														? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800'
														: 'text-muted-foreground bg-muted border-border'
												].join(' ')}
											>
												{b.isActive ? 'Active' : 'Inactive'}
											</span>
										</td>
										{#if hasRole('master_accountant')}
											<td
												class="p-4 text-center"
												onclick={(e) => e.stopPropagation()}
											>
												<div class="flex items-center justify-center gap-1.5">
													<button
														onclick={() => startEdit(b)}
														class="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
														title="Edit Bank"
													>
														<Pencil class="h-3.5 w-3.5" />
													</button>
													<button
														onclick={(e) => handleToggleStatus(b, e)}
														class={[
															'p-1.5 rounded-lg border cursor-pointer',
															b.isActive
																? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
																: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
														].join(' ')}
														title={b.isActive ? 'Deactivate' : 'Activate'}
													>
														<Power class="h-3.5 w-3.5" />
													</button>
												</div>
											</td>
										{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<div class="px-4 py-3 border-t border-border/50 text-[10px] text-muted-foreground bg-muted/10">
						Showing <strong>{banks.length}</strong> bank profiles
					</div>
				</div>

				<!-- Mobile List (Cards) -->
				<div class="block md:hidden space-y-3">
					{#each banks as b (b.id)}
						<a
							href={`/banks/${b.id}`}
							class="block bg-card border border-border rounded-2xl p-4 space-y-3 hover:border-primary/40 active:bg-muted/5 transition-all text-left"
						>
							<div class="flex items-center justify-between">
								<span class="font-bold text-foreground">{b.bankName}</span>
								<span class="font-mono text-xs">{b.accountNumber}</span>
							</div>
							<div class="flex items-center justify-between text-xs pt-1 border-t border-border/40">
								<span class="text-muted-foreground">Current Balance:</span>
								<span class="font-bold text-foreground">
									<MoneyDisplay amount={b.currentBalance} />
								</span>
							</div>
							<div class="flex items-center justify-between pt-1">
								<span class="text-[10px] text-muted-foreground">ID: #{b.id}</span>
								<div class="flex items-center gap-2">
									<span
										class={[
											'text-[9px] font-semibold px-2 py-0.5 rounded-full border',
											b.isActive
												? 'text-emerald-700 bg-emerald-50 border-emerald-200'
												: 'text-muted-foreground bg-muted border-border'
										].join(' ')}
									>
										{b.isActive ? 'Active' : 'Inactive'}
									</span>
									{#if hasRole('master_accountant')}
										<button
											onclick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												startEdit(b);
											}}
											class="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
										>
											<Pencil class="h-3.5 w-3.5" />
										</button>
										<button
											onclick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												handleToggleStatus(b, e);
											}}
											class={[
												'p-1.5 rounded-lg border cursor-pointer',
												b.isActive
													? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
													: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
											].join(' ')}
										>
											<Power class="h-3.5 w-3.5" />
										</button>
									{/if}
								</div>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</div>
