<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { hasRole } from '$lib/stores/auth';
	import { getTransactionById } from '$features/financial-transactions/api';
	import type { TransactionResponse } from '$features/financial-transactions/types';
	import {
		getPaymentMethodLabel,
		getReferenceTypeLabel
	} from '$lib/types/financial';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import FinancialStatusBadge from '$lib/components/financial/FinancialStatusBadge.svelte';
	import TransactionTypeChip from '$lib/components/financial/TransactionTypeChip.svelte';
	import FormattedNarrative from '$lib/components/financial/FormattedNarrative.svelte';
	import TransactionApproveDialog from '$lib/components/TransactionApproveDialog.svelte';
	import TransactionRejectDialog from '$lib/components/TransactionRejectDialog.svelte';
	import ConflictDialog from '$lib/components/ConflictDialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { DateDisplay } from '$lib/components';
	import {
		ArrowLeft,
		Check,
		Ban,
		Receipt,
		User,
		ArrowRight,
		Building2,
		Wallet,
		ExternalLink,
		BookOpen,
		Scale,
		CheckCircle2,
		Clock,
		ShieldCheck,
		ChevronDown,
		ChevronUp,
		Copy
	} from 'lucide-svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { toast } from '$lib/stores/toast';

	const txId = parseInt($page.params.id ?? '', 10);

	let transaction = $state<TransactionResponse | null>(null);
	let loading = $state(true);
	let errorMsg = $state<string | null>(null);
	let correlationId = $state('');

	// Dialog controllers
	let approveDialogOpen = $state(false);
	let rejectDialogOpen = $state(false);
	let conflictDialogOpen = $state(false);

	let abortController: AbortController | null = null;

	// Derived GL Totals
	let totalDebits = $derived(
		transaction?.glPostings ? transaction.glPostings.reduce((sum, g) => sum + (g.debit || 0), 0) : 0
	);
	let totalCredits = $derived(
		transaction?.glPostings ? transaction.glPostings.reduce((sum, g) => sum + (g.credit || 0), 0) : 0
	);
	let isGlBalanced = $derived(
		transaction?.glPostings && transaction.glPostings.length > 0
			? Math.abs(totalDebits - totalCredits) < 0.0001
			: true
	);

	async function loadTransactionDetail() {
		loading = true;
		errorMsg = null;
		correlationId = '';

		if (isNaN(txId) || txId <= 0) {
			errorMsg = 'Invalid transaction reference ID.';
			loading = false;
			return;
		}

		if (abortController) {
			abortController.abort();
		}
		abortController = new AbortController();

		try {
			// Direct single-record API fetch
			const res = await getTransactionById(txId, abortController.signal);
			transaction = res;
		} catch (err: any) {
			if (err.name === 'AbortError') return;
			errorMsg = err.message || `Failed to fetch transaction #${txId} details.`;
			correlationId = err.correlationId || '';
		} finally {
			loading = false;
		}
	}

	function handleActionSuccess() {
		loadTransactionDetail();
	}

	function copyToClipboard(text: string, label: string) {
		navigator.clipboard.writeText(text);
		toast.success(`${label} copied to clipboard.`);
	}

	onMount(() => {
		loadTransactionDetail();
	});

	onDestroy(() => {
		if (abortController) {
			abortController.abort();
		}
	});
</script>

