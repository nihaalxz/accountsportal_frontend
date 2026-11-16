<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createExpense } from '$features/expenses/api';
	import { getChartOfAccounts } from '$features/chart-of-accounts/api';
	import { getAccounts } from '$features/cash-accounts/api';
	import { getBanks } from '$features/bank-accounts/api';
	import type { ChartOfAccountResponse } from '$features/chart-of-accounts/types';
	import type { AccountResponse } from '$features/cash-accounts/types';
	import type { BankResponse } from '$features/bank-accounts/types';
	import type { ExpensePaymentMethod } from '$features/expenses/types';
	import { Button } from '$lib/components/ui/button';
	import { addToast } from '$lib/stores/toast';
	import { getBahrainDateString } from '$lib/formatters/date';
	import { ArrowLeft } from 'lucide-svelte';

	let expenseCategoryIdVal = $state('');
	let amount = $state<string>('');
	let description = $state('');
	let paymentMethod = $state<ExpensePaymentMethod>('cash');
	let sourceAccountIdVal = $state('');
	let sourceBankIdVal = $state('');
	let notes = $state('');
	let expenseDate = $state(getBahrainDateString());

	let categories = $state<ChartOfAccountResponse[]>([]);
	let cashAccounts = $state<AccountResponse[]>([]);
	let bankAccounts = $state<BankResponse[]>([]);
	let isSubmitting = $state(false);
	let isLoadingData = $state(true);

	async function loadDropdowns() {
		try {
			const [coaList, cashList, bankList] = await Promise.all([
				getChartOfAccounts(),
				getAccounts(),
				getBanks()
			]);
			// Filter categories to only include non-control Expense accounts
			categories = coaList.filter(
				(a) => a.accountType === 'expense' && !a.isControlAccount && a.isActive
			);
			cashAccounts = cashList.filter((a) => a.isActive);
			bankAccounts = bankList.filter((b) => b.isActive);
		} catch (err: any) {
			addToast(err.message || 'Failed to load form dropdown data.', 'error');
		} finally {
			isLoadingData = false;
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!expenseCategoryIdVal) {
			addToast('Please select an Expense Category.', 'error');
			return;
		}

		const parsedAmount = parseFloat(amount);
		if (isNaN(parsedAmount) || parsedAmount <= 0) {
			addToast('Amount must be a positive number.', 'error');
			return;
		}

		if (!description.trim()) {
			addToast('Please enter a description.', 'error');
			return;
		}

		if (paymentMethod === 'cash' && !sourceAccountIdVal) {
			addToast('Please select a Source Cash Account.', 'error');
			return;
		}

		if ((paymentMethod === 'bank' || paymentMethod === 'bank_transfer') && !sourceBankIdVal) {
			addToast('Please select a Source Bank Account.', 'error');
			return;
		}

		isSubmitting = true;
		try {
			const categoryId = parseInt(expenseCategoryIdVal);
			const sourceAccountId = paymentMethod === 'cash' ? parseInt(sourceAccountIdVal) : null;
			const sourceBankId =
				paymentMethod === 'bank' || paymentMethod === 'bank_transfer'
					? parseInt(sourceBankIdVal)
					: null;

			await createExpense({
				expenseCategoryId: categoryId,
				amount: parsedAmount,
				description: description.trim(),
				paymentMethod,
				sourceAccountId,
				sourceBankId,
				notes: notes.trim() ? notes.trim() : null,
				expenseDate: expenseDate || ''
			});

			addToast('Expense claim filed successfully.', 'success');
			goto('/expenses');
		} catch (err: any) {
			addToast(err.message || 'Failed to log expense claim.', 'error');
		} finally {
			isSubmitting = false;
		}
	}

	onMount(() => {
		loadDropdowns();
	});
</script>

<svelte:head>
	<title>Log Expense — Accounts Portal</title>
</svelte:head>

