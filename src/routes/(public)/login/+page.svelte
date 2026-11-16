<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { login, isAuthenticated } from '$lib/stores/auth';
	import { Eye, EyeOff, Lock, Loader2 } from 'lucide-svelte';

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);

	// If already authenticated, redirect immediately
	$effect(() => {
		if ($isAuthenticated) {
			const returnTo = $page.url.searchParams.get('returnTo') || '/dashboard';
			goto(returnTo);
		}
	});

	async function handleLogin(e: Event) {
		e.preventDefault();
		if (!email || !password) return;

		loading = true;
		errorMessage = null;

		try {
			await login(email.trim(), password);
			// Success will trigger the redirect effect above
		} catch (err: unknown) {
			const errorDetail = err as Record<string, any>;
			errorMessage =
				errorDetail?.detail || errorDetail?.message || 'Invalid email or password.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Accounts Portal — Sign In</title>
	<meta name="description" content="Sign in to the Texas Accounts Portal." />
</svelte:head>

<div
	class="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-muted/30 overflow-y-auto px-4 py-8 pt-safe pb-safe"
>
	<div
		class="w-full max-w-[440px] bg-card border border-border rounded-3xl p-8 md:p-10 shadow-lg flex flex-col"
	>
		<!-- Lock Accent Icon -->
		<div class="flex justify-center">
			<div class="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
				<Lock class="w-6 h-6 text-primary" />
			</div>
		</div>

		<!-- Title and Brand -->
		<h2 class="text-2xl font-bold text-foreground text-center mt-5 leading-tight">
			Texas Accounts Portal
		</h2>
		<p class="text-xs text-muted-foreground text-center mt-1.5 font-medium">
			Sign in to access accounting & ledger systems
		</p>

		<!-- Error Summary -->
		{#if errorMessage}
			<div
				class="mt-5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold leading-relaxed flex items-start gap-2 animate-fadeIn"
				role="alert"
			>
				<span class="mt-0.5 shrink-0 text-sm">⚠️</span>
				<span>{errorMessage}</span>
			</div>
		{/if}

		<!-- Form -->
		<form onsubmit={handleLogin} class="mt-6 space-y-5">
			<!-- Email Address Input -->
			<div class="space-y-1.5">
				<label for="email" class="block text-xs font-bold text-muted-foreground">
					Email Address
				</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					required
					autocomplete="email"
					placeholder="name@example.com"
					class="w-full border border-input rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background transition-all font-medium"
				/>
			</div>

			<!-- Password Input -->
			<div class="space-y-1.5">
				<label for="password" class="block text-xs font-bold text-muted-foreground">
					Password
				</label>
				<div class="relative">
					<input
						id="password"
						type={showPassword ? 'text' : 'password'}
						bind:value={password}
						required
						autocomplete="current-password"
						placeholder="••••••••••••"
						class="w-full border border-input rounded-xl px-4 py-3 pr-12 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background transition-all font-medium"
					/>
					<button
						type="button"
						onclick={() => (showPassword = !showPassword)}
						class="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
						aria-label={showPassword ? 'Hide password' : 'Show password'}
					>
						{#if showPassword}
							<EyeOff class="h-4.5 w-4.5" />
						{:else}
							<Eye class="h-4.5 w-4.5" />
						{/if}
					</button>
				</div>
			</div>

			<!-- Submit button -->
			<button
				type="submit"
				disabled={loading}
				class="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3.5 px-6 rounded-xl text-sm transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
			>
				{#if loading}
					<Loader2 class="h-4 w-4 animate-spin" />
					<span>Signing in...</span>
				{:else}
					<span>Sign In</span>
				{/if}
			</button>
		</form>
	</div>

	<p class="text-[11px] font-semibold text-muted-foreground mt-6 tracking-wide">
		© 2026 Texas Travels. All rights reserved.
	</p>
</div>
