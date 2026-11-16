<script lang="ts">
	import type { StaffUserResponse, PortalType } from '../types/staff-types';
	import { updateStaffEmail } from '../api/staffs-api';
	import { toast } from '$lib/stores/toast';
	import { X, Mail, Loader2, Save, User } from 'lucide-svelte';

	let props = $props<{
		open: boolean;
		user: StaffUserResponse | null;
		portal: PortalType;
		onClose: () => void;
		onSaved: () => void;
	}>();

	let newEmail = $state('');
	let loading = $state(false);
	let errorMsg = $state<string | null>(null);

	$effect(() => {
		if (props.user) {
			newEmail = props.user.email || '';
			errorMsg = null;
			loading = false;
		}
	});

	function handleClose() {
		errorMsg = null;
		loading = false;
		props.onClose();
	}

	function portalTitle(p: PortalType): string {
		if (p === 'accounts') return 'Accounts Portal';
		if (p === 'sales') return 'Sales Portal';
		return 'Operational Portal';
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!props.user) return;

		const trimmed = newEmail.trim();
		if (!trimmed) {
			errorMsg = 'Please enter a valid email address.';
			return;
		}

		if (props.user.email && trimmed.toLowerCase() === props.user.email.toLowerCase()) {
			errorMsg = 'New email address is identical to current email address.';
			return;
		}

		errorMsg = null;
		loading = true;

		try {
			await updateStaffEmail(props.portal, props.user.id, trimmed);
			toast.success(`Email address updated to "${trimmed}" for ${props.user.name}.`);
			handleClose();
			props.onSaved();
		} catch (err: any) {
			errorMsg = err?.message || 'Failed to update email address.';
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
						class="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-200/60 flex items-center justify-center shadow-sm"
					>
						<Mail class="h-4.5 w-4.5" />
					</div>
					<div>
						<h2 class="text-sm font-bold text-foreground">Update Staff Email</h2>
						<p class="text-[10px] text-muted-foreground">{portalTitle(props.portal)} Member</p>
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
				<!-- Target User Summary Card -->
				<div class="p-3.5 rounded-xl bg-muted/30 border border-border space-y-1">
					<div class="flex items-center gap-2 text-xs font-bold text-foreground">
						<User class="h-3.5 w-3.5 text-blue-600" />
						<span>{props.user.name}</span>
					</div>
					<div class="text-[11px] text-muted-foreground">
						Current Email: <span class="font-mono text-foreground font-semibold">{props.user.email}</span>
					</div>
				</div>

				{#if errorMsg}
					<div
						class="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium"
					>
						{errorMsg}
					</div>
				{/if}

				<!-- New Email Input -->
				<div class="space-y-1.5">
					<label for="newEmail" class="text-xs font-semibold text-foreground flex items-center gap-1.5">
						<Mail class="h-3.5 w-3.5 text-muted-foreground" />
						New Email Address <span class="text-destructive">*</span>
					</label>
					<input
						id="newEmail"
						type="email"
						placeholder="e.g. newemail@texas.com"
						bind:value={newEmail}
						required
						class="w-full h-9 px-3 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
					/>
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
						class="h-9 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60 shadow-sm"
					>
						{#if loading}
							<Loader2 class="h-3.5 w-3.5 animate-spin" />
							<span>Updating...</span>
						{:else}
							<Save class="h-3.5 w-3.5" />
							<span>Update Email</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