<div class="max-w-2xl mx-auto space-y-6">
	<!-- Header -->
	<div class="space-y-2">
		<button
			onclick={() => goto('/expenses')}
			class="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
		>
			<ArrowLeft class="h-3.5 w-3.5" />
			Back to Expense Claims
		</button>
		<h1 class="text-xl font-bold text-foreground">Log Operational Expense</h1>
		<p class="text-xs text-muted-foreground">
			File an operational expense log for approval and General Ledger posting.
		</p>
	</div>

	<!-- Form Card -->
	<form
		onsubmit={handleSubmit}
		class="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4 text-xs"
	>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<!-- Category selection -->
			<div class="space-y-1.5">
				<label for="expenseCategoryId" class="font-semibold text-muted-foreground"
					>Expense Category (Account)</label
				>
				<select
					id="expenseCategoryId"
					class="h-10 w-full bg-background border border-border rounded-xl px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground disabled:opacity-50"
					disabled={isLoadingData}
					bind:value={expenseCategoryIdVal}
				>
					<option value="">-- Select Expense Account --</option>
					{#each categories as cat}
						<option value={String(cat.id)}>{cat.code} — {cat.name}</option>
					{/each}
				</select>
			</div>

			<!-- Amount -->
			<div class="space-y-1.5">
				<label for="amount" class="font-semibold text-muted-foreground">Amount (BHD)</label>
				<input
					id="amount"
					type="number"
					step="0.001"
					min="0.001"
					required
					placeholder="0.000"
					class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
					bind:value={amount}
				/>
			</div>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<!-- Date selection -->
			<div class="space-y-1.5">
				<label for="expenseDate" class="font-semibold text-muted-foreground"
					>Expense Date</label
				>
				<input
					id="expenseDate"
					type="date"
					required
					class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
					bind:value={expenseDate}
				/>
			</div>

			<!-- Payment Method -->
			<div class="space-y-1.5">
				<label for="paymentMethod" class="font-semibold text-muted-foreground"
					>Payment Method</label
				>
				<select
					id="paymentMethod"
					class="h-10 w-full bg-background border border-border rounded-xl px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
					bind:value={paymentMethod}
				>
					<option value="cash">Cash Account</option>
					<option value="bank">Bank Account</option>
				</select>
			</div>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<!-- Conditional source Account selection -->
			{#if paymentMethod === 'cash'}
				<div class="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
					<label for="sourceAccountId" class="font-semibold text-muted-foreground"
						>Source Cash Account</label
					>
					<select
						id="sourceAccountId"
						class="h-10 w-full bg-background border border-border rounded-xl px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground disabled:opacity-50"
						disabled={isLoadingData}
						bind:value={sourceAccountIdVal}
					>
						<option value="">-- Select Source Cash Account --</option>
						{#each cashAccounts as acc}
							<option value={String(acc.id)}
								>{acc.name} (Bal: {acc.currentBalance.toFixed(3)} BHD)</option
							>
						{/each}
					</select>
				</div>
			{:else}
				<div class="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
					<label for="sourceBankId" class="font-semibold text-muted-foreground"
						>Source Bank Account</label
					>
					<select
						id="sourceBankId"
						class="h-10 w-full bg-background border border-border rounded-xl px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground disabled:opacity-50"
						disabled={isLoadingData}
						bind:value={sourceBankIdVal}
					>
						<option value="">-- Select Source Bank --</option>
						{#each bankAccounts as bank}
							<option value={String(bank.id)}
								>{bank.bankName} (Bal: {bank.currentBalance.toFixed(3)} BHD)</option
							>
						{/each}
					</select>
				</div>
			{/if}

			<!-- Description -->
			<div class="space-y-1.5">
				<label for="description" class="font-semibold text-muted-foreground"
					>Description / Purpose</label
				>
				<input
					id="description"
					type="text"
					required
					placeholder="e.g. Office stationery purchases"
					class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
					bind:value={description}
				/>
			</div>
		</div>

		<!-- Notes -->
		<div class="space-y-1.5">
			<label for="notes" class="font-semibold text-muted-foreground"
				>Notes / Internal Remarks (Optional)</label
			>
			<textarea
				id="notes"
				rows="2"
				placeholder="Add additional reconciliation references, receipts info..."
				class="w-full bg-background border border-border rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground resize-y"
				bind:value={notes}></textarea>
		</div>

		<!-- Action Buttons -->
		<div class="flex items-center justify-end gap-3 pt-4 border-t border-border">
			<Button
				variant="outline"
				class="rounded-xl px-5 py-4.5 font-semibold cursor-pointer"
				disabled={isSubmitting}
				onclick={() => goto('/expenses')}
			>
				Cancel
			</Button>
			<Button
				type="submit"
				class="rounded-xl px-5 py-4.5 font-semibold cursor-pointer"
				disabled={isSubmitting || isLoadingData}
			>
				{isSubmitting ? 'Posting...' : 'Log Expense'}
			</Button>
		</div>
	</form>
</div>
