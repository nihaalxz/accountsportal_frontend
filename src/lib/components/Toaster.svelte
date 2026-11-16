<script lang="ts">
	import { toasts, removeToast } from '$lib/stores/toast';
	import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-svelte';
	import { fly } from 'svelte/transition';
	import { cn } from '$lib/utils';

	const typeConfig = {
		success: {
			bg: 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800',
			text: 'text-green-800 dark:text-green-200',
			icon: CheckCircle,
			iconColor: 'text-green-600'
		},
		error: {
			bg: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800',
			text: 'text-red-800 dark:text-red-200',
			icon: AlertCircle,
			iconColor: 'text-red-600'
		},
		warning: {
			bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800',
			text: 'text-amber-800 dark:text-amber-200',
			icon: AlertTriangle,
			iconColor: 'text-amber-600'
		},
		info: {
			bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800',
			text: 'text-blue-800 dark:text-blue-200',
			icon: Info,
			iconColor: 'text-blue-600'
		}
	};
</script>

<div
	class="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-[360px] pointer-events-none select-none"
>
	{#each $toasts as item (item.id)}
		{@const config = typeConfig[item.type]}
		<div
			in:fly={{ y: -20, duration: 250 }}
			out:fly={{ x: 100, duration: 200 }}
			class={cn(
				'pointer-events-auto flex items-start gap-3 p-4 border rounded-2xl shadow-md',
				config.bg
			)}
			role="alert"
		>
			<div class={cn('mt-0.5 shrink-0', config.iconColor)}>
				<config.icon class="h-4.5 w-4.5" />
			</div>

			<div class="flex-1 min-w-0">
				<p class={cn('text-xs font-semibold leading-normal', config.text)}>
					{item.message}
				</p>
			</div>

			<button
				onclick={() => removeToast(item.id)}
				class="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none"
				aria-label="Dismiss alert"
			>
				<X class="h-3.5 w-3.5" />
			</button>
		</div>
	{/each}
</div>
