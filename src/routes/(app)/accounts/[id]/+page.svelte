<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { hasRole } from '$lib/stores/auth';
	import {
		getAccounts,
		toggleAccountStatus,
		correctAccountBalance
	} from '$features/cash-accounts/api';
	import type { AccountResponse } from '$features/cash-accounts/types';
	import { getTransactions } from '$features/financial-transactions/api';
	import type { TransactionResponse } from '$features/financial-transactions/types';
	import { ACCOUNT_TYPE_LABELS, LEDGER_TYPE_LABELS } from '$lib/types/financial';
	import { createIdempotentOperation } from '$lib/utils/idempotency';
	import { previewDocument } from '$lib/utils/preview-document';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import FinancialTableSkeleton from '$lib/components/financial/FinancialTableSkeleton.svelte';
	import FormattedNarrative from '$lib/components/financial/FormattedNarrative.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ConflictDialog from '$lib/components/ConflictDialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { addToast } from '$lib/stores/toast';
	import { formatDateOnly, getBahrainDateString, getBahrainPresetRanges } from '$lib/formatters/date';
	import {
		ArrowLeft,
		RefreshCw,
		Power,
		Plus,
		ShieldAlert,
		BarChart3,
		AlertCircle,
		Loader2,
		Landmark,
		FileSpreadsheet,
		FileDown,
		Receipt
	} from 'lucide-svelte';
	import { DateDisplay } from '$lib/components';

	const accountId = parseInt($page.params.id ?? '', 10);

	// States
	let account = $state<AccountResponse | null>(null);
	let transactions = $state<TransactionResponse[]>([]);
	let loadingAccount = $state(true);
	let loadingReport = $state(false);
	let errorMsg = $state<string | null>(null);
	let correlationId = $state('');

	const filteredTransactions = $derived.by(() => {
		let list = transactions;
		if (startDate) {
			const start = new Date(startDate + 'T00:00:00').getTime();
			list = list.filter(t => new Date(t.createdAt).getTime() >= start);
		}
		if (endDate) {
			const end = new Date(endDate + 'T23:59:59').getTime();
			list = list.filter(t => new Date(t.createdAt).getTime() <= end);
		}
		return list;
	});

	// Helper to calculate ledger rows dynamically based on the filtered transactions
	const statementRows = $derived.by(() => {
		const currentAccount = account;
		if (!currentAccount) return [];
		let bal = currentAccount.balance;
		const mapped = transactions.map(t => {
			const isDebit = t.destinationAccountId === currentAccount.id;
			const debit = isDebit ? t.amount : 0;
			const credit = !isDebit ? t.amount : 0;
			bal += (debit - credit);
			return { t, debit, credit, bal };
		});
		
		const filteredIds = new Set(filteredTransactions.map(x => x.id));
		return mapped.filter(row => filteredIds.has(row.t.id)).reverse();
	});

	// Date range selectors (defaults to current month)
	const { thisMonth } = getBahrainPresetRanges();
	const firstDay = thisMonth.startDate;
	const today = thisMonth.endDate;

	let startDate = $state(firstDay);
	let endDate = $state(today);

	// Balance correction modal state
	let correctionOpen = $state(false);
	let correctionAmount = $state('');
	let correctionReason = $state('');
	let correctionSubmitting = $state(false);
	let correctionError = $state<string | null>(null);
	let conflictDialogOpen = $state(false);

	// Idempotency manager for balance correction
	const correctionIdempotency = createIdempotentOperation();

	let abortController: AbortController | null = null;

	async function loadAccountDetail() {
		loadingAccount = true;
		errorMsg = null;
		correlationId = '';

		if (isNaN(accountId) || accountId <= 0) {
			errorMsg = 'Invalid account identifier.';
			loadingAccount = false;
			return;
		}

		try {
			// Workaround (GAP-004): Locate details by parsing full GET /api/account list
			const list = await getAccounts();
			const match = list.find((a) => a.id === accountId);
			if (match) {
				account = match;
				await loadAccountTransactions();
			} else {
				errorMsg = `Account #${accountId} was not found.`;
			}
		} catch (err: any) {
			errorMsg = err.message || 'Failed to fetch account details.';
			correlationId = err.correlationId || '';
		} finally {
			loadingAccount = false;
		}
	}

	async function loadAccountTransactions() {
		if (!account) return;
		loadingReport = true;
		try {
			if (abortController) {
				abortController.abort();
			}
			abortController = new AbortController();

			const res = await getTransactions({ accountId: account.id, pageSize: 1000 }, abortController.signal);
			transactions = res
				.filter(t => t.status.toLowerCase() === 'approved')
				.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
		} catch (err: any) {
			if (err.name === 'AbortError') return;
			addToast(
				err.message || 'Failed to load cash transaction history.',
				'error'
			);
		} finally {
			loadingReport = false;
		}
	}

	async function handleToggleStatus() {
		if (!account) return;
		if (!hasRole('master_accountant')) {
			addToast('Only a Master Accountant can toggle account status.', 'error');
			return;
		}

		try {
			await toggleAccountStatus(account.id);
			addToast(`Account status updated.`, 'success');
			loadAccountDetail();
		} catch (err: any) {
			addToast(err.message || 'Failed to toggle account status.', 'error');
		}
	}

	// Handle balance correction submission
	async function submitCorrection() {
		if (!account) return;
		if (!correctionAmount || isNaN(Number(correctionAmount))) {
			correctionError = 'Adjustment Amount must be a valid number.';
			return;
		}
		if (!correctionReason.trim()) {
			correctionError = 'Reason is required.';
			return;
		}

		correctionSubmitting = true;
		correctionError = null;

		try {
			await correctAccountBalance(
				account.id,
				{
					adjustmentAmount: Number(correctionAmount),
					reason: correctionReason
				},
				correctionIdempotency.key
			);

			addToast('Balance correction posted successfully.', 'success');
			correctionIdempotency.retire();
			correctionOpen = false;
			correctionAmount = '';
			correctionReason = '';
			// Reload view
			loadAccountDetail();
		} catch (err: any) {
			if (err.status === 409) {
				// Concurrency conflict
				conflictDialogOpen = true;
			} else {
				correctionError = err.message || 'Failed to post balance correction.';
			}
		} finally {
			correctionSubmitting = false;
		}
	}

	function handleFormEdit() {
		correctionIdempotency.regenerate();
		correctionError = null;
	}

	import { exportToCSV as downloadCSV } from '$lib/utils/csv-exporter';

	function handleExportCSV() {
		const currentAccount = account;
		const rowsData = statementRows;
		if (!currentAccount || rowsData.length === 0) return;
		const headers = ['ID', 'Date', 'Description', 'Debit (BHD)', 'Credit (BHD)', 'Reference'];
		
		const rows = rowsData.map((row) => [
			row.t.documentNumber,
			row.t.createdAt ? formatDateOnly(row.t.createdAt) : '',
			row.t.displayDescription || row.t.description || '',
			row.debit > 0 ? row.debit : '',
			row.credit > 0 ? row.credit : '',
			row.t.referenceId ? `${row.t.referenceType ?? ''} #${row.t.referenceId}` : ''
		]);
		
		const sanitizedName = currentAccount.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
		downloadCSV(`statement_${sanitizedName}_${getBahrainDateString()}.csv`, headers, rows);
		addToast('CSV statement exported successfully.', 'success');
	}

	function handleExportPDF() {
		const currentAccount = account;
		if (!currentAccount) return;
		previewDocument('report', 'account-statement', { accountId: currentAccount.id, startDate, endDate });
		addToast('Generating PDF statement...', 'info');
	}



	onMount(() => {
		loadAccountDetail();
	});

	onDestroy(() => {
		if (abortController) {
			abortController.abort();
		}
	});
