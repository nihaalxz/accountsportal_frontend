<script lang="ts">
	/**
	 * ConflictDialog — handles 409 Conflict concurrency responses.
	 * Explains that the resource has been modified, and offers a reload action.
	 */
	import { Button } from '$lib/components/ui/button';
	import { RefreshCw, AlertTriangle } from 'lucide-svelte';

	interface Props {
		open: boolean;
		title?: string;
		message?: string;
		onReload: () => void | Promise<void>;
	}

	let {
		open = $bindable(false),
		title = 'Data Out of Date',
		message = 'Another user has updated this record. Your local screen is out of sync. Please reload to view the latest status and try again.',
		onReload
	}: Props = $props();

	let loading = $state(false);

	async function handleReload() {
		loading = true;
		try {
			await onReload();
			open = false;
		} finally {
			loading = false;
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="conflict-title"
		aria-describedby="conflict-desc"
	>
		<div
			class="w-full max-w-[480px] bg-card border border-border rounded-3xl p-6 shadow-xl flex flex-col gap-4 animate-scaleUp"
		>
			<div class="flex items-start gap-4">
				<div
					class="p-3 bg-amber-100 dark:bg-amber-950/20 text-amber-600 rounded-2xl shrink-0"
				>
					<AlertTriangle class="h-6 w-6" />
				</div>

				<div class="flex-1 min-w-0">
					<h2 id="conflict-title" class="text-sm font-bold text-foreground leading-tight">
						{title}
					</h2>
					<p
						id="conflict-desc"
						class="text-xs text-muted-foreground mt-2 leading-relaxed"
					>
						{message}
					</p>
				</div>
			</div>

			<div class="flex items-center justify-end gap-2 mt-2">
				<Button
					onclick={handleReload}
					disabled={loading}
					class="rounded-xl font-semibold text-xs py-5 px-4 cursor-pointer flex items-center gap-1.5"
				>
					{#if loading}
						<RefreshCw class="h-3.5 w-3.5 animate-spin mr-1.5" />
						<span>Reloading...</span>
					{:else}
						<RefreshCw class="h-3.5 w-3.5" />
						<span>Reload & Refresh</span>
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}
