<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { toast } from '$lib/stores/toast';
	import { hasRole } from '$lib/stores/auth';
	import {
		Globe,
		Plus,
		Search,
		RefreshCw,
		Edit3,
		CheckCircle2,
		XCircle,
		Package,
		Layers,
		X,
		FileText,
		ShieldAlert
	} from 'lucide-svelte';
	import {
		getVisaCountries,
		createVisaCountry,
		updateVisaCountry,
		getVisaPackages,
		createVisaPackage,
		updateVisaPackage,
		type VisaCountryResponse,
		type VisaPackageResponse
	} from '$features/visa-master/api';

	// ─── State ───────────────────────────────────────────────────────────────────
	let activeTab = $state<'countries' | 'packages'>('countries');
	let loading = $state(true);

	// Countries State
	let countries = $state<VisaCountryResponse[]>([]);
	let countrySearch = $state('');
	let showCountryModal = $state(false);
	let editingCountry = $state<VisaCountryResponse | null>(null);
	let countryFormName = $state('');
	let countryFormCode = $state('');
	let countryFormActive = $state(true);
	let savingCountry = $state(false);

	// Packages State
	let packages = $state<VisaPackageResponse[]>([]);
	let packageSearch = $state('');
	let packageCountryFilter = $state<string>('');
	let showPackageModal = $state(false);
	let editingPackage = $state<VisaPackageResponse | null>(null);
	let packageFormCountryId = $state<string>('');
	let packageFormName = $state('');
	let packageFormDescription = $state('');
	let packageFormActive = $state(true);
	let savingPackage = $state(false);

	// ─── Derived Calculations ───────────────────────────────────────────────────
	const filteredCountries = $derived.by(() => {
		let list = countries;
		if (countrySearch.trim()) {
			const term = countrySearch.toLowerCase().trim();
			list = list.filter(
				(c) =>
					c.name.toLowerCase().includes(term) ||
					(c.code && c.code.toLowerCase().includes(term))
			);
		}
		return list;
	});

	const filteredPackages = $derived.by(() => {
		let list = packages;
		if (packageCountryFilter) {
			list = list.filter((p) => String(p.countryId) === packageCountryFilter);
		}
		if (packageSearch.trim()) {
			const term = packageSearch.toLowerCase().trim();
			list = list.filter(
				(p) =>
					p.name.toLowerCase().includes(term) ||
					p.countryName.toLowerCase().includes(term) ||
					(p.description && p.description.toLowerCase().includes(term))
			);
		}
		return list;
	});

	// ─── API Loaders ─────────────────────────────────────────────────────────────
	async function loadAllData() {
		if (!hasRole('master_accountant')) {
			loading = false;
			return;
		}
		loading = true;
		try {
			const [cList, pList] = await Promise.all([
				getVisaCountries(true),
				getVisaPackages(undefined, true)
			]);
			countries = cList || [];
			packages = pList || [];
		} catch (err: any) {
			toast.error(err.message || 'Failed to load visa master data.');
		} finally {
			loading = false;
		}
	}

	// ─── Country Modals & Handlers ───────────────────────────────────────────────
	function openAddCountryModal() {
		editingCountry = null;
		countryFormName = '';
		countryFormCode = '';
		countryFormActive = true;
		showCountryModal = true;
	}

	function openEditCountryModal(c: VisaCountryResponse) {
		editingCountry = c;
		countryFormName = c.name;
		countryFormCode = c.code || '';
		countryFormActive = c.isActive;
		showCountryModal = true;
	}

	async function handleSaveCountry(e: Event) {
		e.preventDefault();
		if (!countryFormName.trim()) {
			toast.error('Country name is required.');
			return;
		}

		savingCountry = true;
		try {
			if (editingCountry) {
				await updateVisaCountry(editingCountry.id, {
					name: countryFormName.trim(),
					code: countryFormCode.trim() ? countryFormCode.trim() : null,
					isActive: countryFormActive
				});
				toast.success(`Country '${countryFormName}' updated successfully.`);
			} else {
				await createVisaCountry({
					name: countryFormName.trim(),
					code: countryFormCode.trim() ? countryFormCode.trim() : null
				});
				toast.success(`Country '${countryFormName}' created successfully.`);
			}
			showCountryModal = false;
			await loadAllData();
		} catch (err: any) {
			toast.error(err.message || 'Failed to save country.');
		} finally {
			savingCountry = false;
		}
	}

	async function toggleCountryActive(c: VisaCountryResponse) {
		try {
			await updateVisaCountry(c.id, {
				name: c.name,
				code: c.code,
				isActive: !c.isActive
			});
			toast.success(`Country '${c.name}' ${!c.isActive ? 'activated' : 'deactivated'}.`);
			await loadAllData();
		} catch (err: any) {
			toast.error(err.message || 'Failed to update country status.');
		}
	}

	// ─── Package Modals & Handlers ───────────────────────────────────────────────
	function openAddPackageModal() {
		editingPackage = null;
		packageFormCountryId = countries.length > 0 && countries[0] ? String(countries[0].id) : '';
		packageFormName = '';
		packageFormDescription = '';
		packageFormActive = true;
		showPackageModal = true;
	}

	function openEditPackageModal(p: VisaPackageResponse) {
		editingPackage = p;
		packageFormCountryId = String(p.countryId);
		packageFormName = p.name;
		packageFormDescription = p.description || '';
		packageFormActive = p.isActive;
		showPackageModal = true;
	}

	async function handleSavePackage(e: Event) {
		e.preventDefault();
		if (!packageFormCountryId) {
			toast.error('Please select a destination country.');
			return;
		}
		if (!packageFormName.trim()) {
			toast.error('Visa package name is required.');
			return;
		}

		savingPackage = true;
		try {
			const countryId = parseInt(packageFormCountryId);
			if (editingPackage) {
				await updateVisaPackage(editingPackage.id, {
					countryId,
					name: packageFormName.trim(),
					description: packageFormDescription.trim() ? packageFormDescription.trim() : null,
					isActive: packageFormActive
				});
				toast.success(`Visa package '${packageFormName}' updated successfully.`);
			} else {
				await createVisaPackage({
					countryId,
					name: packageFormName.trim(),
					description: packageFormDescription.trim() ? packageFormDescription.trim() : null
				});
				toast.success(`Visa package '${packageFormName}' created successfully.`);
			}
			showPackageModal = false;
			await loadAllData();
		} catch (err: any) {
			toast.error(err.message || 'Failed to save visa package.');
		} finally {
			savingPackage = false;
		}
	}

	async function togglePackageActive(p: VisaPackageResponse) {
		try {
			await updateVisaPackage(p.id, {
				countryId: p.countryId,
				name: p.name,
				description: p.description,
				isActive: !p.isActive
			});
			toast.success(`Package '${p.name}' ${!p.isActive ? 'activated' : 'deactivated'}.`);
			await loadAllData();
		} catch (err: any) {
			toast.error(err.message || 'Failed to update package status.');
		}
	}

	onMount(() => {
		loadAllData();
	});
