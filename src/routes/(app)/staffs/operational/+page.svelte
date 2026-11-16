<script lang="ts">
	import { onMount } from 'svelte';
	import { staffsStore } from '$features/staffs/stores/staffs-store.svelte';
	import StaffMetrics from '$features/staffs/components/StaffMetrics.svelte';
	import StaffTable from '$features/staffs/components/StaffTable.svelte';
	import WorkloadLimitsCard from '$features/staffs/components/WorkloadLimitsCard.svelte';

	onMount(() => {
		staffsStore.loadOperational();
	});
</script>

<svelte:head>
	<title>Operational Staff — Texas Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<StaffMetrics users={staffsStore.operational.data} portal="operational" />

	<WorkloadLimitsCard />

	<StaffTable
		users={staffsStore.operational.data}
		portal="operational"
		loading={staffsStore.operational.loading}
		error={staffsStore.operational.error}
		showOperationalPermissions={true}
		onRefresh={() => staffsStore.loadOperational(true)}
	/>
</div>
