<script lang="ts">
	import type { StaffUserResponse, PortalType } from '../types/staff-types';
	import { Users, UserCheck, ShieldCheck } from 'lucide-svelte';

	let props = $props<{ users: StaffUserResponse[]; portal: PortalType }>();

	const activeCount = $derived.by(() => (props.users || []).filter((u: StaffUserResponse) => u.isActive).length);
	const inactiveCount = $derived.by(() => (props.users || []).filter((u: StaffUserResponse) => !u.isActive).length);

	const portalLabel = $derived.by(() => {
		if (props.portal === 'accounts') return 'Accounts';
		if (props.portal === 'sales') return 'Sales';
		return 'Operational';
	});
</script>

<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
	<div class="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center justify-between">
		<div>
			<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total {portalLabel} Staff</span>
			<p class="text-2xl font-black text-foreground font-mono mt-0.5">{props.users?.length ?? 0}</p>
		</div>
		<div class="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
			<Users class="h-5 w-5 text-violet-600" />
		</div>
	</div>

	<div class="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center justify-between">
		<div>
			<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Staff</span>
			<p class="text-2xl font-black text-emerald-600 font-mono mt-0.5">{activeCount}</p>
		</div>
		<div class="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
			<UserCheck class="h-5 w-5 text-emerald-600" />
		</div>
	</div>

	<div class="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center justify-between">
		<div>
			<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inactive Staff</span>
			<p class="text-2xl font-black text-slate-500 font-mono mt-0.5">{inactiveCount}</p>
		</div>
		<div class="h-10 w-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
			<ShieldCheck class="h-5 w-5 text-slate-500" />
		</div>
	</div>
</div>
