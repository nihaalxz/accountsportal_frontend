<script lang="ts">
	import { page } from '$app/stores';
	import { Users, Wallet, Briefcase, ShieldCheck, UserPlus, ShieldAlert } from 'lucide-svelte';
	import { hasRole } from '$lib/stores/auth';
	import { staffsStore } from '$features/staffs/stores/staffs-store.svelte';
	import CreateStaffModal from '$features/staffs/components/CreateStaffModal.svelte';

	let { children } = $props();

	let showCreateModal = $state(false);

	const tabs = [
		{ label: 'Accounts Staff', route: '/staffs/accounts', icon: Wallet },
		{ label: 'Sales Staff', route: '/staffs/sales', icon: Briefcase },
		{ label: 'Operational Staff', route: '/staffs/operational', icon: ShieldCheck }
	];

	function isActiveRoute(currentPath: string, targetRoute: string): boolean {
		return currentPath === targetRoute || currentPath.startsWith(targetRoute + '/');
	}
</script>

<svelte:head>
	<title>Staff Management — Texas Accounts Portal</title>
</svelte:head>

{#if !hasRole('master_accountant')}
	<div class="p-12 text-center border border-border rounded-2xl bg-card space-y-4 max-w-lg mx-auto my-12 shadow-sm">
		<ShieldAlert class="h-12 w-12 text-amber-500 mx-auto" />
		<div class="space-y-1">
			<h2 class="text-base font-bold text-foreground">Access Restricted</h2>
			<p class="text-xs text-muted-foreground">
				Staff Management is restricted exclusively to Master Accountants. Please contact your system administrator if you require access.
			</p>
		</div>
	</div>
{:else}
	<div class="space-y-6">
		<!-- Page Header -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div>
				<h1 class="text-xl font-bold text-foreground flex items-center gap-2">
					<div class="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
						<Users class="h-4 w-4 text-white" />
					</div>
					Staff Management
				</h1>
				<p class="text-xs text-muted-foreground mt-1">
					Portal-centric employee administration. Each portal is the authoritative source for its staff.
				</p>
			</div>

			<button
				onclick={() => (showCreateModal = true)}
				class="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer shadow-sm shrink-0 self-start sm:self-auto"
			>
				<UserPlus class="h-4 w-4" />
				<span>Create User</span>
			</button>
		</div>

		<!-- Section Tabs -->
		<div class="flex items-center border-b border-border bg-card rounded-2xl px-4 gap-2 shadow-sm overflow-x-auto">
			{#each tabs as tab}
				{@const active = isActiveRoute($page.url.pathname, tab.route)}
				<a
					href={tab.route}
					class="flex items-center gap-2 px-4 py-3.5 text-xs font-bold transition-all border-b-2 shrink-0
						{active
						? 'text-primary border-primary bg-primary/5'
						: 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40'}"
				>
					<tab.icon class="h-4 w-4" />
					{tab.label}
				</a>
			{/each}
		</div>

		<!-- Tab Content -->
		<div>
			{@render children()}
		</div>
	</div>

	<!-- Create Staff Modal -->
	<CreateStaffModal
		open={showCreateModal}
		onClose={() => (showCreateModal = false)}
		onCreated={(portal) => staffsStore.loadPortal(portal, true)}
	/>
{/if}
