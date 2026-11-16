<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { hasRole } from '$lib/stores/auth';
	import { apiFetch } from '$lib/api/api-client';
	import { ReceiptRealtimeController } from '$lib/realtime/receipt-realtime-controller';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import { toast } from '$lib/stores/toast';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { DateDisplay } from '$lib/components';
	import { Button } from '$lib/components/ui/button';
	import { getAccounts } from '$features/cash-accounts/api';
	import type { AccountResponse } from '$features/cash-accounts/types';
	import {
		ArrowLeft,
		FileText,
		RefreshCw,
		CreditCard,
		X,
		AlertCircle,
		Printer
	} from 'lucide-svelte';
	import { getSalesPortalFileUrl } from '$lib/config';
	import { Input } from '$lib/components/ui/input';
	import { previewDocument } from '$lib/utils/preview-document';

	let receiptDetail = $state<any>(null);
	const receiptParam = $derived($page.params.id ?? '');
	const parsedId = $derived(parseInt(receiptParam));
	const receiptId = $derived(receiptDetail?.id || (!isNaN(parsedId) && parsedId > 0 ? parsedId : 0));

	let loading = $state(false);
	let actionLoading = $state(false);
	let error = $state<string | null>(null);

	let cashAccounts = $state<AccountResponse[]>([]);
	let selectedCashAccountIdVal = $state('');

	let realtimeController: ReceiptRealtimeController | null = null;

	// Confirmation modal state
	let showConfirmModal = $state(false);
	let showReferenceIdModal = $state(false);
	let onlineReferenceIdVal = $state('');
	let refIdModalError = $state<string | null>(null);
	let confirmTitle = $state('');
	let confirmMessage = $state('');
	let confirmActionLabel = $state('');
	let confirmIsDestructive = $state(false);
	let targetStatusToApply = $state('');

	onMount(() => {
		realtimeController = new ReceiptRealtimeController({
			isGlobalList: true,
			isApprovalQueue: true,
			onReceiptChanged: () => fetchReceiptDetails()
		});
		realtimeController.mount();
	});

	onDestroy(() => {
		realtimeController?.unmount();
	});

	// Map service name to segment
	function getSegment(type: string): string {
		const clean = (type ?? '').toLowerCase().replace(/_/g, '').trim();
		if (clean.includes('flight')) return 'flights';
		if (clean.includes('hotel')) return 'hotels';
		if (clean.includes('visa')) return 'visa';
		if (clean.includes('vfs')) return 'vfs';
		if (clean.includes('holiday') || clean.includes('package')) return 'holiday-packages';
		if (clean.includes('transport')) return 'transportation';
		if (clean.includes('other')) return 'other-services';
		return type;
	}

	async function loadCashAccounts() {
		try {
			const res = await getAccounts();
			cashAccounts = res.filter((a) => a.type.toLowerCase() === 'cash' && a.isActive);
		} catch (err) {
			console.error('Failed to load cash accounts', err);
		}
	}

	async function fetchReceiptDetails() {
		if (!receiptParam || receiptParam.trim() === '' || receiptParam === '0') {
			error = 'Invalid receipt identifier.';
			return;
		}
		loading = true;
		error = null;
		try {
			receiptDetail = await apiFetch<any>(`api/sales-entries/receipts/${encodeURIComponent(receiptParam.trim())}`);
			const isCash = receiptDetail?.paymentMode?.toLowerCase() === 'cash';
			if (isCash) {
				await loadCashAccounts();
			}
		} catch (err: any) {
			error = err?.message || 'Failed to load receipt details.';
			console.error('Failed to load receipt details:', err);
		} finally {
			loading = false;
		}
	}

	const isOnlinePayment = $derived.by(() => {
		if (!receiptDetail) return false;
		const pm = (
			receiptDetail.paymentMode ||
			receiptDetail.paymentMethod ||
			receiptDetail.payment_mode ||
			receiptDetail.payment_method ||
			''
		)
			.toLowerCase()
			.trim();
		if (pm === 'cash' || pm === 'wallet' || pm.includes('wallet')) return false;
		return true;
	});

	function requestStatusChange(newStatus: string) {
		if (actionLoading || !receiptDetail) return;

		targetStatusToApply = newStatus;
		const pm = (
			receiptDetail.paymentMode ||
			receiptDetail.paymentMethod ||
			receiptDetail.payment_mode ||
			receiptDetail.payment_method ||
			''
		)
			.toLowerCase()
			.trim();
		const isCash = pm === 'cash';

		if (newStatus === 'success') {
			if (isCash && !selectedCashAccountIdVal) {
				toast.warning('Please select a destination cash account before approving.');
				return;
			}

			if (isOnlinePayment) {
				onlineReferenceIdVal =
					receiptDetail.paymentReference ||
					receiptDetail.paymentReferenceId ||
					receiptDetail.referenceId ||
					'';
				refIdModalError = null;
				showReferenceIdModal = true;
				return;
			}
		}

		const docRef = receiptDetail?.documentNumber || `#${receiptId}`;

		if (newStatus === 'success') {
			confirmTitle = 'Approve Payment Receipt';
			confirmMessage = `Are you sure you want to approve Receipt ${docRef}? This will confirm the collection and apply financial postings.`;
			confirmActionLabel = 'Approve Payment';
			confirmIsDestructive = false;
		} else {
			confirmTitle = 'Reject Payment Receipt';
			confirmMessage = `Are you sure you want to reject Receipt ${docRef}? This will mark the payment receipt status as Failed.`;
			confirmActionLabel = 'Reject Payment';
			confirmIsDestructive = true;
		}
		showConfirmModal = true;
	}

	async function executeStatusUpdate(refId?: string) {
		if (!receiptDetail) return;
		const statusToApply = targetStatusToApply || 'success';
		actionLoading = true;
		refIdModalError = null;

		try {
			const cashAccountId = selectedCashAccountIdVal
				? parseInt(selectedCashAccountIdVal)
				: null;
			const endpoint = `api/sales-entries/receipts/${receiptId}/payment-status`;

			await apiFetch<any>(endpoint, {
				method: 'POST',
				body: JSON.stringify({
					status: statusToApply,
					cashAccountId: cashAccountId,
					referenceId: refId || null
				})
			});
			toast.success(
				statusToApply === 'success'
					? 'Payment receipt approved successfully.'
					: 'Payment receipt rejected.'
			);
			showReferenceIdModal = false;
			showConfirmModal = false;
			await fetchReceiptDetails();
		} catch (err: any) {
			const msg = err?.message ?? 'Failed to update payment status.';
			toast.error(msg);
			if (showReferenceIdModal) {
				refIdModalError = msg;
			}
		} finally {
			actionLoading = false;
		}
	}

	$effect(() => {
		if (receiptParam) {
			fetchReceiptDetails();
		}
	});

	function statusClass(status: string): string {
		const s = (status ?? '').toLowerCase();
		if (s === 'success' || s === 'posted') {
			return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
		}
		if (s === 'pending' || s === 'processing') {
			return 'bg-amber-50 text-amber-700 border border-amber-200';
		}
		return 'bg-red-50 text-red-700 border border-red-200';
	}
