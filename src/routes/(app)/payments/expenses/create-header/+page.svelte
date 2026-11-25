<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { apiFetch } from '$lib/api/api-client';
	import { hasRole } from '$lib/stores/auth';
	import { createExpenseHeader, getExpenseHeaders } from '$features/expenses/api';
	import type { ExpenseHeaderResponse } from '$features/expenses/types';
	import { Button } from '$lib/components/ui/button';
	import { addToast } from '$lib/stores/toast';
	import { formatDateOnly } from '$lib/formatters/date';
	import { ArrowLeft, Search, Layers, Clock, Check, X, AlertTriangle } from 'lucide-svelte';

	interface PendingHeader {
		id: number;
		entityType: string;
		payloadJson: string;
		submittedByName: string;
		submittedByUserId: number;
		submittedAt: string;
		status: string;
	}

	interface HeaderDisplayItem {
		id: number;
		name: string;
		category: string;
		description: string | null;
		createdAt: string;
		isPending: boolean;
		pendingId?: number;
		submittedByName?: string;
	}

	let name = $state('');
	let category = $state('Expenses');
	let description = $state('');
	let isSubmitting = $state(false);
	let isLoadingHeaders = $state(true);
	let approvingId = $state<number | null>(null);

	let headers = $state<ExpenseHeaderResponse[]>([]);
	let pendingList = $state<PendingHeader[]>([]);
	let searchVal = $state('');
	let bucketFilter = $state('all');

	const allDisplayHeaders = $derived(() => {
		const result: HeaderDisplayItem[] = [];

		// 1. Pending headers at top
		for (const p of pendingList) {
			try {
				const payload = JSON.parse(p.payloadJson);
				result.push({
					id: -p.id,
					name: payload.name || payload.Name || 'Unnamed Header',
					category: payload.category || payload.Category || 'Expenses',
					description: payload.description || payload.Description || null,
					createdAt: p.submittedAt,
					isPending: true,
					pendingId: p.id,
					submittedByName: p.submittedByName
				});
			} catch {
				// Ignore invalid JSON
			}
		}

		// 2. Active approved headers
		for (const h of headers) {
			result.push({
				id: h.id,
				name: h.name,
				category: h.category,
				description: h.description,
				createdAt: h.createdAt,
				isPending: false
			});
		}

		return result;
	});

	const filteredHeaders = $derived(() => {
		return allDisplayHeaders().filter((h) => {
			const matchesSearch =
				!searchVal.trim() ||
				h.name.toLowerCase().includes(searchVal.toLowerCase()) ||
				(h.description || '').toLowerCase().includes(searchVal.toLowerCase());
			const matchesBucket = bucketFilter === 'all' || h.category.toLowerCase() === bucketFilter.toLowerCase();
			return matchesSearch && matchesBucket;
		});
	});

	async function loadHeaders() {
		try {
			isLoadingHeaders = true;
			const [activeRes, pendingRes] = await Promise.all([
				getExpenseHeaders(),
				apiFetch<PendingHeader[]>('api/pending-approvals?status=pending').catch(() => [])
			]);

			headers = activeRes;
			pendingList = (pendingRes || []).filter(
				(p) => p.entityType === 'payment_header' || p.entityType === 'account_category' || p.entityType === 'expense_header'
			);
		} catch (err: any) {
			addToast(err.message || 'Failed to fetch existing headers.', 'error');
		} finally {
			isLoadingHeaders = false;
		}
	}

	async function approvePendingHeader(pendingId: number) {
		approvingId = pendingId;
		try {
			await apiFetch(`api/pending-approvals/${pendingId}/approve`, { method: 'POST' });
			addToast('Payment Category Header approved and registered successfully.', 'success');
			await loadHeaders();
		} catch (err: any) {
			addToast(err.message || 'Failed to approve category header.', 'error');
		} finally {
			approvingId = null;
		}
	}

	async function rejectPendingHeader(pendingId: number) {
		approvingId = pendingId;
		try {
			await apiFetch(`api/pending-approvals/${pendingId}/reject`, { method: 'POST' });
			addToast('Pending category header request rejected.', 'success');
			await loadHeaders();
		} catch (err: any) {
			addToast(err.message || 'Failed to reject request.', 'error');
		} finally {
			approvingId = null;
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!name.trim()) {
			addToast('Please enter a category name.', 'error');
			return;
		}

		isSubmitting = true;
		try {
			await createExpenseHeader({
				name: name.trim(),
				category,
				description: description.trim() ? description.trim() : null
			});

			addToast(`Payment Category '${name.trim()}' submitted / created successfully.`, 'success');
			name = '';
			description = '';
			await loadHeaders();
		} catch (err: any) {
			addToast(err.message || 'Failed to create expense category.', 'error');
		} finally {
			isSubmitting = false;
		}
	}

	onMount(() => {
		loadHeaders();
	});
