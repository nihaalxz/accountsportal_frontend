<script lang="ts">
	let props = $props<{ role: string }>();

	function formatRole(r: string): string {
		if (!r) return '—';
		const norm = r.toLowerCase().replace(/\s+/g, '_');
		if (norm === 'master_accountant') return 'Master Accountant';
		if (norm === 'accounts' || norm === 'accountant') return 'Accounts Staff';
		if (norm === 'salesman' || norm === 'sales') return 'Sales Representative';
		if (norm === 'admin' || norm === 'operational_admin') return 'Ops Administrator';
		if (norm === 'operations' || norm === 'operational_staff' || norm === 'staff') return 'Ops Staff';
		return r;
	}
</script>

<span class="px-2 py-0.5 rounded bg-muted text-foreground border border-border text-[11px] font-medium">
	{formatRole(props.role)}
</span>
