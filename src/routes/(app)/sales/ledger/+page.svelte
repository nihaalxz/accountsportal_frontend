<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { apiFetch } from '$lib/api/api-client';
	import { LedgerRealtimeController } from '$lib/realtime/ledger-realtime-controller';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { DateDisplay } from '$lib/components';
	import { getBahrainPresetRanges, getBahrainDateString, formatDateOnly } from '$lib/formatters/date';
	import { Button } from '$lib/components/ui/button';
	import {
		Printer,
		Download,
		RefreshCw,
		FileText,
		ArrowUpRight,
		ArrowDownLeft,
		Wallet,
		Search,
		User,
		UserCheck,
		ChevronDown,
		Check,
		X,
		Sparkles,
		ExternalLink,
		Receipt,
		Plus
	} from 'lucide-svelte';

	// URL query params
	let urlHeadId = $derived($page.url.searchParams.get('headId'));
	let urlType = $derived($page.url.searchParams.get('type'));

	// Category Filter
	let selectedCategory = $state<'all' | 'customer' | 'agent'>('all');

	// Directory list & Selected Account object
	let accountsList = $state<any[]>([]);
	let selectedAccount = $state<any>(null);
	let isDropdownOpen = $state(false);
	let dropdownSearch = $state('');

	// Ledger Entries & Filters
	let ledgerEntries = $state<any[]>([]);
	let openingBalance = $state(0);
	let closingBalance = $derived(() => ledgerEntries.length > 0 ? (ledgerEntries[ledgerEntries.length - 1].runningBalance ?? 0) : openingBalance);
	let loading = $state(false);
	let startDate = $state('');
	let endDate = $state('');
	let searchFilter = $state('');

	// Helper for account composite key
	function getAccountKey(acc: any) {
		if (!acc) return '';
		return `${acc.type || 'customer'}_${acc.id}`;
	}

	// Load Directory of Customers & Agents
	async function loadDirectory(autoSelectFirst: boolean = false) {
		try {
			const typeParam = selectedCategory !== 'all' ? `&type=${selectedCategory}` : '';
			const res = await apiFetch<any>(`api/sales-entries/heads?pageSize=500${typeParam}`);
			if (res && res.items) {
				accountsList = res.items;

				// Handle URL pre-selection or auto-selection
				if (autoSelectFirst && urlHeadId) {
					const targetType = urlType || 'customer';
					const match = accountsList.find(
						(a) => String(a.id) === String(urlHeadId) && (urlType ? a.type === targetType : true)
					);
					if (match) {
						selectAccount(match);
					} else if (accountsList.length > 0) {
						selectAccount(accountsList[0]);
					}
				}
			}
		} catch (err) {
			console.error('Failed to load accounts directory:', err);
		}
	}

	// Fetch Ledger Statement for a specific Account
	async function fetchLedgerForAccount(acc: any) {
		if (!acc || !acc.id) {
			ledgerEntries = [];
			return;
		}

		loading = true;
		try {
			const accType = acc.type || 'customer';
			const accId = acc.id;

			// 1. Fetch detailed account profile
			try {
				const detail = await apiFetch<any>(`api/sales-entries/heads/${accId}?type=${accType}`);
				if (detail) {
					selectedAccount = detail;
				}
			} catch (e) {
				// Retain current selectedAccount if profile endpoint fails
			}

			// 2. Fetch statement entries
			const res = await apiFetch<any>(`api/sales-entries/customer-ledger?headId=${accId}&type=${accType}&pageSize=1000`);
			if (res && res.items) {
				const allItems: any[] = res.items.slice().sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

				// Calculate opening balance prior to startDate using wallet convention (Credit increases, Debit decreases)
				let opBal = 0;
				if (startDate) {
					const prior = allItems.filter((e: any) => e.createdAt < startDate);
					opBal = prior.reduce((sum: number, e: any) => sum + (Number(e.credit) || 0) - (Number(e.debit) || 0), 0);
				}
				openingBalance = opBal;

				let periodItems = allItems;
				if (startDate) {
					periodItems = periodItems.filter((e: any) => e.createdAt >= startDate);
				}
				if (endDate) {
					periodItems = periodItems.filter((e: any) => e.createdAt <= endDate + 'T23:59:59');
				}

				// Compute running balance chronologically: runningBal += (credit - debit)
				let runningBal = openingBalance;
				ledgerEntries = periodItems.map((item: any) => {
					runningBal += (Number(item.credit) || 0) - (Number(item.debit) || 0);
					return {
						...item,
						runningBalance: runningBal
					};
				});
			} else {
				openingBalance = 0;
				ledgerEntries = [];
			}
		} catch (err) {
			console.error('Failed to load account ledger:', err);
			ledgerEntries = [];
		} finally {
			loading = false;
		}
	}

	// Realtime Controller setup
	let realtimeController: LedgerRealtimeController | null = null;

	// Explicit account selection handler
	function selectAccount(acc: any) {
		selectedAccount = acc;
		isDropdownOpen = false;
		dropdownSearch = '';
		fetchLedgerForAccount(acc);
		realtimeController?.syncSubscription();
	}

	// Category filter handler
	async function setCategoryFilter(cat: 'all' | 'customer' | 'agent') {
		selectedCategory = cat;
		await loadDirectory();
		// Clear selection if current selected account is no longer in filtered list
		if (selectedAccount) {
			const stillExists = accountsList.some(
				(a) => String(a.id) === String(selectedAccount.id) && a.type === selectedAccount.type
			);
			if (!stillExists && accountsList.length > 0) {
				selectAccount(accountsList[0]);
			} else if (accountsList.length === 0) {
				selectedAccount = null;
				ledgerEntries = [];
			}
		}
	}

	onMount(async () => {
		await loadDirectory(true);
		realtimeController = new LedgerRealtimeController({
			getHeadId: () => selectedAccount?.id,
			onLedgerChanged: () => {
				if (selectedAccount) {
					fetchLedgerForAccount(selectedAccount);
				}
			}
		});
		await realtimeController.mount();
	});

	onDestroy(() => {
		realtimeController?.unmount();
	});

	// Filtered combobox items based on search query
	let filteredAccounts = $derived(() => {
		if (!dropdownSearch.trim()) return accountsList;
		const q = dropdownSearch.trim().toLowerCase();
		return accountsList.filter(
			(a) =>
				(a.firstName && a.firstName.toLowerCase().includes(q)) ||
				(a.lastName && a.lastName.toLowerCase().includes(q)) ||
				(a.email && a.email.toLowerCase().includes(q)) ||
				(a.mobileNo && a.mobileNo.includes(q)) ||
				String(a.id).includes(q)
		);
	});

	// Filtered ledger entries based on search input
	let filteredLedgerEntries = $derived(() => {
		if (!searchFilter.trim()) return ledgerEntries;
		const term = searchFilter.trim().toLowerCase();
		return ledgerEntries.filter(
			(e) =>
				(e.type && e.type.toLowerCase().includes(term)) ||
				(e.description && e.description.toLowerCase().includes(term))
		);
	});

	// Compute summary values
	let totalDebits = $derived(() => ledgerEntries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0));
	let totalCredits = $derived(() => ledgerEntries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0));
	let netOutstanding = $derived(() => totalCredits() - totalDebits());

	// Date preset handler
	function applyDatePreset(preset: 'all' | 'month' | '30days' | 'year') {
		if (preset === 'all') {
			startDate = '';
			endDate = '';
		} else if (preset === 'month') {
			const ranges = getBahrainPresetRanges();
			startDate = ranges.thisMonth.startDate;
			endDate = ranges.thisMonth.endDate;
		} else if (preset === '30days') {
			const today = getBahrainDateString();
			const now = new Date();
			const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
			startDate = getBahrainDateString(past30);
			endDate = today;
		} else if (preset === 'year') {
			const today = getBahrainDateString();
			const year = today.split('-')[0];
			startDate = `${year}-01-01`;
			endDate = today;
		}
		if (selectedAccount) {
			fetchLedgerForAccount(selectedAccount);
		}
	}

	import { exportToCSV as downloadCSV } from '$lib/utils/csv-exporter';
	import { toast } from '$lib/stores/toast';

	function exportToCSV() {
		if (!selectedAccount) return;
		const headers = ['Date', 'Type', 'Reference', 'Debit', 'Credit', 'Balance'];
		const rows: any[][] = [];

		// Opening row
		rows.push([
			startDate || 'Inception',
			'OPENING',
			'OPENING BALANCE - Balance Brought Forward',
			'-',
			'-',
			openingBalance > 0 ? `+${openingBalance.toFixed(3)}` : openingBalance.toFixed(3)
		]);

		// Chronological entries
		for (const row of ledgerEntries) {
			rows.push([
				row.createdAt ? formatDateOnly(row.createdAt) : '',
				row.type || '',
				row.description || '',
				row.debit > 0 ? Number(row.debit).toFixed(3) : '-',
				row.credit > 0 ? Number(row.credit).toFixed(3) : '-',
				row.runningBalance > 0 ? `+${Number(row.runningBalance).toFixed(3)}` : Number(row.runningBalance).toFixed(3)
			]);
		}

		// Closing row
		rows.push([
			endDate || 'Current',
			'TOTALS',
			'Statement Closing Balance',
			totalDebits().toFixed(3),
			totalCredits().toFixed(3),
			closingBalance() > 0 ? `+${closingBalance().toFixed(3)}` : closingBalance().toFixed(3)
		]);

		downloadCSV(`ledger_${selectedAccount.firstName}_${selectedAccount.lastName}_${getBahrainDateString()}.csv`, headers, rows);
		toast.success('CSV exported successfully.');
	}

	import { previewDocument } from '$lib/utils/preview-document';

	function handlePrint() {
		if (!selectedAccount) return;
		previewDocument('report', 'sales-ledger', { headId: selectedAccount.id, type: selectedAccount.type, startDate, endDate });
		toast.info('Generating print document...');
	}

	function getInitials(firstName?: string, lastName?: string) {
		const f = (firstName || '').charAt(0).toUpperCase();
		const l = (lastName || '').charAt(0).toUpperCase();
		return (f + l) || 'AC';
	}
	function getBookingDetailUrl(row: any) {
		if (!row) return null;

		let targetId: string | null = null;

		// 1. Prioritize serviceId (numeric booking or receipt primary key)
		if (row.serviceId != null && String(row.serviceId).trim() !== '' && String(row.serviceId) !== '0') {
			targetId = String(row.serviceId);
		}

		// 2. Fallback to Document Code / ID from description (e.g. "#TXSVISA750799", "#TXSFLT788386", "#TXSRCPT10023", "#15")
		if (!targetId && row.description) {
			const match = row.description.match(/#([A-Za-z0-9_-]+)/) || row.description.match(/\b(TXS[A-Za-z0-9_-]+)\b/i);
			if (match && match[1]) {
				targetId = match[1];
			}
		}

		// 3. Fallback to row.id if this is a direct booking/receipt row
		if (!targetId && row.id != null) {
			targetId = String(row.id);
		}

		const type = (row.type || '').toLowerCase();
		const desc = (row.description || '').toLowerCase();

		// Check receipts/deposits FIRST so that receipts describing a service (e.g. "Receipt #TXSRCPT10023: visa (cash)") do not mistakenly route to the visa page
		const isReceiptOrDeposit =
			type === 'receipt' ||
			type === 'receipts' ||
			type === 'deposit' ||
			type === 'wallet_deposit' ||
			type === 'credit_settlement' ||
			type === 'accounts_receipt' ||
			type === 'accounts-receipt' ||
			type === 'client_receipt' ||
			type === 'general_receipt' ||
			type === 'payment' ||
			desc.startsWith('receipt') ||
			desc.includes('receipt #') ||
			desc.includes('wallet deposit') ||
			desc.includes('payment received') ||
			desc.includes('payment approved for receipt') ||
			desc.includes('cash payment approved for receipt') ||
			desc.includes('txsrcpt') ||
			desc.includes('txs-arcpt') ||
			desc.includes('arcpt-');

		if (isReceiptOrDeposit) {
			if (targetId) {
				return `/sales/receipts/${targetId}`;
			}
			return `/sales/receipts`;
		}

		if (!targetId) return null;

		if (type === 'flight' || type === 'flights' || type === 'flight_booking' || (!isReceiptOrDeposit && desc.includes('flight'))) {
			return `/sales/bookings/flights/${targetId}`;
		}
		if (type === 'hotel' || type === 'hotels' || type === 'hotel_booking' || (!isReceiptOrDeposit && desc.includes('hotel'))) {
			return `/sales/bookings/hotels/${targetId}`;
		}
		if (type === 'visa' || type === 'visas' || type === 'visa_application' || (!isReceiptOrDeposit && desc.includes('visa'))) {
			return `/sales/bookings/visa/${targetId}`;
		}
		if (type === 'vfs' || type === 'vfs_appointment' || (!isReceiptOrDeposit && desc.includes('vfs'))) {
			return `/sales/bookings/vfs/${targetId}`;
		}
		if (type === 'holiday' || type === 'holidays' || type === 'holiday_package' || (!isReceiptOrDeposit && desc.includes('holiday'))) {
			return `/sales/bookings/holiday/${targetId}`;
		}
		if (type === 'transport' || type === 'transportation' || (!isReceiptOrDeposit && desc.includes('transport'))) {
			return `/sales/bookings/transportation/${targetId}`;
		}
		if (type === 'other' || type === 'otherservice' || type === 'other-services' || type === 'otherservices' || type === 'other_service' || (!isReceiptOrDeposit && desc.includes('other service'))) {
			return `/sales/bookings/other-services/${targetId}`;
		}

		return null;
	}
</script>

<svelte:head>
	<title>Customer & Agent Ledger Explorer — Accounts Portal</title>
</svelte:head>

<div class="space-y-6 print:space-y-0 print:p-0">
	<!-- Printable Report Header (Print Mode Only) -->
	<div class="hidden print:block mb-6 text-center border-b pb-4">
		<h1 class="text-xl font-bold uppercase tracking-wider text-black">TEXAS TRAVEL ACCOUNTS PORTAL</h1>
		<p class="text-xs text-gray-600">Customer & Agent Official Account Statement</p>
		{#if selectedAccount}
			<div class="mt-4 flex justify-between text-left text-xs border-t pt-3 font-mono">
				<div>
					<p><strong>Account Name:</strong> {selectedAccount.firstName} {selectedAccount.lastName}</p>
					<p><strong>Account Type:</strong> {selectedAccount.type === 'agent' ? 'Agent Account' : 'Customer Head'}</p>
					<p><strong>Contact:</strong> {selectedAccount.email || selectedAccount.mobileNo || 'N/A'}</p>
				</div>
				<div class="text-right">
					<p><strong>Generated Date:</strong> {new Date().toLocaleDateString()}</p>
					<p><strong>Statement Range:</strong> {startDate || 'Start'} to {endDate || 'Present'}</p>
					<p><strong>Wallet Balance:</strong> BHD {selectedAccount.wallet ?? selectedAccount.balance ?? 0}</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Page Header Bar -->
	<div class="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 print:hidden">
		<div class="flex flex-col gap-1 min-w-0 max-w-md 2xl:max-w-xl">
			<h1 class="text-xl font-bold text-foreground font-sans flex items-center gap-2">
				<FileText class="h-5.5 w-5.5 text-primary shrink-0" />
				<span>Customer & Agent Ledger Explorer</span>
			</h1>
			<p class="text-xs text-muted-foreground">
				Interactive account statement analyzer with chronological debits, credits, and running balances.
			</p>
		</div>

		<!-- Action Toolbar -->
		<div class="flex items-center gap-1.5 sm:gap-2 flex-wrap xl:flex-nowrap shrink-0 xl:justify-end">
			{#if selectedAccount}
				<Button
					variant="default"
					class="h-8.5 px-3 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs whitespace-nowrap shrink-0"
					onclick={() => window.open(`/sales/receipts/new-client?clientType=${selectedAccount.type || 'customer'}&headId=${selectedAccount.id}&agentId=${selectedAccount.id}&salesmanId=${selectedAccount.salesmanId || ''}`, '_blank')}
					title="Record receipt and credit wallet for this client (opens in new tab)"
				>
					<Wallet class="h-3.5 w-3.5" />
					<span>Deposit Client Receipt</span>
				</Button>
				<Button
					variant="outline"
					class="h-8.5 px-3 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold hover:bg-muted whitespace-nowrap shrink-0"
					onclick={() => window.open('/sales/receipts/new', '_blank')}
					title="Record general money receipt into cash drawer or bank (opens in new tab)"
				>
					<Receipt class="h-3.5 w-3.5 text-muted-foreground" />
					<span>General Receipt</span>
				</Button>
			{/if}
			<Button
				variant="outline"
				class="h-8.5 px-3 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold hover:bg-muted whitespace-nowrap shrink-0"
				onclick={exportToCSV}
				disabled={!selectedAccount || ledgerEntries.length === 0}
			>
				<Download class="h-3.5 w-3.5" />
				<span>CSV Export</span>
			</Button>
			<Button
				variant="outline"
				class="h-8.5 px-3 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold hover:bg-muted whitespace-nowrap shrink-0"
				onclick={handlePrint}
				disabled={!selectedAccount}
			>
				<Printer class="h-3.5 w-3.5" />
				<span>Print</span>
			</Button>
			<Button
				variant="outline"
				class="h-8.5 px-3 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold hover:bg-muted whitespace-nowrap shrink-0"
				onclick={() => selectedAccount && fetchLedgerForAccount(selectedAccount)}
				disabled={!selectedAccount}
			>
				<RefreshCw class="h-3.5 w-3.5" />
				<span>Reload</span>
			</Button>
		</div>
	</div>

	<!-- Control Panel Card: Category Filter & Account Search Combobox -->
	<div class="bg-card border border-border rounded-2xl p-5 space-y-4 print:hidden shadow-xs">
		<div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
			<!-- Category Filter Pills -->
			<div class="lg:col-span-4 space-y-1.5">
				<span class="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Account Category</span>
				<div class="flex bg-muted/40 p-1 rounded-xl border border-border gap-1">
					<button
						type="button"
						onclick={() => setCategoryFilter('all')}
						class={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${selectedCategory === 'all' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
					>
						All
					</button>
					<button
						type="button"
						onclick={() => setCategoryFilter('customer')}
						class={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${selectedCategory === 'customer' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
					>
						<User class="h-3 w-3" />
						<span>Customers</span>
					</button>
					<button
						type="button"
						onclick={() => setCategoryFilter('agent')}
						class={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${selectedCategory === 'agent' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
					>
						<UserCheck class="h-3 w-3 text-amber-500" />
						<span>Agents</span>
					</button>
				</div>
			</div>

			<!-- Searchable Combobox Account Selector -->
			<div class="lg:col-span-8 space-y-1.5 relative">
				<label for="combobox-trigger" class="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
					Select Account
				</label>
				
				<div class="relative">
					<button
						id="combobox-trigger"
						type="button"
						onclick={() => (isDropdownOpen = !isDropdownOpen)}
						class="w-full text-xs p-2.5 pl-3 pr-10 border border-border rounded-xl bg-background text-foreground flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-xs"
					>
						{#if selectedAccount}
							<div class="flex items-center gap-2 truncate">
								<span class={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${selectedAccount.type === 'agent' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'}`}>
									{selectedAccount.type === 'agent' ? 'AGENT' : 'CUSTOMER'}
								</span>
								<span class="font-bold">{selectedAccount.firstName} {selectedAccount.lastName}</span>
								<span class="text-muted-foreground text-[11px]">({selectedAccount.email || selectedAccount.mobileNo || 'No contact'})</span>
							</div>
						{:else}
							<span class="text-muted-foreground">Search and select Customer Head or Agent Account...</span>
						{/if}
						<ChevronDown class="h-4 w-4 text-muted-foreground shrink-0" />
					</button>

					<!-- Combobox Menu Overlay -->
					{#if isDropdownOpen}
						<button 
							type="button"
							tabindex="-1"
							class="fixed inset-0 z-40 bg-transparent cursor-default" 
							onclick={() => (isDropdownOpen = false)}
							aria-label="Close dropdown backdrop"
						></button>

						<div class="absolute left-0 right-0 top-full mt-1.5 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden max-h-80 flex flex-col animate-in fade-in-50 zoom-in-95">
							<!-- Search Header -->
							<div class="p-2.5 border-b border-border bg-muted/20 relative">
								<Search class="absolute left-5 top-4.5 h-3.5 w-3.5 text-muted-foreground" />
								<input
									type="text"
									placeholder="Search by name, email, phone number..."
									bind:value={dropdownSearch}
									class="w-full text-xs pl-8 pr-8 py-2 border border-border rounded-xl bg-background text-foreground focus:outline-none"
								/>
								{#if dropdownSearch}
									<button 
										type="button"
										onclick={() => (dropdownSearch = '')} 
										class="absolute right-5 top-4.5 text-muted-foreground hover:text-foreground"
									>
										<X class="h-3.5 w-3.5" />
									</button>
								{/if}
							</div>

							<!-- Scrollable Options List -->
							<div class="overflow-y-auto divide-y divide-border/40 p-1">
								{#if filteredAccounts().length > 0}
									{#each filteredAccounts() as item}
										<button
											type="button"
											onclick={() => selectAccount(item)}
											class={`w-full text-left p-2.5 rounded-xl hover:bg-muted/60 transition-colors flex items-center justify-between gap-3 cursor-pointer ${selectedAccount && getAccountKey(item) === getAccountKey(selectedAccount) ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'}`}
										>
											<div class="flex items-center gap-2.5 truncate">
												<div class={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${item.type === 'agent' ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600'}`}>
													{getInitials(item.firstName, item.lastName)}
												</div>
												<div class="truncate">
													<div class="flex items-center gap-1.5 flex-wrap">
														<span class="text-xs font-bold">{item.firstName} {item.lastName}</span>
														<span class={`px-1.5 py-0.2 text-[8px] font-bold uppercase rounded ${item.type === 'agent' ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600'}`}>
															{item.type === 'agent' ? 'AGENT' : 'CUSTOMER'}
														</span>
														{#if item.salesmanName}
															<span class="px-1.5 py-0.2 text-[8px] font-bold uppercase rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
																{item.salesmanName}
															</span>
														{/if}
													</div>
													<p class="text-[10px] text-muted-foreground truncate">{item.email || item.mobileNo || 'No contact'}</p>
												</div>
											</div>
											<div class="text-right shrink-0">
												<span class="text-[10px] font-mono block text-muted-foreground">Wallet</span>
												<span class="text-xs font-bold font-mono">BHD {item.wallet ?? item.balance ?? 0}</span>
											</div>
										</button>
									{/each}
								{:else}
									<div class="p-6 text-center text-xs text-muted-foreground">
										No customer heads or agent accounts match your search.
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Date Range Filters & Presets Bar -->
		<div class="flex flex-col md:flex-row gap-4 items-end pt-2 border-t border-border/60">
			<!-- Date Inputs -->
			<div class="flex flex-wrap items-center gap-3">
				<div class="space-y-1">
					<label for="start-date" class="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Statement From</label>
					<input
						id="start-date"
						type="date"
						bind:value={startDate}
						onchange={() => selectedAccount && fetchLedgerForAccount(selectedAccount)}
						class="text-xs p-2 border border-border rounded-xl bg-background text-foreground focus:outline-none cursor-pointer"
					/>
				</div>

				<div class="space-y-1">
					<label for="end-date" class="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Statement To</label>
					<input
						id="end-date"
						type="date"
						bind:value={endDate}
						onchange={() => selectedAccount && fetchLedgerForAccount(selectedAccount)}
						class="text-xs p-2 border border-border rounded-xl bg-background text-foreground focus:outline-none cursor-pointer"
					/>
				</div>
			</div>

			<!-- Quick Presets -->
			<div class="space-y-1">
				<span class="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Quick Date Presets</span>
				<div class="flex items-center gap-1.5 flex-wrap">
					<button
						type="button"
						onclick={() => applyDatePreset('all')}
						class="px-2.5 py-1 text-[11px] font-medium border border-border rounded-lg bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
					>
						All Time
					</button>
					<button
						type="button"
						onclick={() => applyDatePreset('month')}
						class="px-2.5 py-1 text-[11px] font-medium border border-border rounded-lg bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
					>
						This Month
					</button>
					<button
						type="button"
						onclick={() => applyDatePreset('30days')}
						class="px-2.5 py-1 text-[11px] font-medium border border-border rounded-lg bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
					>
						Last 30 Days
					</button>
					<button
						type="button"
						onclick={() => applyDatePreset('year')}
						class="px-2.5 py-1 text-[11px] font-medium border border-border rounded-lg bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
					>
						This Year
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Ledger Statement Output Section -->
	{#if selectedAccount}
		{#if loading}
			<div class="bg-card border border-border rounded-2xl p-12 h-80 flex flex-col items-center justify-center animate-pulse print:hidden">
				<RefreshCw class="h-8 w-8 text-primary animate-spin mb-3" />
				<p class="text-xs font-semibold text-muted-foreground">Loading account statement & calculating running balances...</p>
			</div>
		{:else}
			<!-- Selected Account Banner -->
			<div class="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs print:border-none print:shadow-none">
				<div class="flex items-center gap-4">
					<div class={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base shadow-xs ${selectedAccount.type === 'agent' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
						{getInitials(selectedAccount.firstName, selectedAccount.lastName)}
					</div>
					<div>
						<div class="flex items-center gap-2 flex-wrap">
							<h2 class="text-base font-bold text-foreground font-sans">
								{selectedAccount.firstName} {selectedAccount.lastName}
							</h2>
							<span class={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-md ${selectedAccount.type === 'agent' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'}`}>
								{selectedAccount.type === 'agent' ? 'Agent Account' : 'Customer Head'}
							</span>
							{#if selectedAccount.salesmanName}
								<span class="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-md bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
									Salesman: {selectedAccount.salesmanName}
								</span>
							{/if}
						</div>
						<p class="text-xs text-muted-foreground mt-0.5">
							Email: {selectedAccount.email || 'N/A'} • Phone: {selectedAccount.mobileNo || 'N/A'} • Nationality: {selectedAccount.nationality || 'Bahraini'}
							{#if selectedAccount.salesmanName}
								• <span class="font-semibold text-foreground">Salesman: {selectedAccount.salesmanName}</span>
							{/if}
						</p>
					</div>
				</div>
			</div>

			<!-- Summaries Cards Grid (4 Cards matching PDF and Wallet Convention) -->
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
				<!-- Opening Balance Card -->
				<div class="bg-card border border-border rounded-2xl p-4 shadow-xs flex items-center gap-3">
					<div class="p-2.5 bg-muted text-muted-foreground rounded-xl">
						<Receipt class="h-5 w-5" />
					</div>
					<div>
						<p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Opening Balance</p>
						<h3 class="text-base font-bold font-mono text-foreground">
							{openingBalance > 0 ? `+${openingBalance.toFixed(3)}` : openingBalance < 0 ? openingBalance.toFixed(3) : '0.000'} BHD
						</h3>
						<p class="text-[10px] text-muted-foreground">Balance brought forward</p>
					</div>
				</div>

				<!-- Total Deposited / Paid (+) -->
				<div class="bg-card border border-border rounded-2xl p-4 shadow-xs flex items-center gap-3 hover:border-emerald-500/30 transition-all">
					<div class="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
						<Wallet class="h-5 w-5" />
					</div>
					<div>
						<p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Deposited / Paid (+)</p>
						<h3 class="text-base font-bold font-mono text-emerald-600">
							+{totalCredits().toFixed(3)} BHD
						</h3>
						<p class="text-[10px] text-muted-foreground">Receipts & Deposits</p>
					</div>
				</div>

				<!-- Total Invoiced / Charges (-) -->
				<div class="bg-card border border-border rounded-2xl p-4 shadow-xs flex items-center gap-3 hover:border-red-500/30 transition-all">
					<div class="p-2.5 bg-red-500/10 text-red-600 rounded-xl">
						<ArrowUpRight class="h-5 w-5" />
					</div>
					<div>
						<p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Invoiced / Charges (-)</p>
						<h3 class="text-base font-bold font-mono text-red-600">
							{totalDebits().toFixed(3)} BHD
						</h3>
						<p class="text-[10px] text-muted-foreground">Bookings & Charges</p>
					</div>
				</div>

				<!-- Current Wallet Balance -->
				<div class="bg-card border border-border rounded-2xl p-4 shadow-xs flex items-center gap-3 hover:border-primary/30 transition-all">
					<div class={`p-2.5 rounded-xl ${closingBalance() >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
						<Wallet class="h-5 w-5" />
					</div>
					<div>
						<p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Wallet Balance</p>
						<h3 class={`text-base font-bold font-mono ${closingBalance() >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
							{closingBalance() > 0 ? `+${closingBalance().toFixed(3)}` : closingBalance() < 0 ? closingBalance().toFixed(3) : '0.000'} BHD
						</h3>
						<p class="text-[10px] text-muted-foreground">
							{closingBalance() > 0 ? 'Prepaid funds held' : closingBalance() < 0 ? 'Outstanding balance owed to Texas' : 'Settled'}
						</p>
					</div>
				</div>
			</div>

			<!-- In-Table Live Search Bar -->
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
				<div class="relative flex-1 max-w-md">
					<Search class="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search transactions by narration or type..."
						bind:value={searchFilter}
						class="w-full text-xs pl-9 pr-8 py-2 border border-border rounded-xl bg-background text-foreground focus:outline-none shadow-xs"
					/>
					{#if searchFilter}
						<button 
							type="button"
							onclick={() => (searchFilter = '')} 
							class="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
						>
							<X class="h-3.5 w-3.5" />
						</button>
					{/if}
				</div>
				<span class="text-xs text-muted-foreground font-mono">
					Showing {filteredLedgerEntries().length} of {ledgerEntries.length} statement entries
				</span>
			</div>

			<!-- Ledger Transactions Table -->
			{#if filteredLedgerEntries().length > 0 || openingBalance !== 0}
				<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs print:border-none print:shadow-none">
					<div class="overflow-x-auto">
						<table class="w-full min-w-[850px] text-left border-collapse text-xs">
							<thead>
								<tr class="bg-muted/40 border-b border-border text-muted-foreground font-semibold print:bg-transparent uppercase text-[10px] tracking-wider">
									<th class="p-4 w-32">Date</th>
									<th class="p-4 w-28">Type</th>
									<th class="p-4">Reference Narration</th>
									<th class="p-4 w-32">Payment Method</th>
									<th class="p-4 text-right w-28 text-red-600">Debit (-)</th>
									<th class="p-4 text-right w-28 text-emerald-600">Credit (+)</th>
									<th class="p-4 text-right w-32 text-foreground font-bold">Running Bal</th>
									<th class="p-4 text-center w-24 print:hidden">Action</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60 font-mono">
								<!-- Opening Balance Row -->
								<tr class="bg-muted/20 font-semibold text-xs border-b border-border/80">
									<td class="p-4 text-muted-foreground font-sans">{startDate ? formatDateOnly(startDate) : '-'}</td>
									<td class="p-4"><span class="px-2 py-0.5 text-[9px] font-bold uppercase rounded-md bg-muted border border-border text-muted-foreground">OPENING</span></td>
									<td class="p-4 font-sans text-foreground font-medium" colspan="2">OPENING BALANCE - Balance Brought Forward</td>
									<td class="p-4 text-right text-muted-foreground font-sans">-</td>
									<td class="p-4 text-right text-muted-foreground font-sans">-</td>
									<td class={`p-4 text-right font-mono font-bold ${openingBalance > 0 ? 'text-emerald-600' : openingBalance < 0 ? 'text-red-600' : 'text-foreground'}`}>
										{openingBalance > 0 ? `+${openingBalance.toFixed(3)}` : openingBalance.toFixed(3)}
									</td>
									<td class="p-4 print:hidden"></td>
								</tr>

								{#each filteredLedgerEntries() as row}
									{@const detailUrl = getBookingDetailUrl(row)}
									<tr class="hover:bg-muted/20 transition-colors">
										<td class="p-4 text-muted-foreground font-sans"><DateDisplay value={row.createdAt} /></td>
										<td class="p-4">
											<span class="px-2 py-0.5 text-[9px] font-bold uppercase rounded-md bg-muted border border-border text-foreground">
												{row.type}
											</span>
										</td>
										<td class="p-4 font-sans text-muted-foreground truncate max-w-md">
											{#if detailUrl}
												<a 
													href={detailUrl} 
													target="_blank"
													rel="noopener noreferrer"
													class="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary hover:underline transition-colors group"
												>
													<span>{row.description}</span>
													<ExternalLink class="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0 print:hidden" />
												</a>
											{:else}
												<span>{row.description}</span>
											{/if}
										</td>
										<td class="p-4 font-sans">
											{#if row.paymentMethod}
												<span class="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-muted/80 text-foreground border border-border">
													{row.paymentMethod}
												</span>
											{:else}
												<span class="text-muted-foreground/35 font-normal">—</span>
											{/if}
										</td>
										<td class="p-4 text-right text-red-600 font-bold">
											{#if row.debit > 0}
												<MoneyDisplay amount={row.debit} />
											{:else}
												<span class="text-muted-foreground/35 font-normal font-sans">—</span>
											{/if}
										</td>
										<td class="p-4 text-right text-emerald-600 font-bold">
											{#if row.credit > 0}
												<MoneyDisplay amount={row.credit} />
											{:else}
												<span class="text-muted-foreground/35 font-normal font-sans">—</span>
											{/if}
										</td>
										<td class={`p-4 text-right font-mono font-bold ${row.runningBalance > 0 ? 'text-emerald-600' : row.runningBalance < 0 ? 'text-red-600' : 'text-foreground'}`}>
											{row.runningBalance > 0 ? `+${Number(row.runningBalance).toFixed(3)}` : Number(row.runningBalance).toFixed(3)}
										</td>
										<td class="p-4 text-center font-sans print:hidden">
											{#if detailUrl}
												<a
													href={detailUrl}
													target="_blank"
													rel="noopener noreferrer"
													class="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold border border-primary/30 rounded-lg text-primary hover:bg-primary/10 transition-colors"
													title="Open details in new tab"
												>
													<span>View</span>
													<ExternalLink class="h-3 w-3" />
												</a>
											{:else}
												<span class="text-muted-foreground/40 font-normal">—</span>
											{/if}
										</td>
									</tr>
								{/each}

								<!-- Closing Totals Row -->
								<tr class="bg-muted/40 font-bold text-xs border-t-2 border-border text-foreground">
									<td class="p-4 font-sans">TOTALS</td>
									<td class="p-4 font-sans">{ledgerEntries.length} Entries</td>
									<td class="p-4 font-sans" colspan="2">Total Movements & Closing Balance</td>
									<td class="p-4 text-right text-red-600">{totalDebits().toFixed(3)}</td>
									<td class="p-4 text-right text-emerald-600">+{totalCredits().toFixed(3)}</td>
									<td class={`p-4 text-right font-mono font-bold ${closingBalance() > 0 ? 'text-emerald-600' : closingBalance() < 0 ? 'text-red-600' : 'text-foreground'}`}>
										{closingBalance() > 0 ? `+${closingBalance().toFixed(3)}` : closingBalance().toFixed(3)}
									</td>
									<td class="p-4 print:hidden"></td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			{:else}
				<div class="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground text-xs shadow-xs space-y-2">
					<p class="font-semibold text-foreground text-sm">No statement entries match your filter criteria.</p>
					<p class="text-xs text-muted-foreground">Try clearing date ranges or search terms to view all transactions.</p>
				</div>
			{/if}
		{/if}
	{:else}
		<!-- Empty State -->
		<div class="bg-card border border-border rounded-2xl p-16 text-center shadow-xs space-y-4">
			<div class="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
				<Sparkles class="h-8 w-8" />
			</div>
			<div class="max-w-md mx-auto space-y-1">
				<h3 class="text-base font-bold text-foreground">Select an Account to View Ledger Statement</h3>
				<p class="text-xs text-muted-foreground">
					Choose any Customer Head or Agent Account from the search dropdown above to explore chronological debit & credit postings and running balances.
				</p>
			</div>
		</div>
	{/if}

	<!-- Printable Footer (Print Mode Only) -->
	<div class="hidden print:block border-t pt-8 mt-12 text-xs text-gray-600 font-mono">
		<div class="flex justify-between items-end">
			<div>
				<p>Prepared By: Texas Accounts Department</p>
				<p>Thank you for choosing Texas Travel.</p>
			</div>
			<div class="text-right border-t border-black pt-2 w-48 text-center font-bold">
				Authorized Signature
			</div>
		</div>
	</div>
</div>
