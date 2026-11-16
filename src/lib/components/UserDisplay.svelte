<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		name: string | null | undefined;
		role?: string | null | undefined;
		class?: string;
	}

	let { name, role = '', class: className = '' }: Props = $props();

	const initials = $derived(() => {
		if (!name) return '—';
		return name
			.split(' ')
			.map((w) => w[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	});
</script>

<div class={cn('flex items-center gap-2', className)}>
	<div
		class="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 border border-primary/5 select-none"
	>
		{initials()}
	</div>
	<div class="flex flex-col min-w-0">
		<span class="text-xs font-medium text-foreground truncate leading-none">{name || '—'}</span>
		{#if role}
			<span class="text-[9px] text-muted-foreground truncate leading-none mt-0.5 capitalize">
				{role.toLowerCase().replace(/_/g, ' ')}
			</span>
		{/if}
	</div>
</div>
