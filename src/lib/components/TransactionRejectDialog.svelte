<script lang="ts">
	/**
	 * TransactionRejectDialog — reject dialog requiring a reason.
	 * Gated to master_accountant role.
	 */
	import { rejectTransaction } from '$features/financial-transactions/api';
	import { hasRole } from '$lib/stores/auth';
	import { addToast } from '$lib/stores/toast';
	import { Button } from '$lib/components/ui/button';
	import { Loader2, AlertTriangle } from 'lucide-svelte';

	interface Props {
		transactionId: number | null;
		open: boolean;
		onConfirm?: () => void;
		onClose?: () => void;
	}

	let { transactionId, open = $bindable(false), onConfirm, onClose }: Props = $props();

	let reason = $state('');
	let loading = $state(false);
	let errorMsg = $state<string | null>(null);

	async function handleReject() {
		if (!transactionId) return;

		if (!hasRole('master_accountant')) {
			addToast('Only a Master Accountant can reject transactions.', 'error');
			return;
		}

		if (!reason.trim()) {
			errorMsg = 'Rejection reason is required.';
			return;
		}

		loading = true;
		errorMsg = null;

		try {
			await rejectTransaction(transactionId, { reason });
			addToast(`Transaction #${transactionId} has been rejected.`, 'success');
			reason = '';
			open = false;
			if (onConfirm) onConfirm();
		} catch (err: any) {
			errorMsg = err.message || 'Failed to reject transaction.';
			addToast(errorMsg ?? '', 'error');
		} finally {
			loading = false;
		}
	}

	function handleCancel() {
		if (loading) return;
		reason = '';
		errorMsg = null;
		if (onClose) onClose();
		open = false;
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="reject-title"
		aria-describedby="reject-desc"
	>
		<div
			class="w-full max-w-[480px] bg-card border border-border rounded-3xl p-6 shadow-xl flex flex-col gap-4 animate-scaleUp"
		>
			<div class="flex items-start gap-4">
				<div class="p-3 bg-red-100 dark:bg-red-950/20 text-red-600 rounded-2xl shrink-0">
					<AlertTriangle class="h-6 w-6" />
				</div>

				<div class="flex-1 min-w-0">
					<h2 id="reject-title" class="text-sm font-bold text-foreground leading-tight">
						Reject Transaction
					</h2>
					<p id="reject-desc" class="text-xs text-muted-foreground mt-2 leading-relaxed">
						Please provide a reason for rejecting transaction #{transactionId}. This
						action is irreversible.
					</p>
				</div>
			</div>

			<!-- Reject Reason Textarea -->
			<div class="flex flex-col gap-1.5 mt-2">
				<label for="reject-reason" class="text-xs font-semibold text-muted-foreground"
					>Reason</label
				>
				<textarea
					id="reject-reason"
					bind:value={reason}
					rows="3"
					class="w-full text-xs p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder-muted-foreground/60 leading-relaxed resize-none"
					placeholder="Describe why this transaction is being rejected..."
					disabled={loading}></textarea>
			</div>

			{#if errorMsg}
				<div
					class="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold leading-relaxed"
				>
					{errorMsg}
				</div>
			{/if}

			<div class="flex items-center justify-end gap-2 mt-2">
				<Button
					variant="outline"
					onclick={handleCancel}
					disabled={loading}
					class="rounded-xl font-semibold text-xs py-5 px-4 cursor-pointer"
				>
					Cancel
				</Button>
				<Button
					onclick={handleReject}
					disabled={loading}
					variant="destructive"
					class="rounded-xl font-semibold text-xs py-5 px-4 cursor-pointer"
				>
					{#if loading}
						<Loader2 class="h-3.5 w-3.5 animate-spin mr-1.5" />
						<span>Rejecting...</span>
					{:else}
						<span>Reject Transaction</span>
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}
