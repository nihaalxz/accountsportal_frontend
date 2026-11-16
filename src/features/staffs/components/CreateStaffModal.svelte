<script lang="ts">
	import type { PortalType } from '../types/staff-types';
	import {
		createAccountsStaff,
		createSalesStaff,
		createOperationalStaff
	} from '../api/staffs-api';
	import { toast } from '$lib/stores/toast';
	import {
		X,
		Building2,
		Briefcase,
		Wrench,
		UserPlus,
		Loader2,
		ShieldCheck,
		Lock,
		Mail,
		User
	} from 'lucide-svelte';

	let props = $props<{
		open: boolean;
		onClose: () => void;
		onCreated: (portal: PortalType) => void;
	}>();

	let selectedPortal = $state<PortalType>('accounts');

	// Isolated form state per portal
	let forms = $state({
		accounts: {
			name: '',
			email: '',
			password: '',
			role: 'accounts' as 'accounts' | 'master_accountant'
		},
		sales: {
			name: '',
			email: '',
			password: '',
			role: 'Salesman'
		},
		operational: {
			name: '',
			email: '',
			password: '',
			role: 'Operations',
			permVisas: true,
			permVfs: true,
			permHolidays: true
		}
	});

	let loading = $state(false);
	let errorMsg = $state<string | null>(null);

	function resetForms() {
		forms.accounts = { name: '', email: '', password: '', role: 'accounts' };
		forms.sales = { name: '', email: '', password: '', role: 'Salesman' };
		forms.operational = {
			name: '',
			email: '',
			password: '',
			role: 'Operations',
			permVisas: true,
			permVfs: true,
			permHolidays: true
		};
		errorMsg = null;
		loading = false;
	}

	function handleClose() {
		resetForms();
		props.onClose();
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		errorMsg = null;

		const currentForm = forms[selectedPortal];
		if (!currentForm.name.trim() || !currentForm.email.trim() || !currentForm.password.trim()) {
			errorMsg = 'Please fill in all required fields (Name, Email, Password).';
			return;
		}

		loading = true;
		try {
			if (selectedPortal === 'accounts') {
				const f = forms.accounts;
				await createAccountsStaff({
					name: f.name.trim(),
					email: f.email.trim(),
					password: f.password.trim(),
					role: f.role
				});
				toast.success(`Accounts staff user "${f.name.trim()}" created successfully.`);
			} else if (selectedPortal === 'sales') {
				const f = forms.sales;
				await createSalesStaff({
					name: f.name.trim(),
					email: f.email.trim(),
					password: f.password.trim(),
					role: 'Salesman'
				});
				toast.success(`Sales staff user "${f.name.trim()}" created successfully.`);
			} else {
				const f = forms.operational;
				const permissions: string[] = [];
				if (f.permVisas) permissions.push('visas');
				if (f.permVfs) permissions.push('vfs');
				if (f.permHolidays) permissions.push('holidays');

				await createOperationalStaff({
					name: f.name.trim(),
					email: f.email.trim(),
					password: f.password.trim(),
					role: 'Operations',
					permissions
				});
				toast.success(`Operational staff user "${f.name.trim()}" created successfully.`);
			}

			const currentPortal = selectedPortal;
			handleClose();
			props.onCreated(currentPortal);
		} catch (err: any) {
			errorMsg = err?.message || 'Failed to create staff member.';
			toast.error(errorMsg!);
		} finally {
			loading = false;
		}
	}
</script>

