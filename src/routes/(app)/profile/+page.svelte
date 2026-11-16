<script lang="ts">
	import { currentUser, updateCurrentUserProfile } from '$lib/stores/auth';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { toast } from '$lib/stores/toast';
	import { apiFetch } from '$lib/api/api-client';
	import { Camera, Key, Save, RefreshCw, User } from 'lucide-svelte';

	let previewUrl = $state<string | null>(null);
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	
	let isSaving = $state(false);
	let fileInputRef = $state<HTMLInputElement | null>(null);

	// Derive user initials dynamically for avatar fallback
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

	function handleFileChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		if (file.size > 1.5 * 1024 * 1024) {
			toast.error('Image size must be less than 1.5MB.');
			return;
		}

		const reader = new FileReader();
		reader.onload = (ev) => {
			previewUrl = ev.target?.result as string;
		};
		reader.readAsDataURL(file);
	}

	function triggerFileInput() {
		fileInputRef?.click();
	}

	async function handleSaveProfile(e: Event) {
		e.preventDefault();

		if (newPassword && newPassword !== confirmPassword) {
			toast.error('New password and confirmation do not match.');
			return;
		}

		if (newPassword && !currentPassword) {
			toast.error('Current password is required to change password.');
			return;
		}

		isSaving = true;

		try {
			const body: { currentPassword?: string; newPassword?: string; profilePicture?: string } = {};

			if (newPassword) {
				body.currentPassword = currentPassword;
				body.newPassword = newPassword;
			}

			if (previewUrl) {
				body.profilePicture = previewUrl;
			}

			const response = await apiFetch<{ message: string; profilePicture?: string }>('api/auth/profile', {
				method: 'PUT',
				body: JSON.stringify(body),
				headers: { 'Content-Type': 'application/json' }
			});

			toast.success(response.message || 'Profile updated successfully.');
			
			if (response.profilePicture) {
				updateCurrentUserProfile(response.profilePicture);
			}

			// Clear password fields on success
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
			previewUrl = null; // Reset modified preview to let original user state bind
		} catch (err: any) {
			toast.error(err.message || 'Failed to update profile.');
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>My Profile — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-1">
		<h1 class="text-xl font-bold text-foreground flex items-center gap-2">
			<User class="h-5 w-5 text-primary" /> My Profile
		</h1>
		<p class="text-xs text-muted-foreground">Manage your personal account settings, profile picture, and login credentials.</p>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
		<!-- Left: Avatar Upload card -->
		<div class="bg-card border border-border rounded-2xl p-6 shadow-xs flex flex-col items-center justify-center text-center space-y-4">
			<span class="text-xs font-bold text-foreground self-start">Profile Photo</span>
			
			<div class="relative group cursor-pointer" onclick={triggerFileInput} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && triggerFileInput()}>
				<!-- Avatar Image -->
				{#if previewUrl}
					<img src={previewUrl} class="h-32 w-32 rounded-full object-cover border border-primary/20 shadow-md group-hover:opacity-85 transition-opacity" alt="Avatar Preview" />
				{:else if $currentUser?.profilePicture}
					<img src={$currentUser.profilePicture} class="h-32 w-32 rounded-full object-cover border border-primary/20 shadow-md group-hover:opacity-85 transition-opacity" alt="Current Avatar" />
				{:else}
					<div class="h-32 w-32 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-3xl border border-primary/20 shadow-md group-hover:bg-primary/15 transition-colors">
						{userInitials()}
					</div>
				{/if}

				<!-- Camera Overlay -->
				<div class="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[11px] font-semibold gap-1">
					<Camera class="h-4 w-4" /> Change Photo
				</div>
			</div>

			<input
				type="file"
				accept="image/*"
				bind:this={fileInputRef}
				class="hidden"
				onchange={handleFileChange}
			/>

			<div class="space-y-1">
				<p class="text-xs font-bold text-foreground">{$currentUser?.name}</p>
				<p class="text-[10px] text-muted-foreground">{$currentUser?.email}</p>
				<span class="inline-flex text-[9px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full mt-1.5">
					{($currentUser?.userType || '').replace(/_/g, ' ')}
				</span>
			</div>
			
			<p class="text-[10px] text-muted-foreground/60 px-4">
				JPG, PNG, or WEBP. Max size 1.5MB. Stored directly to your account.
			</p>
		</div>

		<!-- Right: Info / Password change Form -->
		<div class="bg-card border border-border rounded-2xl p-6 shadow-xs lg:col-span-3">
			<form onsubmit={handleSaveProfile} class="space-y-6">
				<!-- General Details -->
				<div class="space-y-4">
					<h3 class="text-xs font-bold text-foreground flex items-center gap-1.5 border-b border-border/50 pb-2">
						<User class="h-3.5 w-3.5 text-primary" /> Profile Info
					</h3>
					
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
						<div class="space-y-1.5">
							<label class="block font-semibold text-muted-foreground" for="user-name">Full Name</label>
							<Input id="user-name" type="text" value={$currentUser?.name} disabled class="bg-muted/30" />
						</div>
						<div class="space-y-1.5">
							<label class="block font-semibold text-muted-foreground" for="user-email">Email Address</label>
							<Input id="user-email" type="email" value={$currentUser?.email} disabled class="bg-muted/30" />
						</div>
					</div>
				</div>

				<!-- Password Change Details -->
				<div class="space-y-4 pt-2">
					<h3 class="text-xs font-bold text-foreground flex items-center gap-1.5 border-b border-border/50 pb-2">
						<Key class="h-3.5 w-3.5 text-primary" /> Change Password
					</h3>

					<div class="space-y-3 text-xs">
						<div class="space-y-1.5 max-w-md">
							<label class="block font-semibold text-foreground" for="p-current">Current Password</label>
							<Input id="p-current" type="password" bind:value={currentPassword} placeholder="Enter current password to authorize changes" />
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div class="space-y-1.5">
								<label class="block font-semibold text-foreground" for="p-new">New Password</label>
								<Input id="p-new" type="password" bind:value={newPassword} placeholder="Minimum 6 characters" />
							</div>
							<div class="space-y-1.5">
								<label class="block font-semibold text-foreground" for="p-confirm">Confirm New Password</label>
								<Input id="p-confirm" type="password" bind:value={confirmPassword} placeholder="Re-type new password" />
							</div>
						</div>
					</div>
				</div>

				<!-- Save Action Button -->
				<div class="flex justify-end pt-4 border-t border-border/50">
					<Button type="submit" disabled={isSaving || (!previewUrl && !newPassword)} class="rounded-xl h-9 px-5 text-xs font-semibold gap-1.5 cursor-pointer">
						{#if isSaving}
							<RefreshCw class="h-3.5 w-3.5 animate-spin" /> Saving...
						{:else}
							<Save class="h-3.5 w-3.5" /> Save Profile
						{/if}
					</Button>
				</div>
			</form>
		</div>
	</div>
</div>
