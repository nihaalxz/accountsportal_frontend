<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { currentUser, logout } from '$lib/stores/auth';
	import { filteredNavigation } from '$lib/stores/navigation';
	import { ChevronDown, ChevronRight, LogOut, ChevronLeft } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { cn } from '$lib/utils';
	import { apiFetch } from '$lib/api/api-client';

	let pendingTransactionsCount = $state(0);

	onMount(async () => {
		try {
			const txns = await apiFetch<any[]>('api/Transaction?pageSize=100');
			pendingTransactionsCount = txns.filter((t: any) => t.status === 'pending').length;
		} catch (err) {
			// ignore
		}
	});

	let collapsed = $state(false);
	let openSubmenus = $state<Record<string, boolean>>({
		Accounting: false,
		Payroll: false,
		'Sales Entries': false,
		Staffs: false,
		Suppliers: false
	});

	$effect(() => {
		const path = $page.url.pathname;
		if (path.startsWith('/suppliers') && !path.startsWith('/suppliers/returns/record')) openSubmenus['Suppliers'] = true;
		else if (
			path.startsWith('/sales/bookings') ||
			path.startsWith('/sales/dashboard') ||
			path.startsWith('/sales/leads') ||
			path.startsWith('/sales/disputes') ||
			path.startsWith('/sales/heads') ||
			path.startsWith('/master-data/visa')
		) openSubmenus['Sales Entries'] = true;
		else if (path.startsWith('/staffs')) openSubmenus['Staffs'] = true;
		else if (path.startsWith('/payroll')) openSubmenus['Payroll'] = true;
		else if (path.startsWith('/accounting')) openSubmenus['Accounting'] = true;
	});

	function toggleCollapse() {
		collapsed = !collapsed;
	}

	function toggleSubmenu(label: string) {
		if (collapsed) {
			collapsed = false; // Auto expand if clicking submenu when collapsed
		}
		openSubmenus[label] = !openSubmenus[label];
	}

	async function handleLogout() {
		await logout();
		goto('/login');
	}

	const userInitials = $derived(() => {
		const name = $currentUser?.name ?? '';
		return (
			name
				.split(' ')
				.map((w) => w[0])
				.slice(0, 2)
				.join('')
				.toUpperCase() || 'AC'
		);
	});

	// Helper to determine if a navigation item (parent or regular link) is active
	function isItemActive(item: any, currentPath: string): boolean {
		if (item.children && item.children.length > 0) {
			return item.children.some((child: any) => {
				if (child.route === '/suppliers/returns' && currentPath.startsWith('/suppliers/returns/record')) {
					return false;
				}
				return currentPath === child.route || (child.route !== '/' && currentPath.startsWith(child.route + '/'));
			});
		}
		if (item.route === '/dashboard') {
			return currentPath === '/dashboard';
		}
		return currentPath === item.route || (item.route !== '/' && currentPath.startsWith(item.route + '/'));
	}

	// Helper to determine if a child submenu link is active
	function isChildActive(currentPath: string, childRoute: string): boolean {
		if (childRoute === '/suppliers/returns' && currentPath.startsWith('/suppliers/returns/record')) {
			return false;
		}
		return currentPath === childRoute || (childRoute !== '/' && currentPath.startsWith(childRoute + '/'));
	}
</script>

<aside
	class={cn(
		'flex flex-col h-full bg-card border-r border-border shrink-0 transition-all duration-300 select-none relative z-50',
		collapsed ? 'w-16' : 'w-64'
	)}
