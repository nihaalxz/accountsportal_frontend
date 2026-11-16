<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { hasRole } from '$lib/stores/auth';
	import { getBanks, toggleBankStatus } from '$features/bank-accounts/api';
	import type { BankResponse } from '$features/bank-accounts/types';
	import { getTransactions } from '$features/financial-transactions/api';
	import type { TransactionResponse } from '$features/financial-transactions/types';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import FormattedNarrative from '$lib/components/financial/FormattedNarrative.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { addToast } from '$lib/stores/toast';
	import { previewDocument } from '$lib/utils/preview-document';
	import {
		ArrowLeft,
		Power,
		Pencil,
		Landmark,
		FileSpreadsheet,
		FileDown,
		Search,
		Calendar,
		X,
		Receipt
	} from 'lucide-svelte';
	import { DateDisplay } from '$lib/components';
	import { formatDateOnly, getBahrainDateString } from '$lib/formatters/date';

	const bankId = parseInt($page.params.id ?? '', 10);

	let bank = $state<BankResponse | null>(null);
	let loading = $state(true);
	let errorMsg = $state<string | null>(null);
	let correlationId = $state('');
	let transactions = $state<TransactionResponse[]>([]);
	let loadingTransactions = $state(false);

	// Date filtering & Search state
	let startDate = $state('');
	let endDate = $state('');
	let activePreset = $state<'all' | 'today' | 'this_month' | 'last_30' | 'this_year'>('all');
	let searchQuery = $state('');

	function formatDateForInput(d: Date): string {
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function applyPreset(preset: 'all' | 'today' | 'this_month' | 'last_30' | 'this_year') {
		activePreset = preset;
		const now = new Date();
		if (preset === 'today') {
			const todayStr = formatDateForInput(now);
			startDate = todayStr;
			endDate = todayStr;
		} else if (preset === 'this_month') {
			const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
			startDate = formatDateForInput(startOfMonth);
			endDate = formatDateForInput(now);
		} else if (preset === 'last_30') {
			const past30 = new Date();
			past30.setDate(now.getDate() - 30);
			startDate = formatDateForInput(past30);
			endDate = formatDateForInput(now);
		} else if (preset === 'this_year') {
			const startOfYear = new Date(now.getFullYear(), 0, 1);
			startDate = formatDateForInput(startOfYear);
			endDate = formatDateForInput(now);
		} else {
			startDate = '';
			endDate = '';
		}
	}

	function resetFilters() {
		startDate = '';
		endDate = '';
		searchQuery = '';
		activePreset = 'all';
	}

	const filteredTransactions = $derived.by(() => {
		let list = transactions;
		if (startDate) {
			const start = new Date(startDate + 'T00:00:00').getTime();
			list = list.filter((t) => new Date(t.createdAt).getTime() >= start);
		}
		if (endDate) {
			const end = new Date(endDate + 'T23:59:59').getTime();
			list = list.filter((t) => new Date(t.createdAt).getTime() <= end);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.trim().toLowerCase();
			list = list.filter(
				(t) =>
					(t.documentNumber && t.documentNumber.toLowerCase().includes(q)) ||
					(t.displayNarrative && t.displayNarrative.toLowerCase().includes(q)) ||
					(t.displayDescription && t.displayDescription.toLowerCase().includes(q)) ||
					(t.description && t.description.toLowerCase().includes(q)) ||
					(t.referenceId && String(t.referenceId).toLowerCase().includes(q))
			);
		}
		return list;
	});

	const statementRows = $derived.by(() => {
		const currentBank = bank;
		if (!currentBank) return [];
		let bal = currentBank.balance;
		const mapped = transactions.map((t) => {
			const isDebit = t.destinationBankId === currentBank.id;
			const debit = isDebit ? t.amount : 0;
			const credit = !isDebit ? t.amount : 0;
			bal += debit - credit;
			return { t, debit, credit, bal };
		});

		const filteredIds = new Set(filteredTransactions.map((x) => x.id));
		return mapped.filter((row) => filteredIds.has(row.t.id)).reverse();
	});

	const filterSummary = $derived.by(() => {
		let totalDebit = 0;
		let totalCredit = 0;
		for (const r of statementRows) {
			totalDebit += r.debit;
			totalCredit += r.credit;
		}
		return {
			totalDebit,
			totalCredit,
			netChange: totalDebit - totalCredit,
			count: statementRows.length
		};
	});

	async function loadBankDetail() {
		loading = true;
		errorMsg = null;
		correlationId = '';

		if (isNaN(bankId) || bankId <= 0) {
			errorMsg = 'Invalid bank identifier.';
			loading = false;
			return;
		}

		try {
			// Workaround (GAP-005): Locate details from list
			const list = await getBanks();
			const match = list.find((b) => b.id === bankId);
			if (match) {
				bank = match;
				await loadBankTransactions();
			} else {
				errorMsg = `Bank account #${bankId} was not found.`;
			}
		} catch (err: any) {
			errorMsg = err.message || 'Failed to fetch bank details.';
			correlationId = err.correlationId || '';
		} finally {
			loading = false;
		}
	}

	async function loadBankTransactions() {
		if (!bank) return;
		loadingTransactions = true;
		try {
			const res = await getTransactions({ bankId: bank.id, pageSize: 1000 });
			// Filter to approved transactions and sort by date ascending for correct running balances
			transactions = res
				.filter((t) => t.status.toLowerCase() === 'approved')
				.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
		} catch (err: any) {
			addToast(err.message || 'Failed to load bank transaction history.', 'error');
		} finally {
			loadingTransactions = false;
		}
	}

	import { exportToCSV as downloadCSV } from '$lib/utils/csv-exporter';

	function handleExportCSV() {
		const currentBank = bank;
		const rowsData = statementRows;
		if (!currentBank || rowsData.length === 0) return;
		const headers = [
			'ID',
			'Date',
			'Description',
			'Debit (BHD)',
			'Credit (BHD)',
			'Reference'
		];

		const rows = rowsData.map((row) => [
			row.t.documentNumber,
			row.t.createdAt ? formatDateOnly(row.t.createdAt) : '',
			row.t.displayNarrative || row.t.displayDescription || row.t.description || '',
			row.debit > 0 ? row.debit : '',
			row.credit > 0 ? row.credit : '',
			row.t.referenceId ? `${row.t.referenceType ?? ''} #${row.t.referenceId}` : ''
		]);

		const sanitizedName = currentBank.bankName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
		const dateSuffix =
			startDate || endDate ? `_${startDate || 'start'}_to_${endDate || 'end'}` : '';
		downloadCSV(
			`statement_${sanitizedName}${dateSuffix}_${getBahrainDateString()}.csv`,
			headers,
			rows
		);
		addToast('CSV statement exported successfully.', 'success');
	}

	function handleExportPDF() {
		const currentBank = bank;
		if (!currentBank) return;
		previewDocument('report', 'bank-statement', { bankId: currentBank.id, startDate, endDate });
		addToast('Generating PDF statement...', 'info');
	}

	async function handleToggleStatus() {
		if (!bank) return;
		if (!hasRole('master_accountant')) {
			addToast('Only a Master Accountant can toggle bank account status.', 'error');
			return;
		}

		try {
			await toggleBankStatus(bank.id);
			addToast('Bank status updated successfully.', 'success');
			loadBankDetail();
		} catch (err: any) {
			addToast(err.message || 'Failed to toggle status.', 'error');
		}
	}

	onMount(() => {
		loadBankDetail();
	});
</script>

<svelte:head>
	<title>Bank Account Detail — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Back button -->
	<button
		onclick={() => goto('/banks')}
		class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
	>
		<ArrowLeft class="h-3.5 w-3.5" />
		<span>Back to Banks</span>
	</button>

	{#if loading}
		<div class="animate-pulse space-y-6">
			<div class="h-10 w-2/3 bg-muted rounded-lg"></div>
			<div class="h-44 bg-muted rounded-2xl"></div>
			<div class="h-32 bg-muted rounded-2xl"></div>
		</div>
	{:else if errorMsg}
		<ErrorState message={errorMsg} {correlationId} retryAction={loadBankDetail} />
	{:else if bank}
		<!-- Detail Header -->
		<div
			class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-6 rounded-3xl shadow-xs"
		>
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<span class="text-lg font-bold text-foreground">{bank.bankName}</span>
					<span
						class={[
							'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
							bank.isActive
								? 'text-emerald-700 bg-emerald-50 border-emerald-200'
								: 'text-muted-foreground bg-muted border-border'
						].join(' ')}
					>
						{bank.isActive ? 'Active' : 'Inactive'}
					</span>
				</div>
				<div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
					<span class="font-mono tracking-wider">Account: {bank.accountNumber}</span>
					<span>•</span>
					<span>Registered on <DateDisplay value={bank.createdAt} /></span>
				</div>
			</div>

			<div class="flex flex-wrap gap-2">
				{#if hasRole('master_accountant')}
					<!-- Edit -->
					<!-- Create Receipt -->
					<Button
						variant="outline"
						class="h-8.5 rounded-xl font-semibold text-xs cursor-pointer flex items-center gap-1"
						onclick={() => goto(`/sales/receipts/new?bankId=${bank?.id}`)}
						title="Record receipt deposited to this bank account"
					>
						<Receipt class="h-3.5 w-3.5" />
						<span>New Receipt</span>
					</Button>

					<Button
						variant="outline"
						class="h-8.5 rounded-xl font-semibold text-xs cursor-pointer flex items-center gap-1"
						onclick={() => goto(`/banks?edit=${bank?.id}`)}
					>
						<Pencil class="h-3.5 w-3.5" />
						<span>Edit Account</span>
					</Button>

					<!-- Status toggle -->
					<Button
						variant="outline"
						class={[
							'h-8.5 rounded-xl font-semibold text-xs cursor-pointer flex items-center gap-1',
							bank.isActive
								? 'text-red-600 hover:text-red-700 hover:bg-red-50'
								: 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
						].join(' ')}
						onclick={handleToggleStatus}
					>
						<Power class="h-3.5 w-3.5" />
						<span>{bank.isActive ? 'Deactivate' : 'Activate'}</span>
					</Button>
				{/if}
			</div>
		</div>

		<!-- Balance grid -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<div class="bg-card border border-border rounded-2xl p-5 shadow-xs">
				<span class="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1"
					>Opening Balance</span
				>
				<span class="text-xl font-bold text-foreground">
					<MoneyDisplay amount={bank.balance} />
				</span>
			</div>
			<div class="bg-card border border-border rounded-2xl p-5 shadow-xs bg-primary/5">
				<span class="text-xs font-bold text-primary uppercase tracking-wider block mb-1"
					>Treasury Running Balance</span
				>
				<span class="text-2xl font-bold text-foreground">
					<MoneyDisplay amount={bank.currentBalance} />
				</span>
			</div>
		</div>

		<!-- Bank movements section -->
		<div class="space-y-4">
			<div
				class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-3"
			>
				<h2
					class="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5"
				>
					<Landmark class="h-4.5 w-4.5 text-muted-foreground" />
					<span>Bank Statement</span>
				</h2>

				{#if statementRows.length > 0}
					<div class="flex gap-2">
						<Button
							variant="outline"
							class="h-7.5 text-[11px] font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
							onclick={handleExportCSV}
						>
							<FileSpreadsheet class="h-3.5 w-3.5" /> Export CSV
						</Button>
						<Button
							variant="outline"
							class="h-7.5 text-[11px] font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
							onclick={handleExportPDF}
						>
							<FileDown class="h-3.5 w-3.5" /> Export PDF
						</Button>
					</div>
				{/if}
			</div>

			<!-- Filtering toolbar -->
			<div class="bg-card border border-border p-4 rounded-2xl space-y-3 shadow-xs">
				<!-- Quick Date Presets -->
				<div
					class="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3"
				>
					<div class="flex flex-wrap items-center gap-1.5 text-xs">
						<span class="text-xs font-medium text-muted-foreground mr-1 flex items-center gap-1">
							<Calendar class="h-3.5 w-3.5" /> Filter Range:
						</span>
						<button
							type="button"
							onclick={() => applyPreset('all')}
							class="px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer {activePreset ===
								'all' &&
							!startDate &&
							!endDate
								? 'bg-primary text-primary-foreground border-primary'
								: 'border-border bg-background hover:bg-muted text-muted-foreground'}"
						>
							All Time
						</button>
						<button
							type="button"
							onclick={() => applyPreset('today')}
							class="px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer {activePreset ===
							'today'
								? 'bg-primary text-primary-foreground border-primary'
								: 'border-border bg-background hover:bg-muted text-muted-foreground'}"
						>
							Today
						</button>
						<button
							type="button"
							onclick={() => applyPreset('this_month')}
							class="px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer {activePreset ===
							'this_month'
								? 'bg-primary text-primary-foreground border-primary'
								: 'border-border bg-background hover:bg-muted text-muted-foreground'}"
						>
							This Month
						</button>
						<button
							type="button"
							onclick={() => applyPreset('last_30')}
							class="px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer {activePreset ===
							'last_30'
								? 'bg-primary text-primary-foreground border-primary'
								: 'border-border bg-background hover:bg-muted text-muted-foreground'}"
						>
							Last 30 Days
						</button>
						<button
							type="button"
							onclick={() => applyPreset('this_year')}
							class="px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer {activePreset ===
							'this_year'
								? 'bg-primary text-primary-foreground border-primary'
								: 'border-border bg-background hover:bg-muted text-muted-foreground'}"
						>
							This Year
						</button>
					</div>

					{#if startDate || endDate || searchQuery}
						<Button
							variant="ghost"
							size="sm"
							onclick={resetFilters}
							class="h-7 text-xs rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
						>
							<X class="h-3.5 w-3.5 mr-1" /> Reset Filters
						</Button>
					{/if}
				</div>

				<!-- Date Range inputs & Text search -->
				<div
					class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs"
				>
					<!-- Search -->
					<div class="relative flex-1">
						<Search
							class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
						/>
						<Input
							type="text"
							placeholder="Search by ID, narrative, description, ref..."
							bind:value={searchQuery}
							class="pl-9 h-9 text-xs rounded-xl"
						/>
					</div>

					<!-- Date range -->
					<div class="flex items-center gap-2">
						<div class="flex items-center gap-1.5">
							<span class="text-muted-foreground font-medium text-[11px]">From:</span>
							<Input
								type="date"
								bind:value={startDate}
								onchange={() => (activePreset = 'all')}
								class="h-9 text-xs rounded-xl w-36"
							/>
						</div>
						<span class="text-muted-foreground font-semibold">to</span>
						<div class="flex items-center gap-1.5">
							<span class="text-muted-foreground font-medium text-[11px]">To:</span>
							<Input
								type="date"
								bind:value={endDate}
								onchange={() => (activePreset = 'all')}
								class="h-9 text-xs rounded-xl w-36"
							/>
						</div>
					</div>
				</div>

				<!-- Filter summary statistics -->
				{#if startDate || endDate || searchQuery}
					<div
						class="flex flex-wrap items-center justify-between text-xs pt-2 border-t border-border/40 text-muted-foreground"
					>
						<div>
							Showing <strong>{filterSummary.count}</strong> of {transactions.length} entries
							{#if startDate || endDate}
								<span>({startDate || 'Start'} &rarr; {endDate || 'Present'})</span>
							{/if}
						</div>
						<div class="flex gap-4 font-mono text-[11px]">
							<span class="text-emerald-600 font-semibold"
								>Total Deposits: <MoneyDisplay amount={filterSummary.totalDebit} /></span
							>
							<span class="text-red-600 font-semibold"
								>Total Outflows: <MoneyDisplay amount={filterSummary.totalCredit} /></span
							>
							<span class="font-bold text-foreground"
								>Net Change: <MoneyDisplay amount={filterSummary.netChange} /></span
							>
						</div>
					</div>
				{/if}
			</div>

			{#if loadingTransactions}
				<div class="space-y-3">
					<div class="h-10 bg-muted rounded-xl animate-pulse"></div>
					<div class="h-24 bg-muted rounded-xl animate-pulse"></div>
				</div>
			{:else if statementRows.length === 0}
				<div
					class="text-center p-8 bg-card border border-border rounded-2xl text-xs text-muted-foreground space-y-2"
				>
					<p class="font-medium">No transactions found matching the selected filter criteria.</p>
					{#if startDate || endDate || searchQuery}
						<Button
							variant="outline"
							size="sm"
							onclick={resetFilters}
							class="h-7 rounded-lg text-xs cursor-pointer"
						>
							Clear Filters
						</Button>
					{/if}
				</div>
			{:else}
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
										<td class="p-4 font-mono font-medium text-muted-foreground"
											>{row.t.documentNumber}</td
										>
										<td class="p-4 text-muted-foreground">
											{new Date(row.t.createdAt).toLocaleDateString()}
										</td>
										<td class="p-4 font-medium text-foreground">
											<FormattedNarrative
												text={row.t.displayNarrative ||
													row.t.displayDescription ||
													row.t.description}
											/>
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
													<span class="text-[9px] bg-muted px-1.5 py-0.2 rounded ml-1 uppercase"
														>{row.t.referenceType}</span
													>
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

