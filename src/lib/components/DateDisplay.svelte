<script lang="ts">
	import { formatDateOnly, formatDateTime } from '$lib/formatters/date';

	interface Props {
		value?: string | Date | null | undefined;
		date?: string | Date | null | undefined;
		showTime?: boolean;
		format?: 'date' | 'datetime' | 'short';
		class?: string;
	}

	let {
		value,
		date,
		showTime = false,
		format,
		class: className = ''
	}: Props = $props();

	const targetDate = $derived(value ?? date);
	const shouldShowTime = $derived(showTime || format === 'datetime');
</script>

<span class="tabular-nums {className}">
	{shouldShowTime ? formatDateTime(targetDate) : formatDateOnly(targetDate)}
</span>
