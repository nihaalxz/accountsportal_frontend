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
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import {
		ArrowLeft,
		Wallet,
		Building2,
		Receipt,
		Save,
		Plus,
		RefreshCw,
		UserCheck,
		Users,
		CheckCircle2,
		AlertCircle,
		ArrowRight,
		FileText,
		Sparkles,
		RotateCw
	} from 'lucide-svelte';

	interface SalesmanItem {
		id: number;
		name: string;
		email: string;
	}

	interface ClientItem {
		id: number;
		name: string;
		phone?: string | null;
		email?: string | null;
		clientType: string;
		wallet: number;
		salesmanId?: number | null;
		status?: string | null;
	}

	// Salesman State
	let salesmen = $state<SalesmanItem[]>([]);
	let selectedSalesmanId = $state<string>('');
	let isLoadingSalesmen = $state(false);

	// Client State
	let clientType = $state<'customer' | 'agent'>('customer');
	let clients = $state<ClientItem[]>([]);
	let selectedClientId = $state<string>('');
	let isLoadingClients = $state(false);

	// Destination Account State
	let destinationType = $state<'account' | 'bank'>('account');
	let selectedAccountId = $state<string>('');
	let selectedBankId = $state<string>('');
	let cashAccounts = $state<AccountResponse[]>([]);
	let bankAccounts = $state<BankResponse[]>([]);

	// Form Fields
	let amount = $state<string>('');
	let referenceId = $state('');
	let description = $state('');
	let paymentProof = $state<string | null>(null);
	let paymentProofFile = $state<File | null>(null);

	// Execution State
	let isLoadingInitial = $state(true);
	let isSubmitting = $state(false);
	let isRetryingSync = $state(false);

	// Result / Feedback State
	let submissionResult = $state<any | null>(null);
	let syncError = $state<{ receiptId: number; message: string } | null>(null);

	// Derived: Salesman Object & Options
	const salesmanOptions = $derived(
		salesmen.map((s) => ({
			id: s.id,
			name: s.name,
			subtext: s.email || undefined
		}))
	);

	const selectedSalesman = $derived(
		salesmen.find((s) => String(s.id) === selectedSalesmanId) || null
	);

	// Derived: Client Object & Options
	const clientOptions = $derived(
		clients.map((c) => ({
			id: c.id,
			name: c.name,
			subtext: `${c.phone || c.email || 'No phone'} • Balance: ${Number(c.wallet).toFixed(3)} BHD`
		}))
	);

	const selectedClient = $derived(
		clients.find((c) => String(c.id) === selectedClientId) || null
	);

	// Derived: Accounts
	const selectedCashAccount = $derived(
		cashAccounts.find((a) => String(a.id) === selectedAccountId) || null
	);

	const selectedBankAccount = $derived(
		bankAccounts.find((b) => String(b.id) === selectedBankId) || null
	);

	const parsedAmount = $derived(parseFloat(amount) || 0);

	// Derived: Current & Projected Balances
	const clientBalance = $derived(
		selectedClient ? Number(selectedClient.wallet) : 0
	);

	const projectedBalance = $derived(
		selectedClient ? clientBalance + parsedAmount : 0
	);

	async function loadDropdowns() {
		isLoadingInitial = true;
		try {
			const [cashList, bankList, salesmanList] = await Promise.all([
				getAccounts().catch(() => []),
				getBanks().catch(() => []),
				apiFetch<SalesmanItem[]>('api/sales-entries/salesmen').catch(() => [])
			]);

			cashAccounts = (Array.isArray(cashList) ? cashList : (cashList as any)?.items || []).filter((a: any) => a.isActive);
			bankAccounts = (Array.isArray(bankList) ? bankList : (bankList as any)?.items || []).filter((b: any) => b.isActive);
			salesmen = Array.isArray(salesmanList) ? salesmanList : [];

			if (cashAccounts.length > 0 && cashAccounts[0] && !selectedAccountId) {
				selectedAccountId = String(cashAccounts[0].id);
			}
			if (bankAccounts.length > 0 && bankAccounts[0] && !selectedBankId) {
				selectedBankId = String(bankAccounts[0].id);
			}

			// Handle URL query parameters
			const qSalesmanId = $page.url.searchParams.get('salesmanId');
			const qClientType = $page.url.searchParams.get('clientType');
			const qHeadId = $page.url.searchParams.get('headId') || $page.url.searchParams.get('clientId');
			const qAgentId = $page.url.searchParams.get('agentId') || $page.url.searchParams.get('clientId');

			if (qClientType === 'agent' || qClientType === 'customer') {
				clientType = qClientType;
			}

			if (qSalesmanId) {
				selectedSalesmanId = qSalesmanId;
				await fetchClients(qSalesmanId, clientType);
				if (clientType === 'customer' && qHeadId) {
					selectedClientId = qHeadId;
				} else if (clientType === 'agent' && qAgentId) {
					selectedClientId = qAgentId;
				}
			} else if (salesmen.length > 0 && salesmen[0]) {
				selectedSalesmanId = String(salesmen[0].id);
				await fetchClients(selectedSalesmanId, clientType);
				if (clientType === 'customer' && qHeadId) {
					selectedClientId = qHeadId;
				} else if (clientType === 'agent' && qAgentId) {
					selectedClientId = qAgentId;
				}
			}
		} catch (err: any) {
			console.error('Failed to load initial data:', err);
			toast.error('Failed to load accounts and salesmen data.');
		} finally {
			isLoadingInitial = false;
		}
	}

	async function fetchClients(salesmanId: string, type: 'customer' | 'agent') {
		if (!salesmanId) {
			clients = [];
			selectedClientId = '';
			return;
		}

		isLoadingClients = true;
		try {
			if (type === 'customer') {
				const res = await apiFetch<any>('api/sales-entries/heads', {
					params: {
						salesmanId,
						page: 1,
						pageSize: 500
					}
				});

				clients = (res?.items || []).map((item: any) => ({
					id: item.id,
					name: `${item.firstName || ''} ${item.lastName || ''}`.trim() || item.name || 'Customer',
					phone: item.mobileNo || item.phone,
					email: item.email,
					clientType: 'customer',
					wallet: Number(item.wallet ?? 0),
					salesmanId: item.salesmanId,
					status: item.status
				}));
			} else {
				const res = await apiFetch<any>(`api/sales-entries/salesmen/${salesmanId}/clients`, {
					params: {
						type: 'agent',
						page: 1,
						pageSize: 500
					}
				});

				clients = (res?.items || []).map((item: any) => ({
					id: item.id,
					name: item.name,
					phone: item.phone,
					email: item.email,
					clientType: item.clientType,
					wallet: Number(item.wallet ?? 0),
					salesmanId: item.salesmanId,
					status: item.status
				}));
			}

			// Reset selected client if not found in new list
			if (!clients.some((c) => String(c.id) === selectedClientId)) {
				selectedClientId = clients.length > 0 && clients[0] ? String(clients[0].id) : '';
			}
		} catch (err: any) {
			console.error('Failed to fetch clients:', err);
			toast.error(`Failed to load ${type === 'customer' ? 'customers' : 'agents'} for selected salesman.`);
			clients = [];
			selectedClientId = '';
		} finally {
			isLoadingClients = false;
		}
	}

	function handleSalesmanChange(val: string | number) {
		selectedSalesmanId = String(val);
		selectedClientId = '';
		fetchClients(selectedSalesmanId, clientType);
	}

	function handleClientTypeChange(type: 'customer' | 'agent') {
		clientType = type;
		selectedClientId = '';
		fetchClients(selectedSalesmanId, type);
	}

	function handleQuickGenerateRef() {
		const prefix = clientType === 'customer' ? 'CRCPT' : 'ARCPT';
		const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
		const randPart = Math.floor(1000 + Math.random() * 9000);
		referenceId = `${prefix}-${datePart}-${randPart}`;
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
			toast.error('Please select a Destination Cash Account.');
			return;
		}

		if (destinationType === 'bank' && !selectedBankId) {
			toast.error('Please select a Destination Bank Account.');
			return;
		}

		if (!referenceId.trim()) {
			toast.error('Reference ID is required and must be unique.');
			return;
		}

		if (!selectedSalesmanId) {
			toast.error('Please select a Salesman.');
			return;
		}
		if (!selectedClientId) {
			toast.error(`Please select a ${clientType === 'customer' ? 'Customer' : 'Agent'}.`);
			return;
		}

		isSubmitting = true;
		syncError = null;

		try {
			const targetAccName = destinationType === 'account' ? selectedCashAccount?.name : selectedBankAccount?.bankName;

			const payload: any = {
				destinationType,
				destinationAccountId: destinationType === 'account' ? parseInt(selectedAccountId, 10) : null,
				destinationBankId: destinationType === 'bank' ? parseInt(selectedBankId, 10) : null,
				amount: parsedAmount,
				clientType,
				headId: clientType === 'customer' ? parseInt(selectedClientId, 10) : null,
				agentId: clientType === 'agent' ? parseInt(selectedClientId, 10) : null,
				salesmanId: selectedSalesman ? selectedSalesman.id : null,
				salesmanName: selectedSalesman ? selectedSalesman.name : null,
				clientName: selectedClient ? selectedClient.name : null,
				agentName: clientType === 'agent' && selectedClient ? selectedClient.name : null,
				description: description.trim() || `Payment Receipt from ${selectedClient?.name || 'Client'} (${clientType}) via ${selectedSalesman?.name || 'Salesman'}`,
				referenceId: referenceId.trim(),
				paymentProof,
				receiptDate: new Date().toISOString()
			};

			const result = await apiFetch<any>('api/sales-entries/receipts', {
				method: 'POST',
				body: JSON.stringify(payload)
			});

			submissionResult = result;

			if (result.syncStatus === 'Failed') {
				syncError = {
					receiptId: result.id,
					message: result.failureReason || 'Failed to sync receipt with Sales Portal.'
				};
				toast.error('Receipt saved locally, but Sales Portal sync failed.');
			} else {
				toast.success(`Client receipt recorded! Wallet credited by ${parsedAmount.toFixed(3)} BHD.`);
			}
		} catch (err: any) {
			console.error('Failed to create receipt:', err);
			toast.error(err?.message || 'Failed to create payment receipt.');
		} finally {
			isSubmitting = false;
		}
	}

	async function handleRetrySync() {
		if (!syncError?.receiptId) return;

		isRetryingSync = true;
		try {
			const retried = await apiFetch<any>(`api/sales-entries/accounts-receipts/${syncError.receiptId}/retry`, {
				method: 'POST'
			});

			if (retried.syncStatus === 'Synced') {
				submissionResult = retried;
				syncError = null;
				toast.success(`Sync successful! Sales Portal Receipt: ${retried.salesPortalDocumentNumber || retried.salesPortalReceiptId}`);
			} else {
				syncError = {
					receiptId: retried.id,
					message: retried.failureReason || 'Sync attempt failed again.'
				};
				toast.error('Sync attempt failed again.');
			}
		} catch (err: any) {
			console.error('Retry sync error:', err);
			toast.error(err?.message || 'Failed to retry sync.');
		} finally {
			isRetryingSync = false;
		}
	}

	function resetForm() {
		submissionResult = null;
		syncError = null;
		amount = '';
		referenceId = '';
		description = '';
		paymentProof = null;
		paymentProofFile = null;
		if (selectedSalesmanId) {
			fetchClients(selectedSalesmanId, clientType);
		}
	}

	onMount(() => {
		loadDropdowns();
	});
