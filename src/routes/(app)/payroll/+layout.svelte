<script lang="ts">
	import { page } from '$app/stores';
	import { CreditCard, Wallet, History, ShieldAlert } from 'lucide-svelte';
	import { hasRole } from '$lib/stores/auth';

	let { children } = $props();

	const tabs = [
		{ label: 'Salary Profiles', route: '/payroll/salary-profiles', icon: CreditCard },
		{ label: 'Payroll History', route: '/payroll/history', icon: History }
	];

	function isActiveRoute(currentPath: string, targetRoute: string): boolean {
		return currentPath === targetRoute || currentPath.startsWith(targetRoute + '/');
	}
</script>

<svelte:head>
	<title>Payroll & Salary Management — Texas Accounts Portal</title>
</svelte:head>

{#if !hasRole('master_accountant')}
	<div class="p-12 text-center border border-border rounded-2xl bg-card space-y-4 max-w-lg mx-auto my-12 shadow-sm">
		<ShieldAlert class="h-12 w-12 text-amber-500 mx-auto" />
		<div class="space-y-1">
			<h2 class="text-base font-bold text-foreground">Access Restricted</h2>
			<p class="text-xs text-muted-foreground">
				Payroll & Salary Management is restricted exclusively to Master Accountants. Please contact your system administrator if you require access.
			</p>
		</div>
	</div>
{:else}
	<div class="space-y-6">
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
{/if}
