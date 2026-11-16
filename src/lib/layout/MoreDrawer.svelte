<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { currentUser, logout } from '$lib/stores/auth';
	import { filteredNavigation } from '$lib/stores/navigation';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import { LogOut, ChevronDown, ChevronRight } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	let { open = $bindable(false) } = $props();

	// Exclude bottom navigation items from top of overflow list
	const secondaryItems = $derived(() => {
		const excludeRoutes = ['/dashboard', '/transactions', '/suppliers'];
		return $filteredNavigation.filter((item) => !excludeRoutes.includes(item.route));
	});

	const activeSecondaryItems = $derived(secondaryItems());

	// State tracking for expanded parent menus in drawer
	let expandedMenus = $state<Record<string, boolean>>({
		'/sales': true
	});

	function toggleMenu(route: string, e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		expandedMenus[route] = !expandedMenus[route];
	}

	function closeDrawer() {
		open = false;
	}

	async function handleLogout() {
		closeDrawer();
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

	function isRouteActive(currentPath: string, item: any): boolean {
		if (item.children && item.children.length > 0) {
			return item.children.some((child: any) =>
				currentPath === child.route || (child.route !== '/' && currentPath.startsWith(child.route + '/'))
			);
		}
		return currentPath === item.route || (item.route !== '/' && currentPath.startsWith(item.route + '/'));
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		side="bottom"
		class="rounded-t-3xl border-t border-border bg-card px-5 pb-6 pt-2 max-h-[88vh] overflow-y-auto"
	>
		<!-- Drag Handle -->
		<div class="mx-auto my-2 h-1.5 w-12 rounded-full bg-muted-foreground/20"></div>

		<Sheet.Header class="text-left pb-3 border-b border-border">
			<Sheet.Title class="text-base font-bold text-foreground">Navigation Menu</Sheet.Title>
			<p class="text-[11px] text-muted-foreground">
				Access all sales modules, accounts, ledgers, and settings
			</p>
		</Sheet.Header>

		<!-- User Profile Section -->
		<div
			class="flex items-center gap-3 p-3 my-3 rounded-2xl bg-muted/40 border border-border/50"
		>
			<div
				class="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/10"
			>
				{userInitials()}
			</div>
			<div class="flex-1 min-w-0">
				<div class="text-xs font-bold text-foreground truncate">
					{$currentUser?.name}
				</div>
				<div class="text-[11px] text-muted-foreground truncate capitalize">
					{($currentUser?.userType || '').replace(/_/g, ' ')}
				</div>
			</div>
		</div>

		<!-- Navigation Items & Submenus -->
		<div class="space-y-3 py-1">
			{#each activeSecondaryItems as item (item.route)}
				{#if item.children && item.children.length > 0}
					<!-- Parent Section with Submenu Children -->
					<div class="rounded-2xl border border-border/60 bg-muted/10 overflow-hidden">
						<div
							class={cn(
								'flex items-center justify-between p-3 text-xs font-bold transition-all',
								isRouteActive($page.url.pathname, item)
									? 'bg-primary/10 text-primary'
									: 'text-foreground hover:bg-muted/30'
							)}
						>
							<a
								href={item.children[0]?.route || item.route}
								onclick={closeDrawer}
								class="flex items-center gap-2.5 flex-1 min-w-0"
							>
								<div class="p-1.5 rounded-xl border border-border/50 bg-background text-primary shrink-0">
									<item.icon class="h-4 w-4 shrink-0" />
								</div>
								<span class="truncate">{item.label}</span>
							</a>

							<button
								type="button"
								onclick={(e) => toggleMenu(item.route, e)}
								class="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground cursor-pointer"
								aria-label="Toggle Submenu"
							>
								{#if expandedMenus[item.route]}
									<ChevronDown class="h-4 w-4" />
								{:else}
									<ChevronRight class="h-4 w-4" />
								{/if}
							</button>
						</div>

						<!-- Children Submenu Links -->
						{#if expandedMenus[item.route]}
							<div class="p-2 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-1.5 border-t border-border/40 bg-card/50">
								{#each item.children as child (child.route)}
									<a
										href={child.route}
										onclick={closeDrawer}
										class={cn(
											'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors touch-manipulation',
											$page.url.pathname === child.route
												? 'bg-primary text-primary-foreground font-bold shadow-xs'
												: 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
										)}
									>
										<div class="h-1.5 w-1.5 rounded-full bg-current opacity-70"></div>
										<span class="truncate">{child.label}</span>
									</a>
								{/each}
							</div>
						{/if}
					</div>
				{:else}
					<!-- Single Top-Level Link -->
					<a
						href={item.route}
						onclick={closeDrawer}
						class={cn(
							'flex items-center gap-3 p-3 rounded-2xl text-xs font-bold transition-all border touch-manipulation',
							isRouteActive($page.url.pathname, item)
								? 'bg-primary/10 text-primary border-primary/20'
								: 'text-foreground hover:bg-muted/40 border-border bg-card'
						)}
					>
						<div class="p-2 rounded-xl border border-border/50 bg-background text-primary shrink-0">
							<item.icon class="h-4 w-4 shrink-0" />
						</div>
						<span class="truncate">{item.label}</span>
					</a>
				{/if}
			{/each}
		</div>

		<!-- Sign Out button -->
		<div class="mt-4 pt-3 border-t border-border">
			<Button
				onclick={handleLogout}
				variant="destructive"
				class="w-full flex items-center justify-center gap-2 py-5 rounded-2xl font-bold touch-manipulation active:scale-[0.98] cursor-pointer text-xs"
			>
				<LogOut class="h-4 w-4" />
				<span>Sign Out</span>
			</Button>
		</div>
	</Sheet.Content>
</Sheet.Root>
