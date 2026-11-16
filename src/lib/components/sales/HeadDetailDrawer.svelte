<script lang="ts">
	import { apiFetch } from '$lib/api/api-client';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { DateDisplay } from '$lib/components';
	import {
		X,
		User,
		Mail,
		Phone,
		Globe,
		MapPin,
		FileText,
		ShoppingBag,
		History,
		RefreshCw
	} from 'lucide-svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		headId: number | null;
	}

	let { isOpen, onClose, headId }: Props = $props();

	let activeTab = $state<'profile' | 'ledger' | 'bookings' | 'receipts' | 'timeline'>('profile');
	let loading = $state(false);
	let headInfo = $state<any>(null);
	let ledgerData = $state<any>(null);
	let bookingsList = $state<any[]>([]);
	let receiptsList = $state<any[]>([]);

	async function fetchHeadDetails() {
		if (!headId) return;
		loading = true;
		headInfo = null;
		ledgerData = null;

		try {
			// Fetch main profile info
			headInfo = await apiFetch<any>(`api/sales-entries/heads/${headId}`);

			// Fetch ledger list
			ledgerData = await apiFetch<any>(`api/sales-entries/heads/${headId}/ledger?pageSize=50`);

			// Fetch linked receipts
			const receiptsRes = await apiFetch<any>(`api/sales-entries/receipts?pageSize=50`);
			if (receiptsRes && receiptsRes.items) {
				receiptsList = receiptsRes.items.filter((r: any) => r.headName && r.headName.toLowerCase().includes(headInfo.firstName.toLowerCase()));
			}

			// Estimate linked bookings from flights list for mock/display
			const flightsRes = await apiFetch<any>('api/sales-entries/flights?pageSize=50');
			if (flightsRes && flightsRes.items) {
				bookingsList = flightsRes.items.filter((b: any) => b.headName && b.headName.toLowerCase().includes(headInfo.firstName.toLowerCase()));
			}
		} catch (err) {
			console.error('Failed to load customer head inspector data:', err);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (isOpen && headId) {
			fetchHeadDetails();
		}
	});

	// Compute head history timeline events
	const timelineEvents = $derived(() => {
		if (!headInfo) return [];
		const events: { title: string; date: string; desc: string; icon: any; color: string }[] = [];

		events.push({
			title: 'Head Account Created',
			date: headInfo.createdAt,
			desc: `Customer Head profile established as type ${headInfo.type}`,
			icon: User,
			color: 'bg-primary/10 text-primary border-primary/20'
		});

		if (ledgerData && ledgerData.items) {
			ledgerData.items.slice(0, 10).forEach((entry: any) => {
				events.push({
					title: entry.type === 'debit' ? 'Ledger Debit Posted' : 'Ledger Credit Posted',
					date: entry.createdAt,
					desc: `${entry.description}. Balance change: ${entry.debit > 0 ? '+' : '-'}${entry.debit || entry.credit}`,
					icon: FileText,
					color: entry.debit > 0 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
				});
			});
		}

		return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	});
</script>

