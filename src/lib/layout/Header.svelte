<script lang="ts">
	import Breadcrumbs from './Breadcrumbs.svelte';
	import { Sun, Moon, LogOut, Bell, User } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { currentUser, logout, hasRole } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { apiFetch } from '$lib/api/api-client';

	let isDark = $state(false);
	let totalPending = $state(0);

	onMount(() => {
		isDark = document.documentElement.classList.contains('dark');
		// Poll pending count for master accountants only
		if (hasRole('master_accountant')) {
			apiFetch<{ length: number } | unknown[]>('api/pending-approvals?status=pending')
				.then((res) => { totalPending = Array.isArray(res) ? res.length : 0; })
				.catch(() => {});
		}
	});

	function toggleTheme() {
		isDark = !isDark;
		if (isDark) {
			document.documentElement.classList.add('dark');
			if (typeof window !== 'undefined') {
				localStorage.setItem('theme', 'dark');
			}
		} else {
			document.documentElement.classList.remove('dark');
			if (typeof window !== 'undefined') {
				localStorage.setItem('theme', 'light');
			}
		}
	}

	// Derive user initials dynamically for avatar
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

	async function handleLogout() {
		await logout();
		goto('/login');
	}
</script>

<header
	class="flex items-center justify-between px-6 border-b border-border bg-card sticky top-0 z-40 select-none"
	style="padding-top: env(safe-area-inset-top, 0px); height: calc(4rem + env(safe-area-inset-top, 0px));"
>
	<div class="flex items-center gap-4">
		<!-- Mobile logo branding -->
		<a href="/dashboard" class="flex items-center gap-2 lg:hidden group shrink-0">
			<div class="h-8 bg-white flex items-center justify-center rounded-lg shadow-sm border border-border overflow-hidden p-0.5 px-1 shrink-0">
				<img
					src="https://admin.texastravelsbh.com/assets/images/texas-logo.png"
					class="h-6 w-auto object-contain"
					alt="Texas Travels"
				/>
			</div>
			<div class="flex flex-col">
				<span class="font-bold text-xs leading-none text-foreground group-hover:text-primary transition-colors">Texas Travels</span>
				<span class="text-[9px] uppercase tracking-wider font-semibold text-primary leading-none mt-0.5"
					>Accounts</span
				>
			</div>
		</a>

		<!-- Desktop Breadcrumbs -->
		<div class="hidden lg:block">
			<Breadcrumbs />
		</div>
	</div>

	<div class="flex items-center gap-3 font-sans">
		<!-- Pending Approvals badge (master accountant only) -->
		{#if hasRole('master_accountant') && totalPending > 0}
			<div class="relative">
				<Button
					variant="ghost"
					size="icon"
					class="text-amber-500 cursor-pointer hover:bg-amber-50"
					onclick={() => goto('/pending-approvals')}
					aria-label="Pending approvals"
					title="{totalPending} pending approval{totalPending === 1 ? '' : 's'}"
				>
					<Bell class="h-4.5 w-4.5" />
				</Button>
				<span
					class="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 flex items-center justify-center rounded-full text-[9px] font-bold bg-amber-500 text-white pointer-events-none"
				>
					{totalPending}
				</span>
			</div>
		{/if}

		<!-- Theme toggle -->
		<Button
			variant="ghost"
			size="icon"
			class="text-muted-foreground cursor-pointer"
			onclick={toggleTheme}
			aria-label="Toggle theme mode"
		>
			{#if isDark}
				<Sun class="h-4.5 w-4.5" />
			{:else}
				<Moon class="h-4.5 w-4.5" />
			{/if}
		</Button>

		<div class="h-6 w-[1px] bg-border"></div>

		<!-- Active User Popover Menu -->
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				<button
					class="flex items-center gap-2 outline-none hover:opacity-80 transition-opacity focus-visible:ring-2 focus-visible:ring-primary/20 rounded-lg p-1 cursor-pointer"
					aria-label="User profile menu"
				>
					<div class="hidden sm:flex flex-col text-right">
						<span class="text-xs font-semibold leading-none">{$currentUser?.name}</span>
						<span class="text-[9px] text-muted-foreground mt-0.5 capitalize">
							{($currentUser?.userType || '').replace(/_/g, ' ')}
						</span>
					</div>
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
				</button>
			</DropdownMenu.Trigger>

			<DropdownMenu.Content align="end" class="w-56 mt-2">
				<DropdownMenu.Label class="font-normal">
					<div class="flex flex-col space-y-1">
						<p class="text-sm font-medium leading-none">{$currentUser?.name}</p>
						<p class="text-xs leading-none text-muted-foreground">
							{$currentUser?.email}
						</p>
					</div>
				</DropdownMenu.Label>
				<DropdownMenu.Separator />
				<DropdownMenu.Item
					onclick={() => goto('/profile')}
					class="cursor-pointer text-xs font-medium"
				>
					<User class="mr-2 h-4 w-4" />
					<span>Profile Settings</span>
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item
					onclick={handleLogout}
					class="text-destructive focus:text-destructive cursor-pointer text-xs font-medium"
				>
					<LogOut class="mr-2 h-4 w-4" />
					<span>Sign Out</span>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
</header>
