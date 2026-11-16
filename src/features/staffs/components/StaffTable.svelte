<script lang="ts">
	import type { StaffUserResponse, PortalType } from '../types/staff-types';
	import PortalBadge from './PortalBadge.svelte';
	import StaffRoleBadge from './StaffRoleBadge.svelte';
	import StaffStatusBadge from './StaffStatusBadge.svelte';
	import EmptyStaffState from './EmptyStaffState.svelte';
	import LoadingSkeleton from './LoadingSkeleton.svelte';
	import EditPermissionsModal from './EditPermissionsModal.svelte';
	import EditEmailModal from './EditEmailModal.svelte';
	import EditSalesTargetModal from './EditSalesTargetModal.svelte';
	import { Search, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, Pencil, Mail, Target } from 'lucide-svelte';
	import { hasRole } from '$lib/stores/auth';

	let props = $props<{
		users: StaffUserResponse[];
		portal: PortalType;
		loading?: boolean;
		error?: string | null;
		showOperationalPermissions?: boolean;
		onRefresh?: () => void;
	}>();

	let searchQuery = $state('');
	let statusFilter = $state<'all' | 'active' | 'inactive'>('all');
	let currentPage = $state(1);
	let pageSize = $state(50);

	let editingUser = $state<StaffUserResponse | null>(null);
	let showEditModal = $state(false);

	let editingEmailUser = $state<StaffUserResponse | null>(null);
	let showEditEmailModal = $state(false);

	let editingTargetUser = $state<StaffUserResponse | null>(null);
	let showEditTargetModal = $state(false);

	// Reset page on filter changes
	$effect(() => {
		const _q = searchQuery;
		const _s = statusFilter;
		currentPage = 1;
	});

	const filteredUsers = $derived.by(() => {
		let list: StaffUserResponse[] = props.users || [];

		if (statusFilter === 'active') list = list.filter((u: StaffUserResponse) => u.isActive);
		else if (statusFilter === 'inactive') list = list.filter((u: StaffUserResponse) => !u.isActive);

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			list = list.filter(
				(u: StaffUserResponse) =>
					(u.name && u.name.toLowerCase().includes(q)) ||
					(u.email && u.email.toLowerCase().includes(q))
			);
		}

		return list;
	});

	const totalPages = $derived(Math.ceil(filteredUsers.length / pageSize) || 1);

	const paginatedUsers = $derived.by(() => {
		const start = (currentPage - 1) * pageSize;
		return filteredUsers.slice(start, start + pageSize);
	});

	function initials(name: string): string {
		if (!name) return 'U';
		return name
			.split(' ')
			.map((w) => w[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	function avatarGradient(p: PortalType): string {
		if (p === 'accounts') return 'from-blue-400 to-blue-600';
		if (p === 'sales') return 'from-emerald-400 to-emerald-600';
		return 'from-purple-400 to-purple-600';
	}

	function formatDate(dt?: string | null): string {
		if (!dt) return '—';
		try {
			return new Date(dt).toLocaleDateString('en-GB', {
				day: '2-digit',
				month: 'short',
				year: 'numeric'
			});
		} catch {
			return '—';
		}
	}

	function openEditModal(u: StaffUserResponse) {
		editingUser = u;
		showEditModal = true;
	}

	function openEditEmailModal(u: StaffUserResponse) {
		editingEmailUser = u;
		showEditEmailModal = true;
	}

	function openEditTargetModal(u: StaffUserResponse) {
		editingTargetUser = u;
		showEditTargetModal = true;
	}
</script>

<div class="space-y-4">
	<!-- Filter & Search Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border rounded-2xl p-4 shadow-sm">
		<div class="flex items-center gap-2 flex-wrap">
			<div class="relative w-full sm:w-64">
				<Search class="h-3.5 w-3.5 absolute left-3 top-2.5 text-muted-foreground" />
				<input
					type="text"
					placeholder="Search staff by name or email..."
					bind:value={searchQuery}
					class="w-full h-8.5 pl-9 pr-3 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder-muted-foreground/60"
				/>
			</div>

			<select
				bind:value={statusFilter}
				class="h-8.5 px-3 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none text-foreground cursor-pointer"
			>
				<option value="all">All Status</option>
				<option value="active">Active Only</option>
				<option value="inactive">Inactive Only</option>
			</select>
		</div>

		<div class="flex items-center justify-between sm:justify-end gap-3">
			<span class="text-xs text-muted-foreground font-medium">
				Showing <strong class="text-foreground">{filteredUsers.length}</strong> of <strong class="text-foreground">{props.users?.length ?? 0}</strong> staff
			</span>

			{#if props.onRefresh}
				<button
					onclick={props.onRefresh}
					disabled={props.loading}
					class="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-xl border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-60 shrink-0"
				>
					<RefreshCw class="h-3.5 w-3.5 {props.loading ? 'animate-spin' : ''}" />
					<span>Refresh</span>
				</button>
			{/if}
		</div>
	</div>

	<!-- Content Area -->
	{#if props.loading}
		<LoadingSkeleton message="Fetching {props.portal} staff records..." />
	{:else if props.error}
		<div class="p-12 text-center bg-card border border-destructive/30 rounded-2xl space-y-3">
			<AlertCircle class="h-8 w-8 text-destructive mx-auto" />
			<p class="text-xs font-semibold text-destructive">{props.error}</p>
			{#if props.onRefresh}
				<button
					onclick={props.onRefresh}
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors cursor-pointer"
				>
					<RefreshCw class="h-3.5 w-3.5" />
					Retry
				</button>
			{/if}
		</div>
	{:else if filteredUsers.length === 0}
		<EmptyStaffState message={searchQuery ? 'No staff members match your search filter.' : `No ${props.portal} staff records found.`} />
	{:else}
		<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
			<div class="overflow-x-auto">
				<table class="w-full min-w-[700px] text-left border-collapse text-xs">
					<thead>
						<tr class="bg-muted/30 border-b border-border text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
							<th class="px-4 py-3.5">Employee</th>
							<th class="px-4 py-3.5">Portal</th>
							<th class="px-4 py-3.5">Role</th>
							{#if props.showOperationalPermissions}
								<th class="px-4 py-3.5">Permissions</th>
							{/if}
							{#if props.portal === 'sales'}
								<th class="px-4 py-3.5">Monthly Targets</th>
							{/if}
							<th class="px-4 py-3.5 text-center">Status</th>
							<th class="px-4 py-3.5">Joined</th>
							{#if hasRole('master_accountant')}
								<th class="px-4 py-3.5 text-right">Actions</th>
							{/if}
						</tr>
					</thead>
					<tbody class="divide-y divide-border/50">
						{#each paginatedUsers as u (u.id + '-' + (u.email || Math.random()))}
							<tr class="hover:bg-muted/20 transition-colors">
								<!-- Employee -->
								<td class="px-4 py-3.5">
									<div class="flex items-center gap-3">
										{#if u.profilePicture}
											<img
												src={u.profilePicture}
												alt={u.name}
												class="h-9 w-9 rounded-full object-cover shrink-0 border border-border"
											/>
										{:else}
											<div
												class="h-9 w-9 rounded-full bg-gradient-to-br {avatarGradient(props.portal)} flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-sm"
											>
												{initials(u.name)}
											</div>
										{/if}
										<div class="min-w-0">
											<p class="font-bold text-foreground truncate">{u.name}</p>
											<p class="text-[10px] text-muted-foreground truncate font-mono">{u.email}</p>
										</div>
									</div>
								</td>

								<!-- Portal Badge -->
								<td class="px-4 py-3.5">
									<PortalBadge portal={props.portal} />
								</td>

								<!-- Role -->
								<td class="px-4 py-3.5">
									<StaffRoleBadge role={u.role} />
								</td>

								<!-- Operational Permissions -->
								{#if props.showOperationalPermissions}
									<td class="px-4 py-3.5">
										{#if u.operationalPermissions && u.operationalPermissions.length > 0}
											<div class="flex flex-wrap gap-1">
												{#each u.operationalPermissions as perm}
													<span
														class="px-1.5 py-0.5 bg-purple-500/10 text-purple-700 border border-purple-200/60 rounded text-[9px] font-semibold capitalize"
													>
														{perm}
													</span>
												{/each}
											</div>
										{:else}
											<span class="text-muted-foreground/50 text-[10px]">—</span>
										{/if}
									</td>
								{/if}

								<!-- Monthly Targets (Sales Portal) -->
								{#if props.portal === 'sales'}
									<td class="px-4 py-3.5">
										<div class="space-y-0.5 font-mono text-[11px]">
											{#if (Number(u.monthlyTarget) > 0) || (Number(u.profitTarget) > 0)}
												{#if Number(u.monthlyTarget) > 0}
													<div class="flex items-center gap-1.5 text-foreground font-semibold">
														<span class="text-[9px] uppercase font-bold text-muted-foreground">Vol:</span>
														<span>{Number(u.monthlyTarget).toFixed(3)} BHD</span>
													</div>
												{/if}
												{#if Number(u.profitTarget) > 0}
													<div class="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
														<span class="text-[9px] uppercase font-bold text-muted-foreground">Prof:</span>
														<span>{Number(u.profitTarget).toFixed(3)} BHD</span>
													</div>
												{/if}
											{:else}
												<span class="text-muted-foreground/60 text-[10px] italic">No target set</span>
											{/if}
										</div>
									</td>
								{/if}

								<!-- Status -->
								<td class="px-4 py-3.5 text-center">
									<StaffStatusBadge isActive={u.isActive} />
								</td>

								<!-- Joined -->
								<td class="px-4 py-3.5 text-muted-foreground font-mono text-[11px]">
									{formatDate(u.createdAt)}
								</td>

								<!-- Actions (Edit Target, Edit Email & Operational Permissions) -->
								{#if hasRole('master_accountant')}
									<td class="px-4 py-3.5 text-right">
										<div class="flex items-center justify-end gap-1.5">
											{#if props.portal === 'sales'}
												<button
													onclick={() => openEditTargetModal(u)}
													class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-200/80 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
													title="Set Sales Targets"
												>
													<Target class="h-3 w-3" />
													<span>Target</span>
												</button>
											{/if}

											<button
												onclick={() => openEditEmailModal(u)}
												class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-blue-200/80 bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
												title="Update Email Address"
											>
												<Mail class="h-3 w-3" />
												<span>Email</span>
											</button>

											{#if props.showOperationalPermissions}
												<button
													onclick={() => openEditModal(u)}
													class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-purple-200/80 bg-purple-500/10 text-purple-700 hover:bg-purple-500/20 text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
													title="Edit Operational Permissions"
												>
													<Pencil class="h-3 w-3" />
													<span>Permissions</span>
												</button>
											{/if}
										</div>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination Footer -->
			{#if filteredUsers.length > 0}
				<div class="border-t border-border bg-muted/20 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
					<div class="flex items-center gap-2 text-muted-foreground text-[11px]">
						<span>Rows per page:</span>
						<select
							bind:value={pageSize}
							onchange={() => (currentPage = 1)}
							class="h-7 px-2 bg-background border border-border rounded-lg text-xs font-medium text-foreground cursor-pointer"
						>
							<option value={10}>10</option>
							<option value={25}>25</option>
							<option value={50}>50</option>
							<option value={100}>100</option>
							<option value={200}>200</option>
							<option value={500}>500</option>
							<option value={1000}>1000 (All)</option>
						</select>
					</div>

					<div class="flex items-center gap-3">
						<span class="text-[11px] text-muted-foreground">
							Page <strong class="text-foreground">{currentPage}</strong> of <strong class="text-foreground">{totalPages}</strong>
						</span>
						<div class="flex items-center gap-1">
							<button
								onclick={() => (currentPage = Math.max(1, currentPage - 1))}
								disabled={currentPage === 1}
								class="h-7 px-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
							>
								<ChevronLeft class="h-3.5 w-3.5" />
								<span>Prev</span>
							</button>
							<button
								onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))}
								disabled={currentPage === totalPages}
								class="h-7 px-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
							>
								<span>Next</span>
								<ChevronRight class="h-3.5 w-3.5" />
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Edit Operational Permissions Modal -->
<EditPermissionsModal
	open={showEditModal}
	user={editingUser}
	onClose={() => (showEditModal = false)}
	onSaved={() => props.onRefresh?.()}
/>

<!-- Edit Email Modal -->
<EditEmailModal
	open={showEditEmailModal}
	user={editingEmailUser}
	portal={props.portal}
	onClose={() => (showEditEmailModal = false)}
	onSaved={() => props.onRefresh?.()}
/>

<!-- Edit Sales Target Modal -->
<EditSalesTargetModal
	open={showEditTargetModal}
	user={editingTargetUser}
	onClose={() => (showEditTargetModal = false)}
	onSaved={() => props.onRefresh?.()}
/>