</script>

<svelte:head>
	<title>Create Client Receipt — Accounts Portal</title>
</svelte:head>

<div class="max-w-4xl mx-auto space-y-6 pb-12">
	<!-- Page Header -->
	<div class="space-y-2">
		<button
			type="button"
			onclick={() => goto('/sales/receipts?tab=sales_portal')}
			class="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
		>
			<ArrowLeft class="h-3.5 w-3.5" />
			Back to Receipts Workspace
		</button>
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
			<div class="space-y-1">
				<h1 class="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
					<Wallet class="h-5 w-5 text-primary" />
					Create Client Receipt
				</h1>
				<p class="text-xs text-muted-foreground">
					Issue receipts against Customer & Agent balances under sales staff, immediately crediting their wallet and target treasury account.
				</p>
			</div>
			<div class="flex items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="rounded-xl text-xs font-semibold cursor-pointer"
					onclick={() => goto('/sales/receipts/new')}
				>
					<Building2 class="h-3.5 w-3.5 mr-1" />
					General Receipt
				</Button>
			</div>
		</div>
	</div>

	{#if isLoadingInitial}
		<div class="bg-card border border-border rounded-2xl p-16 flex flex-col items-center justify-center gap-3 animate-pulse">
			<RefreshCw class="h-8 w-8 text-primary animate-spin" />
			<span class="text-xs text-muted-foreground font-semibold">Loading receipt workspace...</span>
		</div>
	{:else if submissionResult}
		<!-- Submission Success / Result Card -->
		<div class="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6 animate-in fade-in-50 zoom-in-98 duration-200">
			<div class="flex items-start gap-4">
				<div class="p-3 rounded-2xl {submissionResult.syncStatus === 'Failed' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'}">
					{#if submissionResult.syncStatus === 'Failed'}
						<AlertCircle class="h-8 w-8" />
					{:else}
						<CheckCircle2 class="h-8 w-8" />
					{/if}
				</div>
				<div class="space-y-1 flex-1">
					<div class="flex items-center justify-between">
						<h2 class="text-base font-bold text-foreground">
							{submissionResult.syncStatus === 'Failed' ? 'Receipt Created (Pending Sync)' : 'Receipt Confirmed & Wallet Credited!'}
						</h2>
						<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold {submissionResult.syncStatus === 'Synced' ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-700 border border-amber-500/20'}">
							{submissionResult.syncStatus || 'Synced'}
						</span>
					</div>
					<p class="text-xs text-muted-foreground">
						Receipt voucher <span class="font-mono font-bold text-foreground">{submissionResult.documentNumber || `TXN-${submissionResult.id}`}</span> has been recorded in the accounts ledger.
					</p>
				</div>
			</div>

			<!-- Failure Alert Banner if sync failed -->
			{#if syncError}
				<div class="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-2">
					<div class="flex items-center justify-between">
						<span class="font-bold flex items-center gap-1.5">
							<AlertCircle class="h-4 w-4" />
							Sales Portal Sync Error:
						</span>
						<Button
							type="button"
							variant="outline"
							size="xs"
							disabled={isRetryingSync}
							onclick={handleRetrySync}
							class="h-7 text-xs border-destructive/30 hover:bg-destructive/10 text-destructive cursor-pointer flex items-center gap-1"
						>
							<RotateCw class="h-3 w-3 {isRetryingSync ? 'animate-spin' : ''}" />
							<span>{isRetryingSync ? 'Retrying...' : 'Retry Sync Now'}</span>
						</Button>
					</div>
					<p class="font-mono text-[11px] opacity-90">{syncError.message}</p>
				</div>
			{/if}

			<!-- Summary Details Grid -->
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
				<div class="p-3.5 bg-muted/30 rounded-xl border border-border/40 space-y-1">
					<span class="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Amount Credited</span>
					<div class="text-base font-black font-mono text-emerald-600">
						<MoneyDisplay amount={submissionResult.amount} />
					</div>
				</div>
				<div class="p-3.5 bg-muted/30 rounded-xl border border-border/40 space-y-1">
					<span class="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Destination Account</span>
					<div class="font-bold text-foreground truncate">
						{submissionResult.destinationAccountName || submissionResult.destinationBankName || 'Cash Account'}
					</div>
					<span class="text-[10px] text-muted-foreground capitalize">{submissionResult.paymentMethod}</span>
				</div>
				<div class="p-3.5 bg-muted/30 rounded-xl border border-border/40 space-y-1">
					<span class="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Sales Portal Doc #</span>
					<div class="font-mono font-bold text-foreground">
						{submissionResult.salesPortalDocumentNumber || submissionResult.salesPortalReceiptId || '— (Local Agent Receipt)'}
					</div>
				</div>
			</div>

			<!-- Client & Salesman Info -->
			{#if submissionResult.clientName || submissionResult.salesmanName}
				<div class="p-4 bg-muted/20 rounded-xl border border-border/40 flex flex-wrap items-center justify-between gap-3 text-xs">
					{#if submissionResult.clientName}
						<div class="flex items-center gap-2">
							<span class="text-muted-foreground">Client:</span>
							<span class="font-bold text-foreground">{submissionResult.clientName}</span>
							<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-primary/10 text-primary">
								{submissionResult.clientType || 'Client'}
							</span>
						</div>
					{/if}
					{#if submissionResult.salesmanName}
						<div class="flex items-center gap-2">
							<span class="text-muted-foreground">Salesman:</span>
							<span class="font-semibold text-foreground">{submissionResult.salesmanName}</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Action Buttons -->
			<div class="flex items-center justify-end gap-3 pt-3 border-t border-border">
				<Button
					type="button"
					variant="outline"
					class="rounded-xl h-9.5 text-xs font-semibold cursor-pointer"
					onclick={resetForm}
				>
					<Plus class="h-3.5 w-3.5 mr-1" />
					Create Another Client Receipt
				</Button>
				<Button
					type="button"
					class="rounded-xl h-9.5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
					onclick={() => goto('/sales/receipts?tab=sales_portal')}
				>
					<span>View All Receipts</span>
					<ArrowRight class="h-3.5 w-3.5 ml-1" />
				</Button>
			</div>
		</div>
	{:else}
		<form onsubmit={handleSubmit} class="space-y-6">
			<!-- STEP 1 & 2: SALESMAN & CLIENT SELECTION -->
			<div class="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
				<div class="flex items-center justify-between border-b border-border/40 pb-3">
					<div class="space-y-0.5">
						<h2 class="text-sm font-bold text-foreground flex items-center gap-2">
							<Users class="h-4 w-4 text-primary" />
							Sales Staff & Client Information
						</h2>
						<p class="text-xs text-muted-foreground">
							Select the responsible salesman and choose their Customer or Agent to credit their wallet.
						</p>
					</div>
					<!-- Client Type Toggle (Customer vs Agent) -->
					<div class="bg-muted/50 p-1 rounded-xl border border-border flex items-center gap-1">
						<button
							type="button"
							onclick={() => handleClientTypeChange('customer')}
							class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer {clientType === 'customer' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
						>
							<UserCheck class="h-3.5 w-3.5" />
							<span>Customer (Head)</span>
						</button>
						<button
							type="button"
							onclick={() => handleClientTypeChange('agent')}
							class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer {clientType === 'agent' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
						>
							<Building2 class="h-3.5 w-3.5" />
							<span>Agent</span>
						</button>
					</div>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<!-- Salesman Dropdown -->
					<div class="space-y-1.5">
						<label for="salesmanSelect" class="text-xs font-semibold text-foreground flex items-center justify-between">
							<span>Salesman *</span>
							<span class="text-[10px] text-muted-foreground">Responsible Sales Rep</span>
						</label>
						<SearchableSelect
							id="salesmanSelect"
							options={salesmanOptions}
							bind:value={selectedSalesmanId}
							placeholder="-- Select Salesman --"
							searchPlaceholder="Search salesmen by name..."
							onchange={handleSalesmanChange}
							required
						/>
					</div>

					<!-- Client Dropdown (Customer or Agent) -->
					<div class="space-y-1.5">
						<label for="clientSelect" class="text-xs font-semibold text-foreground flex items-center justify-between">
							<span>{clientType === 'customer' ? 'Customer (Head) *' : 'Agent *'}</span>
							{#if isLoadingClients}
								<span class="text-[10px] text-primary flex items-center gap-1 font-semibold">
									<RotateCw class="h-3 w-3 animate-spin" /> Loading clients...
								</span>
							{:else}
								<span class="text-[10px] text-muted-foreground font-mono">{clients.length} available</span>
							{/if}
						</label>
						<SearchableSelect
							id="clientSelect"
							options={clientOptions}
							bind:value={selectedClientId}
							placeholder={isLoadingClients ? 'Loading clients...' : `-- Select ${clientType === 'customer' ? 'Customer' : 'Agent'} --`}
							searchPlaceholder={`Search ${clientType === 'customer' ? 'customers' : 'agents'}...`}
							disabled={isLoadingClients || clients.length === 0}
							required
						/>
					</div>
				</div>

				<!-- PROMINENT CURRENT WALLET BALANCE & PROJECTED BALANCE CARD -->
				{#if selectedClient}
					<div class="mt-4 p-4 rounded-xl border transition-all {clientBalance > 0 ? 'bg-emerald-500/10 border-emerald-500/30' : clientBalance < 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-muted/40 border-border'}">
						<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
							<div class="space-y-1">
								<div class="flex items-center gap-2">
									<span class="font-bold text-foreground text-sm">{selectedClient.name}</span>
									<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-background border border-border">
										{clientType}
									</span>
									{#if selectedClient.phone}
										<span class="text-xs text-muted-foreground font-mono">{selectedClient.phone}</span>
									{/if}
								</div>
								<div class="flex items-center gap-2 text-xs">
									<span class="text-muted-foreground font-medium">Current Balance:</span>
									{#if clientBalance > 0}
										<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold font-mono text-xs bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
											Prepaid Surplus: +{clientBalance.toFixed(3)} BHD
										</span>
									{:else if clientBalance < 0}
										<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold font-mono text-xs bg-rose-500/20 text-rose-800 dark:text-rose-300">
											Debt Owed: -{Math.abs(clientBalance).toFixed(3)} BHD
										</span>
									{:else}
										<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold font-mono text-xs bg-muted text-muted-foreground">
											Settled: 0.000 BHD
										</span>
									{/if}
								</div>
							</div>

							<!-- Live Projected Balance Preview -->
							{#if parsedAmount > 0}
								<div class="p-3 bg-background/80 rounded-xl border border-border/60 text-right space-y-0.5 shrink-0">
									<span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
										Projected Balance After Receipt
									</span>
									<div class="text-sm font-black font-mono {projectedBalance > 0 ? 'text-emerald-600' : projectedBalance < 0 ? 'text-rose-600' : 'text-foreground'}">
										{projectedBalance >= 0 ? `+${projectedBalance.toFixed(3)}` : projectedBalance.toFixed(3)} BHD
									</div>
									<span class="text-[10px] font-medium text-muted-foreground block">
										{#if clientBalance < 0 && projectedBalance >= 0}
											<span class="text-emerald-600 font-bold">Debt fully settled! Surplus: +{projectedBalance.toFixed(3)} BHD</span>
										{:else if clientBalance < 0 && projectedBalance < 0}
											<span class="text-amber-600 font-bold">Debt reduced by {parsedAmount.toFixed(3)} BHD</span>
										{:else}
											<span class="text-emerald-600 font-bold">Prepaid funds increased</span>
										{/if}
									</span>
								</div>
							{/if}
						</div>
					</div>
				{:else if selectedSalesmanId && clients.length === 0 && !isLoadingClients}
					<div class="p-4 rounded-xl bg-muted/30 border border-dashed border-border text-center text-xs text-muted-foreground">
						No {clientType === 'customer' ? 'customers (heads)' : 'agents'} found assigned to {selectedSalesman?.name || 'this salesman'}.
					</div>
				{/if}
			</div>

			<!-- STEP 3: FINANCIAL DETAILS & TARGET ACCOUNT -->
			<div class="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
				<div class="flex items-center justify-between border-b border-border/40 pb-3">
					<div class="space-y-0.5">
						<h2 class="text-sm font-bold text-foreground flex items-center gap-2">
							<Building2 class="h-4 w-4 text-primary" />
							Target Destination Account
						</h2>
						<p class="text-xs text-muted-foreground">
							Specify the Cash Drawer or Bank Account where funds were collected.
						</p>
					</div>
					<!-- Destination Type Switcher -->
					<div class="bg-muted/50 p-1 rounded-xl border border-border flex items-center gap-1">
						<button
							type="button"
							onclick={() => destinationType = 'account'}
							class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer {destinationType === 'account' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
						>
							<Wallet class="h-3.5 w-3.5" />
							<span>Cash Drawer</span>
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

			<!-- STEP 4: RECEIPT AMOUNT, REFERENCE & TRANSACTION INFO -->
			<div class="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
				<h2 class="text-sm font-bold text-foreground border-b border-border/40 pb-3 flex items-center gap-2">
					<Sparkles class="h-4 w-4 text-primary" />
					Receipt Amount & Transaction Details
				</h2>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<!-- Receipt Amount -->
					<div class="space-y-1.5">
						<label for="receiptAmount" class="text-xs font-semibold text-foreground">
							Receipt Amount (BHD) *
						</label>
						<div class="flex items-center rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary overflow-hidden h-10 shadow-2xs transition-all">
							<span class="px-3 h-full flex items-center justify-center bg-muted/50 border-r border-border text-xs font-bold text-muted-foreground font-mono select-none">
								BHD
							</span>
							<input
								id="receiptAmount"
								type="number"
								step="0.001"
								min="0.001"
								placeholder="0.000"
								bind:value={amount}
								class="flex-1 h-full px-3 bg-transparent text-sm font-bold font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
								required
							/>
						</div>
					</div>

					<!-- Reference ID -->
					<div class="space-y-1.5">
						<label for="referenceIdInput" class="text-xs font-semibold text-foreground flex items-center justify-between">
							<span>Reference ID *</span>
							<button
								type="button"
								onclick={handleQuickGenerateRef}
								class="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
							>
								Auto Generate
							</button>
						</label>
						<input
							id="referenceIdInput"
							type="text"
							placeholder="e.g. CHEQUE-0982 or TXN-REF"
							bind:value={referenceId}
							required
							class="w-full h-10 px-3 bg-background border border-border rounded-xl text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
						/>
					</div>
				</div>

				<!-- Description / Narration -->
				<div class="space-y-1.5 pt-1">
					<label for="receiptDescription" class="text-xs font-semibold text-foreground">
						Narration / Description (Optional)
					</label>
					<textarea
						id="receiptDescription"
						rows="2"
						bind:value={description}
						placeholder={selectedClient ? `Payment collection from ${selectedClient.name}...` : 'Enter receipt narrative or notes...'}
						class="w-full text-xs bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
					></textarea>
				</div>

				<!-- Payment Proof Attachment -->
				<div class="space-y-1.5 pt-2 border-t border-border/40">
					<label for="receiptProofFile" class="text-xs font-semibold text-muted-foreground">
						Payment Proof / Bank Slip / Cheque Copy (Optional)
					</label>
					<input
						id="receiptProofFile"
						type="file"
						accept=".pdf,.png,.jpg,.jpeg"
						onchange={handlePaymentProofChange}
						class="w-full text-xs bg-background border border-border rounded-xl px-3 py-2 text-foreground file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary file:cursor-pointer"
					/>
					{#if paymentProofFile}
						<p class="text-[11px] text-muted-foreground font-semibold flex items-center gap-1 mt-1">
							<FileText class="h-3 w-3 text-primary" />
							Selected: {paymentProofFile.name}
						</p>
					{/if}
				</div>
			</div>

			<!-- SUBMISSION ACTIONS -->
			<div class="flex items-center justify-end gap-3 pt-2">
				<Button
					type="button"
					variant="outline"
					class="rounded-xl h-10 px-5 text-xs font-semibold cursor-pointer"
					disabled={isSubmitting}
					onclick={() => goto('/sales/receipts?tab=sales_portal')}
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
						<span>Confirming & Syncing Receipt...</span>
					{:else}
						<Save class="h-4 w-4" />
						<span>Confirm Receipt & Credit Wallet</span>
					{/if}
				</Button>
			</div>
		</form>
	{/if}
</div>

