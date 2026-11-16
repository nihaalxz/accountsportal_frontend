<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		size?: 'sm' | 'md' | 'lg';
		class?: string;
	}

	let { size = 'md', class: className = '' }: Props = $props();

	const sizeClasses = {
		sm: 'h-4 w-4 border-2',
		md: 'h-6 w-6 border-2',
		lg: 'h-10 w-10 border-3'
	};
</script>

<div
	class={cn(
		'animate-spin rounded-full border-primary border-t-transparent shrink-0',
		sizeClasses[size],
		className
	)}
	role="status"
	aria-label="Loading"
></div>
