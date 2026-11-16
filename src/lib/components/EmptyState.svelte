<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		title: string;
		description: string;
		icon?: any; // Component type for Lucide icons
		actionLabel?: string;
		actionClick?: () => void | Promise<void>;
		class?: string;
		actionsSlot?: Snippet;
	}

	let {
		title,
		description,
		icon: IconSymbol = undefined,
		actionLabel = '',
		actionClick = undefined,
		class: className = '',
		actionsSlot
	}: Props = $props();
</script>

<div
	class={cn(
		'flex flex-col items-center justify-center p-8 text-center bg-card border border-border border-dashed rounded-3xl',
		className
	)}
>
	{#if IconSymbol}
		<div class="p-3 bg-muted rounded-2xl text-muted-foreground mb-4">
			<IconSymbol class="h-6 w-6 shrink-0" />
		</div>
	{/if}

	<h3 class="text-sm font-bold text-foreground">{title}</h3>
	<p class="text-xs text-muted-foreground mt-1 max-w-[320px] leading-relaxed">{description}</p>

	{#if actionsSlot}
		<div class="mt-4">
			{@render actionsSlot()}
		</div>
	{:else}
		{#if actionLabel && actionClick}
			<Button
				variant="outline"
				class="mt-4 font-semibold text-xs rounded-xl cursor-pointer"
				onclick={actionClick}
			>
				{actionLabel}
			</Button>
		{/if}
	{/if}
</div>