</script>

<svelte:head>
	<title>Receipt {receiptDetail?.documentNumber || ''} — Accounts Portal</title>
</svelte:head>

<div class="space-y-6 print:space-y-2">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
		<div class="flex items-center gap-3">
			<Button
				variant="outline"
				class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs"
				onclick={() => goto('/sales/receipts')}
			>
				<ArrowLeft class="h-3.5 w-3.5" /> Back to Receipts
			</Button>
			<div>
				<h1 class="text-xl font-bold text-foreground flex items-center gap-2">
					Receipt <span class="font-mono text-primary"
						>{receiptDetail?.documentNumber || ''}</span
					>
				</h1>
				{#if receiptDetail}
					<p class="text-xs text-muted-foreground mt-0.5 font-mono">
						Receipt Ref: {receiptDetail.documentNumber || receiptDetail.receiptId}
					</p>
				{/if}
			</div>
		</div>
		<div class="flex items-center gap-2">
			{#if receiptDetail}
				<Button
					variant="default"
					class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs bg-primary text-primary-foreground"
					onclick={() => previewDocument('receipt', 'receipt', receiptId)}
				>
					<Printer class="h-3.5 w-3.5" /> Print Receipt
				</Button>
			{/if}
			<Button
				variant="outline"
				class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs"
				onclick={fetchReceiptDetails}
				disabled={loading}
			>
				<RefreshCw class={['h-3.5 w-3.5', loading ? 'animate-spin' : ''].join(' ')} /> Reload
			</Button>
		</div>
	</div>

	<!-- Main Details Area -->
	{#if loading && !receiptDetail}
		<div
			class="bg-card border border-border rounded-2xl p-16 flex items-center justify-center animate-pulse"
		>
			<RefreshCw class="h-8 w-8 text-primary animate-spin" />
		</div>
	{:else if error}
		<div class="bg-card border border-border rounded-2xl p-16 text-center text-red-600 text-sm">
			{error}
		</div>
	{:else if receiptDetail}
		<div class="max-w-3xl mx-auto">
			<!-- General Summary Card -->
			<div class="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-xs font-sans">
				<div class="flex justify-between border-b border-border/40 pb-4">
					<div class="flex items-center gap-3">
						<div class="p-2.5 bg-primary/10 text-primary rounded-xl">
							<FileText class="h-6 w-6" />
						</div>
						<div>
							<h3 class="text-sm font-bold text-foreground">Receipt Summary</h3>
							<p
								class="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-semibold"
							>
								{receiptDetail.service} Booking Payment
							</p>
						</div>
					</div>
					<span
						class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold capitalize h-fit border {statusClass(
							receiptDetail.status
						)}"
					>
						{receiptDetail.status}
					</span>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs leading-relaxed">
					<div class="space-y-1">
						<span class="text-muted-foreground block">Payer Head Account</span>
						<strong class="text-foreground text-sm block"
							>{receiptDetail.headName || '—'}</strong
						>
						<span
							class="text-[10px] text-muted-foreground/80 bg-muted px-2 py-0.5 rounded capitalize"
							>{receiptDetail.clientType}</span
						>
					</div>
					<div class="space-y-1">
						<span class="text-muted-foreground block">Payment Mode / Method</span>
						<span class="capitalize text-sm font-semibold text-foreground block"
							>{receiptDetail.paymentMode}</span
						>
					</div>
					<div class="space-y-1">
						<span class="text-muted-foreground block">Total Receipt Amount</span>
						<strong class="text-foreground font-mono text-base block"
							><MoneyDisplay amount={receiptDetail.amount} /></strong
						>
					</div>
					<div class="space-y-1">
						<span class="text-muted-foreground block">Logged At</span>
						<span class="block font-mono text-muted-foreground text-sm"
							><DateDisplay value={receiptDetail.createdAt} /></span
						>
					</div>
					{#if receiptDetail.bankName}
						<div class="space-y-1">
							<span class="text-muted-foreground block">Target Bank</span>
							<span class="font-semibold text-primary text-sm block"
								>{receiptDetail.bankName}</span
							>
						</div>
					{/if}
					{#if receiptDetail.narration}
						<div class="sm:col-span-2 space-y-1">
							<span class="text-muted-foreground block">Narration / Note</span>
							<p class="text-foreground text-xs leading-relaxed bg-muted/20 p-3 rounded-xl border border-border/40 font-medium">
								{receiptDetail.narration}
							</p>
						</div>
					{/if}
					<div class="sm:col-span-2 space-y-1">
						<span class="text-muted-foreground block">Payment Proof / Reference</span>
						<div
							class="flex items-center gap-3 font-mono text-muted-foreground bg-muted/30 p-2.5 rounded-xl border border-border/40 break-all"
						>
							{#if receiptDetail.paymentProof}
								<span
									class="truncate max-w-[200px] sm:max-w-[400px]"
									title={receiptDetail.paymentProof}
								>
									{receiptDetail.paymentProof.split('/').pop()}
								</span>
								<div class="ml-auto flex gap-2">
									<a
										href={getSalesPortalFileUrl(receiptDetail.paymentProof)}
										target="_blank"
										rel="noopener noreferrer"
										class="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer inline-flex items-center"
									>
										View
									</a>
									<a
										href={getSalesPortalFileUrl(receiptDetail.paymentProof)}
										download
										class="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer inline-flex items-center"
									>
										Download
									</a>
								</div>
							{:else}
								<span>No Proof Attached</span>
							{/if}
						</div>
					</div>
				</div>

				<!-- Destination Cash Account Selector (only when pending & cash payment mode & normal_accountant) -->
				{#if receiptDetail.status?.toLowerCase() === 'pending' && receiptDetail.paymentMode?.toLowerCase() === 'cash' && hasRole('normal_accountant')}
					<div class="flex flex-col gap-1.5 pt-4 border-t border-border/40 text-xs">
						<label for="cashAccountId" class="font-semibold text-muted-foreground"
							>Destination Cash Account</label
						>
						<select
							id="cashAccountId"
							class="h-9.5 w-full bg-background border border-border rounded-xl px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground disabled:opacity-50"
							disabled={actionLoading}
							bind:value={selectedCashAccountIdVal}
						>
							<option value="">-- Select Cash Account --</option>
							{#each cashAccounts as acc}
								<option value={String(acc.id)}
									>{acc.name} (Bal: {acc.currentBalance.toFixed(3)} BHD)</option
								>
							{/each}
						</select>
					</div>
				{/if}

				<!-- Action Buttons (Approve / Reject) (only when normal_accountant) -->
				{#if receiptDetail.status?.toLowerCase() === 'pending' && hasRole('normal_accountant')}
					<div class="flex gap-3 pt-4 border-t border-border/40 justify-end">
						<button
							class="px-4 py-2 text-xs font-bold rounded-xl cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
							onclick={() => requestStatusChange('success')}
							disabled={actionLoading ||
								(receiptDetail.paymentMode?.toLowerCase() === 'cash' &&
									!selectedCashAccountIdVal)}
						>
							{#if actionLoading}
								<RefreshCw class="h-3.5 w-3.5 animate-spin" />
							{/if}
							Approve Payment
						</button>
						<button
							class="px-4 py-2 text-xs font-bold rounded-xl cursor-pointer bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 transition-all shadow-sm"
							onclick={() => requestStatusChange('failed')}
							disabled={actionLoading}
						>
							{#if actionLoading}
								<RefreshCw class="h-3.5 w-3.5 animate-spin" />
							{/if}
							Reject Payment
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<ConfirmationDialog
		bind:open={showConfirmModal}
		title={confirmTitle}
		message={confirmMessage}
		confirmLabel={confirmActionLabel}
		isDestructive={confirmIsDestructive}
		onConfirm={executeStatusUpdate}
	/>

	<!-- Online Payment Reference ID Modal -->
	{#if showReferenceIdModal}
		<div
			class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
		>
			<div
				class="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 font-sans"
			>
				<div class="flex items-center justify-between border-b border-border/40 pb-3">
					<div class="flex items-center gap-2">
						<CreditCard class="h-5 w-5 text-primary" />
						<h3 class="text-base font-bold text-foreground">Enter Bank Reference ID</h3>
					</div>
					<button
						onclick={() => (showReferenceIdModal = false)}
						class="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
					>
						<X class="h-4 w-4" />
					</button>
				</div>

				<p class="text-xs text-muted-foreground leading-relaxed">
					Please enter the unique Bank / Online Transaction Reference ID for Receipt <span
						class="font-semibold text-foreground font-mono"
						>{receiptDetail?.documentNumber || receiptDetail?.receiptId || `#${receiptId}`}</span
					>. Duplicate reference IDs are strictly prohibited and cannot be reused.
				</p>

				<form
					onsubmit={(e) => {
						e.preventDefault();
						if (!onlineReferenceIdVal.trim()) {
							toast.error('Bank Reference ID is required for online payments.');
							return;
						}
						targetStatusToApply = 'success';
						executeStatusUpdate(onlineReferenceIdVal.trim());
					}}
					class="space-y-4"
				>
					<div class="space-y-1.5">
						<label for="refIdInputReceipt" class="text-xs font-semibold text-foreground"
							>Transaction Reference ID *</label
						>
						<Input
							id="refIdInputReceipt"
							type="text"
							placeholder="e.g. TXN-987654321"
							bind:value={onlineReferenceIdVal}
							oninput={() => (refIdModalError = null)}
							required
							class={[
								'text-xs font-mono',
								refIdModalError ? 'border-red-500 ring-2 ring-red-500/20' : ''
							].join(' ')}
						/>
						{#if refIdModalError}
							<p
								class="text-[11px] font-semibold text-red-600 flex items-center gap-1 mt-1.5 animate-in fade-in duration-150"
							>
								<AlertCircle class="h-3.5 w-3.5 shrink-0 text-red-600" />
								<span>{refIdModalError}</span>
							</p>
						{/if}
					</div>

					<div class="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
						<Button
							type="button"
							variant="outline"
							class="rounded-xl h-9 text-xs cursor-pointer"
							disabled={actionLoading}
							onclick={() => (showReferenceIdModal = false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							class="rounded-xl h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
							disabled={actionLoading || !onlineReferenceIdVal.trim()}
						>
							{#if actionLoading}
								<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />
							{/if}
							Confirm & Approve Payment
						</Button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
