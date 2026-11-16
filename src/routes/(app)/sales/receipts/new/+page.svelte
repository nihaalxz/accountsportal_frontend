<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { apiFetch } from '$lib/api/api-client';
	import { getAccounts } from '$features/cash-accounts/api';
	import { getBanks } from '$features/bank-accounts/api';
	import type { AccountResponse } from '$features/cash-accounts/types';
	import type { BankResponse } from '$features/bank-accounts/types';
	import { Button } from '$lib/components/ui/button';
	import { toast } from '$lib/stores/toast';
	import {
		ArrowLeft,
		Wallet,
		Building2,
		Receipt,
		Save,
		Plus,
		RefreshCw
	} from 'lucide-svelte';

	// Form State
	let destinationType = $state<'account' | 'bank'>('account');
	let selectedAccountId = $state<string>('');
	let selectedBankId = $state<string>('');
	let amount = $state<string>('');
	let referenceId = $state('');
	let description = $state('');
	let paymentProof = $state<string | null>(null);
	let paymentProofFile = $state<File | null>(null);

	let cashAccounts = $state<AccountResponse[]>([]);
	let bankAccounts = $state<BankResponse[]>([]);

	let isLoadingData = $state(true);
	let isSubmitting = $state(false);

	// Derived: Selected account object
	const selectedCashAccount = $derived(
		cashAccounts.find((a) => String(a.id) === selectedAccountId) || null
	);

	const selectedBankAccount = $derived(
		bankAccounts.find((b) => String(b.id) === selectedBankId) || null
	);

	const parsedAmount = $derived(parseFloat(amount) || 0);

	async function loadDropdowns() {
		isLoadingData = true;
		try {
			const [cashList, bankList] = await Promise.all([
				getAccounts().catch(() => []),
				getBanks().catch(() => [])
			]);

			cashAccounts = (Array.isArray(cashList) ? cashList : (cashList as any)?.items || []).filter((a: any) => a.isActive);
			bankAccounts = (Array.isArray(bankList) ? bankList : (bankList as any)?.items || []).filter((b: any) => b.isActive);

			const qAccountId = $page.url.searchParams.get('accountId');
			const qBankId = $page.url.searchParams.get('bankId');

			if (qAccountId && cashAccounts.some((a) => String(a.id) === qAccountId)) {
				destinationType = 'account';
				selectedAccountId = qAccountId;
			} else if (cashAccounts.length > 0 && !selectedAccountId) {
				const firstCash = cashAccounts[0];
				if (firstCash) selectedAccountId = String(firstCash.id);
			}

			if (qBankId && bankAccounts.some((b) => String(b.id) === qBankId)) {
				destinationType = 'bank';
				selectedBankId = qBankId;
			} else if (bankAccounts.length > 0 && !selectedBankId) {
				const firstBank = bankAccounts[0];
				if (firstBank) selectedBankId = String(firstBank.id);
			}
		} catch (err: any) {
			console.error('Failed to load accounts data:', err);
			toast.error('Failed to load cash and bank accounts.');
		} finally {
			isLoadingData = false;
		}
	}

	function handlePaymentProofChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			const file = target.files[0];
			paymentProofFile = file;
			const reader = new FileReader();
			reader.onload = (event) => {
				paymentProof = event.target?.result as string;
			};
			reader.readAsDataURL(file);
		} else {
			paymentProofFile = null;
			paymentProof = null;
		}
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();

		if (parsedAmount <= 0) {
			toast.error('Please enter a valid receipt amount greater than zero.');
			return;
		}

		if (destinationType === 'account' && !selectedAccountId) {
			toast.error('Please select a Destination Cash Account to increment.');
			return;
		}

		if (destinationType === 'bank' && !selectedBankId) {
			toast.error('Please select a Destination Bank Account to increment.');
			return;
		}

		if (!referenceId.trim()) {
			toast.error('Reference ID is required and must be unique.');
			return;
		}

		isSubmitting = true;
		try {
			const targetAccName = destinationType === 'account' ? selectedCashAccount?.name : selectedBankAccount?.bankName;

			const payload = {
				destinationType,
				destinationAccountId: destinationType === 'account' ? parseInt(selectedAccountId, 10) : null,
				destinationBankId: destinationType === 'bank' ? parseInt(selectedBankId, 10) : null,
				amount: parsedAmount,
				clientType: 'general',
				headId: null,
				agentName: null,
				description: description.trim() || `Receipt Collection deposited to ${targetAccName || 'Account'}`,
				referenceId: referenceId.trim(),
				paymentProof
			};

			await apiFetch<any>('api/sales-entries/receipts', {
				method: 'POST',
				body: JSON.stringify(payload)
			});

			toast.success(`Receipt created successfully! Balance for ${targetAccName || 'account'} incremented by ${parsedAmount.toFixed(3)} BHD.`);
			goto('/sales/receipts?tab=accounts_portal');
		} catch (err: any) {
			console.error('Failed to create receipt:', err);
			toast.error(err?.message || 'Failed to create payment receipt.');
		} finally {
			isSubmitting = false;
		}
	}

	onMount(() => {
		loadDropdowns();
	});