{#if isOpen}
	<button
		type="button"
		class="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 transition-opacity w-full h-full cursor-default border-none p-0 bg-transparent block"
		onclick={onClose}
		aria-label="Close details"
	></button>

	<div class="fixed right-0 top-0 h-screen w-full max-w-3xl bg-card border-l border-border shadow-2xl z-50 flex flex-col transition-all duration-300">
		<!-- Drawer Header -->
		<div class="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/10 shrink-0">
			<div class="flex items-center gap-2.5">
				<div class="h-10 w-10 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold">
					<User class="h-5 w-5" />
				</div>
				<div>
					<h3 class="text-sm font-bold text-foreground">
						Customer Head Account Inspector
					</h3>
					<p class="text-[10px] text-muted-foreground mt-0.5">
						ID: #{headId} • Account Level Trace
					</p>
				</div>
			</div>
			<button onclick={onClose} class="p-2 hover:bg-muted text-muted-foreground rounded-lg transition-colors cursor-pointer">
				<X class="h-4.5 w-4.5" />
			</button>
		</div>

		<!-- Tabs -->
		<div class="flex border-b border-border bg-muted/5 px-4 overflow-x-auto scrollbar-none shrink-0">
			{#each [
				{ id: 'profile', label: 'Profile details' },
				{ id: 'ledger', label: 'Ledger History' },
				{ id: 'bookings', label: 'Bookings Log' },
				{ id: 'receipts', label: 'Receipts Record' },
				{ id: 'timeline', label: 'Account Timeline' }
			] as tab}
				<button
					onclick={() => activeTab = tab.id as any}
					class="px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer {activeTab === tab.id ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'}"
				>
					{tab.label}
				</button>
			{/each}
		</div>

		<!-- Scrollable Content -->
		<div class="flex-1 overflow-y-auto p-6 bg-muted/5">
			{#if loading}
				<div class="flex flex-col items-center justify-center h-full py-20 gap-3">
					<RefreshCw class="h-8 w-8 text-primary animate-spin" />
					<span class="text-xs text-muted-foreground">Retrieving head statements & ledgers...</span>
				</div>
			{:else if headInfo}
				<!-- TAB: PROFILE -->
				{#if activeTab === 'profile'}
					<div class="space-y-6">
						<div class="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
							<div class="flex justify-between items-center border-b border-border/40 pb-3">
								<div>
									<h4 class="text-base font-bold text-foreground">{headInfo.firstName} {headInfo.lastName}</h4>
									<p class="text-xs text-muted-foreground capitalize mt-0.5">Account Type: <strong class="text-primary">{headInfo.type}</strong></p>
								</div>
								<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold capitalize h-fit
									{headInfo.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}">
									{headInfo.status}
								</span>
							</div>

							<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
								<div class="flex items-center gap-2 text-muted-foreground">
									<Mail class="h-4 w-4 shrink-0 text-muted-foreground/60" />
									<span>Email: <strong class="text-foreground">{headInfo.email}</strong></span>
								</div>
								<div class="flex items-center gap-2 text-muted-foreground">
									<Phone class="h-4 w-4 shrink-0 text-muted-foreground/60" />
									<span>Mobile: <strong class="text-foreground font-mono">{headInfo.mobileNo}</strong></span>
								</div>
								<div class="flex items-center gap-2 text-muted-foreground">
									<Globe class="h-4 w-4 shrink-0 text-muted-foreground/60" />
									<span>Nationality: <strong class="text-foreground">{headInfo.nationality || '—'}</strong></span>
								</div>
								<div class="flex items-center gap-2 text-muted-foreground">
									<MapPin class="h-4 w-4 shrink-0 text-muted-foreground/60" />
									<span>Billing Address: <strong class="text-foreground">{headInfo.address || '—'}</strong></span>
								</div>
							</div>
						</div>

						<!-- Balances Box -->
						<div class="grid grid-cols-2 gap-4 text-xs font-sans">
							<div class="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col justify-between">
								<span class="text-muted-foreground uppercase font-bold text-[9px] tracking-wider">Account Normal Balance</span>
								<h3 class="text-lg font-bold text-foreground mt-2"><MoneyDisplay amount={headInfo.balance} /></h3>
							</div>
							<div class="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col justify-between">
								<span class="text-muted-foreground uppercase font-bold text-[9px] tracking-wider">Wallet Credit Balance</span>
								<h3 class="text-lg font-bold text-emerald-600 mt-2"><MoneyDisplay amount={headInfo.wallet} /></h3>
							</div>
						</div>
					</div>

				<!-- TAB: LEDGER -->
				{:else if activeTab === 'ledger'}
					<div class="space-y-4">
						<h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Chronological Ledger Log</h4>
						{#if ledgerData && ledgerData.items && ledgerData.items.length > 0}
							<div class="border border-border rounded-xl overflow-hidden bg-card">
								<table class="w-full text-left text-xs border-collapse">
									<thead>
										<tr class="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
											<th class="p-3">Posting Date</th>
											<th class="p-3">Reference/Description</th>
											<th class="p-3 text-right">Debit</th>
											<th class="p-3 text-right">Credit</th>
											<th class="p-3 text-right">Balance</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-border/60 font-mono">
										{#each ledgerData.items as row}
											<tr class="hover:bg-muted/5">
												<td class="p-3 text-muted-foreground"><DateDisplay value={row.createdAt} /></td>
												<td class="p-3 font-sans text-foreground truncate max-w-xs">{row.description}</td>
												<td class="p-3 text-right">
													{#if row.debit > 0}
														<MoneyDisplay amount={row.debit} />
													{:else}
														<span class="text-muted-foreground/35">—</span>
													{/if}
												</td>
												<td class="p-3 text-right text-emerald-600">
													{#if row.credit > 0}
														<MoneyDisplay amount={row.credit} />
													{:else}
														<span class="text-muted-foreground/35">—</span>
													{/if}
												</td>
												<td class="p-3 text-right font-semibold text-foreground"><MoneyDisplay amount={row.balance} /></td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{:else}
							<div class="border border-border border-dashed rounded-xl p-8 text-center text-muted-foreground text-xs bg-card">
								No ledger transactions posted for this customer head.
							</div>
						{/if}
					</div>

				<!-- TAB: BOOKINGS -->
				{:else if activeTab === 'bookings'}
					<div class="space-y-4">
						<h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer Bookings List</h4>
						{#if bookingsList.length > 0}
							<div class="border border-border rounded-xl overflow-hidden bg-card">
								<table class="w-full text-left text-xs border-collapse">
									<thead>
										<tr class="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
											<th class="p-3">ID</th>
											<th class="p-3">Route / Booking Type</th>
											<th class="p-3">Amount</th>
											<th class="p-3">Payment Status</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-border/60">
										{#each bookingsList as b}
											<tr class="hover:bg-muted/5">
												<td class="p-3 font-mono">#{b.id}</td>
												<td class="p-3 text-foreground">{b.fromLocation} → {b.toLocation}</td>
												<td class="p-3 font-bold font-mono"><MoneyDisplay amount={b.payableAmount} /></td>
												<td class="p-3 capitalize">{b.paymentStatus}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{:else}
							<div class="border border-border border-dashed rounded-xl p-8 text-center text-muted-foreground text-xs bg-card">
								No bookings registered.
							</div>
						{/if}
					</div>

				<!-- TAB: RECEIPTS -->
				{:else if activeTab === 'receipts'}
					<div class="space-y-4">
						<h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer Receipts Record</h4>
						{#if receiptsList.length > 0}
							<div class="border border-border rounded-xl overflow-hidden bg-card">
								<table class="w-full text-left text-xs border-collapse">
									<thead>
										<tr class="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
											<th class="p-3">Receipt ID</th>
											<th class="p-3">Amount</th>
											<th class="p-3">Mode</th>
											<th class="p-3">Status</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-border/60 font-mono">
										{#each receiptsList as r}
											<tr class="hover:bg-muted/5">
												<td class="p-3 font-semibold font-sans">{r.documentNumber || r.receiptId}</td>
												<td class="p-3 font-bold"><MoneyDisplay amount={r.amount} /></td>
												<td class="p-3 capitalize font-sans">{r.paymentMode}</td>
												<td class="p-3 capitalize font-sans">{r.status}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{:else}
							<div class="border border-border border-dashed rounded-xl p-8 text-center text-muted-foreground text-xs bg-card">
								No receipts found.
							</div>
						{/if}
					</div>

				<!-- TAB: TIMELINE -->
				{:else if activeTab === 'timeline'}
					<div class="space-y-6">
						<h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Account Statement Timeline</h4>
						<div class="relative pl-6 border-l-2 border-border/80 space-y-6">
							{#each timelineEvents() as ev}
								<div class="relative">
									<span class="absolute -left-10 top-0.5 flex h-8 w-8 items-center justify-center rounded-full border bg-card {ev.color}">
										<ev.icon class="h-4 w-4" />
									</span>
									<div class="bg-card border border-border rounded-xl p-4 shadow-xs text-xs">
										<div class="flex justify-between items-center">
											<span class="font-bold text-foreground">{ev.title}</span>
											<span class="font-mono text-[10px] text-muted-foreground"><DateDisplay value={ev.date} /></span>
										</div>
										<p class="text-muted-foreground mt-1">{ev.desc}</p>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{:else}
				<div class="flex items-center justify-center h-full text-muted-foreground py-20 text-xs">
					Failed to load customer profile detail records.
				</div>
			{/if}
		</div>
	</div>
{/if}
