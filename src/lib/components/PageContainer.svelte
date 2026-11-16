<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children: Snippet;
	}

	let { class: className = '', children }: Props = $props();
</script>

<div class={cn('max-w-7xl mx-auto w-full space-y-6 pb-12', className)}>
	{@render children()}
</div>
