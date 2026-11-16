<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children: Snippet;
	}

	let { class: className = '', children }: Props = $props();
</script>

<div
	class={cn(
		'bg-card border border-border p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-2xs',
		className
	)}
>
	{@render children()}
</div>
