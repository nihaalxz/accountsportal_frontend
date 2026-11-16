<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	interface Props {
		cols?: 1 | 2 | 3 | 4;
		class?: string;
		children: Snippet;
	}

	let { cols = 4, class: className = '', children }: Props = $props();

	const colClasses = {
		1: 'grid-cols-1',
		2: 'grid-cols-1 sm:grid-cols-2',
		3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
		4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
	};
</script>

<div class={cn('grid gap-4 w-full', colClasses[cols], className)}>
	{@render children()}
</div>