{#if props.open}
	<div
		class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
		onclick={(e) => e.target === e.currentTarget && handleClose()}
		role="dialog"
		aria-modal="true"
	>
		<div
			class="bg-card border border-border rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
		>
			<!-- Modal Header -->
			<div class="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
				<div class="flex items-center gap-2.5">
					<div
						class="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm text-white"
					>
						<UserPlus class="h-4.5 w-4.5" />
					</div>
					<div>
						<h2 class="text-sm font-bold text-foreground">Create New Staff Member</h2>
						<p class="text-[10px] text-muted-foreground">Provision employee account into portal</p>
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
				<!-- Step 1: Portal Selection Cards -->
				<div class="space-y-2">
					<span class="text-xs font-bold text-foreground uppercase tracking-wider block"
						>1. Select Target Portal</span
					>
					<div class="grid grid-cols-3 gap-2">
						<!-- Accounts Portal -->
						<button
							type="button"
							onclick={() => { selectedPortal = 'accounts'; errorMsg = null; }}
							class="p-3 rounded-xl border text-left flex flex-col items-center gap-1.5 transition-all cursor-pointer select-none
								{selectedPortal === 'accounts'
								? 'border-blue-500 bg-blue-500/10 text-blue-600 shadow-sm ring-1 ring-blue-500/30'
								: 'border-border bg-background text-muted-foreground hover:bg-muted/40'}"
						>
							<Building2 class="h-5 w-5" />
							<span class="text-xs font-bold">Accounts</span>
						</button>

						<!-- Sales Portal -->
						<button
							type="button"
							onclick={() => { selectedPortal = 'sales'; errorMsg = null; }}
							class="p-3 rounded-xl border text-left flex flex-col items-center gap-1.5 transition-all cursor-pointer select-none
								{selectedPortal === 'sales'
								? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 shadow-sm ring-1 ring-emerald-500/30'
								: 'border-border bg-background text-muted-foreground hover:bg-muted/40'}"
						>
							<Briefcase class="h-5 w-5" />
							<span class="text-xs font-bold">Sales</span>
						</button>

						<!-- Operational Portal -->
						<button
							type="button"
							onclick={() => { selectedPortal = 'operational'; errorMsg = null; }}
							class="p-3 rounded-xl border text-left flex flex-col items-center gap-1.5 transition-all cursor-pointer select-none
								{selectedPortal === 'operational'
								? 'border-purple-500 bg-purple-500/10 text-purple-600 shadow-sm ring-1 ring-purple-500/30'
								: 'border-border bg-background text-muted-foreground hover:bg-muted/40'}"
						>
							<Wrench class="h-5 w-5" />
							<span class="text-xs font-bold">Operational</span>
						</button>
					</div>
				</div>

				<!-- Error alert if any -->
				{#if errorMsg}
					<div
						class="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium"
					>
						{errorMsg}
					</div>
				{/if}

				<!-- Step 2: Form Inputs (Isolated per portal) -->
				<div class="space-y-4 pt-1 border-t border-border">
					<span class="text-xs font-bold text-foreground uppercase tracking-wider block"
						>2. Staff User Details ({selectedPortal})</span
					>

					<!-- Full Name -->
					<div class="space-y-1.5">
						<label for="name" class="text-xs font-semibold text-foreground flex items-center gap-1.5">
							<User class="h-3.5 w-3.5 text-muted-foreground" />
							Full Name <span class="text-destructive">*</span>
						</label>
						<input
							id="name"
							type="text"
							placeholder="e.g. John Doe"
							bind:value={forms[selectedPortal].name}
							required
							class="w-full h-9 px-3 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>

					<!-- Email Address -->
					<div class="space-y-1.5">
						<label for="email" class="text-xs font-semibold text-foreground flex items-center gap-1.5">
							<Mail class="h-3.5 w-3.5 text-muted-foreground" />
							Email Address <span class="text-destructive">*</span>
						</label>
						<input
							id="email"
							type="email"
							placeholder="e.g. johndoe@texas.com"
							bind:value={forms[selectedPortal].email}
							required
							class="w-full h-9 px-3 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>

					<!-- Password -->
					<div class="space-y-1.5">
						<label for="password" class="text-xs font-semibold text-foreground flex items-center gap-1.5">
							<Lock class="h-3.5 w-3.5 text-muted-foreground" />
							Password <span class="text-destructive">*</span>
						</label>
						<input
							id="password"
							type="password"
							placeholder="••••••••"
							bind:value={forms[selectedPortal].password}
							required
							class="w-full h-9 px-3 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
						/>
					</div>

					<!-- Portal-Specific Role / Permission Config -->
					{#if selectedPortal === 'accounts'}
						<div class="space-y-2 pt-2 border-t border-border/60">
							<span class="text-xs font-bold text-foreground block">Accounts Portal Role</span>
							<div class="grid grid-cols-2 gap-2">
								<label
									class="p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all
										{forms.accounts.role === 'accounts' ? 'border-blue-500 bg-blue-500/10 text-blue-700 font-bold' : 'border-border bg-background text-muted-foreground'}"
								>
									<input
										type="radio"
										name="accountsRole"
										value="accounts"
										bind:group={forms.accounts.role}
										class="sr-only"
									/>
									<span class="text-xs">Accountant</span>
								</label>

								<label
									class="p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all
										{forms.accounts.role === 'master_accountant' ? 'border-blue-500 bg-blue-500/10 text-blue-700 font-bold' : 'border-border bg-background text-muted-foreground'}"
								>
									<input
										type="radio"
										name="accountsRole"
										value="master_accountant"
										bind:group={forms.accounts.role}
										class="sr-only"
									/>
									<span class="text-xs">Master Accountant</span>
								</label>
							</div>
						</div>
					{:else if selectedPortal === 'sales'}
						<div class="p-3 bg-emerald-500/10 border border-emerald-200/60 rounded-xl text-xs space-y-1">
							<p class="font-bold text-emerald-800 flex items-center gap-1.5">
								<Briefcase class="h-4 w-4 text-emerald-600" />
								Sales Representative Role
							</p>
							<p class="text-[11px] text-emerald-700">
								This staff user will be registered into the Sales Portal with full salesman booking access.
							</p>
						</div>
					{:else if selectedPortal === 'operational'}
						<div class="space-y-2 pt-2 border-t border-border/60">
							<span class="text-xs font-bold text-foreground flex items-center gap-1.5">
								<ShieldCheck class="h-4 w-4 text-purple-600" />
								Role Access Permissions (Operational Services)
							</span>
							<div class="space-y-2 bg-purple-500/5 p-3 rounded-xl border border-purple-200/60">
								<label class="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
									<input
										type="checkbox"
										bind:checked={forms.operational.permVisas}
										class="h-4 w-4 rounded border-border text-purple-600 focus:ring-purple-500"
									/>
									<span>Visa Services</span>
								</label>
								<label class="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
									<input
										type="checkbox"
										bind:checked={forms.operational.permVfs}
										class="h-4 w-4 rounded border-border text-purple-600 focus:ring-purple-500"
									/>
									<span>VFS Services</span>
								</label>
								<label class="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
									<input
										type="checkbox"
										bind:checked={forms.operational.permHolidays}
										class="h-4 w-4 rounded border-border text-purple-600 focus:ring-purple-500"
									/>
									<span>Holiday Packages</span>
								</label>
							</div>
						</div>
					{/if}
				</div>

				<!-- Modal Actions -->
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
						class="h-9 px-5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60 shadow-sm"
					>
						{#if loading}
							<Loader2 class="h-3.5 w-3.5 animate-spin" />
							<span>Creating...</span>
						{:else}
							<UserPlus class="h-3.5 w-3.5" />
							<span>Create Staff Member</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
