<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		getAllStaffUsers,
		getSalaryProfiles,
		createSalaryProfile,
		updateSalaryProfile,
		getSalaryRevisions
	} from '$features/payroll/services/payroll-api';
	import type {
		UnifiedStaffUser,
		SalaryProfile,
		SalaryRevision,
		CreateSalaryProfilePayload,
		UpdateSalaryProfilePayload
	} from '$features/payroll/types';
	import {
		Plus,
		Search,
		History,
		Edit3,
		Send,
		AlertCircle,
		CheckCircle2,
		X,
		UserCheck,
		CreditCard,
		RefreshCw
	} from 'lucide-svelte';

	let loading = $state(true);
	let error = $state<string | null>(null);
	let successMsg = $state<string | null>(null);

	let profiles = $state<SalaryProfile[]>([]);
	let staffUsers = $state<UnifiedStaffUser[]>([]);
	let selectedPortal = $state<string>('all');
	let searchQuery = $state<string>('');

	// Modals state
	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let showHistoryModal = $state(false);

	let selectedProfile = $state<SalaryProfile | null>(null);
	let revisions = $state<SalaryRevision[]>([]);
	let loadingRevisions = $state(false);

	const todayStr = new Date().toISOString().slice(0, 10);

	// Create Form state
	let createForm = $state<CreateSalaryProfilePayload>({
		portalType: 'Account',
		portalUserId: 0,
		employeeCode: '',
		basicSalary: 0,
		defaultMonthlyIncentive: 0,
		currency: 'BHD',
		effectiveFrom: todayStr,
		remarks: ''
	});
	let submittingCreate = $state(false);

	// Edit (Revision) Form state
	let editForm = $state<UpdateSalaryProfilePayload>({
		newBasicSalary: 0,
		newMonthlyIncentive: 0,
		reason: '',
		effectiveDate: todayStr,
		remarks: ''
	});
	let submittingEdit = $state(false);

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		loading = true;
		error = null;
		try {
			const [profRes, staffRes] = await Promise.all([
				getSalaryProfiles(),
				getAllStaffUsers()
			]);
			profiles = profRes;
			staffUsers = staffRes;
		} catch (err: any) {
			error = err?.message || 'Failed to load salary profiles';
		} finally {
			loading = false;
		}
	}

	let filteredProfiles = $derived.by(() => {
		return profiles.filter((p) => {
			const matchesPortal =
				selectedPortal === 'all' || (p.portalType || '').toLowerCase() === selectedPortal.toLowerCase();
			const matchesSearch =
				!searchQuery ||
				(p.employeeName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
				(p.employeeCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
				(p.employeeEmail || '').toLowerCase().includes(searchQuery.toLowerCase());
			return matchesPortal && matchesSearch;
		});
	});

	// Filter staff for create modal based on selected portalType
	let availableStaffForCreate = $derived.by(() => {
		const existingKeys = new Set(
			profiles
				.filter((p) => p.status === 'Active')
				.map((p) => `${(p.portalType || '').toLowerCase()}_${p.portalUserId}`)
		);
		return staffUsers.filter((u) => {
			const matchesType = (u.portalType || '').toLowerCase() === (createForm.portalType || '').toLowerCase();
			const alreadyHasProfile = existingKeys.has(`${(u.portalType || '').toLowerCase()}_${u.portalUserId}`);
			return matchesType && !alreadyHasProfile;
		});
	});

	function openCreateModal() {
		createForm = {
			portalType: 'Account',
			portalUserId: 0,
			employeeCode: 'EMP-' + Math.floor(1000 + Math.random() * 9000),
			basicSalary: 0,
			defaultMonthlyIncentive: 0,
			currency: 'BHD',
			effectiveFrom: todayStr,
			remarks: ''
		};
		showCreateModal = true;
	}

	async function handleCreateSubmit(e: Event) {
		e.preventDefault();
		if (!createForm.portalUserId || createForm.portalUserId === 0) {
			error = 'Please select a staff member.';
			return;
		}
		if (createForm.basicSalary < 0) {
			error = 'Basic salary cannot be negative.';
			return;
		}

		submittingCreate = true;
		error = null;
		try {
			await createSalaryProfile(createForm);
			showCreateModal = false;
			successMsg = 'Salary profile created successfully.';
			setTimeout(() => (successMsg = null), 4000);
			await loadData();
		} catch (err: any) {
			error = err?.message || 'Failed to create salary profile';
		} finally {
			submittingCreate = false;
		}
	}

	function openEditModal(profile: SalaryProfile) {
		selectedProfile = profile;
		editForm = {
			newBasicSalary: profile.basicSalary,
			newMonthlyIncentive: profile.defaultMonthlyIncentive,
			reason: 'Annual Salary Revision',
			effectiveDate: todayStr,
			remarks: profile.remarks || ''
		};
		showEditModal = true;
	}

	async function handleEditSubmit(e: Event) {
		e.preventDefault();
		if (!selectedProfile) return;
		if (editForm.newBasicSalary < 0) {
			error = 'New basic salary cannot be negative.';
			return;
		}

		submittingEdit = true;
		error = null;
		try {
			await updateSalaryProfile(selectedProfile.id, editForm);
			showEditModal = false;
			successMsg = 'Salary revision recorded successfully.';
			setTimeout(() => (successMsg = null), 4000);
			await loadData();
		} catch (err: any) {
			error = err?.message || 'Failed to update salary profile';
		} finally {
			submittingEdit = false;
		}
	}

	async function openHistoryModal(profile: SalaryProfile) {
		selectedProfile = profile;
		showHistoryModal = true;
		loadingRevisions = true;
		try {
			revisions = await getSalaryRevisions(profile.id);
		} catch (err: any) {
			error = err?.message || 'Failed to fetch revision history';
		} finally {
			loadingRevisions = false;
		}
	}

	function navigateToPayout(profile: SalaryProfile) {
		goto(`/payments/new?tab=salary&profileId=${profile.id}`);
	}

	function formatCurrency(val: number, curr = 'BHD') {
		return `${curr} ${(val || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
	}
</script>

<div class="space-y-6">
	<!-- Top Action Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
		<div>
			<h1 class="text-xl font-bold text-foreground flex items-center gap-2">
				<CreditCard class="h-6 w-6 text-primary" />
				Staff Salary Profiles
			</h1>
			<p class="text-xs text-muted-foreground mt-1">
				Configure base salaries, monthly incentives, and track salary revisions across Accounts, Sales, and Operational staff.
			</p>
		</div>
		<button
			onclick={openCreateModal}
			class="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer shadow-sm shrink-0"
		>
			<Plus class="h-4 w-4" />
			<span>Configure New Profile</span>
		</button>
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

	<!-- Controls & Filters Bar -->
	<div class="flex flex-col md:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
		<!-- Portal Filter Tabs -->
		<div class="flex items-center gap-1 bg-muted p-1 rounded-lg w-full md:w-auto">
			<button
				onclick={() => (selectedPortal = 'all')}
				class="px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex-1 md:flex-initial text-center
					{selectedPortal === 'all' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
			>
				All Portals
			</button>
			<button
				onclick={() => (selectedPortal = 'Account')}
				class="px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex-1 md:flex-initial text-center
					{selectedPortal === 'Account' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
			>
				Accounts Staff
			</button>
			<button
				onclick={() => (selectedPortal = 'Sales')}
				class="px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex-1 md:flex-initial text-center
					{selectedPortal === 'Sales' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
			>
				Sales Staff
			</button>
			<button
				onclick={() => (selectedPortal = 'Operational')}
				class="px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex-1 md:flex-initial text-center
					{selectedPortal === 'Operational' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
			>
				Operational Staff
			</button>
		</div>

		<!-- Search Input -->
		<div class="relative w-full md:w-72">
			<Search class="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search employee or code..."
				class="w-full h-9 pl-9 pr-4 rounded-xl border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
			/>
		</div>
	</div>

	<!-- Profiles Table -->
	<div class="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
		{#if loading}
			<div class="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
				<RefreshCw class="h-6 w-6 animate-spin text-primary" />
				<span class="text-xs font-medium">Loading salary profiles...</span>
			</div>
		{:else if filteredProfiles.length === 0}
			<div class="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
				<UserCheck class="h-10 w-10 text-muted-foreground/40" />
				<p class="text-sm font-semibold text-foreground">No salary profiles found</p>
				<p class="text-xs">Click "Configure New Profile" to assign salary parameters to a staff member.</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs border-collapse">
					<thead>
						<tr class="border-b border-border bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
							<th class="py-3 px-4">Employee</th>
							<th class="py-3 px-4">Portal</th>
							<th class="py-3 px-4">Emp Code</th>
							<th class="py-3 px-4 text-right">Basic Salary</th>
							<th class="py-3 px-4 text-right">Monthly Incentive</th>
							<th class="py-3 px-4">Effective Date</th>
							<th class="py-3 px-4 text-center">Status</th>
							<th class="py-3 px-4 text-right">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each filteredProfiles as profile}
							<tr class="hover:bg-muted/30 transition-colors">
								<td class="py-3.5 px-4 font-semibold text-foreground">
									<div>{profile.employeeName}</div>
									<div class="text-[10px] text-muted-foreground font-normal">{profile.employeeEmail}</div>
								</td>
								<td class="py-3.5 px-4">
									<span
										class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider
										{profile.portalType === 'Account' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : ''}
										{profile.portalType === 'Sales' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : ''}
										{profile.portalType === 'Operational' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : ''}"
									>
										{profile.portalType}
									</span>
								</td>
								<td class="py-3.5 px-4 font-mono text-muted-foreground">{profile.employeeCode}</td>
								<td class="py-3.5 px-4 text-right font-bold text-foreground">
									{formatCurrency(profile.basicSalary, profile.currency)}
								</td>
								<td class="py-3.5 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
									{formatCurrency(profile.defaultMonthlyIncentive, profile.currency)}
								</td>
								<td class="py-3.5 px-4 text-muted-foreground">
									{new Date(profile.effectiveFrom).toLocaleDateString()}
								</td>
								<td class="py-3.5 px-4 text-center">
									<span
										class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase
										{profile.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}"
									>
										{profile.status}
									</span>
								</td>
								<td class="py-3.5 px-4 text-right">
									<div class="flex items-center justify-end gap-1">
										<button
											onclick={() => openEditModal(profile)}
											class="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
											title="Edit Salary (Revision)"
										>
											<Edit3 class="h-4 w-4" />
										</button>
										<button
											onclick={() => openHistoryModal(profile)}
											class="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
											title="Salary History"
										>
											<History class="h-4 w-4" />
										</button>
										<button
											onclick={() => navigateToPayout(profile)}
											class="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer ml-1"
											title="Generate Payroll"
										>
											<Send class="h-4 w-4" />
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<!-- Modal: Create Salary Profile -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
		<div class="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
			<div class="flex items-center justify-between p-5 border-b border-border">
				<h2 class="text-base font-bold text-foreground">Configure Salary Profile</h2>
				<button onclick={() => (showCreateModal = false)} class="text-muted-foreground hover:text-foreground">
					<X class="h-5 w-5" />
				</button>
			</div>
			<form onsubmit={handleCreateSubmit} class="p-6 space-y-4">
				<div>
					<span class="block text-xs font-semibold text-foreground mb-1">Target Portal</span>
					<div class="grid grid-cols-3 gap-2">
						{#each ['Account', 'Sales', 'Operational'] as portal}
							<button
								type="button"
								onclick={() => {
									createForm.portalType = portal as any;
									createForm.portalUserId = 0;
								}}
								class="py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer
									{createForm.portalType === portal
									? 'bg-primary/10 text-primary border-primary'
									: 'border-border text-muted-foreground hover:bg-muted'}"
							>
								{portal}
							</button>
						{/each}
					</div>
				</div>

				<div>
					<label for="create-employee-select" class="block text-xs font-semibold text-foreground mb-1">Select Employee</label>
					<select
						id="create-employee-select"
						bind:value={createForm.portalUserId}
						required
						class="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
					>
						<option value={0}>-- Select Staff Member --</option>
						{#each availableStaffForCreate as user}
							<option value={user.portalUserId}>
								{user.name} ({user.email})
							</option>
						{/each}
					</select>
					{#if availableStaffForCreate.length === 0}
						<p class="text-[11px] text-muted-foreground mt-1">No unassigned {createForm.portalType} staff members available.</p>
					{/if}
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="create-code-input" class="block text-xs font-semibold text-foreground mb-1">Employee Code</label>
						<input
							id="create-code-input"
							type="text"
							bind:value={createForm.employeeCode}
							required
							class="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>
					<div>
						<label for="create-currency-input" class="block text-xs font-semibold text-foreground mb-1">Currency</label>
						<input
							id="create-currency-input"
							type="text"
							bind:value={createForm.currency}
							required
							class="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="create-basic-input" class="block text-xs font-semibold text-foreground mb-1">Basic Salary</label>
						<input
							id="create-basic-input"
							type="number"
							step="0.001"
							bind:value={createForm.basicSalary}
							required
							class="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>
					<div>
						<label for="create-incentive-input" class="block text-xs font-semibold text-foreground mb-1">Monthly Incentive</label>
						<input
							id="create-incentive-input"
							type="number"
							step="0.001"
							bind:value={createForm.defaultMonthlyIncentive}
							required
							class="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>
				</div>


				<div>
					<label for="create-remarks-input" class="block text-xs font-semibold text-foreground mb-1">Remarks (Optional)</label>
					<textarea
						id="create-remarks-input"
						bind:value={createForm.remarks}
						rows="2"
						class="w-full p-3 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
					></textarea>
				</div>

				<div class="flex items-center justify-end gap-3 pt-3 border-t border-border">
					<button
						type="button"
						onclick={() => (showCreateModal = false)}
						class="h-10 px-4 rounded-xl border border-border text-xs font-bold hover:bg-muted transition-colors cursor-pointer"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={submittingCreate}
						class="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2"
					>
						{#if submittingCreate}
							<RefreshCw class="h-4 w-4 animate-spin" />
						{/if}
						<span>Save Profile</span>
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal: Edit Salary (Revision) -->
{#if showEditModal && selectedProfile}
	<div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
		<div class="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
			<div class="flex items-center justify-between p-5 border-b border-border">
				<div>
					<h2 class="text-base font-bold text-foreground">Record Salary Revision</h2>
					<p class="text-xs text-muted-foreground mt-0.5">{selectedProfile.employeeName} ({selectedProfile.employeeCode})</p>
				</div>
				<button onclick={() => (showEditModal = false)} class="text-muted-foreground hover:text-foreground">
					<X class="h-5 w-5" />
				</button>
			</div>
			<form onsubmit={handleEditSubmit} class="p-6 space-y-4">
				<div class="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
					<div class="flex justify-between">
						<span class="text-muted-foreground">Current Basic Salary:</span>
						<span class="font-bold text-foreground">{formatCurrency(selectedProfile.basicSalary, selectedProfile.currency)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Current Monthly Incentive:</span>
						<span class="font-bold text-foreground">{formatCurrency(selectedProfile.defaultMonthlyIncentive, selectedProfile.currency)}</span>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="edit-basic-input" class="block text-xs font-semibold text-foreground mb-1">New Basic Salary</label>
						<input
							id="edit-basic-input"
							type="number"
							step="0.001"
							bind:value={editForm.newBasicSalary}
							required
							class="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>
					<div>
						<label for="edit-incentive-input" class="block text-xs font-semibold text-foreground mb-1">New Monthly Incentive</label>
						<input
							id="edit-incentive-input"
							type="number"
							step="0.001"
							bind:value={editForm.newMonthlyIncentive}
							required
							class="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>
				</div>

				<div>
					<label for="edit-reason-input" class="block text-xs font-semibold text-foreground mb-1">Revision Reason</label>
					<input
						id="edit-reason-input"
						type="text"
						bind:value={editForm.reason}
						required
						placeholder="e.g., Annual appraisal, Promotion, Increment"
						class="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
					/>
				</div>

				<div>
					<label for="edit-date-input" class="block text-xs font-semibold text-foreground mb-1">Effective Date</label>
					<input
						id="edit-date-input"
						type="date"
						bind:value={editForm.effectiveDate}
						required
						class="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
					/>
				</div>

				<div class="flex items-center justify-end gap-3 pt-3 border-t border-border">
					<button
						type="button"
						onclick={() => (showEditModal = false)}
						class="h-10 px-4 rounded-xl border border-border text-xs font-bold hover:bg-muted transition-colors cursor-pointer"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={submittingEdit}
						class="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2"
					>
						{#if submittingEdit}
							<RefreshCw class="h-4 w-4 animate-spin" />
						{/if}
						<span>Apply Revision</span>
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal: Salary Revision History -->
{#if showHistoryModal && selectedProfile}
	<div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
		<div class="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
			<div class="flex items-center justify-between p-5 border-b border-border">
				<div>
					<h2 class="text-base font-bold text-foreground">Salary Revision History</h2>
					<p class="text-xs text-muted-foreground mt-0.5">{selectedProfile.employeeName} ({selectedProfile.employeeCode})</p>
				</div>
				<button onclick={() => (showHistoryModal = false)} class="text-muted-foreground hover:text-foreground">
					<X class="h-5 w-5" />
				</button>
			</div>
			<div class="p-6 max-h-[70vh] overflow-y-auto">
				{#if loadingRevisions}
					<div class="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
						<RefreshCw class="h-5 w-5 animate-spin text-primary" />
						<span class="text-xs">Loading revision log...</span>
					</div>
				{:else if revisions.length === 0}
					<div class="p-8 text-center text-muted-foreground text-xs">
						No revision history recorded for this profile yet.
					</div>
				{:else}
					<div class="space-y-3">
						{#each revisions as rev}
							<div class="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
								<div class="flex items-center justify-between text-xs font-bold text-foreground">
									<span>{rev.reason}</span>
									<span class="text-muted-foreground font-normal">{new Date(rev.effectiveDate).toLocaleDateString()}</span>
								</div>
								<div class="grid grid-cols-2 gap-4 text-xs">
									<div class="p-2.5 rounded-lg bg-card border border-border">
										<div class="text-[10px] text-muted-foreground font-semibold uppercase">Basic Salary</div>
										<div class="flex items-center gap-2 mt-1">
											<span class="line-through text-muted-foreground">{formatCurrency(rev.oldBasicSalary, selectedProfile.currency)}</span>
											<span class="font-bold text-emerald-600 dark:text-emerald-400">➜ {formatCurrency(rev.newBasicSalary, selectedProfile.currency)}</span>
										</div>
									</div>
									<div class="p-2.5 rounded-lg bg-card border border-border">
										<div class="text-[10px] text-muted-foreground font-semibold uppercase">Monthly Incentive</div>
										<div class="flex items-center gap-2 mt-1">
											<span class="line-through text-muted-foreground">{formatCurrency(rev.oldMonthlyIncentive, selectedProfile.currency)}</span>
											<span class="font-bold text-emerald-600 dark:text-emerald-400">➜ {formatCurrency(rev.newMonthlyIncentive, selectedProfile.currency)}</span>
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
			<div class="p-4 border-t border-border bg-muted/10 text-right">
				<button
					onclick={() => (showHistoryModal = false)}
					class="h-9 px-4 rounded-xl border border-border text-xs font-bold hover:bg-muted transition-colors cursor-pointer"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
