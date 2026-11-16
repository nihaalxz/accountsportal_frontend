<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getSalaryPayments,
		updateSalaryPaymentStatus
	} from '$features/payroll/services/payroll-api';
	import type { SalaryPayment } from '$features/payroll/types';
	import {
		Wallet,
		AlertCircle,
		CheckCircle2,
		X,
		RefreshCw,
		Plus,
		Check,
		Ban,
		DollarSign
	} from 'lucide-svelte';

	let loading = $state(true);
	let error = $state<string | null>(null);
	let successMsg = $state<string | null>(null);
	let pendingPayments = $state<SalaryPayment[]>([]);
	let actionLoadingId = $state<number | null>(null);

	onMount(async () => {
		await loadPendingPayments();
	});

	async function loadPendingPayments() {
		loading = true;
		error = null;
		try {
			pendingPayments = await getSalaryPayments('Pending');
		} catch (err: any) {
			error = err?.message || 'Failed to load pending payout data';
		} finally {
			loading = false;
		}
	}

	async function handleStatusUpdate(id: number, status: 'Paid' | 'Cancelled') {
		actionLoadingId = id;
		error = null;
		try {
			await updateSalaryPaymentStatus(id, { status });
			successMsg = `Salary payment marked as '${status}'.`;
			setTimeout(() => (successMsg = null), 4000);
			await loadPendingPayments();
		} catch (err: any) {
			error = err?.message || `Failed to update status to ${status}`;
		} finally {
			actionLoadingId = null;
		}
	}

	function formatCurrency(val: number, curr = 'BHD') {
		return `${curr} ${(val || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
	}

	const months = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="bg-card p-6 rounded-2xl border border-border shadow-sm flex items-center justify-between">
		<div>
			<h1 class="text-xl font-bold text-foreground flex items-center gap-2">
				<Wallet class="h-6 w-6 text-primary" />
				Salary Payout Generator
			</h1>
			<p class="text-xs text-muted-foreground mt-1">
				Generate and process monthly staff salary payouts cleanly through Cash or Bank accounts without impacting Journal Entries or Ledger engines.
			</p>
		</div>
		<a
			href="/payments/new?tab=salary"
			class="h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-2 shrink-0"
		>
			<Plus class="h-4 w-4" />
			<span>Log New Payout</span>
		</a>
	</div>

	{#if error}
		<div class="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center justify-between">
			<div class="flex items-center gap-2">
				<AlertCircle class="h-4 w-4 shrink-0" />
				<span>{error}</span>
			</div>
			<button onclick={() => (error = null)} class="hover:opacity-80"><X class="h-4 w-4" /></button>
		</div>
	{/if}

	{#if successMsg}
		<div class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between">
			<div class="flex items-center gap-2">
				<CheckCircle2 class="h-4 w-4 shrink-0" />
				<span>{successMsg}</span>
			</div>
			<button onclick={() => (successMsg = null)} class="hover:opacity-80"><X class="h-4 w-4" /></button>
		</div>
	{/if}

	<!-- Pending Payouts Card -->
	<div class="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-4">
		<div class="border-b border-border pb-3 flex items-center justify-between">
			<h2 class="text-sm font-bold text-foreground flex items-center gap-2">
				<DollarSign class="h-4 w-4 text-amber-500" />
				Pending Salary Payouts ({pendingPayments.length})
			</h2>
			<a
				href="/payments/new?tab=salary"
				class="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
			>
				<Plus class="h-3.5 w-3.5" />
				<span>Log Payout in Treasury Payments</span>
			</a>
		</div>

		<div class="space-y-3">
			{#if pendingPayments.length === 0}
				<div class="p-12 text-center text-muted-foreground text-xs bg-muted/20 border border-dashed border-border rounded-xl">
					No pending salary payouts waiting for payment approval.
				</div>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{#each pendingPayments as item}
						<div class="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
							<div class="flex items-center justify-between text-xs font-bold text-foreground">
								<span>{item.employeeName}</span>
								<span class="text-primary">{formatCurrency(item.netSalary)}</span>
							</div>
							<div class="text-[11px] text-muted-foreground flex items-center justify-between">
								<span>Period: {months[item.payrollMonth - 1]} {item.payrollYear}</span>
								<span class="font-medium">{item.paymentMethod}</span>
							</div>
							<div class="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
								<button
									onclick={() => handleStatusUpdate(item.id, 'Cancelled')}
									disabled={actionLoadingId === item.id}
									class="h-8 px-2.5 rounded-lg border border-destructive/30 text-destructive text-[11px] font-semibold hover:bg-destructive/10 transition-colors cursor-pointer flex items-center gap-1"
								>
									<Ban class="h-3.5 w-3.5" />
									<span>Cancel</span>
								</button>
								<button
									onclick={() => handleStatusUpdate(item.id, 'Paid')}
									disabled={actionLoadingId === item.id}
									class="h-8 px-3 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
								>
									{#if actionLoadingId === item.id}
										<RefreshCw class="h-3.5 w-3.5 animate-spin" />
									{:else}
										<Check class="h-3.5 w-3.5" />
									{/if}
									<span>Mark Paid</span>
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
