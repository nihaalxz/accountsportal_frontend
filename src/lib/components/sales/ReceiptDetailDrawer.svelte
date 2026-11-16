<script lang="ts">
	import { apiFetch } from '$lib/api/api-client';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { DateDisplay } from '$lib/components';
	import {
		X,
		FileText,
		User,
		DollarSign,
		ArrowRight,
		RefreshCw,
		ExternalLink,
		BookOpen
	} from 'lucide-svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		receiptId: number | null;
	}

	let { isOpen, onClose, receiptId }: Props = $props();

	let loading = $state(false);
	let receiptDetail = $state<any>(null);

	async function fetchReceiptDetails() {
		if (!receiptId) return;
		loading = true;
		receiptDetail = null;

		try {
			receiptDetail = await apiFetch<any>(`api/sales-entries/receipts/${receiptId}`);
		} catch (err) {
			console.error('Failed to load receipt details:', err);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (isOpen && receiptId) {
			fetchReceiptDetails();
		}
	});
</script>

{#if isOpen}
	<button
		type="button"
		class="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 transition-opacity w-full h-full cursor-default border-none p-0 bg-transparent block"
		onclick={onClose}
		aria-label="Close details"
	></button>

	<div class="fixed right-0 top-0 h-screen w-full max-w-2xl bg-card border-l border-border shadow-2xl z-50 flex flex-col transition-all duration-300">
		<!-- Header -->
		<div class="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/10 shrink-0">
			<div class="flex items-center gap-2.5">
				<div class="p-2 bg-primary/10 text-primary rounded-xl">
					<FileText class="h-5 w-5" />
				</div>
				<div>
					<h3 class="text-sm font-bold text-foreground">
						Receipt Payment Details
					</h3>
					<p class="text-[10px] text-muted-foreground mt-0.5">
						ID: {receiptDetail?.documentNumber || ''} • Accounting Posting Audit
					</p>
				</div>
			</div>
			<button onclick={onClose} class="p-2 hover:bg-muted text-muted-foreground rounded-lg transition-colors cursor-pointer">
				<X class="h-4.5 w-4.5" />
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-6 bg-muted/5 space-y-6">
			{#if loading}
				<div class="flex flex-col items-center justify-center h-full py-20 gap-3">
					<RefreshCw class="h-8 w-8 text-primary animate-spin" />
					<span class="text-xs text-muted-foreground">Retrieving receipt audit trace...</span>
				</div>
			{:else if receiptDetail}
				<!-- Receipt Summary Card -->
				<div class="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
					<div class="flex justify-between border-b border-border/40 pb-3">
						<div>
							<h4 class="text-sm font-bold text-foreground font-mono">{receiptDetail.documentNumber || receiptDetail.receiptId}</h4>
							<p class="text-xs text-muted-foreground capitalize mt-0.5">{receiptDetail.service} Booking Payment</p>
						</div>
						<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize h-fit
							{receiptDetail.status === 'success' || receiptDetail.status === 'posted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">
							{receiptDetail.status}
						</span>
					</div>

					<div class="grid grid-cols-2 gap-4 text-xs">
						<div><span class="text-muted-foreground">Payer Head Account:</span> <strong class="text-foreground block mt-0.5">{receiptDetail.headName || '—'}</strong></div>
						<div><span class="text-muted-foreground">Payment Method:</span> <span class="capitalize block font-semibold text-foreground mt-0.5">{receiptDetail.paymentMode}</span></div>
						<div><span class="text-muted-foreground">Payer Type:</span> <span class="capitalize block mt-0.5">{receiptDetail.clientType}</span></div>
						<div><span class="text-muted-foreground">Total Receipt Amount:</span> <strong class="text-foreground block font-mono text-sm mt-0.5"><MoneyDisplay amount={receiptDetail.amount} /></strong></div>
						<div><span class="text-muted-foreground">Payment Proof:</span> <span class="block truncate mt-0.5 font-mono text-muted-foreground">{receiptDetail.paymentProof || 'No Proof Attached'}</span></div>
						<div><span class="text-muted-foreground">Logged At:</span> <span class="block font-mono mt-0.5 text-muted-foreground"><DateDisplay value={receiptDetail.createdAt} /></span></div>
					</div>
				</div>

				<!-- Liquidity Destination Accounts (Cash, Bank, Wallet Breakout) -->
				<div class="bg-card border border-border rounded-xl p-5 space-y-3">
					<h4 class="text-xs font-bold uppercase tracking-wider text-foreground">Liquidity Allocation Breakout</h4>
					<div class="grid grid-cols-3 gap-3 text-center text-xs">
						<div class="p-3 bg-muted/30 rounded-xl border border-border/40">
							<span class="text-muted-foreground text-[10px]">Cash Inflow</span>
							<p class="font-bold font-mono mt-1">
								{#if receiptDetail.paymentMode === 'cash'}
									<MoneyDisplay amount={receiptDetail.amount} />
								{:else}
									<span class="text-muted-foreground/35">—</span>
								{/if}
							</p>
						</div>
						<div class="p-3 bg-muted/30 rounded-xl border border-border/40">
							<span class="text-muted-foreground text-[10px]">Bank Transfer</span>
							<p class="font-bold font-mono mt-1">
								{#if receiptDetail.paymentMode === 'bank' || receiptDetail.paymentMode === 'card'}
									<MoneyDisplay amount={receiptDetail.amount} />
									<span class="block text-[9px] font-sans text-muted-foreground mt-0.5 truncate">{receiptDetail.bankName || 'Unknown Bank'}</span>
								{:else}
									<span class="text-muted-foreground/35">—</span>
								{/if}
							</p>
						</div>
						<div class="p-3 bg-muted/30 rounded-xl border border-border/40">
							<span class="text-muted-foreground text-[10px]">Wallet Draw</span>
							<p class="font-bold font-mono mt-1">
								{#if receiptDetail.paymentMode === 'wallet'}
									<MoneyDisplay amount={receiptDetail.amount} />
								{:else}
									<span class="text-muted-foreground/35">—</span>
								{/if}
							</p>
						</div>
					</div>
				</div>

				<!-- Cross-System Accounting Links (Checkpoint 7) -->
				<div class="bg-card border border-border rounded-xl p-5 space-y-4">
					<h4 class="text-xs font-bold uppercase tracking-wider text-foreground">Accounts Portal Audit Navigation</h4>
					<div class="space-y-2 text-xs">
						<!-- Transaction link -->
						<div class="flex items-center justify-between p-2.5 bg-muted/35 hover:bg-muted/70 rounded-xl border border-border/30">
							<div>
								<span class="font-bold text-foreground">Incoming Financial Transaction</span>
								<p class="text-[10px] text-muted-foreground mt-0.5">Audit log of cash/bank collections posting</p>
							</div>
							<a
								href={`/transactions?referenceId=${receiptDetail.bookingId || receiptDetail.id}`}
								class="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg flex items-center gap-1 font-semibold text-[10px]"
							>
								<span>Trace Txn</span>
								<ExternalLink class="h-3 w-3" />
							</a>
						</div>

						<!-- Journal Link -->
						<div class="flex items-center justify-between p-2.5 bg-muted/35 hover:bg-muted/70 rounded-xl border border-border/30">
							<div>
								<span class="font-bold text-foreground">Journal Entry Posting</span>
								<p class="text-[10px] text-muted-foreground mt-0.5">Double-entry ledger journal adjustments</p>
							</div>
							<a
								href={`/accounting/journals?reference=${receiptDetail.receiptId}`}
								class="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg flex items-center gap-1 font-semibold text-[10px]"
							>
								<span>Open Journal</span>
								<ExternalLink class="h-3 w-3" />
							</a>
						</div>
					</div>
				</div>
			{:else}
				<div class="flex items-center justify-center h-full text-muted-foreground py-20 text-xs">
					Failed to load detailed receipt records.
				</div>
			{/if}
		</div>
	</div>
{/if}