</script>

<svelte:head>
	<title>Manage Expense Categories — Accounts Portal</title>
</svelte:head>

<div class="max-w-6xl mx-auto space-y-6">
	<!-- Top Navigation & Header -->
	<div class="space-y-2">
		<button
			onclick={() => goto('/payments')}
			class="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
		>
			<ArrowLeft class="h-3.5 w-3.5" />
			Back to Treasury Payments
		</button>
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-xl font-bold text-foreground">Expense Categories & Treasury Headers</h1>
				<p class="text-xs text-muted-foreground">
					Register and view classification headers for operational expenses, asset purchases, income receipts, and capital deposits.
				</p>
			</div>
			<div class="flex items-center gap-2">
				{#if pendingList.length > 0}
					<span class="px-3 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-xl text-xs font-semibold flex items-center gap-1">
						<Clock class="h-3.5 w-3.5" /> {pendingList.length} Pending Approval
					</span>
				{/if}
				<span class="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-semibold">
					{headers.length} Active Headers
				</span>
			</div>
		</div>
	</div>

	<!-- Notice Banner for Pending Items -->
	{#if pendingList.length > 0}
		<div class="flex items-start gap-3 bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 rounded-2xl px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
			<AlertTriangle class="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
			<div>
				<span class="font-bold">{pendingList.length} payment category {pendingList.length === 1 ? 'header request is' : 'header requests are'} awaiting Master Accountant approval.</span>
				<span class="ml-1 text-amber-700 dark:text-amber-400">
					{#if hasRole('master_accountant')}
						You can approve or reject them directly from the table below.
					{:else}
						Submitted headers will become active once approved by a Master Accountant.
					{/if}
				</span>
			</div>
		</div>
	{/if}

	<!-- Main Grid: Form on left/top, Table on right/bottom -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
		<!-- Form Card (4 Cols on LG) -->
		<form
			onsubmit={handleSubmit}
			class="lg:col-span-4 bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4 text-xs"
		>
			<div class="flex items-center gap-2 pb-2 border-b border-border">
				<Layers class="h-4 w-4 text-primary shrink-0" />
				<h2 class="font-bold text-foreground text-sm">
					{hasRole('master_accountant') ? 'Create New Category' : 'Submit Category Request'}
				</h2>
			</div>

			<!-- Category Name -->
			<div class="space-y-1.5">
				<label for="name" class="font-semibold text-muted-foreground">Category Name</label>
				<input
					id="name"
					type="text"
					required
					placeholder="e.g., Office Rent, Software Subscriptions"
					class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
					bind:value={name}
				/>
			</div>

			<!-- Accounting Bucket -->
			<div class="space-y-1.5">
				<label for="category" class="font-semibold text-muted-foreground">Accounting Bucket (Category)</label>
				<select
					id="category"
					class="h-10 w-full bg-background border border-border rounded-xl px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
					bind:value={category}
				>
					<option value="Expenses">Expenses (Operating Payout)</option>
					<option value="Asset">Asset (Asset Acquisition)</option>
					<option value="Liability">Liability (Debt / Settlement)</option>
					<option value="Income">Income (Incoming Receipt)</option>
					<option value="Capital">Capital (Owner Investment)</option>
				</select>
			</div>

			<!-- Description -->
			<div class="space-y-1.5">
				<label for="description" class="font-semibold text-muted-foreground">Description (Optional)</label>
				<textarea
					id="description"
					rows="3"
					placeholder="Describe what type of charges map to this header..."
					class="w-full bg-background border border-border rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground resize-y"
					bind:value={description}
				></textarea>
			</div>

			<!-- Action Buttons -->
			<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
				<Button
					variant="outline"
					class="rounded-xl px-4 py-4 font-semibold cursor-pointer text-xs"
					disabled={isSubmitting}
					onclick={() => goto('/payments')}
				>
					Done
				</Button>
				<Button
					type="submit"
					class="rounded-xl px-4 py-4 font-semibold cursor-pointer text-xs"
					disabled={isSubmitting}
				>
					{isSubmitting ? 'Submitting...' : hasRole('master_accountant') ? 'Create Header' : 'Submit for Approval'}
				</Button>
			</div>
		</form>

		<!-- Existing Headers Table Card (8 Cols on LG) -->
		<div class="lg:col-span-8 bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4 text-xs">
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border">
				<div>
					<h2 class="font-bold text-foreground text-sm">Category Headers & Pending Requests</h2>
					<p class="text-xs text-muted-foreground">List of active expense headers and pending approval requests</p>
				</div>

				<!-- Search & Filter Controls -->
				<div class="flex items-center gap-2 w-full sm:w-auto">
					<div class="relative flex-1 sm:w-48">
						<Search class="h-3.5 w-3.5 absolute left-2.5 top-3 text-muted-foreground" />
						<input
							type="text"
							placeholder="Search headers..."
							class="h-9 w-full bg-background border border-border rounded-xl pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
							bind:value={searchVal}
						/>
					</div>
					<select
						class="h-9 bg-background border border-border rounded-xl px-2 text-xs focus:outline-none"
						bind:value={bucketFilter}
					>
						<option value="all">All Buckets</option>
						<option value="Expenses">Expenses</option>
						<option value="Asset">Asset</option>
						<option value="Liability">Liability</option>
						<option value="Income">Income</option>
						<option value="Capital">Capital</option>
					</select>
				</div>
			</div>

			<!-- Table Body -->
			{#if isLoadingHeaders}
				<div class="py-12 text-center text-muted-foreground">
					Loading category headers...
				</div>
			{:else if filteredHeaders().length === 0}
				<div class="py-12 text-center text-muted-foreground space-y-1">
					<p class="font-semibold text-foreground">No category headers found</p>
					<p class="text-xs">No headers match your search criteria or none have been created yet.</p>
				</div>
			{:else}
				<div class="overflow-x-auto border border-border rounded-xl">
					<table class="w-full text-left border-collapse">
						<thead>
							<tr class="bg-muted/40 border-b border-border font-semibold text-muted-foreground">
								<th class="p-3 w-12 text-center">#</th>
								<th class="p-3">Category Name</th>
								<th class="p-3 w-28">Accounting Bucket</th>
								<th class="p-3">Description</th>
								<th class="p-3 w-32">Status / Date</th>
								{#if hasRole('master_accountant')}
									<th class="p-3 w-24 text-center">Actions</th>
								{/if}
							</tr>
						</thead>
						<tbody class="divide-y divide-border/60">
							{#each filteredHeaders() as h, idx (h.isPending ? `pending-${h.pendingId}` : `active-${h.id}`)}
								<tr class={h.isPending ? 'bg-amber-500/5 hover:bg-amber-500/10 transition-colors' : 'hover:bg-muted/10 transition-colors'}>
									<td class="p-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
									<td class="p-3">
										<div class="flex flex-col gap-0.5">
											<span class="font-bold text-foreground flex items-center gap-1.5">
												{h.name}
												{#if h.isPending}
													<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase tracking-wider flex items-center gap-1">
														<Clock class="h-2.5 w-2.5" /> Pending Approval
													</span>
												{/if}
											</span>
											{#if h.isPending && h.submittedByName}
												<span class="text-[10px] text-muted-foreground">
													Submitted by <span class="font-semibold text-foreground">{h.submittedByName}</span>
												</span>
											{/if}
										</div>
									</td>
									<td class="p-3">
										<span
											class={[
												'px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider',
												h.category === 'Expenses'
													? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
													: h.category === 'Asset'
														? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
														: h.category === 'Income'
															? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
															: h.category === 'Capital'
																? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
																: 'bg-rose-500/10 text-rose-600 border-rose-500/20'
											].join(' ')}
										>
											{h.category}
										</span>
									</td>
									<td class="p-3 text-muted-foreground truncate max-w-[200px]" title={h.description || 'N/A'}>
										{h.description || '—'}
									</td>
									<td class="p-3 text-muted-foreground font-mono text-[11px]">
										{h.createdAt ? formatDateOnly(h.createdAt) : '—'}
									</td>
									{#if hasRole('master_accountant')}
										<td class="p-3 text-center">
											{#if h.isPending && h.pendingId}
												<div class="flex items-center justify-center gap-1">
													<button
														onclick={() => approvePendingHeader(h.pendingId!)}
														disabled={approvingId === h.pendingId}
														class="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold cursor-pointer disabled:opacity-50"
														title="Approve Category Header"
													>
														<Check class="h-3.5 w-3.5" />
													</button>
													<button
														onclick={() => rejectPendingHeader(h.pendingId!)}
														disabled={approvingId === h.pendingId}
														class="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold cursor-pointer disabled:opacity-50"
														title="Reject Request"
													>
														<X class="h-3.5 w-3.5" />
													</button>
												</div>
											{:else}
												<span class="text-[10px] text-muted-foreground font-semibold">Active</span>
											{/if}
										</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
</div>
