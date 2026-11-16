<script lang="ts">
	/**
	 * FinancialStatusBadge — displays a transaction status with semantic color.
	 * Uses only color + text (no color-only communication — accessible).
	 */
	import { getStatusConfig } from '$lib/types/financial';

	interface Props {
		status: string;
		size?: 'sm' | 'md';
	}

	let { status, size = 'md' }: Props = $props();

	const config = $derived(getStatusConfig(status));
</script>

<span
	class={[
		'inline-flex items-center gap-1 font-semibold rounded-full border',
		size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1',
		config.textClass,
		config.bgClass,
		config.borderClass
	].join(' ')}
	aria-label="Status: {config.label}"
>
	<!-- Status dot — non-color indicator -->
	<span
		class={[
			'rounded-full shrink-0',
			size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5',
			config.textClass.replace('text-', 'bg-')
		].join(' ')}
		aria-hidden="true"
	></span>
	{config.label}
</span>
