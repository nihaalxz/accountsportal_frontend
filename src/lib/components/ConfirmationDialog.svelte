<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Loader2, AlertTriangle } from 'lucide-svelte';

	interface Props {
		open: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		isDestructive?: boolean;
		onConfirm: () => Promise<void> | void;
		onCancel?: () => void;
	}

	let {
		open = $bindable(false),
		title,
		message,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		isDestructive = false,
		onConfirm,
		onCancel = undefined
	}: Props = $props();

	let loading = $state(false);
	let error = $state<string | null>(null);

	async function handleConfirm() {
		if (loading) return;
		loading = true;
		error = null;

		try {
			await onConfirm();
			open = false;
		} catch (err: any) {
			error = err?.detail || err?.message || 'An error occurred. Please try again.';
		} finally {
			loading = false;
		}
	}

	function handleCancel() {
		if (loading) return;
		if (onCancel) onCancel();
		open = false;
		error = null;
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-title"
		aria-describedby="confirm-desc"
	>
		<!-- Modal panel -->
		<div
			class="w-full max-w-[480px] bg-card border border-border rounded-3xl p-6 shadow-xl flex flex-col gap-4 animate-scaleUp"
		>
			<div class="flex items-start gap-4">
				{#if isDestructive}
					<div
						class="p-3 bg-red-100 dark:bg-red-950/20 text-red-600 rounded-2xl shrink-0"
					>
						<AlertTriangle class="h-6 w-6" />
					</div>
				{:else}
					<div class="p-3 bg-primary/10 text-primary rounded-2xl shrink-0">
						<AlertTriangle class="h-6 w-6" />
					</div>
				{/if}

				<div class="flex-1 min-w-0">
					<h2 id="confirm-title" class="text-sm font-bold text-foreground leading-tight">
						{title}
					</h2>
					<p id="confirm-desc" class="text-xs text-muted-foreground mt-2 leading-relaxed">
						{message}
					</p>
				</div>
			</div>

			<!-- Action feedback errors -->
			{#if error}
				<div
					class="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold leading-relaxed"
				>
					{error}
				</div>
			{/if}

			<!-- Footer Buttons -->
			<div class="flex items-center justify-end gap-2 mt-2">
				<Button
					variant="outline"
					onclick={handleCancel}
					disabled={loading}
					class="rounded-xl font-semibold text-xs py-5 px-4 cursor-pointer"
				>
					{cancelLabel}
				</Button>
				<Button
					onclick={handleConfirm}
					disabled={loading}
					variant={isDestructive ? 'destructive' : 'default'}
					class="rounded-xl font-semibold text-xs py-5 px-4 cursor-pointer"
				>
					{#if loading}
						<Loader2 class="h-3.5 w-3.5 animate-spin mr-1.5" />
						<span>Processing...</span>
					{:else}
						<span>{confirmLabel}</span>
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}
