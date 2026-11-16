<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		description?: string;
		class?: string;
		headerAction?: Snippet;
		children: Snippet;
	}

	let {
		title = '',
		description = '',
		class: className = '',
		headerAction,
		children
	}: Props = $props();
</script>

<div
	class={cn(
		'bg-card border border-border rounded-3xl shadow-xs overflow-hidden flex flex-col',
		className
	)}
>
	{#if title || headerAction}
		<div class="px-6 py-5 border-b border-border flex items-center justify-between gap-4">
			<div>
				{#if title}
					<h2 class="text-sm font-bold text-foreground">{title}</h2>
				{/if}
				{#if description}
					<p class="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
				{/if}
			</div>
			{#if headerAction}
				<div>
					{@render headerAction()}
				</div>
			{/if}
		</div>
	{/if}

	<div class="p-6 flex-1">
		{@render children()}
	</div>
</div>