>
	<!-- Collapse Toggle Button -->
	<button
		onclick={toggleCollapse}
		class="absolute -right-3 top-20 bg-border border border-border rounded-full p-1 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 z-50"
		aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
	>
		<ChevronLeft class={cn('h-3 w-3 transition-transform', collapsed && 'rotate-180')} />
	</button>

	<!-- Brand / Logo Area -->
	<div class="flex items-center gap-3 px-4 h-16 border-b border-border overflow-hidden">
		{#if collapsed}
			<a
				href="/dashboard"
				class="w-8 h-8 bg-white flex items-center justify-center rounded-lg shadow-sm border border-border overflow-hidden p-0.5 hover:border-primary transition-colors shrink-0"
				title="Texas Travels Accounts Portal"
			>
				<img
					src="https://admin.texastravelsbh.com/assets/images/texas-logo.png"
					class="w-full h-full object-contain"
					alt="Texas Travels"
				/>
			</a>
		{:else}
			<a href="/dashboard" class="flex items-center gap-2.5 outline-none group shrink-0">
				<div class="h-9 bg-white flex items-center justify-center rounded-lg shadow-sm border border-border overflow-hidden p-1 px-1.5 shrink-0">
					<img
						src="https://admin.texastravelsbh.com/assets/images/texas-logo.png"
						class="h-7 w-auto object-contain"
						alt="Texas Travels"
					/>
				</div>
				<div class="flex flex-col transition-opacity duration-200">
					<span class="font-bold text-xs tracking-tight text-foreground whitespace-nowrap group-hover:text-primary transition-colors"
						>Texas Travels</span
					>
					<span class="text-[9px] uppercase tracking-wider font-semibold text-primary leading-none mt-0.5"
						>Accounts Portal</span
					>
				</div>
			</a>
		{/if}
	</div>

	<!-- Navigation Scroll Container -->
	<nav class="flex-1 overflow-y-auto px-2 py-4 space-y-1">
		{#each $filteredNavigation as item (item.route)}
			{#if item.children}
				<!-- Collapsible Menu -->
				<div class="space-y-1">
					{#if collapsed}
						<Tooltip.Root>
							<Tooltip.Trigger>
								<button
									onclick={() => toggleSubmenu(item.label)}
									class={cn(
										'w-full flex items-center justify-center h-10 rounded-xl transition-colors hover:bg-muted text-muted-foreground',
										isItemActive(item, $page.url.pathname) &&
											'bg-primary/10 text-primary'
									)}
								>
									<item.icon class="h-4.5 w-4.5 shrink-0" />
								</button>
							</Tooltip.Trigger>
							<Tooltip.Content side="right">
								{item.label}
							</Tooltip.Content>
						</Tooltip.Root>
					{:else}
						<button
							onclick={() => toggleSubmenu(item.label)}
							class={cn(
								'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-muted text-muted-foreground cursor-pointer',
								isItemActive(item, $page.url.pathname) &&
									'bg-primary/5 text-primary'
							)}
						>
							<div class="flex items-center gap-3">
								<item.icon class="h-4.5 w-4.5 shrink-0" />
								<span>{item.label}</span>
							</div>
							{#if openSubmenus[item.label]}
								<ChevronDown class="h-3.5 w-3.5" />
							{:else}
								<ChevronRight class="h-3.5 w-3.5" />
							{/if}
						</button>

						{#if openSubmenus[item.label]}
							<div class="pl-7 space-y-0.5 mt-0.5">
								{#each item.children as child (child.route)}
									<a
										href={child.route}
										class={cn(
											'flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border-l border-transparent',
											isChildActive($page.url.pathname, child.route)
												? 'text-primary border-primary pl-4 font-semibold'
												: 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
										)}
									>
										<span class="flex-1">{child.label}</span>
										{#if child.label.includes('Receipts') && pendingTransactionsCount > 0}
											<span class="px-1.5 py-0.2 text-[9px] font-bold bg-amber-500/20 text-amber-700 rounded-md">
												{pendingTransactionsCount}
											</span>
										{/if}
									</a>
								{/each}
							</div>
						{/if}
					{/if}
				</div>
			{:else}
				<!-- Regular link -->
				{#if collapsed}
					<Tooltip.Root>
						<Tooltip.Trigger>
							<a
								href={item.route}
								class={cn(
									'flex items-center justify-center h-10 rounded-xl transition-colors',
									isItemActive(item, $page.url.pathname)
										? 'bg-primary text-primary-foreground'
										: 'text-muted-foreground hover:bg-muted hover:text-foreground'
								)}
							>
								<item.icon class="h-4.5 w-4.5 shrink-0" />
							</a>
						</Tooltip.Trigger>
						<Tooltip.Content side="right">
							{item.label}
						</Tooltip.Content>
					</Tooltip.Root>
				{:else}
					<a
						href={item.route}
						class={cn(
							'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border-l-2',
							isItemActive(item, $page.url.pathname)
								? 'bg-primary/10 text-primary border-primary font-bold'
								: 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted'
						)}
					>
						<item.icon class="h-4.5 w-4.5 shrink-0" />
						<span class="flex-1">{item.label}</span>
						{#if (item.label.includes('Receipt') || item.label.includes('Pending Approvals')) && pendingTransactionsCount > 0}
							<span class="px-1.5 py-0.2 text-[9px] font-bold bg-amber-500/20 text-amber-700 rounded-md">
								{pendingTransactionsCount}
							</span>
						{/if}
					</a>
				{/if}
			{/if}
		{/each}
	</nav>

	<!-- User / Session Footer -->
	<div class="p-3 border-t border-border bg-muted/20">
		{#if collapsed}
			<Tooltip.Root>
				<Tooltip.Trigger>
					<button
						onclick={handleLogout}
						class="w-full h-10 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center justify-center cursor-pointer"
					>
						<LogOut class="h-4 w-4" />
					</button>
				</Tooltip.Trigger>
				<Tooltip.Content side="right">Sign Out</Tooltip.Content>
			</Tooltip.Root>
		{:else}
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-2 overflow-hidden">
					{#if $currentUser?.profilePicture}
						<img
							src={$currentUser.profilePicture}
							class="h-8 w-8 rounded-full object-cover shrink-0 border border-primary/10"
							alt="Profile Avatar"
						/>
					{:else}
						<div
							class="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/10"
						>
							{userInitials()}
						</div>
					{/if}
					<div class="flex flex-col overflow-hidden">
						<span class="text-xs font-semibold text-foreground truncate"
							>{$currentUser?.name}</span
						>
						<span class="text-[9px] text-muted-foreground truncate capitalize">
							{($currentUser?.userType || '').replace(/_/g, ' ')}
						</span>
					</div>
				</div>
				<Button
					onclick={handleLogout}
					variant="ghost"
					size="icon"
					class="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
					title="Sign out"
				>
					<LogOut class="h-4 w-4" />
				</Button>
			</div>
		{/if}
	</div>
</aside>
