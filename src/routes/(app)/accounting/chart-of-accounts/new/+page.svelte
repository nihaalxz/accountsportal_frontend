<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createChartOfAccount, getChartOfAccounts } from '$features/chart-of-accounts/api';
	import type {
		ChartOfAccountResponse,
		AccountType,
		NormalBalance
	} from '$features/chart-of-accounts/types';
	import { Button } from '$lib/components/ui/button';
	import { addToast } from '$lib/stores/toast';
	import { ArrowLeft } from 'lucide-svelte';

	let code = $state('');
	let name = $state('');
	let accountType = $state<AccountType>('asset');
	let normalBalance = $state<NormalBalance>('debit');
	let parentIdVal = $state<string>(''); // empty string for null
	let isControlAccount = $state(false);
	let description = $state('');

	let parentAccounts = $state<ChartOfAccountResponse[]>([]);
	let isSubmitting = $state(false);
	let isLoadingParents = $state(true);

	async function loadParents() {
		try {
			const res = await getChartOfAccounts();
			// Only allow Control accounts as parents
			parentAccounts = res.filter((a) => a.isControlAccount);
		} catch (err: any) {
			addToast(err.message || 'Failed to load parent accounts.', 'error');
		} finally {
			isLoadingParents = false;
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!code.trim() || !name.trim()) {
			addToast('Please fill in Code and Name.', 'error');
			return;
		}

		isSubmitting = true;
		try {
			const parentId = parentIdVal === '' ? null : parseInt(parentIdVal);
			await createChartOfAccount({
				code: code.trim(),
				name: name.trim(),
				accountType,
				normalBalance,
				parentId,
				isControlAccount,
				description: description.trim() || null
			});
			addToast('Account created successfully.', 'success');
			goto('/accounting/chart-of-accounts');
		} catch (err: any) {
			addToast(err.message || 'Failed to create chart of account.', 'error');
		} finally {
			isSubmitting = false;
		}
	}

	onMount(() => {
		loadParents();
	});
</script>

<svelte:head>
	<title>Create Account — Accounts Portal</title>
</svelte:head>

<div class="max-w-2xl mx-auto space-y-6">
	<!-- Header -->
	<div class="space-y-2">
		<button
			onclick={() => goto('/accounting/chart-of-accounts')}
			class="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
		>
			<ArrowLeft class="h-3.5 w-3.5" />
			Back to Chart of Accounts
		</button>
		<h1 class="text-xl font-bold text-foreground">Create Chart of Account</h1>
		<p class="text-xs text-muted-foreground">
			Add a new posting or control account to the ledger hierarchy.
		</p>
	</div>

	<!-- Form Card -->
	<form
		onsubmit={handleSubmit}
		class="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4 text-xs"
	>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<!-- Account Code -->
			<div class="space-y-1.5">
				<label for="code" class="font-semibold text-muted-foreground">Account Code</label>
				<input
					id="code"
					type="text"
					required
					placeholder="e.g. 1010"
					class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
					bind:value={code}
				/>
			</div>

			<!-- Account Name -->
			<div class="space-y-1.5">
				<label for="name" class="font-semibold text-muted-foreground">Account Name</label>
				<input
					id="name"
					type="text"
					required
					placeholder="e.g. Petty Cash Drawer"
					class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
					bind:value={name}
				/>
			</div>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<!-- Account Type -->
			<div class="space-y-1.5">
				<label for="accountType" class="font-semibold text-muted-foreground"
					>Account Type</label
				>
				<select
					id="accountType"
					class="h-10 w-full bg-background border border-border rounded-xl px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
					bind:value={accountType}
				>
					<option value="asset">Asset</option>
					<option value="liability">Liability</option>
					<option value="equity">Equity</option>
					<option value="revenue">Revenue</option>
					<option value="expense">Expense</option>
				</select>
			</div>

			<!-- Normal Balance Direction -->
			<div class="space-y-1.5">
				<label for="normalBalance" class="font-semibold text-muted-foreground"
					>Normal Balance</label
				>
				<select
					id="normalBalance"
					class="h-10 w-full bg-background border border-border rounded-xl px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
					bind:value={normalBalance}
				>
					<option value="debit">Debit</option>
					<option value="credit">Credit</option>
				</select>
			</div>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<!-- Parent Account -->
			<div class="space-y-1.5">
				<label for="parentId" class="font-semibold text-muted-foreground"
					>Parent Account (Optional)</label
				>
				<select
					id="parentId"
					class="h-10 w-full bg-background border border-border rounded-xl px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground disabled:opacity-50"
					disabled={isLoadingParents}
					bind:value={parentIdVal}
				>
					<option value="">-- No Parent (Root Account) --</option>
					{#each parentAccounts as p}
						<option value={String(p.id)}>{p.code} — {p.name}</option>
					{/each}
				</select>
			</div>

			<!-- Is Control Account -->
			<div class="flex items-center gap-2 pt-6">
				<input
					id="isControlAccount"
					type="checkbox"
					class="h-4 w-4 rounded border-border text-primary focus:ring-primary/25 cursor-pointer"
					bind:checked={isControlAccount}
				/>
				<label
					for="isControlAccount"
					class="font-semibold text-muted-foreground cursor-pointer select-none"
				>
					Is Control Account (Allows sub-accounts, blocks postings)
				</label>
			</div>
		</div>

		<!-- Description -->
		<div class="space-y-1.5">
			<label for="description" class="font-semibold text-muted-foreground"
				>Description / Notes (Optional)</label
			>
			<textarea
				id="description"
				rows="3"
				placeholder="Add contextual details for this ledger account..."
				class="w-full bg-background border border-border rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground resize-y"
				bind:value={description}></textarea>
		</div>

		<!-- Action Buttons -->
		<div class="flex items-center justify-end gap-3 pt-4 border-t border-border">
			<Button
				variant="outline"
				class="rounded-xl px-5 py-4.5 font-semibold cursor-pointer"
				disabled={isSubmitting}
				onclick={() => goto('/accounting/chart-of-accounts')}
			>
				Cancel
			</Button>
			<Button
				type="submit"
				class="rounded-xl px-5 py-4.5 font-semibold cursor-pointer"
				disabled={isSubmitting}
			>
				{isSubmitting ? 'Creating...' : 'Create Account'}
			</Button>
		</div>
	</form>
</div>
