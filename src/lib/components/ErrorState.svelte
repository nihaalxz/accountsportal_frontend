<script lang="ts">
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import { AlertTriangle, RotateCcw } from 'lucide-svelte';

	interface Props {
		title?: string;
		message: string;
		correlationId?: string;
		retryAction?: () => void | Promise<void>;
		class?: string;
	}

	let {
		title = 'Failed to load details',
		message,
		correlationId = '',
		retryAction = undefined,
		class: className = ''
	}: Props = $props();
</script>

<div
	class={cn(
		'flex flex-col items-center justify-center p-8 text-center bg-destructive/5 border border-destructive/10 rounded-3xl',
		className
	)}
>
	<div class="p-3 bg-destructive/10 rounded-2xl text-destructive mb-4">
		<AlertTriangle class="h-6 w-6 shrink-0" />
	</div>

	<h3 class="text-sm font-bold text-foreground">{title}</h3>
	<p class="text-xs text-muted-foreground mt-1 max-w-[420px] leading-relaxed">{message}</p>

	{#if correlationId}
		<div
			class="mt-3 px-2 py-1 bg-muted rounded-md font-mono text-[9px] text-muted-foreground select-all"
		>
			Trace ID: {correlationId}
		</div>
	{/if}

	{#if retryAction}
		<Button
			variant="outline"
			class="mt-4 font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
			onclick={retryAction}
		>
			<RotateCcw class="h-3.5 w-3.5" />
			<span>Retry Operation</span>
		</Button>
	{/if}
</div>
