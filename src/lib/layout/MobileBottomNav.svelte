<script lang="ts">
	import { page } from '$app/stores';
	import { currentUser } from '$lib/stores/auth';
	import { LayoutDashboard, Receipt, ShoppingBag, Users, MoreHorizontal } from 'lucide-svelte';
	import MoreDrawer from './MoreDrawer.svelte';
	import { cn } from '$lib/utils';

	let moreOpen = $state(false);

	// Active status checks based on pathnames
	const isDashboardActive = $derived($page.url.pathname.startsWith('/dashboard'));
	const isTransactionsActive = $derived($page.url.pathname.startsWith('/transactions'));
	const isSalesActive = $derived($page.url.pathname.startsWith('/sales'));
	const isSuppliersActive = $derived($page.url.pathname.startsWith('/suppliers'));
	const isMoreActive = $derived(
		$page.url.pathname.startsWith('/agents') ||
			$page.url.pathname.startsWith('/accounts') ||
			$page.url.pathname.startsWith('/banks') ||
			$page.url.pathname.startsWith('/payments') ||
			$page.url.pathname.startsWith('/accounting') ||
			$page.url.pathname.startsWith('/pending-approvals') ||
			$page.url.pathname.startsWith('/reports') ||
			$page.url.pathname.startsWith('/users')
	);

	function openMore() {
		moreOpen = true;
	}
</script>

{#if $currentUser}
	<div
		class="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md lg:hidden shadow-lg select-none"
		style="padding-bottom: env(safe-area-inset-bottom);"
	>
		<nav
			class="flex items-center justify-around h-16 w-full px-1"
			aria-label="Mobile Navigation"
		>
			<!-- 1. Dashboard -->
			<a
				href="/dashboard"
				class={cn(
					'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 text-center touch-manipulation',
					isDashboardActive
						? 'text-primary font-bold'
						: 'text-muted-foreground hover:text-foreground'
				)}
				aria-label="Dashboard"
			>
				<LayoutDashboard class="h-5 w-5 shrink-0" />
				<span class="text-[10px] font-medium tracking-tight">Dashboard</span>
			</a>

			<!-- 2. Transactions -->
			<a
				href="/transactions"
				class={cn(
					'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 text-center touch-manipulation',
					isTransactionsActive
						? 'text-primary font-bold'
						: 'text-muted-foreground hover:text-foreground'
				)}
				aria-label="Transactions"
			>
				<Receipt class="h-5 w-5 shrink-0" />
				<span class="text-[10px] font-medium tracking-tight">Transactions</span>
			</a>

			<!-- 3. Sales -->
			<a
				href="/sales/dashboard"
				class={cn(
					'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 text-center touch-manipulation',
					isSalesActive
						? 'text-primary font-bold'
						: 'text-muted-foreground hover:text-foreground'
				)}
				aria-label="Sales Entries"
			>
				<ShoppingBag class="h-5 w-5 shrink-0" />
				<span class="text-[10px] font-medium tracking-tight">Sales</span>
			</a>

			<!-- 4. Suppliers -->
			<a
				href="/suppliers"
				class={cn(
					'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 text-center touch-manipulation',
					isSuppliersActive
						? 'text-primary font-bold'
						: 'text-muted-foreground hover:text-foreground'
				)}
				aria-label="Suppliers"
			>
				<Users class="h-5 w-5 shrink-0" />
				<span class="text-[10px] font-medium tracking-tight">Suppliers</span>
			</a>

			<!-- 5. More -->
			<button
				onclick={openMore}
				type="button"
				class={cn(
					'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 text-center touch-manipulation bg-transparent border-0 cursor-pointer',
					isMoreActive || moreOpen
						? 'text-primary font-bold'
						: 'text-muted-foreground hover:text-foreground'
				)}
				aria-label="Open More Drawer"
			>
				<MoreHorizontal class="h-5 w-5 shrink-0" />
				<span class="text-[10px] font-medium tracking-tight">More</span>
			</button>
		</nav>
	</div>

	<!-- More Sheet Drawer -->
	<MoreDrawer bind:open={moreOpen} />
{/if}
