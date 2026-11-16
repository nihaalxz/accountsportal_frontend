<script lang="ts">
	/**
	 * TransactionTypeChip — displays a transaction type with directional indication.
	 */
	import { getTypeConfig } from '$lib/types/financial';

	interface Props {
		type: string;
	}

	let { type }: Props = $props();

	const config = $derived(getTypeConfig(type));
	const arrowSymbol = $derived(
		config.direction === 'in' ? '↑' : config.direction === 'out' ? '↓' : '↔'
	);
</script>

<span
	class={['inline-flex items-center gap-1 text-xs font-semibold', config.textClass].join(' ')}
	aria-label="Type: {config.label} ({config.direction === 'in'
		? 'incoming'
		: config.direction === 'out'
			? 'outgoing'
			: 'internal'})"
>
	<span aria-hidden="true">{arrowSymbol}</span>
	{config.label}
</span>