</script>

<svelte:head>
	<title>Create Receipt — Accounts Portal</title>
</svelte:head>

<div class="max-w-3xl mx-auto space-y-6 pb-12">
	<!-- Page Header -->
	<div class="space-y-2">
		<button
			onclick={() => goto('/sales/receipts')}
			class="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
		>
			<ArrowLeft class="h-3.5 w-3.5" />
			Back to Receipts Workspace
		</button>
		<div class="flex items-center justify-between">
			<div class="space-y-1">
				<h1 class="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
					<Receipt class="h-5 w-5 text-primary" />
					Create Payment Receipt
				</h1>
				<p class="text-xs text-muted-foreground">
					Record an incoming payment receipt to directly increment the balance of a Cash Account or Bank Account.
				</p>
			</div>
			<div class="flex items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="rounded-xl text-xs font-semibold cursor-pointer"
					onclick={() => goto('/sales/receipts/new-client')}
				>
					<Wallet class="h-3.5 w-3.5 mr-1 text-primary" />
					Client Wallet Receipt
				</Button>
				<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-xs">
					<Plus class="h-3.5 w-3.5" /> Balance Increment
				</span>
			</div>
		</div>
	</div>

	{#if isLoadingData}
		<div class="bg-card border border-border rounded-2xl p-16 flex items-center justify-center animate-pulse">
			<RefreshCw class="h-8 w-8 text-primary animate-spin" />
		</div>
	{:else}
		<form onsubmit={handleSubmit} class="space-y-6">
			<!-- Destination Account Selector -->
			<div class="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
				<div class="flex items-center justify-between border-b border-border/40 pb-3">
					<div>
						<h2 class="text-sm font-bold text-foreground">Target Destination Account</h2>
						<p class="text-xs text-muted-foreground">
							Choose which Cash Account or Bank Account will receive funds and increment its balance.
						</p>
					</div>
					<div class="bg-muted/50 p-1 rounded-xl border border-border flex items-center gap-1">
						<button
							type="button"
							onclick={() => destinationType = 'account'}
							class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer {destinationType === 'account' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
						>
							<Wallet class="h-3.5 w-3.5" />
							<span>Cash Account</span>
						</button>
						<button
							type="button"
							onclick={() => destinationType = 'bank'}
							class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer {destinationType === 'bank' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
						>
							<Building2 class="h-3.5 w-3.5" />
							<span>Bank Account</span>
						</button>
					</div>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					{#if destinationType === 'account'}
						<div class="space-y-1.5 sm:col-span-2">
							<label for="cashAccSelect" class="text-xs font-semibold text-foreground">
								Select Cash Account *
							</label>
							<select
								id="cashAccSelect"
								bind:value={selectedAccountId}
								class="w-full text-xs bg-background border border-border rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold cursor-pointer"
								required
							>
								{#each cashAccounts as acc}
									<option value={String(acc.id)}>
										{acc.name} — Current Balance: {Number(acc.currentBalance).toFixed(3)} BHD
									</option>
								{/each}
							</select>
						</div>
					{:else}
						<div class="space-y-1.5 sm:col-span-2">
							<label for="bankAccSelect" class="text-xs font-semibold text-foreground">
								Select Bank Account *
							</label>
							<select
								id="bankAccSelect"
								bind:value={selectedBankId}
								class="w-full text-xs bg-background border border-border rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold cursor-pointer"
								required
							>
								{#each bankAccounts as b}
									<option value={String(b.id)}>
										{b.bankName} ({b.accountNumber}) — Current Balance: {Number(b.currentBalance).toFixed(3)} BHD
									</option>
								{/each}
							</select>
						</div>
					{/if}
				</div>
			</div>

			<!-- Receipt Amount & Information -->
			<div class="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
				<h2 class="text-sm font-bold text-foreground border-b border-border/40 pb-3">
					Receipt Amount & Transaction Details
				</h2>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<!-- Amount -->
					<div class="space-y-1.5">
						<label for="receiptAmount" class="text-xs font-semibold text-foreground">
							Receipt Amount (BHD) *
						</label>
						<div class="flex items-center rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary overflow-hidden h-10 shadow-2xs transition-all">
							<span class="px-3.5 h-full flex items-center justify-center bg-muted/50 border-r border-border text-xs font-bold text-muted-foreground font-mono select-none">
								BHD
							</span>
							<input
								id="receiptAmount"
								type="number"
								step="0.001"
								min="0.001"
								placeholder="0.000"
								bind:value={amount}
								class="flex-1 h-full px-3.5 bg-transparent text-sm font-bold font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
								required
							/>
						</div>
					</div>

					<!-- Reference ID -->
					<div class="space-y-1.5">
						<label for="referenceIdInput" class="text-xs font-semibold text-foreground flex items-center justify-between">
							<span>Reference ID *</span>
							<span class="text-[10px] text-amber-600 font-semibold">Unique</span>
						</label>
						<input
							id="referenceIdInput"
							type="text"
							placeholder="e.g. REF-2026-001 or Cheque Ref"
							bind:value={referenceId}
							required
							class="w-full h-10 px-3.5 bg-background border border-border rounded-xl text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
						/>
					</div>
				</div>

				<!-- Description / Narration -->
				<div class="space-y-1.5 pt-2">
					<label for="receiptDescription" class="text-xs font-semibold text-foreground">
						Narration / Description (Optional)
					</label>
					<textarea
						id="receiptDescription"
						rows="2"
						bind:value={description}
						placeholder="Enter receipt narration or notes..."
						class="w-full text-xs bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
					></textarea>
				</div>

				<!-- Payment Proof Attachment -->
				<div class="space-y-1.5 pt-2 border-t border-border/40">
					<label for="receiptProofFile" class="text-xs font-semibold text-muted-foreground">
						Payment Proof / Deposit Slip (Optional)
					</label>
					<input
						id="receiptProofFile"
						type="file"
						accept=".pdf,.png,.jpg,.jpeg"
						onchange={handlePaymentProofChange}
						class="w-full text-xs bg-background border border-border rounded-xl px-3 py-2 text-foreground file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary file:cursor-pointer"
					/>
					{#if paymentProofFile}
						<p class="text-[11px] text-muted-foreground font-semibold">
							Selected: {paymentProofFile.name}
						</p>
					{/if}
				</div>
			</div>

			<!-- Action Buttons -->
			<div class="flex items-center justify-end gap-3 pt-2">
				<Button
					type="button"
					variant="outline"
					class="rounded-xl h-10 px-5 text-xs font-semibold cursor-pointer"
					disabled={isSubmitting}
					onclick={() => goto('/sales/receipts')}
				>
					Cancel
				</Button>
				<Button
					type="submit"
					class="rounded-xl h-10 px-6 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm cursor-pointer flex items-center gap-1.5"
					disabled={isSubmitting || parsedAmount <= 0}
				>
					{#if isSubmitting}
						<RefreshCw class="h-4 w-4 animate-spin" />
						<span>Processing Receipt...</span>
					{:else}
						<Save class="h-4 w-4" />
						<span>Save & Increment Balance</span>
					{/if}
				</Button>
			</div>
		</form>
	{/if}
</div>
