<script lang="ts">
	import { onMount } from 'svelte';
	import { staffsStore } from '$features/staffs/stores/staffs-store.svelte';
	import StaffMetrics from '$features/staffs/components/StaffMetrics.svelte';
	import StaffTable from '$features/staffs/components/StaffTable.svelte';

	onMount(() => {
		staffsStore.loadAccounts();
	});
</script>

<svelte:head>
	<title>Accounts Staff — Texas Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<StaffMetrics users={staffsStore.accounts.data} portal="accounts" />

	<StaffTable
		users={staffsStore.accounts.data}
		portal="accounts"
		loading={staffsStore.accounts.loading}
		error={staffsStore.accounts.error}
		onRefresh={() => staffsStore.loadAccounts(true)}
	/>
</div>