<svelte:head>
	<title>Transaction {transaction?.documentNumber || `TXSTRN${String(txId).padStart(6, '0')}`} — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Top Navigation Back Button -->
	<div class="flex items-center justify-between">
		<button
			onclick={() => goto('/transactions')}
			class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
		>
			<ArrowLeft class="h-3.5 w-3.5" />
			<span>Back to Transactions List</span>
		</button>

		{#if transaction}
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="xs"
					class="text-[11px] font-semibold flex items-center gap-1"
					onclick={() => copyToClipboard(transaction?.documentNumber || String(transaction?.id), 'Document Number')}
				>
					<Copy class="h-3 w-3" />
					<span>Copy Document Number</span>
				</Button>
			</div>
		{/if}
	</div>

	{#if loading}
		<div class="animate-pulse space-y-6">
			<div class="h-20 bg-card rounded-3xl border border-border"></div>
			<div class="h-44 bg-card rounded-3xl border border-border"></div>
			<div class="h-64 bg-card rounded-3xl border border-border"></div>
		</div>
	{:else if errorMsg}
		<ErrorState message={errorMsg} {correlationId} retryAction={loadTransactionDetail} />
	{:else if transaction}
		<!-- Section 1: Hero Header -->
		<div class="bg-card border border-border rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
			<div class="space-y-2">
				<div class="flex items-center gap-3">
					<h1 class="text-xl font-extrabold text-foreground">Transaction {transaction.documentNumber}</h1>
					<FinancialStatusBadge status={transaction.status} />
					<TransactionTypeChip type={transaction.transactionType} />
				</div>
				<p class="text-xs text-muted-foreground flex items-center gap-2">
					<span>Initiated by <strong class="text-foreground">{transaction.createdByName || `User #${transaction.createdBy}`}</strong></span>
					<span>•</span>
					<DateDisplay value={transaction.createdAt} showTime={true} />
				</p>
			</div>

			<div class="flex flex-col md:items-end gap-3">
				<div class="text-left md:text-right">
					<span class="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Total Amount</span>
					<span class="text-3xl font-extrabold font-mono text-foreground">
						<MoneyDisplay amount={transaction.amount} />
					</span>
				</div>

				{#if hasRole('master_accountant') && transaction.status === 'pending'}
					<div class="flex items-center gap-2">
						<Button
							variant="outline"
							class="rounded-xl text-xs py-4 px-3 cursor-pointer text-rose-600 hover:bg-rose-50 border-rose-200"
							onclick={() => (rejectDialogOpen = true)}
						>
							<Ban class="h-3.5 w-3.5 mr-1" />
							Reject
						</Button>
						<Button
							class="rounded-xl text-xs py-4 px-4 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
							onclick={() => (approveDialogOpen = true)}
						>
							<Check class="h-3.5 w-3.5 mr-1" />
							Approve Posting
						</Button>
					</div>
				{/if}
			</div>
		</div>

		<!-- Section 2: Financial Flow Visualizer -->
		<div class="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-xs">
			<h3 class="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/60 pb-2">
				Financial Flow Diagram
			</h3>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
				<!-- Source -->
				<div class="p-4 rounded-2xl border border-border bg-muted/20 space-y-2">
					<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Money Source</span>
					<div class="flex items-center gap-2">
						{#if transaction.sourceParty}
							<User class="h-5 w-5 text-primary shrink-0" />
							<div>
								<span class="font-bold text-sm block leading-tight">{transaction.sourceParty.name}</span>
								<span class="text-[10px] text-muted-foreground capitalize">{transaction.sourceParty.type}</span>
							</div>
						{:else if transaction.sourceBankName}
							<Building2 class="h-5 w-5 text-blue-500 shrink-0" />
							<div>
								<span class="font-bold text-sm block leading-tight">{transaction.sourceBankName}</span>
								<span class="text-[10px] text-muted-foreground">Bank Account</span>
							</div>
						{:else if transaction.sourceAccountName}
							<Wallet class="h-5 w-5 text-amber-500 shrink-0" />
							<div>
								<span class="font-bold text-sm block leading-tight">{transaction.sourceAccountName}</span>
								<span class="text-[10px] text-muted-foreground">Cash Account / Drawer</span>
							</div>
						{:else}
							<Wallet class="h-5 w-5 text-muted-foreground shrink-0" />
							<div>
								<span class="font-bold text-sm block leading-tight">Cash Drawer / Internal</span>
								<span class="text-[10px] text-muted-foreground">Primary Cash Holding</span>
							</div>
						{/if}
					</div>
				</div>

				<!-- Flow Arrow Badge -->
				<div class="flex flex-col items-center justify-center space-y-1 py-2">
					<div class="flex items-center gap-2 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
						<span><MoneyDisplay amount={transaction.amount} /></span>
						<ArrowRight class="h-4 w-4" />
					</div>
					<span class="text-[10px] text-muted-foreground uppercase font-semibold">
						Via {getPaymentMethodLabel(transaction.paymentMethod)}
					</span>
				</div>

				<!-- Destination -->
				<div class="p-4 rounded-2xl border border-border bg-muted/20 space-y-2">
					<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Money Destination</span>
					<div class="flex items-center gap-2">
						{#if transaction.destinationParty}
							<User class="h-5 w-5 text-emerald-500 shrink-0" />
							<div>
								<span class="font-bold text-sm block leading-tight">{transaction.destinationParty.name}</span>
								<span class="text-[10px] text-muted-foreground capitalize">{transaction.destinationParty.type}</span>
							</div>
						{:else if transaction.destinationBankName}
							<Building2 class="h-5 w-5 text-blue-500 shrink-0" />
							<div>
								<span class="font-bold text-sm block leading-tight">{transaction.destinationBankName}</span>
								<span class="text-[10px] text-muted-foreground">Bank Account</span>
							</div>
						{:else if transaction.destinationAccountName}
							<Wallet class="h-5 w-5 text-amber-500 shrink-0" />
							<div>
								<span class="font-bold text-sm block leading-tight">{transaction.destinationAccountName}</span>
								<span class="text-[10px] text-muted-foreground">Cash Account / Drawer</span>
							</div>
						{:else}
							<Wallet class="h-5 w-5 text-muted-foreground shrink-0" />
							<div>
								<span class="font-bold text-sm block leading-tight">Accounts Ledger</span>
								<span class="text-[10px] text-muted-foreground">General Ledger Account</span>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Section 3: Highlighted Transaction Narrative -->
		<div class="bg-primary/5 border border-primary/20 rounded-3xl p-6 space-y-2">
			<span class="text-[10px] font-bold text-primary uppercase tracking-wider block">Human-Readable Narrative</span>
			<p class="text-base font-semibold text-foreground leading-relaxed">
				<FormattedNarrative text={transaction.displayNarrative || transaction.description || 'No narrative description generated.'} />
			</p>
		</div>

		<!-- Section 4 & 5 Grid: Party Info & Reference Details -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<!-- Party & Counterparties -->
			<div class="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-xs">
				<h3 class="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/60 pb-2">
					Party & Counterparties
				</h3>

				<div class="space-y-3 text-xs">
					{#if transaction.displayRecipientName || transaction.recipientName || transaction.recipientId}
						<div class="flex justify-between items-center py-1 border-b border-border/40">
							<span class="text-muted-foreground font-medium">Recipient ({transaction.recipientType || 'Party'})</span>
							<span class="font-bold text-foreground">{transaction.displayRecipientName || transaction.recipientName}</span>
						</div>
					{/if}

					{#if transaction.supplierName || transaction.supplierId}
						<div class="flex justify-between items-center py-1 border-b border-border/40">
							<span class="text-muted-foreground font-medium">Supplier</span>
							<span class="font-bold text-foreground">{transaction.supplierName || `ID #${transaction.supplierId}`}</span>
						</div>
					{/if}

					<div class="flex justify-between items-center py-1 border-b border-border/40">
						<span class="text-muted-foreground font-medium">Initiated By</span>
						<span class="font-bold text-foreground">{transaction.createdByName || `User #${transaction.createdBy}`}</span>
					</div>

					{#if transaction.approvedByName || transaction.approvedBy}
						<div class="flex justify-between items-center py-1 border-b border-border/40">
							<span class="text-muted-foreground font-medium">Approved By</span>
							<span class="font-bold text-emerald-600 dark:text-emerald-400">{transaction.approvedByName || `User #${transaction.approvedBy}`}</span>
						</div>
					{/if}

					{#if transaction.rejectedByName || transaction.rejectedBy}
						<div class="flex justify-between items-center py-1 border-b border-border/40">
							<span class="text-muted-foreground font-medium">Rejected By</span>
							<span class="font-bold text-rose-600 dark:text-rose-400">{transaction.rejectedByName || `User #${transaction.rejectedBy}`}</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- Reference Record -->
			<div class="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-xs">
				<h3 class="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/60 pb-2">
					Originating Business Record
				</h3>

				<div class="space-y-3 text-xs">
					<div class="flex justify-between items-center py-1 border-b border-border/40">
						<span class="text-muted-foreground font-medium">Reference Type</span>
						<span class="font-semibold uppercase">{transaction.referenceType ? getReferenceTypeLabel(transaction.referenceType) : '—'}</span>
					</div>

					<div class="flex justify-between items-center py-1 border-b border-border/40">
						<span class="text-muted-foreground font-medium">Reference ID</span>
						<span class="font-mono font-bold">{transaction.referenceId || '—'}</span>
					</div>

					{#if transaction.referenceUrl}
						<div class="pt-2">
							<a
							href={transaction.referenceUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
						>
								<ExternalLink class="h-3.5 w-3.5" />
								<span>Open Originating Record ({transaction.referenceDisplayName})</span>
							</a>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Section 6: General Ledger Impact Table (Only rendered when GL postings exist) -->
		{#if transaction.glPostings && transaction.glPostings.length > 0}
			<div class="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-xs">
				<div class="flex items-center justify-between border-b border-border/60 pb-3">
					<div class="flex items-center gap-2">
						<BookOpen class="h-4 w-4 text-primary" />
						<h3 class="text-xs font-bold text-muted-foreground uppercase tracking-wider">
							General Ledger Posting Impact
						</h3>
					</div>

					<div class="flex items-center gap-2 text-xs">
						<Scale class="h-4 w-4 {isGlBalanced ? 'text-emerald-500' : 'text-rose-500'}" />
						<span class="font-semibold {isGlBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
							{isGlBalanced ? 'Balanced (Total Debit = Total Credit)' : 'Unbalanced Posting Warning'}
						</span>
					</div>
				</div>

				<div class="overflow-x-auto">
					<table class="w-full text-left border-collapse text-xs">
						<thead>
							<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold uppercase text-[10px]">
								<th class="p-3">Account Code</th>
								<th class="p-3">Account Name</th>
								<th class="p-3">Entry Type</th>
								<th class="p-3">Line Description</th>
								<th class="p-3 text-right">Debit</th>
								<th class="p-3 text-right">Credit</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/60">
							{#each transaction.glPostings as gl}
								<tr class="hover:bg-muted/10 transition-colors font-medium">
									<td class="p-3 font-mono font-bold">{gl.accountCode}</td>
									<td class="p-3 text-foreground font-semibold">{gl.accountName}</td>
									<td class="p-3">
										<span class="px-2 py-0.5 rounded text-[10px] font-semibold uppercase {gl.debit > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'}">
											{gl.entryType}
										</span>
									</td>
									<td class="p-3 text-muted-foreground text-[11px]">{gl.description || transaction.description || '—'}</td>
									<td class="p-3 text-right font-mono font-semibold">
										{#if gl.debit > 0}
											<MoneyDisplay amount={gl.debit} />
										{:else}
											<span class="text-muted-foreground/40">—</span>
										{/if}
									</td>
									<td class="p-3 text-right font-mono font-semibold">
										{#if gl.credit > 0}
											<MoneyDisplay amount={gl.credit} />
										{:else}
											<span class="text-muted-foreground/40">—</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr class="border-t-2 border-border font-bold bg-muted/20 text-xs">
								<td colspan="4" class="p-3 text-right uppercase tracking-wider text-muted-foreground">Totals</td>
								<td class="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
									<MoneyDisplay amount={totalDebits} />
								</td>
								<td class="p-3 text-right font-mono text-blue-600 dark:text-blue-400">
									<MoneyDisplay amount={totalCredits} />
								</td>
							</tr>
						</tfoot>
					</table>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Modal Dialogs -->
<TransactionApproveDialog
	transactionId={txId}
	bind:open={approveDialogOpen}
	onConfirm={handleActionSuccess}
/>

<TransactionRejectDialog
	transactionId={txId}
	bind:open={rejectDialogOpen}
	onConfirm={handleActionSuccess}
/>

<ConflictDialog bind:open={conflictDialogOpen} onReload={handleActionSuccess} />
