<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Loader2, AlertTriangle } from 'lucide-svelte';

	interface Props {
		open: boolean;
		paymentAmount?: number | null;
		paymentDescription?: string | null;
		loading?: boolean;
		onConfirm: (reason: string) => void;
		onClose: () => void;
	}

	let {
		open = $bindable(false),
		paymentAmount = null,
		paymentDescription = null,
		loading = false,
		onConfirm,
		onClose
	}: Props = $props();

	let reason = $state('');
	let errorMsg = $state<string | null>(null);

	function handleConfirm() {
		if (!reason.trim()) {
			errorMsg = 'Rejection reason is required.';
			return;
		}
		errorMsg = null;
		onConfirm(reason.trim());
	}

	function handleCancel() {
		if (loading) return;
		reason = '';
		errorMsg = null;
		onClose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) handleCancel();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') handleCancel();
	}

	$effect(() => {
		if (!open) {
			reason = '';
			errorMsg = null;
		}
	});
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="sp-reject-title"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
	>
		<div
			class="w-full max-w-[480px] bg-card border border-border rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-scaleUp"
		>
			<!-- Header -->
			<div class="flex items-start gap-4">
				<div class="p-3 bg-red-100 dark:bg-red-950/20 text-red-600 rounded-2xl shrink-0">
					<AlertTriangle class="h-5 w-5" />
				</div>
				<div class="flex-1 min-w-0">
					<h2 id="sp-reject-title" class="text-sm font-bold text-foreground leading-tight">
						Reject Supplier Payment
					</h2>
					<p class="text-xs text-muted-foreground mt-1.5 leading-relaxed">
						{#if paymentDescription}
							<span class="font-medium text-foreground">{paymentDescription}</span> —&nbsp;
						{/if}
						{#if paymentAmount != null}
							<span class="font-semibold text-foreground font-mono">
								{paymentAmount.toFixed(3)} BHD
							</span>
						{/if}
						<br />
						Please provide a reason. This action cannot be undone.
					</p>
				</div>
			</div>

			<!-- Rejection Reason -->
			<div class="flex flex-col gap-1.5">
				<label for="sp-reject-reason" class="text-xs font-semibold text-muted-foreground">
					Reason for Rejection <span class="text-red-500">*</span>
				</label>
				<textarea
					id="sp-reject-reason"
					bind:value={reason}
					rows="3"
					disabled={loading}
					placeholder="e.g. Incorrect amount, wrong supplier, duplicate entry..."
					class="w-full text-xs p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 placeholder-muted-foreground/60 leading-relaxed resize-none transition-colors"
				></textarea>
			</div>

			<!-- Error -->
			{#if errorMsg}
				<div
					class="px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold"
				>
					{errorMsg}
				</div>
			{/if}

			<!-- Actions -->
			<div class="flex items-center justify-end gap-2 pt-1 border-t border-border">
				<Button
					variant="outline"
					onclick={handleCancel}
					disabled={loading}
					class="rounded-xl font-semibold text-xs py-5 px-5 cursor-pointer"
				>
					Cancel
				</Button>
				<Button
					onclick={handleConfirm}
					disabled={loading || !reason.trim()}
					variant="destructive"
					class="rounded-xl font-semibold text-xs py-5 px-5 cursor-pointer"
				>
					{#if loading}
						<Loader2 class="h-3.5 w-3.5 animate-spin mr-1.5" />
						<span>Rejecting...</span>
					{:else}
						<span>Reject Payment</span>
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}