</script>

<svelte:head>
	<title>Cash Account Detail — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Back navigation -->
	<button
		onclick={() => goto('/accounts')}
		class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
	>
		<ArrowLeft class="h-3.5 w-3.5" />
		<span>Back to Accounts</span>
	</button>

	{#if loadingAccount}
		<div class="animate-pulse space-y-6">
			<div class="h-10 w-2/3 bg-muted rounded-lg"></div>
			<div class="h-44 bg-muted rounded-2xl"></div>
			<div class="h-32 bg-muted rounded-2xl"></div>
		</div>
	{:else if errorMsg}
		<ErrorState message={errorMsg} {correlationId} retryAction={loadAccountDetail} />
	{:else if account}
		<!-- Summary Header Card -->
		<div
			class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-6 rounded-3xl shadow-xs"
		>
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<span class="text-lg font-bold text-foreground">{account.name}</span>
					<span
						class={[
							'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
							account.isActive
								? 'text-emerald-700 bg-emerald-50 border-emerald-200'
								: 'text-muted-foreground bg-muted border-border'
						].join(' ')}
					>
						{account.isActive ? 'Active' : 'Inactive'}
					</span>
				</div>
				<div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
					<span class="capitalize"
						>Type: {(ACCOUNT_TYPE_LABELS as any)[account.type] || account.type}</span
					>
					<span>•</span>
					<span class="capitalize"
						>Ledger: {(LEDGER_TYPE_LABELS as any)[account.ledgerType] ||
							account.ledgerType}</span
					>
					<span>•</span>
					<span>Created on <DateDisplay value={account.createdAt} /></span>
				</div>
			</div>

			<div class="flex flex-wrap gap-2">
				{#if hasRole('master_accountant')}
					<!-- Create Receipt -->
					<Button
						variant="outline"
						class="h-8.5 rounded-xl font-semibold text-xs cursor-pointer flex items-center gap-1"
						onclick={() => goto(`/sales/receipts/new?accountId=${account?.id}`)}
						title="Record receipt deposited to this cash drawer"
					>
						<Receipt class="h-3.5 w-3.5" />
						<span>New Receipt</span>
					</Button>

					<!-- Correct Balance -->
					<Button
						variant="outline"
						class="h-8.5 rounded-xl font-semibold text-xs cursor-pointer flex items-center gap-1"
						onclick={() => {
							correctionOpen = true;
							handleFormEdit();
						}}
					>
						<Plus class="h-3.5 w-3.5" />
						<span>Correct Balance</span>
					</Button>

					<!-- Toggle Status -->
					<Button
						variant="outline"
						class={[
							'h-8.5 rounded-xl font-semibold text-xs cursor-pointer flex items-center gap-1',
							account.isActive
								? 'text-red-600 hover:text-red-700 hover:bg-red-50'
								: 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
						].join(' ')}
						onclick={handleToggleStatus}
					>
						<Power class="h-3.5 w-3.5" />
						<span>{account.isActive ? 'Deactivate' : 'Activate'}</span>
					</Button>

					<Button
						variant="outline"
						class="h-8.5 rounded-xl font-semibold text-xs cursor-pointer"
						onclick={() => goto(`/accounts?edit=${account?.id}`)}
					>
						Edit Account
					</Button>
				{/if}
			</div>
		</div>

		<!-- Balance stats cards -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<div class="bg-card border border-border rounded-2xl p-5 shadow-xs">
				<span
					class="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1"
					>Opening/Book Balance</span
				>
				<span class="text-xl font-bold text-foreground">
					<MoneyDisplay amount={account.balance} />
				</span>
			</div>
			<div class="bg-card border border-border rounded-2xl p-5 shadow-xs bg-primary/5">
				<span class="text-xs font-bold text-primary uppercase tracking-wider block mb-1"
					>Authoritative Running Balance</span
				>
				<span class="text-2xl font-bold text-foreground">
					<MoneyDisplay amount={account.currentBalance} />
				</span>
			</div>
		</div>

		<!-- Cash Account Statement Section -->
		<div class="space-y-4">
			<div
				class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-3"
			>
				<h2
					class="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5"
				>
					<BarChart3 class="h-4.5 w-4.5 text-muted-foreground" />
					<span>Cash Account Statement</span>
				</h2>

				<!-- Date filtering form -->
				<div class="flex flex-wrap items-center gap-2 text-xs">
					{#if transactions.length > 0}
						<Button
							variant="outline"
							class="h-7.5 text-[11px] font-semibold rounded-lg flex items-center gap-1 cursor-pointer mr-1"
							onclick={handleExportCSV}
						>
							<FileSpreadsheet class="h-3.5 w-3.5" /> Export CSV
						</Button>
						<Button
							variant="outline"
							class="h-7.5 text-[11px] font-semibold rounded-lg flex items-center gap-1 cursor-pointer mr-3"
							onclick={handleExportPDF}
						>
							<FileDown class="h-3.5 w-3.5" /> Export PDF
						</Button>
					{/if}
					<input
						type="date"
						bind:value={startDate}
						disabled={loadingReport}
						class="p-1.5 rounded-lg border border-border bg-background focus:outline-none"
					/>
					<span class="text-muted-foreground">to</span>
					<input
						type="date"
						bind:value={endDate}
						disabled={loadingReport}
						class="p-1.5 rounded-lg border border-border bg-background focus:outline-none"
					/>
					<Button
						variant="outline"
						class="p-2 h-7.5 rounded-lg cursor-pointer"
						onclick={loadAccountTransactions}
						disabled={loadingReport}
					>
						<RefreshCw
							class={['h-3 w-3', loadingReport ? 'animate-spin' : ''].join(' ')}
						/>
					</Button>
				</div>
			</div>

			{#if loadingReport}
				<FinancialTableSkeleton rows={4} columns={7} />
			{:else if statementRows.length === 0}
				<EmptyState
					title="No transactions found"
					description="There are no entries recorded in the selected date range."
					icon={Landmark}
				/>
			{:else}
				<!-- Ledger Summary Info -->
				{@const summary = (() => {
					const rows = statementRows;
					const totalDebits = rows.reduce((sum: number, row: any) => sum + row.debit, 0);
					const totalCredits = rows.reduce((sum: number, row: any) => sum + row.credit, 0);
					const currentAccount = account;
					const opBal = currentAccount ? currentAccount.balance : 0;
					const edBal = currentAccount ? currentAccount.currentBalance : 0;
					return { opBal, totalDebits, totalCredits, edBal };
				})()}
				<div
					class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/15 p-4 rounded-2xl border border-border/50 text-xs"
				>
					<div>
						<span class="text-muted-foreground block">Opening Bal</span>
						<span class="font-bold"
							><MoneyDisplay amount={summary.opBal} /></span
						>
					</div>
					<div>
						<span class="text-primary block">Total Debits</span>
						<span class="font-bold text-emerald-600"
							><MoneyDisplay amount={summary.totalDebits} /></span
						>
					</div>
					<div>
						<span class="text-primary block">Total Credits</span>
						<span class="font-bold text-red-600"
							><MoneyDisplay amount={summary.totalCredits} /></span
						>
					</div>
					<div>
						<span class="text-muted-foreground block">Ending Bal</span>
						<span class="font-bold"
							><MoneyDisplay amount={summary.edBal} /></span
						>
					</div>
				</div>

				<!-- Ledger Postings Table -->
				<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
					<div class="overflow-x-auto">
						<table class="w-full text-left border-collapse text-xs">
							<thead>
								<tr
									class="bg-muted/30 border-b border-border text-muted-foreground font-semibold"
								>
									<th class="p-4 w-16">ID</th>
									<th class="p-4 w-28">Date</th>
									<th class="p-4">Description</th>
									<th class="p-4 w-28 text-right">Debit</th>
									<th class="p-4 w-28 text-right">Credit</th>
									<th class="p-4 w-32">Source Ref</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60">
								{#each statementRows as row (row.t.id)}
									<tr class="hover:bg-muted/10 transition-colors">
										<td class="p-4 font-mono font-medium text-muted-foreground">{row.t.documentNumber}</td>
										<td class="p-4 text-muted-foreground">
											{new Date(row.t.createdAt).toLocaleDateString()}
										</td>
										<td class="p-4 font-medium text-foreground">
											<FormattedNarrative text={row.t.displayNarrative || row.t.displayDescription || row.t.description} />
										</td>
										<td class="p-4 text-right font-semibold text-emerald-600">
											{#if row.debit > 0}
												<MoneyDisplay amount={row.debit} />
											{:else}
												<span class="text-muted-foreground/35">—</span>
											{/if}
										</td>
										<td class="p-4 text-right font-semibold text-red-600">
											{#if row.credit > 0}
												<MoneyDisplay amount={row.credit} />
											{:else}
												<span class="text-muted-foreground/35">—</span>
											{/if}
										</td>
										<td class="p-4">
											{#if row.t.referenceId}
												<span class="font-mono text-muted-foreground">{row.t.referenceId}</span>
												{#if row.t.referenceType}
													<span class="text-[9px] bg-muted px-1.5 py-0.2 rounded ml-1 uppercase">{row.t.referenceType}</span>
												{/if}
											{:else}
												<span class="text-muted-foreground/60">—</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- ================= BALANCE CORRECTION DIALOG ================= -->
{#if correctionOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="corr-title"
		aria-describedby="corr-desc"
	>
		<div
			class="w-full max-w-[480px] bg-card border border-border rounded-3xl p-6 shadow-xl flex flex-col gap-4 animate-scaleUp"
		>
			<div class="flex items-start gap-4">
				<div
					class="p-3 bg-amber-100 dark:bg-amber-950/20 text-amber-600 rounded-2xl shrink-0"
				>
					<ShieldAlert class="h-6 w-6" />
				</div>

				<div class="flex-1 min-w-0">
					<h2 id="corr-title" class="text-sm font-bold text-foreground leading-tight">
						Apply Balance Correction
					</h2>
					<p id="corr-desc" class="text-xs text-muted-foreground mt-2 leading-relaxed">
						This forces a direct adjustments write on the ledger account. Use this tool
						only to match external reconciliation audits.
					</p>
				</div>
			</div>

			<!-- Correction Input Fields -->
			<div class="space-y-3 text-xs">
				<div>
					<label for="adj-amt" class="block font-semibold text-muted-foreground mb-1.5"
						>Adjustment Amount (BHD)</label
					>
					<input
						id="adj-amt"
						type="number"
						step="0.001"
						placeholder="e.g. -50.000 or +120.000"
						bind:value={correctionAmount}
						oninput={handleFormEdit}
						class="w-full p-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground placeholder-muted-foreground/60 font-semibold"
						disabled={correctionSubmitting}
					/>
					<p class="text-[9px] text-muted-foreground/80 mt-1">
						Use negative values to debit, positive values to credit.
					</p>
				</div>

				<div>
					<label for="adj-reason" class="block font-semibold text-muted-foreground mb-1.5"
						>Audit Reason</label
					>
					<textarea
						id="adj-reason"
						rows="3"
						placeholder="Describe the reason for this correction posting..."
						bind:value={correctionReason}
						oninput={handleFormEdit}
						class="w-full p-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground placeholder-muted-foreground/60 resize-none leading-relaxed"
						disabled={correctionSubmitting}></textarea>
				</div>
			</div>

			{#if correctionError}
				<div
					class="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold leading-relaxed"
				>
					{correctionError}
				</div>
			{/if}

			<div class="flex items-center justify-end gap-2 mt-2">
				<Button
					variant="outline"
					onclick={() => {
						correctionOpen = false;
					}}
					disabled={correctionSubmitting}
					class="rounded-xl font-semibold text-xs py-5 px-4 cursor-pointer"
				>
					Cancel
				</Button>
				<Button
					onclick={submitCorrection}
					disabled={correctionSubmitting}
					class="rounded-xl font-semibold text-xs py-5 px-4 cursor-pointer"
				>
					{#if correctionSubmitting}
						<Loader2 class="h-3.5 w-3.5 animate-spin mr-1.5" />
						<span>Submitting...</span>
					{:else}
						<span>Correct Balance</span>
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}

<!-- Concurrency dialog -->
<ConflictDialog bind:open={conflictDialogOpen} onReload={loadAccountDetail} />
