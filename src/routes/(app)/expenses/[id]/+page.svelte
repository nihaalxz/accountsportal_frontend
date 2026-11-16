<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { hasRole } from '$lib/stores/auth';
	import {
		getExpenseById,
		submitExpense,
		approveExpense,
		rejectExpense,
		cancelExpense
	} from '$features/expenses/api';
	import { getChartOfAccountById } from '$features/chart-of-accounts/api';
	import { getAccounts } from '$features/cash-accounts/api';
	import { getBanks } from '$features/bank-accounts/api';
	import type { ExpenseResponse } from '$features/expenses/types';
	import type { ChartOfAccountResponse } from '$features/chart-of-accounts/types';
	import {
		canSubmitExpense,
		canApproveExpense,
		canRejectExpense,
		canCancelExpense,
		EXPENSE_STATUS_LABELS,
		PAYMENT_METHOD_LABELS
	} from '$features/expenses/types';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { Button } from '$lib/components/ui/button';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import { addToast } from '$lib/stores/toast';
	import { ArrowLeft, Check, X, Send, Calendar, User, FileText, Landmark } from 'lucide-svelte';

	const id = $page.params.id ? parseInt($page.params.id) : 0;

	let expense = $state<ExpenseResponse | null>(null);
	let category = $state<ChartOfAccountResponse | null>(null);
	let sourceAccountName = $state('');
	let sourceBankName = $state('');

	let loading = $state(true);
	let errorMsg = $state<string | null>(null);
	let correlationId = $state('');

	let showSubmitConfirm = $state(false);
	let showApproveConfirm = $state(false);
	let showRejectDialog = $state(false);
	let showCancelConfirm = $state(false);
	let isActionRunning = $state(false);

	let rejectReason = $state('');

	let abortController: AbortController | null = null;

	async function loadDetails() {
		if (abortController) abortController.abort();
		abortController = new AbortController();
		loading = true;
		errorMsg = null;

		try {
			const exp = await getExpenseById(id, abortController.signal);
			expense = exp;

			// Fetch category details
			try {
				category = await getChartOfAccountById(
					exp.expenseCategoryId,
					abortController.signal
				);
			} catch {
				category = null;
			}

			// Resolve payment source
			if (exp.sourceAccountId) {
				try {
					const cashAccs = await getAccounts(abortController.signal);
					const match = cashAccs.find((a) => a.id === exp.sourceAccountId);
					sourceAccountName = match ? match.name : `Cash Account #${exp.sourceAccountId}`;
				} catch {
					sourceAccountName = `Cash Account #${exp.sourceAccountId}`;
				}
			}

			if (exp.sourceBankId) {
				try {
					const bankAccs = await getBanks(abortController.signal);
					const match = bankAccs.find((b) => b.id === exp.sourceBankId);
					sourceBankName = match ? match.bankName : `Bank Account #${exp.sourceBankId}`;
				} catch {
					sourceBankName = `Bank Account #${exp.sourceBankId}`;
				}
			}
		} catch (err: any) {
			if (err.name === 'AbortError') return;
			errorMsg = err.message || 'Failed to load expense details.';
			correlationId = err.correlationId || '';
		} finally {
			loading = false;
		}
	}

	async function handleSubmit() {
		isActionRunning = true;
		try {
			await submitExpense(id);
			addToast('Expense claim submitted for approval successfully.', 'success');
			await loadDetails();
		} catch (err: any) {
			addToast(err.message || 'Failed to submit expense.', 'error');
		} finally {
			isActionRunning = false;
			showSubmitConfirm = false;
		}
	}

	async function handleApprove() {
		isActionRunning = true;
		try {
			await approveExpense(id);
			addToast('Expense claim approved and posted to General Ledger.', 'success');
			await loadDetails();
		} catch (err: any) {
			addToast(err.message || 'Failed to approve expense.', 'error');
		} finally {
			isActionRunning = false;
			showApproveConfirm = false;
		}
	}

	async function handleReject() {
		if (!rejectReason.trim()) {
			addToast('Please enter a rejection reason.', 'error');
			return;
		}

		isActionRunning = true;
		try {
			await rejectExpense(id, { reason: rejectReason.trim() });
			addToast('Expense claim rejected.', 'success');
			rejectReason = '';
			await loadDetails();
		} catch (err: any) {
			addToast(err.message || 'Failed to reject expense.', 'error');
		} finally {
			isActionRunning = false;
			showRejectDialog = false;
		}
	}

	async function handleCancel() {
		isActionRunning = true;
		try {
			await cancelExpense(id);
			addToast('Expense claim cancelled.', 'success');
			await loadDetails();
		} catch (err: any) {
			addToast(err.message || 'Failed to cancel expense.', 'error');
		} finally {
			isActionRunning = false;
			showCancelConfirm = false;
		}
	}

	onMount(() => {
		loadDetails();
		return () => {
			if (abortController) abortController.abort();
		};
	});
