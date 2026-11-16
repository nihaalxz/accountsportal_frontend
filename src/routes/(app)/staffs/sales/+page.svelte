<script lang="ts">
	import { onMount } from 'svelte';
	import { staffsStore } from '$features/staffs/stores/staffs-store.svelte';
	import StaffMetrics from '$features/staffs/components/StaffMetrics.svelte';
	import StaffTable from '$features/staffs/components/StaffTable.svelte';

	onMount(() => {
		staffsStore.loadSales();
	});
</script>

<svelte:head>
	<title>Sales Staff — Texas Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<StaffMetrics users={staffsStore.sales.data} portal="sales" />

	<StaffTable
		users={staffsStore.sales.data}
		portal="sales"
		loading={staffsStore.sales.loading}
		error={staffsStore.sales.error}
		onRefresh={() => staffsStore.loadSales(true)}
	/>
</div>
