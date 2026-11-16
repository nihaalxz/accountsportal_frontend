<script lang="ts">
	import type { PortalType } from '../types/staff-types';
	import { Building2, Briefcase, Wrench } from 'lucide-svelte';

	let props = $props<{ portal: PortalType }>();

	const config = $derived.by(() => {
		if (props.portal === 'accounts') {
			return { label: 'Accounts', color: 'text-blue-600 bg-blue-500/10 border-blue-200', dot: 'bg-blue-500', icon: Building2 };
		}
		if (props.portal === 'sales') {
			return { label: 'Sales', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-200', dot: 'bg-emerald-500', icon: Briefcase };
		}
		return { label: 'Operational', color: 'text-purple-600 bg-purple-500/10 border-purple-200', dot: 'bg-purple-500', icon: Wrench };
	});
</script>

<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold {config.color}">
	<span class="h-1.5 w-1.5 rounded-full {config.dot} shrink-0"></span>
	<config.icon class="h-3 w-3 shrink-0" />
	{config.label}
</span>
