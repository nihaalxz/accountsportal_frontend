<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import PageContainer from '$lib/components/PageContainer.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SectionCard from '$lib/components/SectionCard.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import DateDisplay from '$lib/components/DateDisplay.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { getSuppliers, getSupplierStatement } from '$features/suppliers/api';
	import type { SupplierResponse } from '$features/suppliers/types';
	import type { TransactionResponse } from '$features/financial-transactions/types';
	import { ArrowLeft, ChevronLeft, ChevronRight, Calendar } from 'lucide-svelte';

	const supplierId = Number($page.params.id);

	let isLoading = $state(true);
	let errorMsg = $state<string | null>(null);

	let supplier = $state<SupplierResponse | null>(null);
	let transactions = $state<TransactionResponse[]>([]);

	// Pagination & Filter state
	let currentPage = $state(1);
	let pageSize = $state(20);
	let startDate = $state('');
	let endDate = $state('');

	async function loadStatement() {
		isLoading = true;
		errorMsg = null;
		try {
			const [suppliersList, statementData] = await Promise.all([
				getSuppliers(),
				getSupplierStatement(supplierId, {
					page: currentPage,
					pageSize,
					startDate: startDate || undefined,
					endDate: endDate || undefined
				})
			]);

			supplier = suppliersList.find(s => s.id === supplierId) || null;
			transactions = statementData;
		} catch (err: any) {
			errorMsg = err.message || 'Failed to load statement ledger.';
		} finally {
			isLoading = false;
		}
	}

	function handleSearch(e: Event) {
		e.preventDefault();
		currentPage = 1;
		loadStatement();
	}

	function handlePrev() {
		if (currentPage > 1) {
			currentPage--;
			loadStatement();
		}
	}

	function handleNext() {
		if (transactions.length === pageSize) {
			currentPage++;
			loadStatement();
		}
	}

	onMount(() => {
		loadStatement();
	});
</script>

<PageContainer>
	<PageHeader title={`${supplier?.name || 'Supplier'} Statement Ledger`} description={`Searchable audit statement ledger for Supplier ID ${supplierId}`}>
		<Button variant="outline" onclick={() => goto(`/suppliers/${supplierId}`)}>
			<ArrowLeft class="h-4 w-4 mr-2" />
			Back to Wallet
		</Button>
	</PageHeader>

	<!-- Filters -->
	<div class="p-4 border rounded-lg border-border bg-card">
		<form onsubmit={handleSearch} class="flex flex-col md:flex-row items-end gap-4">
			<div class="flex-1">
				<label class="block text-xs font-semibold mb-1" for="start">Start Date</label>
				<Input type="date" id="start" bind:value={startDate} />
			</div>
			<div class="flex-1">
				<label class="block text-xs font-semibold mb-1" for="end">End Date</label>
				<Input type="date" id="end" bind:value={endDate} />
			</div>
			<Button type="submit">
				Filter Ledger
			</Button>
		</form>
	</div>

	{#if isLoading}
		<div class="flex justify-center py-20">
			<Spinner size="lg" />
		</div>
	{:else if errorMsg}
		<ErrorState message={errorMsg} retryAction={loadStatement} />
	{:else}
		<SectionCard title="Ledger Entries">
			{#if transactions.length === 0}
				<div class="text-center py-12 text-sm text-muted-foreground">
					No transactions found matching your criteria.
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-left border-collapse">
						<thead>
							<tr class="border-b border-border text-xs font-semibold text-muted-foreground uppercase bg-muted/20">
								<th class="p-3">Transaction ID</th>
								<th class="p-3">Type</th>
								<th class="p-3 text-right">Debit / Credit</th>
								<th class="p-3">Payment Method</th>
								<th class="p-3">Reference</th>
								<th class="p-3">Status</th>
								<th class="p-3">Posting Date</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border text-sm">
							{#each transactions as tx}
								<tr class="hover:bg-muted/10 transition-colors">
									<td class="p-3 font-semibold">#{tx.id}</td>
									<td class="p-3">
										<span class="text-[10px] font-mono py-0.5 px-1.5 rounded uppercase {tx.transactionType === 'incoming' || tx.transactionType === 'salesreturn' || tx.transactionType === 'purchasereturn' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}">
											{tx.transactionType}
										</span>
									</td>
									<td class="p-3 text-right font-medium">
										<MoneyDisplay amount={tx.amount} />
									</td>
									<td class="p-3 text-xs uppercase">{tx.paymentMethod}</td>
									<td class="p-3 text-xs font-mono">{tx.referenceId || '—'}</td>
									<td class="p-3">
										<StatusBadge status={tx.status} />
									</td>
									<td class="p-3"><DateDisplay value={tx.createdAt} /></td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Pagination footer -->
				<div class="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border pt-4 mt-4">
					<span class="text-xs text-muted-foreground">Page {currentPage}</span>
					<div class="flex items-center gap-4">
						<div class="flex items-center gap-2">
							<span class="text-xs text-muted-foreground whitespace-nowrap">Rows per page:</span>
							<select
								value={pageSize}
								onchange={(e) => {
									pageSize = Number((e.target as HTMLSelectElement).value);
									currentPage = 1;
									loadStatement();
								}}
								class="bg-background border border-border rounded-xl px-2.5 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
							>
								<option value={10}>10</option>
								<option value={20}>20</option>
								<option value={50}>50</option>
								<option value={100}>100</option>
								<option value={200}>200</option>
								<option value={500}>500</option>
								<option value={1000}>1000 (All)</option>
							</select>
						</div>
						<div class="flex gap-2">
							<Button size="sm" variant="outline" onclick={handlePrev} disabled={currentPage === 1}>
								<ChevronLeft class="h-4 w-4 mr-1" />
								Previous
							</Button>
							<Button size="sm" variant="outline" onclick={handleNext} disabled={transactions.length < pageSize}>
								Next
								<ChevronRight class="h-4 w-4 ml-1" />
							</Button>
						</div>
					</div>
				</div>
			{/if}
		</SectionCard>
	{/if}
</PageContainer>
