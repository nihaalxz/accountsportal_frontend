<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getAccounts } from '$features/cash-accounts/api';
	import { getBanks } from '$features/bank-accounts/api';
	import type { AccountResponse } from '$features/cash-accounts/types';
	import type { BankResponse } from '$features/bank-accounts/types';
	import {
		createIncomingTransaction,
		createOutgoingTransaction,
		createContraTransaction
	} from '$features/financial-transactions/api';
	import { createIdempotentOperation } from '$lib/utils/idempotency';
	import {
		PAYMENT_METHOD_VALUES,
		PAYMENT_METHOD_LABELS,
		REFERENCE_TYPE_VALUES,
		REFERENCE_TYPE_LABELS
	} from '$lib/types/financial';
	import { addToast } from '$lib/stores/toast';
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft, Loader2 } from 'lucide-svelte';

	// Accounts & Banks selection list
	let accounts = $state<AccountResponse[]>([]);
	let banks = $state<BankResponse[]>([]);
	let loadingLists = $state(true);

	// Tab state: 'contra'
	let activeTab = $state<'contra'>('contra');

	// Common submission states
	let submitting = $state(false);
	let validationErrors = $state<Record<string, string>>({});

	// Idempotency operation container
	const idempotentOp = createIdempotentOperation();

	// --- Form Fields ---

	// Incoming Flow Form
	let incomingForm = $state({
		destinationType: 'account' as 'account' | 'bank',
		destinationAccountId: '' as string | number,
		destinationBankId: '' as string | number,
		amount: '' as string | number,
		paymentMethod: 'cash',
		referenceType: '' as string,
		referenceId: '',
		description: ''
	});

	// Outgoing Flow Form
	let outgoingForm = $state({
		sourceType: 'account' as 'account' | 'bank',
		sourceAccountId: '' as string | number,
		sourceBankId: '' as string | number,
		amount: '' as string | number,
		paymentMethod: 'cash',
		referenceType: '' as string,
		referenceId: '',
		description: '',
		supplierId: '' as string | number,
		supplierName: ''
	});

	// Contra Flow Form
	let contraForm = $state({
		sourceType: 'account' as 'account' | 'bank',
		sourceAccountId: '' as string | number,
		sourceBankId: '' as string | number,
		destinationType: 'account' as 'account' | 'bank',
		destinationAccountId: '' as string | number,
		destinationBankId: '' as string | number,
		amount: '' as string | number,
		description: ''
	});

	onMount(async () => {
		try {
			const [accountsRes, banksRes] = await Promise.all([getAccounts(), getBanks()]);
			accounts = accountsRes.filter((a: AccountResponse) => a.isActive);
			banks = banksRes.filter((b: BankResponse) => b.isActive);
		} catch (err: any) {
			addToast('Failed to load accounts and bank references.', 'error');
		} finally {
			loadingLists = false;
		}
	});

	// Whenever user changes form fields/inputs, regenerate the idempotency key to prevent accidental key re-use on edit
	function handleFormEdit() {
		idempotentOp.regenerate();
		validationErrors = {};
	}

	// --- Validations ---

	function validateIncoming(): boolean {
		const errors: Record<string, string> = {};
		if (incomingForm.destinationType === 'account' && !incomingForm.destinationAccountId) {
			errors.destinationAccountId = 'Destination Cash Account is required.';
		}
		if (incomingForm.destinationType === 'bank' && !incomingForm.destinationBankId) {
			errors.destinationBankId = 'Destination Bank Account is required.';
		}
		const numAmt = Number(incomingForm.amount);
		if (isNaN(numAmt) || numAmt <= 0) {
			errors.amount = 'Amount must be greater than zero.';
		}
		if (!incomingForm.paymentMethod) {
			errors.paymentMethod = 'Payment Method is required.';
		}
		validationErrors = errors;
		return Object.keys(errors).length === 0;
	}

	function validateOutgoing(): boolean {
		const errors: Record<string, string> = {};
		if (outgoingForm.sourceType === 'account' && !outgoingForm.sourceAccountId) {
			errors.sourceAccountId = 'Source Cash Account is required.';
		}
		if (outgoingForm.sourceType === 'bank' && !outgoingForm.sourceBankId) {
			errors.sourceBankId = 'Source Bank Account is required.';
		}
		const numAmt = Number(outgoingForm.amount);
		if (isNaN(numAmt) || numAmt <= 0) {
			errors.amount = 'Amount must be greater than zero.';
		}
		if (!outgoingForm.paymentMethod) {
			errors.paymentMethod = 'Payment Method is required.';
		}
		validationErrors = errors;
		return Object.keys(errors).length === 0;
	}

	function validateContra(): boolean {
		const errors: Record<string, string> = {};
		if (contraForm.sourceType === 'account' && !contraForm.sourceAccountId) {
			errors.sourceAccountId = 'Source Cash Account is required.';
		}
		if (contraForm.sourceType === 'bank' && !contraForm.sourceBankId) {
			errors.sourceBankId = 'Source Bank Account is required.';
		}
		if (contraForm.destinationType === 'account' && !contraForm.destinationAccountId) {
			errors.destinationAccountId = 'Destination Cash Account is required.';
		}
		if (contraForm.destinationType === 'bank' && !contraForm.destinationBankId) {
			errors.destinationBankId = 'Destination Bank Account is required.';
		}
		const numAmt = Number(contraForm.amount);
		if (isNaN(numAmt) || numAmt <= 0) {
			errors.amount = 'Amount must be greater than zero.';
		}

		// Prevent contra transfers between exact same account/bank
		if (
			contraForm.sourceType === contraForm.destinationType &&
			(contraForm.sourceType === 'account'
				? contraForm.sourceAccountId === contraForm.destinationAccountId
				: contraForm.sourceBankId === contraForm.destinationBankId)
		) {
			errors.destinationAccountId =
				'Source and Destination cannot be the exact same account.';
		}

		validationErrors = errors;
		return Object.keys(errors).length === 0;
	}

	// --- Submissions ---

	async function submitIncoming() {
		if (!validateIncoming()) return;
		submitting = true;

		try {
			const payload = {
				destinationAccountId:
					incomingForm.destinationType === 'account'
						? Number(incomingForm.destinationAccountId)
						: null,
				destinationBankId:
					incomingForm.destinationType === 'bank'
						? Number(incomingForm.destinationBankId)
						: null,
				amount: Number(incomingForm.amount),
				paymentMethod: incomingForm.paymentMethod,
				referenceType: incomingForm.referenceType || null,
				referenceId: incomingForm.referenceId || null,
				description: incomingForm.description || null
			};

			await createIncomingTransaction(payload, idempotentOp.key);
			addToast('Incoming transaction posted successfully.', 'success');
			idempotentOp.retire();
			goto('/transactions');
		} catch (err: any) {
			addToast(err.message || 'Failed to post incoming transaction.', 'error');
		} finally {
			submitting = false;
		}
	}

	async function submitOutgoing() {
		if (!validateOutgoing()) return;
		submitting = true;

		try {
			const payload = {
				sourceAccountId:
					outgoingForm.sourceType === 'account'
						? Number(outgoingForm.sourceAccountId)
						: null,
				sourceBankId:
					outgoingForm.sourceType === 'bank' ? Number(outgoingForm.sourceBankId) : null,
				amount: Number(outgoingForm.amount),
				paymentMethod: outgoingForm.paymentMethod,
				referenceType: outgoingForm.referenceType || null,
				referenceId: outgoingForm.referenceId || null,
				description: outgoingForm.description || null,
				supplierId: outgoingForm.supplierId ? Number(outgoingForm.supplierId) : null,
				supplierName: outgoingForm.supplierName || null
			};

			await createOutgoingTransaction(payload, idempotentOp.key);
			addToast('Outgoing transaction posted successfully.', 'success');
			idempotentOp.retire();
			goto('/transactions');
		} catch (err: any) {
			addToast(err.message || 'Failed to post outgoing transaction.', 'error');
		} finally {
			submitting = false;
		}
	}

	async function submitContra() {
		if (!validateContra()) return;
		submitting = true;

		try {
			const payload = {
				sourceAccountId:
					contraForm.sourceType === 'account' ? Number(contraForm.sourceAccountId) : null,
				sourceBankId:
					contraForm.sourceType === 'bank' ? Number(contraForm.sourceBankId) : null,
				destinationAccountId:
					contraForm.destinationType === 'account'
						? Number(contraForm.destinationAccountId)
						: null,
				destinationBankId:
					contraForm.destinationType === 'bank'
						? Number(contraForm.destinationBankId)
						: null,
				amount: Number(contraForm.amount),
				description: contraForm.description || null
			};

			await createContraTransaction(payload, idempotentOp.key);
			addToast('Contra transfer posted successfully.', 'success');
			idempotentOp.retire();
			goto('/transactions');
		} catch (err: any) {
			addToast(err.message || 'Failed to post contra transfer.', 'error');
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>New Transaction Posting — Accounts Portal</title>
</svelte:head>

<div class="space-y-6 max-w-2xl">
	<!-- Back button -->
	<button
		onclick={() => goto('/transactions')}
		class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
	>
		<ArrowLeft class="h-3.5 w-3.5" />
		<span>Back to Transactions</span>
	</button>

	<div class="flex flex-col gap-1">
		<h1 class="text-xl font-bold text-foreground">Post New Transaction</h1>
		<p class="text-xs text-muted-foreground">
			Post incoming/outgoing flows or transfer internal balances (contra). Guarded with
			idempotent safety checks.
		</p>
	</div>



	{#if loadingLists}
		<div
			class="flex flex-col items-center justify-center p-12 gap-3 bg-card border border-border rounded-3xl"
		>
			<Loader2 class="h-6 w-6 animate-spin text-primary" />
			<span class="text-xs text-muted-foreground font-semibold"
				>Loading ledger accounts...</span
			>
		</div>
	{:else}
		<!-- Content Card -->
		<div class="bg-card border border-border p-6 rounded-3xl shadow-xs">
				<!-- ================= CONTRA TRANSFER FORM ================= -->
				{#if activeTab === 'contra'}
				<form
					onsubmit={(e) => {
						e.preventDefault();
						submitContra();
					}}
					class="space-y-4 text-xs"
				>
					<!-- SOURCE SELECT -->
					<div class="border border-border p-4 rounded-2xl bg-muted/10 space-y-4">
						<h3
							class="font-bold text-muted-foreground uppercase tracking-wider text-[10px] pb-1 border-b border-border/50"
						>
							Source Funding account
						</h3>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<span class="block font-semibold text-muted-foreground mb-1.5"
									>Source Type</span
								>
								<div class="flex gap-2 bg-muted/30 p-1 rounded-xl">
									<button
										type="button"
										class={[
											'flex-1 py-2 text-center rounded-lg font-semibold transition-all cursor-pointer',
											contraForm.sourceType === 'account'
												? 'bg-card text-foreground shadow-xs'
												: 'text-muted-foreground hover:text-foreground'
										].join(' ')}
										onclick={() => {
											contraForm.sourceType = 'account';
											handleFormEdit();
										}}
									>
										Cash Account
									</button>
									<button
										type="button"
										class={[
											'flex-1 py-2 text-center rounded-lg font-semibold transition-all cursor-pointer',
											contraForm.sourceType === 'bank'
												? 'bg-card text-foreground shadow-xs'
												: 'text-muted-foreground hover:text-foreground'
										].join(' ')}
										onclick={() => {
											contraForm.sourceType = 'bank';
											handleFormEdit();
										}}
									>
										Bank Account
									</button>
								</div>
							</div>

							{#if contraForm.sourceType === 'account'}
								<div>
									<label
										for="contra-src-acc"
										class="block font-semibold text-muted-foreground mb-1.5"
										>Cash Account</label
									>
									<select
										id="contra-src-acc"
										bind:value={contraForm.sourceAccountId}
										onchange={handleFormEdit}
										class="w-full p-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
									>
										<option value="">Select Account</option>
										{#each accounts as a}
											<option value={a.id}
												>{a.name} ({a.ledgerType.toUpperCase()})</option
											>
										{/each}
									</select>
									{#if validationErrors.sourceAccountId}
										<p class="text-[10px] text-red-600 mt-1">
											{validationErrors.sourceAccountId}
										</p>
									{/if}
								</div>
							{:else}
								<div>
									<label
										for="contra-src-bank"
										class="block font-semibold text-muted-foreground mb-1.5"
										>Bank Account</label
									>
									<select
										id="contra-src-bank"
										bind:value={contraForm.sourceBankId}
										onchange={handleFormEdit}
										class="w-full p-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
									>
										<option value="">Select Bank</option>
										{#each banks as b}
											<option value={b.id}
												>{b.bankName} - {b.accountNumber}</option
											>
										{/each}
									</select>
									{#if validationErrors.sourceBankId}
										<p class="text-[10px] text-red-600 mt-1">
											{validationErrors.sourceBankId}
										</p>
									{/if}
								</div>
							{/if}
						</div>
					</div>

					<!-- DESTINATION SELECT -->
					<div class="border border-border p-4 rounded-2xl bg-muted/10 space-y-4">
						<h3
							class="font-bold text-muted-foreground uppercase tracking-wider text-[10px] pb-1 border-b border-border/50"
						>
							Destination Target Account
						</h3>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<span class="block font-semibold text-muted-foreground mb-1.5"
									>Destination Type</span
								>
								<div class="flex gap-2 bg-muted/30 p-1 rounded-xl">
									<button
										type="button"
										class={[
											'flex-1 py-2 text-center rounded-lg font-semibold transition-all cursor-pointer',
											contraForm.destinationType === 'account'
												? 'bg-card text-foreground shadow-xs'
												: 'text-muted-foreground hover:text-foreground'
										].join(' ')}
										onclick={() => {
											contraForm.destinationType = 'account';
											handleFormEdit();
										}}
									>
										Cash Account
									</button>
									<button
										type="button"
										class={[
											'flex-1 py-2 text-center rounded-lg font-semibold transition-all cursor-pointer',
											contraForm.destinationType === 'bank'
												? 'bg-card text-foreground shadow-xs'
												: 'text-muted-foreground hover:text-foreground'
										].join(' ')}
										onclick={() => {
											contraForm.destinationType = 'bank';
											handleFormEdit();
										}}
									>
										Bank Account
									</button>
								</div>
							</div>

							{#if contraForm.destinationType === 'account'}
								<div>
									<label
										for="contra-dest-acc"
										class="block font-semibold text-muted-foreground mb-1.5"
										>Cash Account</label
									>
									<select
										id="contra-dest-acc"
										bind:value={contraForm.destinationAccountId}
										onchange={handleFormEdit}
										class="w-full p-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
									>
										<option value="">Select Account</option>
										{#each accounts as a}
											<option value={a.id}
												>{a.name} ({a.ledgerType.toUpperCase()})</option
											>
										{/each}
									</select>
									{#if validationErrors.destinationAccountId}
										<p class="text-[10px] text-red-600 mt-1">
											{validationErrors.destinationAccountId}
										</p>
									{/if}
								</div>
							{:else}
								<div>
									<label
										for="contra-dest-bank"
										class="block font-semibold text-muted-foreground mb-1.5"
										>Bank Account</label
									>
									<select
										id="contra-dest-bank"
										bind:value={contraForm.destinationBankId}
										onchange={handleFormEdit}
										class="w-full p-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
									>
										<option value="">Select Bank</option>
										{#each banks as b}
											<option value={b.id}
												>{b.bankName} - {b.accountNumber}</option
											>
										{/each}
									</select>
									{#if validationErrors.destinationBankId}
										<p class="text-[10px] text-red-600 mt-1">
											{validationErrors.destinationBankId}
										</p>
									{/if}
								</div>
							{/if}
						</div>
					</div>

					<!-- Amount -->
					<div>
						<label
							for="contra-amount"
							class="block font-semibold text-muted-foreground mb-1.5"
							>Amount (BHD)</label
						>
						<input
							id="contra-amount"
							type="number"
							step="0.001"
							placeholder="0.000"
							bind:value={contraForm.amount}
							oninput={handleFormEdit}
							class="w-full p-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground placeholder-muted-foreground/60 font-semibold"
						/>
						{#if validationErrors.amount}
							<p class="text-[10px] text-red-600 mt-1">{validationErrors.amount}</p>
						{/if}
					</div>

					<!-- Description -->
					<div>
						<label
							for="contra-desc"
							class="block font-semibold text-muted-foreground mb-1.5"
							>Description</label
						>
						<textarea
							id="contra-desc"
							rows="3"
							placeholder="Provide transfer / contra narrative details..."
							bind:value={contraForm.description}
							oninput={handleFormEdit}
							class="w-full p-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground placeholder-muted-foreground/60 resize-none leading-relaxed"
						></textarea>
					</div>

					<!-- Submit Bar -->
					<div class="flex justify-end pt-3">
						<Button
							type="submit"
							disabled={submitting}
							class="rounded-xl font-semibold text-xs py-5 px-6 cursor-pointer"
						>
							{#if submitting}
								<Loader2 class="h-3.5 w-3.5 animate-spin mr-1.5" />
								<span>Posting Transfer...</span>
							{:else}
								<span>Post Contra Transfer</span>
							{/if}
						</Button>
					</div>
				</form>
			{/if}
		</div>
	{/if}
</div>
