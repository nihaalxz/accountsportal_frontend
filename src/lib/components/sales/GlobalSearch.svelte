<script lang="ts">
	import { apiFetch } from '$lib/api/api-client';
	import {
		Search,
		X,
		ShoppingBag,
		User,
		FileText,
		ArrowRight,
		Loader2,
		Receipt
	} from 'lucide-svelte';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	let { isOpen, onClose }: Props = $props();

	let searchTerm = $state('');
	let searching = $state(false);
	
	// Aggregated search results
	let bookings = $state<any[]>([]);
	let customers = $state<any[]>([]);
	let receipts = $state<any[]>([]);
	let leads = $state<any[]>([]);

	let searchTimeout: any;

	function handleSearchInput(val: string) {
		searchTerm = val;
		clearTimeout(searchTimeout);
		if (!val.trim()) {
			bookings = [];
			customers = [];
			receipts = [];
			leads = [];
			return;
		}

		searchTimeout = setTimeout(async () => {
			searching = true;
			try {
				const term = val.trim();
				// Parallel fetching across modules
				const [flightsRes, headsRes, receiptsRes, leadsRes] = await Promise.all([
					apiFetch<any>(`api/sales-entries/flights?search=${term}&pageSize=5`),
					apiFetch<any>(`api/sales-entries/heads?search=${term}&pageSize=5`),
					apiFetch<any>(`api/sales-entries/receipts?search=${term}&pageSize=5`),
					apiFetch<any>(`api/sales-entries/leads?search=${term}&pageSize=5`)
				]);

				bookings = flightsRes?.items || [];
				customers = headsRes?.items || [];
				receipts = receiptsRes?.items || [];
				leads = leadsRes?.items || [];
			} catch (err) {
				console.error('Failed to run global search:', err);
			} finally {
				searching = false;
			}
		}, 400);
	}

	// Close global search when esc is pressed
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
{#if isOpen}
	<div
		class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-20 px-4"
		onkeydown={handleKeyDown}
		tabindex="0"
		role="dialog"
		aria-labelledby="global-search-title"
	>
		<!-- Backdrop button to close -->
		<button
			type="button"
			class="fixed inset-0 bg-transparent cursor-default border-none p-0 w-full h-full block"
			onclick={onClose}
			aria-label="Close search"
		></button>

		<div class="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[70vh] overflow-hidden">
			<!-- Search Header -->
			<div class="flex items-center gap-3 p-4 border-b border-border bg-muted/10 shrink-0">
				<Search class="h-5 w-5 text-muted-foreground" />
				<input
					type="text"
					id="global-search-input"
					placeholder="Search Document Ref, Bookings, Passengers, Phone numbers, Passport IDs, or Receipts..."
					value={searchTerm}
					oninput={(e) => handleSearchInput((e.target as HTMLInputElement).value)}
					class="flex-1 text-sm bg-transparent border-none outline-none text-foreground placeholder-muted-foreground/60 focus:ring-0 focus:border-none"
				/>
				{#if searching}
					<Loader2 class="h-4 w-4 text-primary animate-spin" />
				{/if}
				<button onclick={onClose} class="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer">
					<X class="h-4 w-4" />
				</button>
			</div>

			<!-- Search Results Body -->
			<div class="flex-1 overflow-y-auto p-4 space-y-5">
				{#if !searchTerm.trim()}
					<div class="py-12 text-center text-muted-foreground text-xs">
						Type something to search globally across the Texas Sales Entries workspace.
					</div>
				{:else if bookings.length === 0 && customers.length === 0 && receipts.length === 0 && leads.length === 0}
					<div class="py-12 text-center text-muted-foreground text-xs">
						No results matching "{searchTerm}" found.
					</div>
				{:else}
					<!-- Bookings Results -->
					{#if bookings.length > 0}
						<div class="space-y-2">
							<h4 class="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
								<ShoppingBag class="h-3.5 w-3.5" /> Bookings ({bookings.length})
							</h4>
							<div class="divide-y divide-border/60 bg-muted/20 border border-border rounded-xl overflow-hidden">
								{#each bookings as b}
									<a
										href="/sales/bookings/flights"
										onclick={onClose}
										class="w-full text-left p-3 hover:bg-muted/40 transition-colors flex justify-between items-center text-xs block"
									>
										<div>
											<strong class="text-foreground">Flight #{b.id}</strong>
											<span class="text-muted-foreground ml-2">{b.fromLocation} → {b.toLocation} • {b.headName}</span>
										</div>
										<ArrowRight class="h-3.5 w-3.5 text-muted-foreground/60" />
									</a>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Customer Heads -->
					{#if customers.length > 0}
						<div class="space-y-2">
							<h4 class="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
								<User class="h-3.5 w-3.5" /> Customer Heads ({customers.length})
							</h4>
							<div class="divide-y divide-border/60 bg-muted/20 border border-border rounded-xl overflow-hidden">
								{#each customers as c}
									<a
										href={`/sales/ledger?headId=${c.id}`}
										onclick={onClose}
										class="w-full text-left p-3 hover:bg-muted/40 transition-colors flex justify-between items-center text-xs block"
									>
										<div>
											<strong class="text-foreground">{c.firstName} {c.lastName}</strong>
											<span class="text-muted-foreground ml-2">{c.email} • Mobile: {c.mobileNo}</span>
										</div>
										<ArrowRight class="h-3.5 w-3.5 text-muted-foreground/60" />
									</a>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Receipts -->
					{#if receipts.length > 0}
						<div class="space-y-2">
							<h4 class="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
								<Receipt class="h-3.5 w-3.5" /> Receipts ({receipts.length})
							</h4>
							<div class="divide-y divide-border/60 bg-muted/20 border border-border rounded-xl overflow-hidden">
								{#each receipts as r}
									<a
										href={`/sales/receipts/${r.id}`}
										onclick={onClose}
										class="w-full text-left p-3 hover:bg-muted/40 transition-colors flex justify-between items-center text-xs block"
									>
										<div>
											<strong class="text-foreground font-mono">{r.documentNumber || r.receiptId}</strong>
											<span class="text-muted-foreground ml-2">{r.headName} • Service: {r.service}</span>
										</div>
										<span class="font-bold text-foreground font-mono"><MoneyDisplay amount={r.amount} /></span>
									</a>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Leads -->
					{#if leads.length > 0}
						<div class="space-y-2">
							<h4 class="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
								<FileText class="h-3.5 w-3.5" /> Sales Leads ({leads.length})
							</h4>
							<div class="divide-y divide-border/60 bg-muted/20 border border-border rounded-xl overflow-hidden">
								{#each leads as l}
									<a
										href="/sales/leads"
										onclick={onClose}
										class="w-full text-left p-3 hover:bg-muted/40 transition-colors flex justify-between items-center text-xs block"
									>
										<div>
											<strong class="text-foreground">{l.name}</strong>
											<span class="text-muted-foreground ml-2">Source: {l.leadSource} • Services: {l.services}</span>
										</div>
										<ArrowRight class="h-3.5 w-3.5 text-muted-foreground/60" />
									</a>
								{/each}
							</div>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}
