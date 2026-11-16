<script lang="ts">
	import type { StaffUserResponse } from '../types/staff-types';
	import { updateSalesmanTargets } from '../api/staffs-api';
	import { toast } from '$lib/stores/toast';
	import { X, Target, Loader2, Save, User, TrendingUp } from 'lucide-svelte';

	let props = $props<{
		open: boolean;
		user: StaffUserResponse | null;
		onClose: () => void;
		onSaved: () => void;
	}>();

	let monthlyTarget = $state<number>(0);
	let profitTarget = $state<number>(0);
	let loading = $state(false);
	let errorMsg = $state<string | null>(null);

	$effect(() => {
		if (props.user) {
			monthlyTarget = props.user.monthlyTarget ?? 0;
			profitTarget = props.user.profitTarget ?? 0;
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

		if (monthlyTarget < 0 || profitTarget < 0) {
			errorMsg = 'Targets cannot be negative numbers.';
			return;
		}

		errorMsg = null;
		loading = true;

		try {
			await updateSalesmanTargets(props.user.id, Number(monthlyTarget), Number(profitTarget));
			if (props.user) {
				props.user.monthlyTarget = Number(monthlyTarget);
				props.user.profitTarget = Number(profitTarget);
			}
			toast.success(`Sales targets updated successfully for ${props.user.name}.`);
			handleClose();
			props.onSaved();
		} catch (err: any) {
			errorMsg = err?.message || 'Failed to update salesman targets.';
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
						class="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shadow-sm"
					>
						<Target class="h-4.5 w-4.5" />
					</div>
					<div>
						<h2 class="text-sm font-bold text-foreground">Set Sales Targets</h2>
						<p class="text-[10px] text-muted-foreground">Configure monthly volume & profit goals</p>
					</div>
				</div>
				<button
					onclick={handleClose}
					class="h-8 w-8 rounded-lg bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<form onsubmit={handleSubmit} class="p-6 space-y-4 text-xs">
				<!-- Salesman Info Box -->
				<div class="p-3 bg-muted/40 border border-border rounded-xl flex items-center gap-3">
					<div
						class="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs"
					>
						<User class="h-4 w-4" />
					</div>
					<div class="min-w-0">
						<p class="font-bold text-foreground truncate">{props.user.name}</p>
						<p class="text-[10px] text-muted-foreground font-mono truncate">{props.user.email}</p>
					</div>
				</div>

				{#if errorMsg}
					<div class="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs">
						{errorMsg}
					</div>
				{/if}

				<!-- Monthly Sales Volume Target Input -->
				<div class="space-y-1.5">
					<label for="monthlyTargetInput" class="font-semibold text-foreground flex items-center gap-1.5">
						<Target class="h-3.5 w-3.5 text-primary" />
						<span>Monthly Sales Volume Target (BHD)</span>
					</label>
					<input
						id="monthlyTargetInput"
						type="number"
						step="0.001"
						min="0"
						placeholder="0.000"
						bind:value={monthlyTarget}
						class="w-full h-9 px-3 bg-background border border-border rounded-xl text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
					/>
					<p class="text-[10px] text-muted-foreground">The gross monthly booking sales volume expected from this salesman.</p>
				</div>

				<!-- Monthly Profit Target Input -->
				<div class="space-y-1.5">
					<label for="profitTargetInput" class="font-semibold text-foreground flex items-center gap-1.5">
						<TrendingUp class="h-3.5 w-3.5 text-emerald-600" />
						<span>Monthly Profit Target (BHD)</span>
					</label>
					<input
						id="profitTargetInput"
						type="number"
						step="0.001"
						min="0"
						placeholder="0.000"
						bind:value={profitTarget}
						class="w-full h-9 px-3 bg-background border border-border rounded-xl text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
					/>
					<p class="text-[10px] text-muted-foreground">The net monthly profit target expected from this salesman's bookings.</p>
				</div>

				<!-- Modal Actions -->
				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={handleClose}
						disabled={loading}
						class="h-8.5 px-3 rounded-xl border border-border bg-background text-foreground hover:bg-muted text-xs font-medium cursor-pointer transition-colors"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={loading}
						class="h-8.5 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60"
					>
						{#if loading}
							<Loader2 class="h-3.5 w-3.5 animate-spin" />
							<span>Saving...</span>
						{:else}
							<Save class="h-3.5 w-3.5" />
							<span>Save Targets</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
