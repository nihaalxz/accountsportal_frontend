<script lang="ts">
	import Badge from '$lib/components/ui/badge/badge.svelte';

	interface Props {
		status: string | null | undefined;
		class?: string;
	}

	let { status, class: className = '' }: Props = $props();

	const formattedStatus = $derived((status || '').toLowerCase().trim());

	// Determine badge variant and label mapping
	const config = $derived(() => {
		switch (formattedStatus) {
			case 'paid':
			case 'approved':
			case 'completed':
			case 'success':
			case 'active':
				return { variant: 'success' as const, label: status || 'Completed' };
			case 'pending':
			case 'processing':
			case 'partial':
			case 'draft':
				return { variant: 'warning' as const, label: status || 'Pending' };
			case 'cancelled':
			case 'failed':
			case 'rejected':
			case 'overdue':
				return { variant: 'destructive' as const, label: status || 'Failed' };
			default:
				return { variant: 'secondary' as const, label: status || 'Unknown' };
		}
	});

	const activeConfig = $derived(config());
</script>

<Badge variant={activeConfig.variant} class={className}>
	{activeConfig.label}
</Badge>