</script>

<svelte:head>
	<title>Visa Master Configuration — Master Accounts</title>
</svelte:head>

{#if !hasRole('master_accountant')}
	<div class="p-12 text-center border border-border rounded-2xl bg-card space-y-4 max-w-lg mx-auto my-12 shadow-sm">
		<ShieldAlert class="h-12 w-12 text-amber-500 mx-auto" />
		<div class="space-y-1">
			<h2 class="text-base font-bold text-foreground">Access Restricted</h2>
			<p class="text-xs text-muted-foreground">
				Visa Master Data configuration is restricted exclusively to Master Accountants. Please contact your system administrator if you require access.
			</p>
		</div>
	</div>
{:else}
<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-bold text-foreground flex items-center gap-2">
				<Globe class="h-5 w-5 text-primary" /> Visa Master Management
			</h1>
			<p class="text-xs text-muted-foreground">
				Configure destination countries and visa package types dynamically for sales visa bookings.
			</p>
		</div>
		<div class="flex items-center gap-2">
			<Button variant="outline" class="h-8.5 rounded-xl cursor-pointer" onclick={loadAllData} disabled={loading}>
				<RefreshCw class={['h-3.5 w-3.5 mr-1.5', loading ? 'animate-spin' : ''].join(' ')} />
				<span>Refresh</span>
			</Button>
		</div>
	</div>

	<!-- Navigation Tabs & Actions -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
		<div class="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border border-border/60">
			<button
				type="button"
				onclick={() => (activeTab = 'countries')}
				class="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 {activeTab === 'countries'
					? 'bg-card text-foreground shadow-xs border border-border'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				<Globe class="h-3.5 w-3.5 text-primary" />
				<span>Visa Countries ({countries.length})</span>
			</button>
			<button
				type="button"
				onclick={() => (activeTab = 'packages')}
				class="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 {activeTab === 'packages'
					? 'bg-card text-foreground shadow-xs border border-border'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				<Package class="h-3.5 w-3.5 text-primary" />
				<span>Visa Packages ({packages.length})</span>
			</button>
		</div>

		{#if activeTab === 'countries'}
			<Button class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5" onclick={openAddCountryModal}>
				<Plus class="h-4 w-4" />
				<span>Add Country</span>
			</Button>
		{:else}
			<Button class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5" onclick={openAddPackageModal}>
				<Plus class="h-4 w-4" />
				<span>Add Visa Package</span>
			</Button>
		{/if}
	</div>

	<!-- Main Content Area -->
	{#if loading}
		<div class="animate-pulse space-y-4">
			<div class="h-10 bg-muted rounded-xl w-64"></div>
			<div class="h-80 bg-muted rounded-2xl"></div>
		</div>
	{:else if activeTab === 'countries'}
		<!-- Countries Section -->
		<div class="space-y-4">
			<div class="relative w-full max-w-[320px]">
				<span class="absolute inset-y-0 left-3 flex items-center text-muted-foreground/60">
					<Search class="h-4 w-4" />
				</span>
				<input
					type="text"
					placeholder="Search country by name or code..."
					bind:value={countrySearch}
					class="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder-muted-foreground/60"
				/>
			</div>

			{#if filteredCountries.length === 0}
				<div class="p-12 text-center text-muted-foreground border border-border rounded-2xl bg-card space-y-3">
					<p>No visa countries found in master records.</p>
					<Button variant="outline" size="sm" class="rounded-xl" onclick={openAddCountryModal}>
						<Plus class="h-3.5 w-3.5 mr-1" /> Add First Country
					</Button>
				</div>
			{:else}
				<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
					<div class="overflow-x-auto">
						<table class="w-full text-left border-collapse text-xs">
							<thead>
								<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold">
									<th class="p-4 w-20">ID</th>
									<th class="p-4">Country Name</th>
									<th class="p-4 w-32">ISO / Short Code</th>
									<th class="p-4 text-center w-32">Active Packages</th>
									<th class="p-4 text-center w-32">Status</th>
									<th class="p-4 text-right w-40">Actions</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60">
								{#each filteredCountries as c}
									<tr class="hover:bg-muted/10 transition-colors">
										<td class="p-4 font-mono font-medium text-muted-foreground">#{c.id}</td>
										<td class="p-4 font-bold text-foreground">{c.name}</td>
										<td class="p-4 font-mono text-muted-foreground">{c.code || '—'}</td>
										<td class="p-4 text-center font-mono font-bold text-foreground">
											{c.packagesCount}
										</td>
										<td class="p-4 text-center">
											{#if c.isActive}
												<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
													<CheckCircle2 class="h-3 w-3" /> Active
												</span>
											{:else}
												<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
													<XCircle class="h-3 w-3" /> Inactive
												</span>
											{/if}
										</td>
										<td class="p-4 text-right">
											<div class="flex items-center justify-end gap-2">
												<Button
													variant="outline"
													class="h-7 px-2.5 text-[11px] rounded-lg cursor-pointer flex items-center gap-1"
													onclick={() => openEditCountryModal(c)}
												>
													<Edit3 class="h-3 w-3" /> Edit
												</Button>
												<Button
													variant="ghost"
													class="h-7 px-2 text-[11px] rounded-lg cursor-pointer {c.isActive ? 'text-rose-600 hover:bg-rose-500/10' : 'text-emerald-600 hover:bg-emerald-500/10'}"
													onclick={() => toggleCountryActive(c)}
												>
													{c.isActive ? 'Deactivate' : 'Activate'}
												</Button>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Packages Section -->
		<div class="space-y-4">
			<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
				<div class="relative w-full max-w-[320px]">
					<span class="absolute inset-y-0 left-3 flex items-center text-muted-foreground/60">
						<Search class="h-4 w-4" />
					</span>
					<input
						type="text"
						placeholder="Search package by name or description..."
						bind:value={packageSearch}
						class="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder-muted-foreground/60"
					/>
				</div>

				<div class="flex items-center gap-2">
					<label for="countryFilter" class="text-xs text-muted-foreground font-semibold">Filter Country:</label>
					<select
						id="countryFilter"
						class="h-9 px-3 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none cursor-pointer"
						bind:value={packageCountryFilter}
					>
						<option value="">All Countries</option>
						{#each countries as c}
							<option value={String(c.id)}>{c.name}</option>
						{/each}
					</select>
				</div>
			</div>

			{#if filteredPackages.length === 0}
				<div class="p-12 text-center text-muted-foreground border border-border rounded-2xl bg-card space-y-3">
					<p>No visa packages found matching your filter.</p>
					<Button variant="outline" size="sm" class="rounded-xl" onclick={openAddPackageModal}>
						<Plus class="h-3.5 w-3.5 mr-1" /> Add First Visa Package
					</Button>
				</div>
			{:else}
				<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
					<div class="overflow-x-auto">
						<table class="w-full text-left border-collapse text-xs">
							<thead>
								<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold">
									<th class="p-4 w-20">ID</th>
									<th class="p-4">Package Name</th>
									<th class="p-4">Destination Country</th>
									<th class="p-4">Description / Details</th>
									<th class="p-4 text-center w-32">Status</th>
									<th class="p-4 text-right w-40">Actions</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60">
								{#each filteredPackages as p}
									<tr class="hover:bg-muted/10 transition-colors">
										<td class="p-4 font-mono font-medium text-muted-foreground">#{p.id}</td>
										<td class="p-4 font-bold text-foreground">{p.name}</td>
										<td class="p-4 font-semibold text-primary">{p.countryName}</td>
										<td class="p-4 text-muted-foreground">{p.description || '—'}</td>
										<td class="p-4 text-center">
											{#if p.isActive}
												<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
													<CheckCircle2 class="h-3 w-3" /> Active
												</span>
											{:else}
												<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
													<XCircle class="h-3 w-3" /> Inactive
												</span>
											{/if}
										</td>
										<td class="p-4 text-right">
											<div class="flex items-center justify-end gap-2">
												<Button
													variant="outline"
													class="h-7 px-2.5 text-[11px] rounded-lg cursor-pointer flex items-center gap-1"
													onclick={() => openEditPackageModal(p)}
												>
													<Edit3 class="h-3 w-3" /> Edit
												</Button>
												<Button
													variant="ghost"
													class="h-7 px-2 text-[11px] rounded-lg cursor-pointer {p.isActive ? 'text-rose-600 hover:bg-rose-500/10' : 'text-emerald-600 hover:bg-emerald-500/10'}"
													onclick={() => togglePackageActive(p)}
												>
													{p.isActive ? 'Deactivate' : 'Activate'}
												</Button>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Add/Edit Country Modal -->
{#if showCountryModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
		<div class="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-lg space-y-4 text-xs">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<h2 class="text-sm font-bold text-foreground flex items-center gap-2">
					<Globe class="h-4 w-4 text-primary" />
					<span>{editingCountry ? 'Edit Visa Country' : 'Add New Visa Country'}</span>
				</h2>
				<button type="button" onclick={() => (showCountryModal = false)} class="text-muted-foreground hover:text-foreground">
					<X class="h-4 w-4" />
				</button>
			</div>

			<form onsubmit={handleSaveCountry} class="space-y-4">
				<div class="space-y-1.5">
					<label for="cName" class="font-semibold text-muted-foreground">Country Name *</label>
					<input
						id="cName"
						type="text"
						required
						placeholder="e.g. Saudi Arabia, Turkey, Japan"
						bind:value={countryFormName}
						class="h-9 w-full bg-background border border-border rounded-xl px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="cCode" class="font-semibold text-muted-foreground">ISO / Short Code (Optional)</label>
					<input
						id="cCode"
						type="text"
						placeholder="e.g. SA, TR, JP"
						bind:value={countryFormCode}
						class="h-9 w-full bg-background border border-border rounded-xl px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase"
					/>
				</div>

				{#if editingCountry}
					<div class="flex items-center gap-2 pt-2">
						<input id="cActive" type="checkbox" bind:checked={countryFormActive} class="rounded border-border text-primary" />
						<label for="cActive" class="font-semibold text-foreground cursor-pointer">Active Status</label>
					</div>
				{/if}

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<Button variant="outline" class="rounded-xl px-4 h-9" disabled={savingCountry} onclick={() => (showCountryModal = false)}>
						Cancel
					</Button>
					<Button type="submit" class="rounded-xl px-4 h-9" disabled={savingCountry}>
						{savingCountry ? 'Saving...' : editingCountry ? 'Update Country' : 'Create Country'}
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Add/Edit Package Modal -->
{#if showPackageModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
		<div class="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-lg space-y-4 text-xs">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<h2 class="text-sm font-bold text-foreground flex items-center gap-2">
					<Package class="h-4 w-4 text-primary" />
					<span>{editingPackage ? 'Edit Visa Package' : 'Add New Visa Package'}</span>
				</h2>
				<button type="button" onclick={() => (showPackageModal = false)} class="text-muted-foreground hover:text-foreground">
					<X class="h-4 w-4" />
				</button>
			</div>

			<form onsubmit={handleSavePackage} class="space-y-4">
				<div class="space-y-1.5">
					<label for="pCountry" class="font-semibold text-muted-foreground">Destination Country *</label>
					<select
						id="pCountry"
						required
						bind:value={packageFormCountryId}
						class="h-9 w-full bg-background border border-border rounded-xl px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
					>
						<option value="">-- Select Country --</option>
						{#each countries as c}
							<option value={String(c.id)}>{c.name}</option>
						{/each}
					</select>
				</div>

				<div class="space-y-1.5">
					<label for="pName" class="font-semibold text-muted-foreground">Visa Package Name *</label>
					<input
						id="pName"
						type="text"
						required
						placeholder="e.g. Tourist Visa, Umrah Visa, Business Visit"
						bind:value={packageFormName}
						class="h-9 w-full bg-background border border-border rounded-xl px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="pDesc" class="font-semibold text-muted-foreground">Description / Notes (Optional)</label>
					<textarea
						id="pDesc"
						rows="2"
						placeholder="Enter details, required documents, or validity notes..."
						bind:value={packageFormDescription}
						class="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
					></textarea>
				</div>

				{#if editingPackage}
					<div class="flex items-center gap-2 pt-2">
						<input id="pActive" type="checkbox" bind:checked={packageFormActive} class="rounded border-border text-primary" />
						<label for="pActive" class="font-semibold text-foreground cursor-pointer">Active Status</label>
					</div>
				{/if}

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<Button variant="outline" class="rounded-xl px-4 h-9" disabled={savingPackage} onclick={() => (showPackageModal = false)}>
						Cancel
					</Button>
					<Button type="submit" class="rounded-xl px-4 h-9" disabled={savingPackage}>
						{savingPackage ? 'Saving...' : editingPackage ? 'Update Package' : 'Create Package'}
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}
{/if}
