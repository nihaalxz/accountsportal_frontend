<script lang="ts">
	/**
	 * FinancialSummaryCard — displays a financial metric with label, value, and tone.
	 * Used on the Dashboard for key balance metrics.
	 */
	import MoneyAmount from './MoneyAmount.svelte';

	interface Props {
		label: string;
		value: number;
		/** Subtitle / additional context */
		subtitle?: string;
		tone?: 'positive' | 'negative' | 'neutral';
		loading?: boolean;
	}

	let { label, value, subtitle, tone = 'neutral', loading = false }: Props = $props();
</script>

<div class="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 shadow-xs">
	<div class="flex items-center justify-between">
		<span class="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span
		>
	</div>

	{#if loading}
		<div class="animate-pulse">
			<div class="h-7 w-32 bg-muted rounded-lg"></div>
			{#if subtitle}
				<div class="h-3 w-20 bg-muted rounded mt-2"></div>
			{/if}
		</div>
	{:else}
		<div>
			<MoneyAmount amount={value} size="xl" {tone} />
			{#if subtitle}
				<p class="text-xs text-muted-foreground mt-1">{subtitle}</p>
			{/if}
		</div>
	{/if}
</div>
