<script lang="ts">
	import type { StaffUserResponse } from '../types/staff-types';
	import { updateOperationalPermissions } from '../api/staffs-api';
	import { toast } from '$lib/stores/toast';
	import { X, ShieldCheck, Loader2, Save, User, Mail } from 'lucide-svelte';

	let props = $props<{
		open: boolean;
		user: StaffUserResponse | null;
		onClose: () => void;
		onSaved: () => void;
	}>();

	let permVisas = $state(true);
	let permVfs = $state(true);
	let permHolidays = $state(true);

	let loading = $state(false);
	let errorMsg = $state<string | null>(null);

	$effect(() => {
		if (props.user) {
			const perms = props.user.operationalPermissions || [];
			permVisas = perms.includes('visas');
			permVfs = perms.includes('vfs');
			permHolidays = perms.includes('holidays');
			errorMsg = null;
			loading = false;
		}
	});

	function handleClose() {
		errorMsg = null;
		loading = false;
		props.onClose();
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!props.user) return;

		errorMsg = null;
		loading = true;

		try {
			const permissions: string[] = [];
			if (permVisas) permissions.push('visas');
			if (permVfs) permissions.push('vfs');
			if (permHolidays) permissions.push('holidays');

			await updateOperationalPermissions({
				name: props.user.name,
				email: props.user.email,
				userType: props.user.role || 'Operations',
				permissions
			});

			toast.success(`Operational permissions updated for ${props.user.name}.`);
			handleClose();
			props.onSaved();
		} catch (err: any) {
			errorMsg = err?.message || 'Failed to update operational permissions.';
			toast.error(errorMsg!);
		} finally {
			loading = false;
		}
	}
</script>

{#if props.open && props.user}
	<div
		class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
		onclick={(e) => e.target === e.currentTarget && handleClose()}
		role="dialog"
		aria-modal="true"
	>
		<div
			class="bg-card border border-border rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
		>
			<!-- Modal Header -->
			<div class="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
				<div class="flex items-center gap-2.5">
					<div
						class="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-600 border border-purple-200/60 flex items-center justify-center shadow-sm"
					>
						<ShieldCheck class="h-4.5 w-4.5" />
					</div>
					<div>
						<h2 class="text-sm font-bold text-foreground">Edit Operational Permissions</h2>
						<p class="text-[10px] text-muted-foreground">Manage section access rights</p>
					</div>
				</div>
				<button
					onclick={handleClose}
					class="h-8 w-8 rounded-lg bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<form onsubmit={handleSubmit} class="p-6 space-y-5">
				<!-- Target User Card -->
				<div class="p-3.5 rounded-xl bg-muted/30 border border-border space-y-1">
					<div class="flex items-center gap-2 text-xs font-bold text-foreground">
						<User class="h-3.5 w-3.5 text-purple-600" />
						<span>{props.user.name}</span>
					</div>
					<div class="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
						<Mail class="h-3 w-3 text-muted-foreground" />
						<span>{props.user.email}</span>
					</div>
				</div>

				{#if errorMsg}
					<div
						class="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium"
					>
						{errorMsg}
					</div>
				{/if}

				<!-- Permissions Checkboxes -->
				<div class="space-y-2">
					<span class="text-xs font-bold text-foreground block"
						>Role Access Permissions (Operational Services)</span
					>
					<div class="space-y-2.5 bg-purple-500/5 p-4 rounded-xl border border-purple-200/60">
						<label
							class="flex items-center gap-2.5 text-xs font-semibold text-foreground cursor-pointer select-none"
						>
							<input
								type="checkbox"
								bind:checked={permVisas}
								class="h-4 w-4 rounded border-border text-purple-600 focus:ring-purple-500"
							/>
							<span>Visa Services</span>
						</label>

						<label
							class="flex items-center gap-2.5 text-xs font-semibold text-foreground cursor-pointer select-none"
						>
							<input
								type="checkbox"
								bind:checked={permVfs}
								class="h-4 w-4 rounded border-border text-purple-600 focus:ring-purple-500"
							/>
							<span>VFS Services</span>
						</label>

						<label
							class="flex items-center gap-2.5 text-xs font-semibold text-foreground cursor-pointer select-none"
						>
							<input
								type="checkbox"
								bind:checked={permHolidays}
								class="h-4 w-4 rounded border-border text-purple-600 focus:ring-purple-500"
							/>
							<span>Holiday Packages</span>
						</label>
					</div>
				</div>

				<!-- Actions -->
				<div class="pt-4 border-t border-border flex items-center justify-end gap-3">
					<button
						type="button"
						onclick={handleClose}
						disabled={loading}
						class="h-9 px-4 rounded-xl border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-60"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={loading}
						class="h-9 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60 shadow-sm"
					>
						{#if loading}
							<Loader2 class="h-3.5 w-3.5 animate-spin" />
							<span>Saving...</span>
						{:else}
							<Save class="h-3.5 w-3.5" />
							<span>Save Permissions</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
