<script lang="ts">
	/**
	 * MoneyAmount — formats and displays a financial amount.
	 *
	 * Uses backend-provided values only. Does not calculate authoritative amounts.
	 * Formats using Intl.NumberFormat with 3 decimal places (BHD standard).
	 */

	interface Props {
		amount: number;
		/** Show sign prefix (+ for positive, - for negative) */
		showSign?: boolean;
		/** Size variant */
		size?: 'sm' | 'md' | 'lg' | 'xl';
		/** Semantic tone override (auto-detected from sign if not provided) */
		tone?: 'positive' | 'negative' | 'neutral';
		/** Currency code (default: BHD) */
		currency?: string;
	}

	let { amount, showSign = false, size = 'md', tone, currency = 'BHD' }: Props = $props();

	const formattedAmount = $derived(() => {
		const abs = Math.abs(amount);
		const formatted = new Intl.NumberFormat('en-BH', {
			minimumFractionDigits: 3,
			maximumFractionDigits: 3
		}).format(abs);
		return formatted;
	});

	const effectiveTone = $derived(() => {
		if (tone) return tone;
		if (amount > 0) return 'positive';
		if (amount < 0) return 'negative';
		return 'neutral';
	});

	const signPrefix = $derived(() => {
		if (!showSign) return '';
		if (amount > 0) return '+';
		if (amount < 0) return '-';
		return '';
	});

	const toneClass = $derived(() => {
		switch (effectiveTone()) {
			case 'positive':
				return 'text-emerald-600 dark:text-emerald-400';
			case 'negative':
				return 'text-red-600 dark:text-red-400';
			default:
				return 'text-foreground';
		}
	});

	const sizeClass = $derived(() => {
		switch (size) {
			case 'sm':
				return 'text-xs';
			case 'md':
				return 'text-sm';
			case 'lg':
				return 'text-base font-semibold';
			case 'xl':
				return 'text-xl font-bold';
		}
	});
</script>

<span
	class={[sizeClass(), toneClass(), 'tabular-nums font-medium'].join(' ')}
	aria-label="{signPrefix()}{formattedAmount()} {currency}"
>
	<span aria-hidden="true">{signPrefix()}</span>{formattedAmount()}
	<span class="text-[0.75em] text-muted-foreground font-normal ml-0.5">{currency}</span>
</span>