</script>

<svelte:head>
	<title>Expense Claim Details — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Top Navigation Bar -->
	<div class="flex items-center justify-between">
		<button
			onclick={() => goto('/expenses')}
			class="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
		>
			<ArrowLeft class="h-3.5 w-3.5" />
			Back to Expense Claims
		</button>

		<!-- Actions -->
		{#if expense}
			<div class="flex items-center gap-2">
				{#if hasRole('accountant')}
					{#if canSubmitExpense(expense.status)}
						<Button
							variant="outline"
							size="sm"
							class="rounded-xl text-xs py-4 cursor-pointer font-semibold"
							disabled={isActionRunning}
							onclick={() => (showSubmitConfirm = true)}
						>
							<Send class="h-3.5 w-3.5 mr-1" />
							Submit for Approval
						</Button>
					{/if}
					{#if canCancelExpense(expense.status)}
						<Button
							variant="outline"
							size="sm"
							class="rounded-xl text-xs py-4 cursor-pointer font-semibold text-rose-600 hover:bg-rose-50"
							disabled={isActionRunning}
							onclick={() => (showCancelConfirm = true)}
						>
							<X class="h-3.5 w-3.5 mr-1" />
							Cancel
						</Button>
					{/if}
				{/if}

				{#if hasRole('master_accountant')}
					{#if canApproveExpense(expense.status)}
						<Button
							variant="default"
							size="sm"
							class="rounded-xl text-xs py-4 cursor-pointer font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
							disabled={isActionRunning}
							onclick={() => (showApproveConfirm = true)}
						>
							<Check class="h-3.5 w-3.5 mr-1" />
							Approve
						</Button>
					{/if}
					{#if canRejectExpense(expense.status)}
						<Button
							variant="destructive"
							size="sm"
							class="rounded-xl text-xs py-4 cursor-pointer font-semibold"
							disabled={isActionRunning}
							onclick={() => (showRejectDialog = true)}
						>
							<X class="h-3.5 w-3.5 mr-1" />
							Reject
						</Button>
					{/if}
				{/if}
			</div>
		{/if}
	</div>

	<!-- Main details display -->
	{#if errorMsg}
		<ErrorState message={errorMsg} {correlationId} retryAction={loadDetails} />
	{:else}
		{#if loading || !expense}
			<div
				class="flex flex-col items-center justify-center min-h-[300px] bg-card border border-border rounded-2xl"
			>
				<Spinner class="h-8 w-8 text-primary" />
				<span class="text-xs text-muted-foreground mt-2">Loading expense details...</span>
			</div>
		{:else}
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<!-- Details card -->
				<div
					class="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6"
				>
					<div class="flex items-start justify-between border-b border-border pb-4">
						<div class="space-y-1">
							<span
								class="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded-md font-semibold"
							>
								Claim #{expense.expenseNumber}
							</span>
							<h2 class="text-lg font-bold text-foreground">{expense.description}</h2>
						</div>
						<span
							class={[
								'inline-flex items-center gap-1 font-semibold rounded-full border text-[10px] px-3 py-1 capitalize',
								expense.status === 'approved' || expense.status === 'posted'
									? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800'
									: expense.status === 'pendingapproval'
										? 'text-yellow-700 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-950/40 dark:border-yellow-800'
										: expense.status === 'rejected' ||
											  expense.status === 'cancelled' ||
											  expense.status === 'reversed'
											? 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/40 dark:border-rose-800'
											: 'text-muted-foreground bg-muted border-border'
							].join(' ')}
						>
							{EXPENSE_STATUS_LABELS[expense.status] || expense.status}
						</span>
					</div>

					<!-- Details Grid -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
						<div class="space-y-1">
							<span class="text-muted-foreground font-semibold">Expense Category</span
							>
							<p class="font-bold text-foreground">
								{category
									? `${category.code} - ${category.name}`
									: `Category ID #${expense.expenseCategoryId}`}
							</p>
						</div>
						<div class="space-y-1">
							<span class="text-muted-foreground font-semibold">Amount</span>
							<p class="font-bold text-lg text-foreground">
								<MoneyDisplay amount={expense.amount} />
							</p>
						</div>
						<div class="space-y-1">
							<span class="text-muted-foreground font-semibold">Payment Source</span>
							<p class="font-bold text-foreground">
								{#if expense.paymentMethod === 'cash'}
									Cash Point: {sourceAccountName || 'Unknown'}
								{:else if expense.paymentMethod === 'bank' || expense.paymentMethod === 'bank_transfer'}
									Bank Account: {sourceBankName || 'Unknown'}
								{:else}
									{PAYMENT_METHOD_LABELS[expense.paymentMethod] ||
										expense.paymentMethod}
								{/if}
							</p>
						</div>
						<div class="space-y-1">
							<span class="text-muted-foreground font-semibold">Expense Date</span>
							<p class="font-bold text-foreground">
								{new Date(expense.expenseDate).toLocaleDateString(undefined, {
									dateStyle: 'full'
								})}
							</p>
						</div>
					</div>

					{#if expense.notes}
						<div class="pt-4 border-t border-border space-y-1.5 text-xs">
							<span class="text-muted-foreground font-semibold"
								>Notes / Purpose Details</span
							>
							<p class="text-foreground leading-relaxed">{expense.notes}</p>
						</div>
					{/if}

					<!-- Post Reference IDs if posted to GL -->
					{#if expense.postedTransactionId || expense.postedJournalEntryId}
						<div class="pt-4 border-t border-border space-y-3 text-xs">
							<span class="text-muted-foreground font-semibold"
								>Automatic Post References</span
							>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
								{#if expense.postedTransactionId}
									<div
										class="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between"
									>
										<span class="font-medium text-muted-foreground"
											>General Ledger Posting</span
										>
										<a
											href={`/transactions/${expense.postedTransactionId}`}
											class="font-mono font-semibold text-primary hover:underline"
										>
											GL #{expense.postedTransactionId}
										</a>
									</div>
								{/if}
								{#if expense.postedJournalEntryId}
									<div
										class="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between"
									>
										<span class="font-medium text-muted-foreground"
											>Double-Entry Journal Reference</span
										>
										<a
											href={`/accounting/journals/${expense.postedJournalEntryId}`}
											class="font-mono font-semibold text-primary hover:underline"
										>
											Journal #{expense.postedJournalEntryId}
										</a>
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>

				<!-- Side card with workflows logs & details -->
				<div class="space-y-6 text-xs">
					<!-- Workflow History -->
					<div class="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
						<h3
							class="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
						>
							<Calendar class="h-4 w-4 text-primary" />
							Workflow Tracking
						</h3>

						<div class="space-y-3">
							<!-- Filing date -->
							<div class="flex items-center gap-3">
								<div
									class="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0"
								>
									<User class="h-4 w-4 text-muted-foreground" />
								</div>
								<div>
									<p class="font-semibold text-foreground">Filed By Accountant</p>
									<p class="text-[10px] text-muted-foreground">
										User ID: #{expense.createdBy} — {new Date(
											expense.createdAt
										).toLocaleString()}
									</p>
								</div>
							</div>

							<!-- Approval logs -->
							{#if expense.approvedBy}
								<div class="flex items-center gap-3">
									<div
										class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 dark:bg-emerald-950/40"
									>
										<Check
											class="h-4 w-4 text-emerald-600 dark:text-emerald-400"
										/>
									</div>
									<div>
										<p class="font-semibold text-foreground">
											Approved By Master
										</p>
										<p class="text-[10px] text-muted-foreground">
											User ID: #{expense.approvedBy} — {expense.approvedAt
												? new Date(expense.approvedAt).toLocaleString()
												: ''}
										</p>
									</div>
								</div>
							{/if}

							<!-- Rejection logs -->
							{#if expense.rejectedBy}
								<div class="flex items-center gap-3">
									<div
										class="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 dark:bg-rose-950/40"
									>
										<X class="h-4 w-4 text-rose-600 dark:text-rose-400" />
									</div>
									<div>
										<p class="font-semibold text-foreground">
											Rejected By Master
										</p>
										<p class="text-[10px] text-muted-foreground">
											User ID: #{expense.rejectedBy} — {expense.rejectedAt
												? new Date(expense.rejectedAt).toLocaleString()
												: ''}
										</p>
										{#if expense.rejectionReason}
											<div
												class="mt-1 p-2 bg-rose-50 border border-rose-100 text-rose-700 rounded-lg text-[10px] italic dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-400"
											>
												" {expense.rejectionReason} "
											</div>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					</div>

					<!-- Trace info -->
					<div class="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
						<h3
							class="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
						>
							<FileText class="h-4 w-4 text-primary" />
							Security Trace
						</h3>

						<div class="text-[11px] text-muted-foreground space-y-2">
							<div class="flex flex-col">
								<span>Correlation ID</span>
								<span class="font-mono font-semibold text-foreground break-all"
									>{expense.correlationId}</span
								>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Submit Confirmation -->
<ConfirmationDialog
	bind:open={showSubmitConfirm}
	title="Submit Expense Log?"
	message="Are you sure you want to submit this expense claim for approval? You will not be able to edit it afterward."
	confirmLabel="Yes, Submit Claim"
	onConfirm={handleSubmit}
/>

<!-- Approve Confirmation -->
<ConfirmationDialog
	bind:open={showApproveConfirm}
	title="Approve operational expense payout?"
	message={`Are you sure you want to approve this expense of ${expense?.amount.toFixed(3)} BHD? Approval automatically posts transaction ledger lines and balances Double-Entry general ledger entries.`}
	confirmLabel="Confirm Payout"
	onConfirm={handleApprove}
/>

<!-- Cancel Confirmation -->
<ConfirmationDialog
	bind:open={showCancelConfirm}
	title="Cancel operational expense claim?"
	message="Cancel this claim immediately? Canceled claims cannot be reopened."
	confirmLabel="Yes, Cancel"
	isDestructive={true}
	onConfirm={handleCancel}
/>

<!-- Reject Dialog with Reason input -->
{#if showRejectDialog}
	<div
		class="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
	>
		<div
			class="bg-card border border-border rounded-2xl shadow-lg w-full max-w-md p-6 space-y-4 text-xs animate-in fade-in zoom-in-95"
		>
			<div class="space-y-1.5">
				<h3 class="text-base font-bold text-foreground">Reject Expense Claim</h3>
				<p class="text-muted-foreground">
					Specify the audit rejection reason for the accountant who filed this operational
					expense.
				</p>
			</div>

			<div class="space-y-1.5">
				<label for="reject-reason" class="font-semibold text-muted-foreground"
					>Rejection Reason</label
				>
				<input
					id="reject-reason"
					type="text"
					required
					placeholder="e.g. Missing receipt attachment verification"
					class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
					bind:value={rejectReason}
				/>
			</div>

			<div class="flex items-center justify-end gap-2 pt-2">
				<Button
					variant="outline"
					class="rounded-xl px-4 py-4.5 cursor-pointer font-semibold"
					disabled={isActionRunning}
					onclick={() => {
						showRejectDialog = false;
						rejectReason = '';
					}}
				>
					Cancel
				</Button>
				<Button
					class="rounded-xl px-4 py-4.5 cursor-pointer font-semibold bg-rose-600 hover:bg-rose-700 text-white"
					disabled={isActionRunning || !rejectReason.trim()}
					onclick={handleReject}
				>
					{isActionRunning ? 'Rejecting...' : 'Reject Claim'}
				</Button>
			</div>
		</div>
	</div>
{/if}
