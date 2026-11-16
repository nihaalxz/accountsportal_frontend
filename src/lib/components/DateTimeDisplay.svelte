<script lang="ts">
	import { formatDateTime } from '$lib/formatters/date';

	interface Props {
		value: string | Date | null | undefined;
		class?: string;
	}

	let { value, class: className = '' }: Props = $props();
</script>

<span class="tabular-nums {className}">
	{formatDateTime(value)}
</span>
