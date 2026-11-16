<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();
</script>

<span class={cn('text-muted-foreground select-none font-light', className)}>—</span>
