<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { hasRole } from '$lib/stores/auth';

	import { apiFetch } from '$lib/api/api-client';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Alert from '$lib/components/ui/alert';
	import * as Card from '$lib/components/ui/card';
	import { addToast } from '$lib/stores/toast';
	import { formatDateTime, getBahrainDateString, getBahrainPresetRanges } from '$lib/formatters/date';
	import { approveExpense, rejectExpense, getExpenseHeaders } from '$features/expenses/api';
	import { getAccounts } from '$features/cash-accounts/api';
	import { getBanks } from '$features/bank-accounts/api';
	import {
		approvePurchaseReturn,
		rejectPurchaseReturn,
		approveSalesReturn,
		rejectSalesReturn,
		approveSupplierPayment,
		rejectSupplierPayment,
		getSupplierPayments
	} from '$features/suppliers/api';
	import { fetchAccountsStaff } from '$features/staffs/api/staffs-api';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { exportToCSV } from '$lib/utils/csv-exporter';
	import { previewDocument } from '$lib/utils/preview-document';
	import {
		Clock,
		Check,
		X,
		CheckSquare,
		RefreshCw,
		Search,
		Filter,
		UserCheck,
		Users,
		Landmark,
		Wallet,
		Layers,
		AlertCircle,
		CheckCircle2,
		XCircle,
		ListChecks,
		ShieldAlert,
		Receipt,
		BookOpen,
		Download,
		FileText,
		Calendar,
		RotateCcw,
		ArrowRight,
		ArrowDownLeft,
		ArrowUpRight,
		DollarSign,
		Building,
		CheckCheck,
		Info,
		Tag,
		Sparkles,
		ChevronRight,
		CornerDownRight,
		Coins
	} from 'lucide-svelte';

	interface PendingApprovalItem {
		id: number;
		entityType: string;
		payloadJson: string;
		submittedByName: string;
		submittedByUserId: number;
		submittedAt: string;
		status: string;
		reviewedByName: string | null;
		reviewedAt: string | null;
	}

	interface PendingExpenseItem {
		id: number;
		expenseNumber: string;
		expenseCategoryId: number;
		amount: number;
		currency: string;
		description: string;
		paymentMethod: string;
		sourceAccountId: number | null;
		sourceBankId: number | null;
		expenseDate: string;
		status: string;
		notes: string | null;
		createdBy: number;
		createdAt: string;
	}

	interface PendingTransactionItem {
		id: number;
		transactionType: string;
		amount: number;
		paymentMethod: string;
		description: string | null;
		status: string;
		createdBy: number;
		createdAt: string;
		createdByName?: string;
		sourceAccountName?: string;
		destinationAccountName?: string;
		sourceBankName?: string;
		destinationBankName?: string;
		sourceAccountId?: number | null;
		destinationAccountId?: number | null;
		sourceBankId?: number | null;
		destinationBankId?: number | null;
		destinationParty?: { type: string; id: number; name: string } | null;
	}

	interface PendingJournalItem {
		id: number;
		journalNumber: string;
		transferReference?: string | null;
		debitPartyType: string;
		debitPartyId: number;
		debitPartyName: string;
		creditPartyType: string;
		creditPartyId: number;
		creditPartyName: string;
		amount: number;
		status: string;
		note: string | null;
		createdBy: number | null;
		createdByName?: string | null;
		approvedBy?: number | null;
		approvedByName?: string | null;
		approvedAt?: string | null;
		createdAt: string;
		updatedAt: string;
		rowVersion: string;
	}

	interface PendingSupplierSettlementItem {
		id: number;
		supplierId: number;
		amount: number;
		currency: string;
		paymentMethod: string;
		sourceType?: string | null;
		sourceAccountId?: number | null;
		sourceBankId?: number | null;
		referenceNumber?: string | null;
		externalReference?: string | null;
		serviceType?: string | null;
		description?: string | null;
		status: string;
		rejectionReason?: string | null;
		createdBy?: number;
		createdAt?: string;
		requestedByUserId?: number;
		requestedByName?: string | null;
		requestedAt?: string;
		rowVersion?: string;
		documentNumber?: string | null;
	}

	let loading = $state(true);
	let isExportingPdf = $state(false);
	let pendingApprovals = $state<PendingApprovalItem[]>([]);
	let pendingExpenses = $state<PendingExpenseItem[]>([]);
	let pendingTransactions = $state<PendingTransactionItem[]>([]);
	let pendingJournals = $state<PendingJournalItem[]>([]);
	let pendingPurchaseReturns = $state<any[]>([]);
	let pendingSalesReturns = $state<any[]>([]);
	let pendingSupplierSettlements = $state<PendingSupplierSettlementItem[]>([]);
	let staffUsers = $state<any[]>([]);
	let headsList = $state<any[]>([]);
	let agentsList = $state<any[]>([]);
	let suppliersList = $state<any[]>([]);
	let categoriesList = $state<any[]>([]);
	let cashAccountsList = $state<any[]>([]);
	let bankAccountsList = $state<any[]>([]);
	let activeTab = $state<string>('all');
	let processingId = $state<string | number | null>(null);
	let processingAction = $state<'approve' | 'reject' | null>(null);

	// Synchronize activeTab with URL ?tab= query parameter
	$effect(() => {
		const tabFromUrl = $page.url.searchParams.get('tab');
		if (tabFromUrl && tabFromUrl !== activeTab) {
			activeTab = tabFromUrl;
		}
	});

	function switchTab(tab: string) {
		activeTab = tab;
		const url = new URL($page.url);
		if (tab === 'all') {
			url.searchParams.delete('tab');
		} else {
			url.searchParams.set('tab', tab);
		}
		goto(url.pathname + url.search, { replaceState: true, noScroll: true, keepFocus: true });
	}

	// Filtering & Date Range State
	let statusFilter = $state<'pending' | 'approved_today' | 'approved_all' | 'all'>('pending');
	let datePreset = $state<'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom'>('all');
	let startDate = $state<string>('');
	let endDate = $state<string>('');
	let searchQuery = $state<string>('');

	// Selection State
	let selectedKeys = $state<string[]>([]);
	let isBulkProcessing = $state(false);

	// Rejection Modal State
	let rejectionModalOpen = $state(false);
	let isRejectingModal = $state(false);
	let rejectionTarget = $state<{ type: 'single-approval' | 'single-expense' | 'single-transaction' | 'single-journal' | 'single-purchase-return' | 'single-sales-return' | 'single-supplier-settlement' | 'bulk'; item?: any } | null>(null);
	let rejectionReason = $state('Rejected by Master Accountant');

	const quickRejectionReasons = [
		'Incorrect Amount',
		'Missing Supporting Documents',
		'Invalid Payment Channel',
		'Duplicate Submission',
		'Incorrect Beneficiary Details'
	];

	function getTodayDateString(): string {
		return getBahrainDateString();
	}

	function handleDatePresetChange(preset: 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom') {
		datePreset = preset;

		if (preset === 'all') {
			startDate = '';
			endDate = '';
		} else if (preset === 'today') {
			const ranges = getBahrainPresetRanges();
			startDate = ranges.today.startDate;
			endDate = ranges.today.endDate;
		} else if (preset === 'yesterday') {
			const now = new Date();
			const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bahrain', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
			const year = parseInt(parts.find((p) => p.type === 'year')?.value || '2026', 10);
			const month = parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10);
			const day = parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10);
			const d = new Date(year, month - 1, day);
			d.setDate(d.getDate() - 1);
			const yestStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
			startDate = yestStr;
			endDate = yestStr;
		} else if (preset === 'this_week') {
			const ranges = getBahrainPresetRanges();
			startDate = ranges.thisWeek.startDate;
			endDate = ranges.thisWeek.endDate;
		} else if (preset === 'this_month') {
			const ranges = getBahrainPresetRanges();
			startDate = ranges.thisMonth.startDate;
			endDate = ranges.thisMonth.endDate;
		}
		loadAllPending();
	}

	function handleStatusFilterChange(newStatus: 'pending' | 'approved_today' | 'approved_all' | 'all') {
		statusFilter = newStatus;
		if (newStatus === 'approved_today') {
			datePreset = 'today';
			const today = getTodayDateString();
			startDate = today;
			endDate = today;
		}
		loadAllPending();
	}

	function resetFilters() {
		statusFilter = 'pending';
		datePreset = 'all';
		startDate = '';
		endDate = '';
		searchQuery = '';
		loadAllPending();
	}

	function getRecipientLabel(type: string | undefined, id: number | string | undefined, item?: any): string {
		if (item?.recipientName) return item.recipientName;
		if (!id) return 'N/A';
		const rType = (type || '').toLowerCase().trim();
		const numericId = Number(id);

		if (rType === 'agent') {
			const ag = agentsList.find((a: any) => Number(a.id) === numericId);
			if (ag) {
				const name = ag.agencyName || ag.name || ag.fullName || `${ag.firstName || ''} ${ag.lastName || ''}`.trim();
				if (name) return name;
			}
			return `Agent #${id}`;
		}

		if (rType === 'head') {
			const hd = headsList.find((h: any) => Number(h.id) === numericId);
			if (hd) {
				const name = hd.fullName || hd.headName || hd.name || `${hd.firstName || ''} ${hd.lastName || ''}`.trim();
				if (name) return name;
			}
			return `Head #${id}`;
		}

		return `${type || 'Recipient'} #${id}`;
	}

	function getSupplierLabel(id: number): string {
		const s = suppliersList.find((sup: any) => Number(sup.id) === Number(id));
		if (s) return `${s.name} (${s.code})`;
		return `Supplier #${id}`;
	}

	function getCategoryLabel(categoryId: number): string {
		const cat = categoriesList.find((c) => Number(c.id) === Number(categoryId));
		if (cat) return `${cat.name} (${cat.category})`;
		return `Category #${categoryId}`;
	}

	function getCashAccountLabel(accId: number | null): string {
		if (!accId) return '';
		const acc = cashAccountsList.find((a) => Number(a.id) === Number(accId));
		if (acc) return `${acc.name}`;
		return `Cash Account #${accId}`;
	}

	function getBankAccountLabel(bankId: number | null): string {
		if (!bankId) return '';
		const b = bankAccountsList.find((x) => Number(x.id) === Number(bankId));
		if (b) return `${b.bankName}${b.accountNumber ? ` (${b.accountNumber})` : ''}`;
		return `Bank Account #${bankId}`;
	}

	function getPaymentChannelLabel(method: string, sourceAccountId: number | null, sourceBankId: number | null): string {
		const m = (method || '').toLowerCase();
		if (m === 'cash' || sourceAccountId) {
			const accName = getCashAccountLabel(sourceAccountId);
			return accName ? `Cash Account — ${accName}` : 'Cash Account';
		}
		if (m === 'bank' || m === 'bank_transfer' || sourceBankId) {
			const bankName = getBankAccountLabel(sourceBankId);
			return bankName ? `Bank Account — ${bankName}` : 'Bank Account';
		}
		return method || 'Cash / Bank Account';
	}

	async function loadAllPending() {
		loading = true;
		selectedKeys = [];
		try {
			let paStatus = 'pending';
			let expStatus = 'pending';
			let txnStatus = 'pending';
			let jrnStatus = 'pending';
			let prStatus = 'pending';
			let srStatus = 'pending';
			let spStatus = 'Pending';

			if (statusFilter === 'approved_today' || statusFilter === 'approved_all') {
				paStatus = 'approved';
				expStatus = 'approved';
				txnStatus = 'approved';
				jrnStatus = 'approved';
				prStatus = 'approved';
				srStatus = 'approved';
				spStatus = 'Approved';
			} else if (statusFilter === 'all') {
				paStatus = 'all';
				expStatus = 'all';
				txnStatus = 'all';
				jrnStatus = 'all';
				prStatus = 'all';
				srStatus = 'all';
				spStatus = 'all';
			}

			const [
				approvalsRes,
				expensesRes,
				transactionsRes,
				journalsRes,
				purchaseReturnsRes,
				salesReturnsRes,
				supplierPaymentsRes,
				suppliersRes,
				staffRes,
				headsRes,
				agentsRes,
				headersRes,
				cashRes,
				banksRes
			] = await Promise.all([
				apiFetch<PendingApprovalItem[]>(`api/pending-approvals?status=${paStatus}`).catch(() => []),
				apiFetch<PendingExpenseItem[]>('api/Expenses').catch(() => []),
				apiFetch<PendingTransactionItem[]>(`api/Transaction?status=${txnStatus}`).catch(() => []),
				apiFetch<PendingJournalItem[]>('api/JournalEntries').catch(() => []),
				apiFetch<any[]>(`api/purchase-returns?status=${prStatus}`).catch(() => []),
				apiFetch<any[]>(`api/sales-returns?status=${srStatus}`).catch(() => []),
				apiFetch<PendingSupplierSettlementItem[]>('api/supplier-payments', { params: { status: spStatus } }).catch(() => []),
				apiFetch<any[]>('api/supplier').catch(() => []),
				fetchAccountsStaff().catch(() => []),
				apiFetch<any>('api/sales-entries/heads?pageSize=500').catch(() => null),
				apiFetch<any>('api/agent').catch(() => null),
				getExpenseHeaders().catch(() => []),
				getAccounts().catch(() => []),
				getBanks().catch(() => [])
			]);

			pendingApprovals = approvalsRes || [];
			
			pendingExpenses = (expensesRes || []).filter((e) => {
				const st = (e.status || '').toLowerCase();
				if (expStatus === 'pending') return st === 'pendingapproval';
				if (expStatus === 'approved') return st === 'approved' || st === 'posted';
				return true;
			});

			pendingTransactions = (transactionsRes || []).filter((t) => {
				const st = (t.status || '').toLowerCase();
				const tt = (t.transactionType || '').toLowerCase();
				const isRelevant = tt === 'outgoing' || tt === 'contra';
				if (!isRelevant) return false;
				if (txnStatus === 'pending') return st === 'pending';
				if (txnStatus === 'approved') return st === 'approved' || st === 'posted';
				return true;
			});

			pendingJournals = (journalsRes || []).filter((j) => {
				const st = (j.status || '').toLowerCase();
				if (jrnStatus === 'pending') return st === 'pending';
				if (jrnStatus === 'approved') return st === 'approved' || st === 'posted';
				return true;
			});

			pendingPurchaseReturns = (purchaseReturnsRes || []).filter((r) => {
				const st = (r.status || '').toLowerCase();
				if (prStatus === 'pending') return st.includes('pending');
				if (prStatus === 'approved') return st.includes('approved') || st.includes('posted');
				return true;
			});

			pendingSalesReturns = (salesReturnsRes || []).filter((r) => {
				const st = (r.status || '').toLowerCase();
				if (srStatus === 'pending') return st.includes('pending');
				if (srStatus === 'approved') return st.includes('approved') || st.includes('posted');
				return true;
			});

			// Strictly isolate Supplier Deposits and Supplier Credit Settlements (Treasury only, no booking/operational payments)
			pendingSupplierSettlements = (supplierPaymentsRes || []).filter((p) => {
				const st = (p.serviceType || '').toLowerCase().trim();
				const isCredit = st === 'supplier_credit' || st.includes('credit');
				const isWallet = st === 'supplier_wallet' || st.includes('wallet') || st.includes('deposit');
				const isTreasury = !p.externalReference || p.externalReference.trim() === '';
				if (!((isCredit || isWallet) && isTreasury)) return false;

				const statusVal = (p.status || '').toLowerCase();
				if (spStatus === 'Pending') return statusVal === 'pending';
				if (spStatus === 'Approved') return statusVal === 'approved' || statusVal === 'posted';
				return true;
			});

			suppliersList = Array.isArray(suppliersRes) ? suppliersRes : (suppliersRes as any)?.items || [];
			staffUsers = staffRes || [];
			if (headsRes && headsRes.items) headsList = headsRes.items;
			if (agentsRes) agentsList = Array.isArray(agentsRes) ? agentsRes : (agentsRes.items || []);
			categoriesList = headersRes || [];
			cashAccountsList = cashRes || [];
			bankAccountsList = banksRes || [];
		} catch (err: any) {
			addToast(err.message || 'Failed to load requests.', 'error');
		} finally {
			loading = false;
		}
	}

	function getUserLabel(userId: number, directName?: string | null): string {
		if (directName && directName.trim() && !directName.startsWith('User #') && !directName.startsWith('Staff #')) {
			return directName;
		}
		if (!userId) return 'System User';
		const u = staffUsers.find((user) => Number(user.id) === Number(userId));
		if (u && (u.name || u.displayName)) {
			return u.name || u.displayName;
		}
		return `Staff #${userId}`;
	}

	function parsePayload(item: PendingApprovalItem): Record<string, any> {
		try {
			const raw = JSON.parse(item.payloadJson);
			if (!raw || typeof raw !== 'object') return {};
			const normalized: Record<string, any> = { ...raw };
			for (const key of Object.keys(raw)) {
				const lower = key.toLowerCase();
				if (normalized[lower] === undefined) {
					normalized[lower] = raw[key];
				}
				const camel = key.charAt(0).toLowerCase() + key.slice(1);
				if (normalized[camel] === undefined) {
					normalized[camel] = raw[key];
				}
			}
			return normalized;
		} catch {
			return {};
		}
	}

	function isWithinDateRange(dateStr: string | null | undefined): boolean {
		if (!dateStr) return true;
		const d = new Date(dateStr);
		if (isNaN(d.getTime())) return true;
		const parts = d.toISOString().split('T');
		const dateOnly = parts[0] || '';

		if (statusFilter === 'approved_today') {
			const today = getTodayDateString();
			return dateOnly === today;
		}

		if (startDate && dateOnly && dateOnly < startDate) return false;
		if (endDate && dateOnly && dateOnly > endDate) return false;
		return true;
	}

	function matchesSearch(text: string | null | undefined): boolean {
		if (!searchQuery.trim()) return true;
		if (!text) return false;
		return text.toLowerCase().includes(searchQuery.toLowerCase().trim());
	}

	// Filtered items derivations
	const filteredApprovals = $derived(() => {
		return pendingApprovals.filter((p) => {
			const dt = p.reviewedAt || p.submittedAt;
			if (!isWithinDateRange(dt)) return false;
			if (searchQuery.trim()) {
				const payload = parsePayload(p);
				const party = payload.name || payload.agencyName || payload.bankName || payload.firstName || '';
				const match = matchesSearch(p.entityType) || matchesSearch(p.submittedByName) || matchesSearch(p.reviewedByName) || matchesSearch(party) || matchesSearch(String(p.id));
				if (!match) return false;
			}
			return true;
		});
	});

	const filteredExpenses = $derived(() => {
		return pendingExpenses.filter((e) => {
			// Exclude contra-transfer expenses — these are treasury movements and
			// should only appear in the "Treasury Txns" tab, not "Payment Vouchers".
			const cat = categoriesList.find((c: any) => Number(c.id) === Number(e.expenseCategoryId));
			if (cat && (cat.category === 'Contra' || cat.name === 'Internal Contra Transfer')) return false;

			const dt = e.expenseDate || e.createdAt;
			if (!isWithinDateRange(dt)) return false;
			if (searchQuery.trim()) {
				const catLabel = getCategoryLabel(e.expenseCategoryId);
				const user = getUserLabel(e.createdBy);
				const match = matchesSearch(e.expenseNumber) || matchesSearch(e.description) || matchesSearch(e.notes) || matchesSearch(catLabel) || matchesSearch(user) || matchesSearch(String(e.amount));
				if (!match) return false;
			}
			return true;
		});
	});


	const filteredTransactions = $derived(() => {
		return pendingTransactions.filter((t) => {
			const dt = t.createdAt;
			if (!isWithinDateRange(dt)) return false;
			if (searchQuery.trim()) {
				const user = getUserLabel(t.createdBy, t.createdByName);
				const src = t.sourceAccountName || t.sourceBankName || '';
				const dest = t.destinationAccountName || t.destinationBankName || t.destinationParty?.name || '';
				const match =
					matchesSearch(String(t.id)) ||
					matchesSearch(t.transactionType) ||
					matchesSearch(t.description) ||
					matchesSearch(t.paymentMethod) ||
					matchesSearch(user) ||
					matchesSearch(src) ||
					matchesSearch(dest) ||
					matchesSearch(String(t.amount));
				if (!match) return false;
			}
			return true;
		});
	});

	const filteredJournals = $derived(() => {
		return pendingJournals.filter((j) => {
			const dt = j.approvedAt || j.createdAt;
			if (!isWithinDateRange(dt)) return false;
			if (searchQuery.trim()) {
				const match = matchesSearch(j.journalNumber) || matchesSearch(j.debitPartyName) || matchesSearch(j.creditPartyName) || matchesSearch(j.note) || matchesSearch(j.createdByName) || matchesSearch(String(j.amount));
				if (!match) return false;
			}
			return true;
		});
	});

	const filteredPurchaseReturns = $derived(() => {
		return pendingPurchaseReturns.filter((pr) => {
			const dt = pr.approvedAt || pr.requestedAt || pr.createdAt;
			if (!isWithinDateRange(dt)) return false;
			if (searchQuery.trim()) {
				const sup = getSupplierLabel(pr.supplierId);
				const user = getUserLabel(pr.requestedByUserId, pr.creatorName || pr.requestedByName);
				const match = matchesSearch(String(pr.id)) || matchesSearch(pr.documentNumber) || matchesSearch(sup) || matchesSearch(pr.reason) || matchesSearch(user) || matchesSearch(String(pr.amount));
				if (!match) return false;
			}
			return true;
		});
	});

	const filteredSalesReturns = $derived(() => {
		return pendingSalesReturns.filter((sr) => {
			const dt = sr.approvedAt || sr.requestedAt || sr.createdAt;
			if (!isWithinDateRange(dt)) return false;
			if (searchQuery.trim()) {
				const rec = getRecipientLabel(sr.recipientType, sr.recipientId, sr);
				const user = getUserLabel(sr.requestedByUserId, sr.creatorName || sr.requestedByName);
				const match = matchesSearch(String(sr.id)) || matchesSearch(sr.documentNumber) || matchesSearch(rec) || matchesSearch(sr.reason) || matchesSearch(user) || matchesSearch(String(sr.amount));
				if (!match) return false;
			}
			return true;
		});
	});

	const filteredSupplierSettlements = $derived(() => {
		return pendingSupplierSettlements.filter((s) => {
			const dt = s.requestedAt || s.createdAt;
			if (!isWithinDateRange(dt)) return false;
			if (searchQuery.trim()) {
				const sup = getSupplierLabel(s.supplierId);
				const user = getUserLabel(s.requestedByUserId || s.createdBy || 0, s.requestedByName);
				const match =
					matchesSearch(String(s.id)) ||
					matchesSearch(s.documentNumber) ||
					matchesSearch(s.referenceNumber) ||
					matchesSearch(sup) ||
					matchesSearch(s.description) ||
					matchesSearch(user) ||
					matchesSearch(s.serviceType) ||
					matchesSearch(s.paymentMethod) ||
					matchesSearch(String(s.amount));
				if (!match) return false;
			}
			return true;
		});
	});

	// Visible keys derivation based on active tab and filtered results
	const visibleKeys = $derived(() => {
		const keys: string[] = [];

		for (const p of filteredApprovals()) {
			const type = (p.entityType || '').toLowerCase();
			const isHeader = type === 'payment_header' || type === 'account_category' || type === 'expense_header';
			const isAgent = type === 'agent';
			const isSupplier = type === 'supplier';
			const isBank = type === 'bank';
			const isAccount = type === 'account';

			if (activeTab === 'all' || (activeTab === 'headers' && isHeader) || (activeTab === 'agents' && isAgent) || (activeTab === 'suppliers' && isSupplier) || (activeTab === 'banks' && isBank) || (activeTab === 'accounts' && isAccount)) {
				keys.push(`approval-${p.id}`);
			}
		}

		if (activeTab === 'all' || activeTab === 'expenses') {
			for (const exp of filteredExpenses()) {
				keys.push(`expense-${exp.id}`);
			}
		}

		if (activeTab === 'all' || activeTab === 'transactions') {
			for (const tx of filteredTransactions()) {
				keys.push(`txn-${tx.id}`);
			}
		}

		if (activeTab === 'all' || activeTab === 'journals') {
			for (const j of filteredJournals()) {
				keys.push(`journal-${j.id}`);
			}
		}

		if (activeTab === 'all' || activeTab === 'purchase_returns') {
			for (const pr of filteredPurchaseReturns()) {
				keys.push(`purchase_return-${pr.id}`);
			}
		}

		if (activeTab === 'all' || activeTab === 'sales_returns') {
			for (const sr of filteredSalesReturns()) {
				keys.push(`sales_return-${sr.id}`);
			}
		}

		if (activeTab === 'all' || activeTab === 'supplier_settlements') {
			for (const sp of filteredSupplierSettlements()) {
				keys.push(`supplier_settlement-${sp.id}`);
			}
		}

		return keys;
	});

	const isAllSelected = $derived(
		visibleKeys().length > 0 && visibleKeys().every((k) => selectedKeys.includes(k))
	);

	function toggleSelect(key: string) {
		if (selectedKeys.includes(key)) {
			selectedKeys = selectedKeys.filter((k) => k !== key);
		} else {
			selectedKeys = [...selectedKeys, key];
		}
	}

	function toggleSelectAll() {
		const allKeys = visibleKeys();
		if (isAllSelected) {
			selectedKeys = selectedKeys.filter((k) => !allKeys.includes(k));
		} else {
			const union = new Set([...selectedKeys, ...allKeys]);
			selectedKeys = Array.from(union);
		}
	}

	// Entity type counts based on filtered items
	const counts = $derived(() => {
		let headersCount = 0;
		let agentsCount = 0;
		let suppliersCount = 0;
		let banksCount = 0;
		let accountsCount = 0;

		for (const p of filteredApprovals()) {
			const type = (p.entityType || '').toLowerCase();
			if (type === 'payment_header' || type === 'account_category' || type === 'expense_header') {
				headersCount++;
			} else if (type === 'agent') {
				agentsCount++;
			} else if (type === 'supplier') {
				suppliersCount++;
			} else if (type === 'bank') {
				banksCount++;
			} else if (type === 'account') {
				accountsCount++;
			}
		}

		const expensesCount = filteredExpenses().length;
		const transactionsCount = filteredTransactions().length;
		const journalsCount = filteredJournals().length;
		const purchaseReturnsCount = filteredPurchaseReturns().length;
		const salesReturnsCount = filteredSalesReturns().length;
		const supplierSettlementsCount = filteredSupplierSettlements().length;
		const total = filteredApprovals().length + expensesCount + transactionsCount + journalsCount + purchaseReturnsCount + salesReturnsCount + supplierSettlementsCount;

		// Calculate total financial amount across pending financial requests
		const financialTotal = 
			filteredExpenses().reduce((sum, e) => sum + (e.amount || 0), 0) +
			filteredTransactions().reduce((sum, t) => sum + (t.amount || 0), 0) +
			filteredJournals().reduce((sum, j) => sum + (j.amount || 0), 0) +
			filteredPurchaseReturns().reduce((sum, pr) => sum + (pr.amount || 0), 0) +
			filteredSalesReturns().reduce((sum, sr) => sum + (sr.amount || 0), 0) +
			filteredSupplierSettlements().reduce((sum, sp) => sum + (sp.amount || 0), 0);

		return {
			total,
			headers: headersCount,
			expenses: expensesCount,
			transactions: transactionsCount,
			journals: journalsCount,
			agents: agentsCount,
			suppliers: suppliersCount,
			banks: banksCount,
			accounts: accountsCount,
			purchaseReturns: purchaseReturnsCount,
			salesReturns: salesReturnsCount,
			supplierSettlements: supplierSettlementsCount,
			financialTotal
		};
	});

	// CSV Export Handler
	function exportCurrentToCSV() {
		const rows: (string | number | null | undefined)[][] = [];

		const headers = [
			'Category / Type',
			'Document / Reference #',
			'Party / Beneficiary',
			'Amount (BHD)',
			'Payment Channel',
			'Description / Narration',
			'Submitted By',
			'Submitted Date',
			'Status',
			'Reviewed / Approved By',
			'Reviewed / Approved Date'
		];

		if (activeTab === 'all' || activeTab === 'headers' || activeTab === 'agents' || activeTab === 'suppliers' || activeTab === 'banks' || activeTab === 'accounts') {
			for (const p of filteredApprovals()) {
				const type = (p.entityType || '').toLowerCase();
				const isHeader = type === 'payment_header' || type === 'account_category' || type === 'expense_header';
				const isAgent = type === 'agent';
				const isSupplier = type === 'supplier';
				const isBank = type === 'bank';
				const isAccount = type === 'account';

				if (activeTab === 'all' || (activeTab === 'headers' && isHeader) || (activeTab === 'agents' && isAgent) || (activeTab === 'suppliers' && isSupplier) || (activeTab === 'banks' && isBank) || (activeTab === 'accounts' && isAccount)) {
					const payload = parsePayload(p);
					const party = payload.name || payload.agencyName || payload.bankName || `${payload.firstName || ''} ${payload.lastName || ''}`.trim() || '—';
					rows.push([
						`${p.entityType.toUpperCase()} REGISTRATION`,
						`PA-${p.id}`,
						party,
						'—',
						'—',
						'Entity registration request',
						p.submittedByName,
						formatDateTime(p.submittedAt),
						p.status.toUpperCase(),
						p.reviewedByName || '—',
						p.reviewedAt ? formatDateTime(p.reviewedAt) : '—'
					]);
				}
			}
		}

		if (activeTab === 'all' || activeTab === 'expenses') {
			for (const exp of filteredExpenses()) {
				rows.push([
					'PAYMENT VOUCHER',
					exp.expenseNumber,
					getCategoryLabel(exp.expenseCategoryId),
					exp.amount.toFixed(3),
					getPaymentChannelLabel(exp.paymentMethod, exp.sourceAccountId, exp.sourceBankId),
					exp.description || exp.notes || 'Expense Payment',
					getUserLabel(exp.createdBy),
					formatDateTime(exp.expenseDate || exp.createdAt),
					exp.status.toUpperCase(),
					'Master Accountant',
					'—'
				]);
			}
		}

		if (activeTab === 'all' || activeTab === 'transactions') {
			for (const tx of filteredTransactions()) {
				const isTxContra = (tx.transactionType || '').toLowerCase() === 'contra';
				const txDest = tx.destinationAccountName || tx.destinationBankName || (tx.destinationAccountId ? getCashAccountLabel(tx.destinationAccountId) : (tx.destinationBankId ? getBankAccountLabel(tx.destinationBankId) : ''));
				const channelLabel = isTxContra && txDest
					? `${tx.sourceAccountName || tx.sourceBankName || 'Internal'} → ${txDest}`
					: (tx.sourceAccountName || tx.sourceBankName || getPaymentChannelLabel(tx.paymentMethod, null, null));

				rows.push([
					`${tx.transactionType.toUpperCase()} TRANSACTION`,
					`TXN-${tx.id}`,
					channelLabel,
					tx.amount.toFixed(3),
					tx.paymentMethod,
					tx.description || 'Treasury Movement',
					getUserLabel(tx.createdBy, tx.createdByName),
					formatDateTime(tx.createdAt),
					tx.status.toUpperCase(),
					'Master Accountant',
					'—'
				]);
			}
		}

		if (activeTab === 'all' || activeTab === 'journals') {
			for (const j of filteredJournals()) {
				rows.push([
					'PARTY TRANSFER JOURNAL',
					j.journalNumber,
					`${j.debitPartyName} → ${j.creditPartyName}`,
					j.amount.toFixed(3),
					'Party Wallet Transfer',
					j.note || j.transferReference || 'Inter-party transfer',
					j.createdByName || 'System User',
					formatDateTime(j.createdAt),
					j.status.toUpperCase(),
					j.approvedByName || '—',
					j.approvedAt ? formatDateTime(j.approvedAt) : '—'
				]);
			}
		}

		if (activeTab === 'all' || activeTab === 'purchase_returns') {
			for (const pr of filteredPurchaseReturns()) {
				rows.push([
					'PURCHASE RETURN',
					pr.documentNumber || `PR-${pr.id}`,
					getSupplierLabel(pr.supplierId),
					pr.amount.toFixed(3),
					getPaymentChannelLabel(pr.destinationType || 'cash', pr.destinationAccountId, pr.destinationBankId),
					pr.reason || pr.originalPurchaseReference || 'Supplier return',
					getUserLabel(pr.requestedByUserId, pr.creatorName || pr.requestedByName),
					formatDateTime(pr.requestedAt || pr.createdAt),
					(pr.status || 'PENDING').toUpperCase(),
					pr.approvedByUserName || '—',
					pr.approvedAt ? formatDateTime(pr.approvedAt) : '—'
				]);
			}
		}

		if (activeTab === 'all' || activeTab === 'sales_returns') {
			for (const sr of filteredSalesReturns()) {
				rows.push([
					'SALES RETURN',
					sr.documentNumber || `SR-${sr.id}`,
					getRecipientLabel(sr.recipientType, sr.recipientId, sr),
					sr.amount.toFixed(3),
					getPaymentChannelLabel(sr.sourceType || 'cash', sr.sourceAccountId, sr.sourceBankId),
					sr.reason || sr.originalSaleReference || 'Sales return refund',
					getUserLabel(sr.requestedByUserId, sr.creatorName || sr.requestedByName),
					formatDateTime(sr.requestedAt || sr.createdAt),
					(sr.status || 'PENDING').toUpperCase(),
					sr.approvedByUserName || '—',
					sr.approvedAt ? formatDateTime(sr.approvedAt) : '—'
				]);
			}
		}

		if (activeTab === 'all' || activeTab === 'supplier_settlements') {
			for (const sp of filteredSupplierSettlements()) {
				const st = (sp.serviceType || '').toLowerCase();
				const isCredit = st.includes('credit');
				rows.push([
					isCredit ? 'SUPPLIER CREDIT SETTLEMENT' : 'SUPPLIER DEPOSIT (WALLET)',
					sp.documentNumber || `SP-${sp.id}`,
					getSupplierLabel(sp.supplierId),
					sp.amount.toFixed(3),
					getPaymentChannelLabel(sp.paymentMethod, sp.sourceAccountId || null, sp.sourceBankId || null),
					sp.description || (isCredit ? 'Credit debt settlement' : 'Prepaid wallet deposit'),
					getUserLabel(sp.requestedByUserId || sp.createdBy || 0, sp.requestedByName),
					formatDateTime(sp.requestedAt || sp.createdAt),
					(sp.status || 'PENDING').toUpperCase(),
					'Master Accountant',
					'—'
				]);
			}
		}

		if (rows.length === 0) {
			addToast('No records available to export for current filter.', 'info');
			return;
		}

		const todayStr = getTodayDateString();
		const filename = `${statusFilter}_approvals_export_${todayStr}.csv`;
		exportToCSV(filename, headers, rows);
		addToast(`Exported ${rows.length} record(s) to CSV.`, 'success');
	}

	// Server-Sided PDF Export Handler
	async function exportCurrentToPDF() {
		isExportingPdf = true;
		try {
			const todayStr = getTodayDateString();
			await previewDocument('report', 'pending-approvals', {
				status: statusFilter,
				startDate: startDate || (datePreset === 'today' || statusFilter === 'approved_today' ? todayStr : undefined),
				endDate: endDate || (datePreset === 'today' || statusFilter === 'approved_today' ? todayStr : undefined),
				approvedToday: statusFilter === 'approved_today' ? 'true' : 'false'
			});
			addToast('Generated PDF audit statement.', 'success');
		} catch (err: any) {
			addToast(err.message || 'Failed to export PDF.', 'error');
		} finally {
			isExportingPdf = false;
		}
	}

	// Actions for PendingApprovals API items
	async function approvePendingItem(item: PendingApprovalItem) {
		processingId = `approval-${item.id}`;
		processingAction = 'approve';
		try {
			await apiFetch(`api/pending-approvals/${item.id}/approve`, { method: 'POST' });
			addToast(`Approved ${item.entityType.replace('_', ' ')} request successfully.`, 'success');
			await loadAllPending();
		} catch (err: any) {
			addToast(err.message || 'Approval failed.', 'error');
		} finally {
			processingId = null;
			processingAction = null;
		}
	}

	function openRejectModalForApprovalItem(item: PendingApprovalItem) {
		rejectionTarget = { type: 'single-approval', item };
		rejectionReason = 'Rejected by Master Accountant';
		rejectionModalOpen = true;
	}

	function openRejectModalForExpenseItem(expense: PendingExpenseItem) {
		rejectionTarget = { type: 'single-expense', item: expense };
		rejectionReason = 'Rejected by Master Accountant';
		rejectionModalOpen = true;
	}

	function openRejectModalForTransactionItem(txn: PendingTransactionItem) {
		rejectionTarget = { type: 'single-transaction', item: txn };
		rejectionReason = 'Rejected by Master Accountant';
		rejectionModalOpen = true;
	}

	function openRejectModalForJournalItem(journal: PendingJournalItem) {
		rejectionTarget = { type: 'single-journal', item: journal };
		rejectionReason = 'Rejected by Master Accountant';
		rejectionModalOpen = true;
	}

	function openRejectModalForPurchaseReturnItem(item: any) {
		rejectionTarget = { type: 'single-purchase-return', item };
		rejectionReason = 'Rejected by Master Accountant';
		rejectionModalOpen = true;
	}

	function openRejectModalForSalesReturnItem(item: any) {
		rejectionTarget = { type: 'single-sales-return', item };
		rejectionReason = 'Rejected by Master Accountant';
		rejectionModalOpen = true;
	}

	function openBulkRejectModal() {
		if (selectedKeys.length === 0) return;
		rejectionTarget = { type: 'bulk' };
		rejectionReason = 'Bulk rejected by Master Accountant';
		rejectionModalOpen = true;
	}

	async function confirmRejectionModal() {
		if (!rejectionTarget) return;
		isRejectingModal = true;
		processingAction = 'reject';

		try {
			if (rejectionTarget.type === 'single-approval' && rejectionTarget.item) {
				const item = rejectionTarget.item as PendingApprovalItem;
				processingId = `approval-${item.id}`;
				try {
					await apiFetch(`api/pending-approvals/${item.id}/reject`, { method: 'POST' });
					addToast('Request rejected.', 'success');
					await loadAllPending();
				} catch (err: any) {
					addToast(err.message || 'Rejection failed.', 'error');
				}
			} else if (rejectionTarget.type === 'single-expense' && rejectionTarget.item) {
				const expense = rejectionTarget.item as PendingExpenseItem;
				processingId = `expense-${expense.id}`;
				try {
					await rejectExpense(expense.id, { reason: rejectionReason || 'Rejected by Master Accountant' });
					addToast(`Payment voucher ${expense.expenseNumber} rejected.`, 'success');
					await loadAllPending();
				} catch (err: any) {
					addToast(err.message || 'Expense rejection failed.', 'error');
				}
			} else if (rejectionTarget.type === 'single-transaction' && rejectionTarget.item) {
				const txn = rejectionTarget.item as PendingTransactionItem;
				processingId = `txn-${txn.id}`;
				try {
					await apiFetch(`api/Transaction/${txn.id}/reject`, {
						method: 'POST',
						body: JSON.stringify({ reason: rejectionReason || 'Rejected by Master Accountant' })
					});
					addToast(`Transaction #${txn.id} rejected.`, 'success');
					await loadAllPending();
				} catch (err: any) {
					addToast(err.message || 'Transaction rejection failed.', 'error');
				}
			} else if (rejectionTarget.type === 'single-journal' && rejectionTarget.item) {
				const journal = rejectionTarget.item as PendingJournalItem;
				processingId = `journal-${journal.id}`;
				try {
					await apiFetch(`api/JournalEntries/${journal.id}/reject`, { method: 'POST' });
					addToast(`Party Transfer Journal ${journal.journalNumber} rejected.`, 'success');
					await loadAllPending();
				} catch (err: any) {
					addToast(err.message || 'Journal rejection failed.', 'error');
				}
			} else if (rejectionTarget.type === 'single-purchase-return' && rejectionTarget.item) {
				const item = rejectionTarget.item as any;
				processingId = `purchase_return-${item.id}`;
				try {
					await rejectPurchaseReturn(item.id, rejectionReason || 'Rejected by Master Accountant');
					addToast('Purchase Return rejected.', 'success');
					await loadAllPending();
				} catch (err: any) {
					addToast(err.message || 'Rejection failed.', 'error');
				}
			} else if (rejectionTarget.type === 'single-sales-return' && rejectionTarget.item) {
				const item = rejectionTarget.item as any;
				processingId = `sales_return-${item.id}`;
				try {
					await rejectSalesReturn(item.id, rejectionReason || 'Rejected by Accountant');
					addToast('Sales Return rejected.', 'success');
					await loadAllPending();
				} catch (err: any) {
					addToast(err.message || 'Rejection failed.', 'error');
				}
			} else if (rejectionTarget.type === 'single-supplier-settlement' && rejectionTarget.item) {
				const item = rejectionTarget.item as PendingSupplierSettlementItem;
				processingId = `supplier_settlement-${item.id}`;
				try {
					await rejectSupplierPayment(item.id, rejectionReason || 'Rejected by Master Accountant');
					addToast('Supplier settlement rejected.', 'success');
					await loadAllPending();
				} catch (err: any) {
					addToast(err.message || 'Rejection failed.', 'error');
				}
			} else if (rejectionTarget.type === 'bulk') {
				isBulkProcessing = true;
				let successCount = 0;
				let failCount = 0;

				for (const key of selectedKeys) {
					try {
						if (key.startsWith('approval-')) {
							const id = parseInt(key.replace('approval-', ''), 10);
							await apiFetch(`api/pending-approvals/${id}/reject`, { method: 'POST' });
							successCount++;
						} else if (key.startsWith('expense-')) {
							const id = parseInt(key.replace('expense-', ''), 10);
							await rejectExpense(id, { reason: rejectionReason || 'Bulk rejected by Master Accountant' });
							successCount++;
						} else if (key.startsWith('txn-')) {
							const id = parseInt(key.replace('txn-', ''), 10);
							await apiFetch(`api/Transaction/${id}/reject`, {
								method: 'POST',
								body: JSON.stringify({ reason: rejectionReason || 'Bulk rejected by Master Accountant' })
							});
							successCount++;
						} else if (key.startsWith('journal-')) {
							const id = parseInt(key.replace('journal-', ''), 10);
							await apiFetch(`api/JournalEntries/${id}/reject`, { method: 'POST' });
							successCount++;
						} else if (key.startsWith('purchase_return-')) {
							const id = parseInt(key.replace('purchase_return-', ''), 10);
							await rejectPurchaseReturn(id, rejectionReason || 'Bulk rejected by Master Accountant');
							successCount++;
						} else if (key.startsWith('sales_return-')) {
							const id = parseInt(key.replace('sales_return-', ''), 10);
							await rejectSalesReturn(id, rejectionReason || 'Bulk rejected by Accountant');
							successCount++;
						} else if (key.startsWith('supplier_settlement-')) {
							const id = parseInt(key.replace('supplier_settlement-', ''), 10);
							await rejectSupplierPayment(id, rejectionReason || 'Bulk rejected by Master Accountant');
							successCount++;
						}
					} catch (err) {
						failCount++;
					}
				}

				isBulkProcessing = false;
				if (successCount > 0) {
					addToast(`Bulk rejected ${successCount} request${successCount === 1 ? '' : 's'}.`, 'success');
				}
				if (failCount > 0) {
					addToast(`Failed to reject ${failCount} request${failCount === 1 ? '' : 's'}.`, 'error');
				}
				await loadAllPending();
			}
		} finally {
			isRejectingModal = false;
			processingId = null;
			processingAction = null;
			rejectionModalOpen = false;
			rejectionTarget = null;
		}
	}

	// Actions for Pending Expenses (Payment Vouchers)
	async function handleApproveExpense(expense: PendingExpenseItem) {
		processingId = `expense-${expense.id}`;
		processingAction = 'approve';
		try {
			await approveExpense(expense.id);
			addToast(`Payment voucher ${expense.expenseNumber} approved and posted.`, 'success');
			await loadAllPending();
		} catch (err: any) {
			addToast(err.message || 'Expense approval failed.', 'error');
		} finally {
			processingId = null;
			processingAction = null;
		}
	}

	// Actions for Pending Transactions
	async function handleApproveTransaction(txn: PendingTransactionItem) {
		processingId = `txn-${txn.id}`;
		processingAction = 'approve';
		try {
			await apiFetch(`api/Transaction/${txn.id}/approve`, { method: 'POST' });
			addToast(`Transaction #${txn.id} approved and posted.`, 'success');
			await loadAllPending();
		} catch (err: any) {
			addToast(err.message || 'Transaction approval failed.', 'error');
		} finally {
			processingId = null;
			processingAction = null;
		}
	}

	// Actions for Pending Journals
	async function handleApproveJournal(journal: PendingJournalItem) {
		processingId = `journal-${journal.id}`;
		processingAction = 'approve';
		try {
			await apiFetch(`api/JournalEntries/${journal.id}/approve`, {
				method: 'POST',
				headers: {
					'Idempotency-Key': `approve-journal-${journal.id}-${Date.now()}`,
					'Row-Version': journal.rowVersion || ''
				}
			});
			addToast(`Party Transfer Journal ${journal.journalNumber} approved and posted.`, 'success');
			await loadAllPending();
		} catch (err: any) {
			addToast(err.message || 'Journal approval failed.', 'error');
		} finally {
			processingId = null;
			processingAction = null;
		}
	}

	async function handleApprovePurchaseReturn(item: any) {
		processingId = `purchase_return-${item.id}`;
		processingAction = 'approve';
		try {
			await approvePurchaseReturn(item.id);
			addToast('Approved purchase return successfully.', 'success');
			await loadAllPending();
		} catch (err: any) {
			addToast(err.message || 'Approval failed.', 'error');
		} finally {
			processingId = null;
			processingAction = null;
		}
	}

	async function handleApproveSalesReturn(item: any) {
		processingId = `sales_return-${item.id}`;
		processingAction = 'approve';
		try {
			await approveSalesReturn(item.id);
			addToast('Approved sales return successfully.', 'success');
			await loadAllPending();
		} catch (err: any) {
			addToast(err.message || 'Approval failed.', 'error');
		} finally {
			processingId = null;
			processingAction = null;
		}
	}

	async function handleApproveSupplierSettlement(item: PendingSupplierSettlementItem) {
		processingId = `supplier_settlement-${item.id}`;
		processingAction = 'approve';
		try {
			await approveSupplierPayment(item.id, item.rowVersion);
			const st = (item.serviceType || '').toLowerCase();
			const label = st.includes('credit') ? 'Supplier Credit Settlement' : 'Supplier Deposit';
			addToast(`${label} approved successfully.`, 'success');
			await loadAllPending();
		} catch (err: any) {
			addToast(err.message || 'Approval failed.', 'error');
		} finally {
			processingId = null;
			processingAction = null;
		}
	}

	function openRejectModalForSupplierSettlement(item: PendingSupplierSettlementItem) {
		rejectionTarget = { type: 'single-supplier-settlement', item };
		const st = (item.serviceType || '').toLowerCase();
		const label = st.includes('credit') ? 'Supplier Credit Settlement' : 'Supplier Deposit';
		rejectionReason = `Rejected ${label} by Master Accountant`;
		rejectionModalOpen = true;
	}

	// Bulk Actions
	async function executeBulkApprove() {
		if (selectedKeys.length === 0) return;
		isBulkProcessing = true;
		processingAction = 'approve';
		let successCount = 0;
		let failCount = 0;

		try {
			for (const key of selectedKeys) {
				try {
					if (key.startsWith('approval-')) {
						const id = parseInt(key.replace('approval-', ''), 10);
						await apiFetch(`api/pending-approvals/${id}/approve`, { method: 'POST' });
						successCount++;
					} else if (key.startsWith('expense-')) {
						const id = parseInt(key.replace('expense-', ''), 10);
						await approveExpense(id);
						successCount++;
					} else if (key.startsWith('txn-')) {
						const id = parseInt(key.replace('txn-', ''), 10);
						await apiFetch(`api/Transaction/${id}/approve`, { method: 'POST' });
						successCount++;
					} else if (key.startsWith('journal-')) {
						const id = parseInt(key.replace('journal-', ''), 10);
						const journal = pendingJournals.find((j) => j.id === id);
						await apiFetch(`api/JournalEntries/${id}/approve`, {
							method: 'POST',
							headers: {
								'Idempotency-Key': `approve-journal-${id}-${Date.now()}`,
								'Row-Version': journal?.rowVersion || ''
							}
						});
						successCount++;
					} else if (key.startsWith('purchase_return-')) {
						const id = parseInt(key.replace('purchase_return-', ''), 10);
						await approvePurchaseReturn(id);
						successCount++;
					} else if (key.startsWith('sales_return-')) {
						const id = parseInt(key.replace('sales_return-', ''), 10);
						await approveSalesReturn(id);
						successCount++;
					} else if (key.startsWith('supplier_settlement-')) {
						const id = parseInt(key.replace('supplier_settlement-', ''), 10);
						const sp = pendingSupplierSettlements.find((s) => s.id === id);
						await approveSupplierPayment(id, sp?.rowVersion);
						successCount++;
					}
				} catch (err) {
					failCount++;
				}
			}

			if (successCount > 0) {
				addToast(`Bulk approved ${successCount} request${successCount === 1 ? '' : 's'} successfully.`, 'success');
			}
			if (failCount > 0) {
				addToast(`Failed to approve ${failCount} request${failCount === 1 ? '' : 's'}.`, 'error');
			}
			await loadAllPending();
		} finally {
			isBulkProcessing = false;
			processingAction = null;
		}
	}

	onMount(() => {
		if (!hasRole('master_accountant')) {
			addToast('Pending Approvals is only accessible for Master Accountants.', 'error');
			goto('/payments');
			return;
		}
		loadAllPending();
	});
</script>

<svelte:head>
	<title>Pending Approvals — Accounts Portal</title>
</svelte:head>

<div class="space-y-6 pb-24 font-sans max-w-7xl mx-auto">
	<!-- Top Executive Header & Action Hub -->
	<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card border border-border/80 rounded-3xl p-6 shadow-xs relative overflow-hidden">
		<div class="space-y-1.5 z-10">
			<div class="flex items-center gap-2.5 flex-wrap">
				<div class="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center shadow-xs">
					<CheckSquare class="h-5 w-5" />
				</div>
				<h1 class="text-xl font-bold tracking-tight text-foreground">
					Approvals Command Center
				</h1>
				<Badge variant="outline" class="bg-primary/5 text-primary border-primary/20 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
					Master Accountant
				</Badge>
			</div>
			<p class="text-xs text-muted-foreground max-w-2xl leading-relaxed">
				Centralized multi-channel verification hub. Authorize, review, or dispute entity master registrations, party transfers, supplier returns, and payment vouchers.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2.5 z-10 shrink-0">
			<Button
				variant="outline"
				size="sm"
				class="h-9 px-3.5 rounded-xl cursor-pointer flex items-center gap-2 text-xs font-semibold hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all shadow-xs"
				onclick={exportCurrentToCSV}
				disabled={loading || counts().total === 0}
			>
				<Download class="h-3.5 w-3.5 text-emerald-600" />
				<span>Export CSV</span>
			</Button>

			<Button
				variant="outline"
				size="sm"
				class="h-9 px-3.5 rounded-xl cursor-pointer flex items-center gap-2 text-xs font-semibold hover:border-blue-500/30 hover:bg-blue-500/5 transition-all shadow-xs"
				onclick={exportCurrentToPDF}
				disabled={loading || isExportingPdf || counts().total === 0}
			>
				<FileText class="h-3.5 w-3.5 text-blue-600" />
				<span>{isExportingPdf ? 'Exporting...' : 'Export PDF'}</span>
			</Button>

			<Button
				variant="outline"
				size="sm"
				class="h-9 px-3.5 rounded-xl cursor-pointer flex items-center gap-2 text-xs font-semibold hover:bg-muted/60 transition-all shadow-xs"
				onclick={loadAllPending}
				disabled={loading || isBulkProcessing}
			>
				<RefreshCw class="h-3.5 w-3.5 text-foreground {loading ? 'animate-spin' : ''}" />
				<span>Refresh</span>
			</Button>
		</div>
	</div>

	<!-- Refined Filter Panel -->
	<div class="bg-card border border-border rounded-3xl p-5 shadow-xs space-y-4">
		<!-- First Row: Status Segmentation & Quick Presets -->
		<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
			<!-- Status Filters -->
			<div class="space-y-1.5">
				<span class="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
					<Filter class="h-3 w-3 text-primary" />
					Audit Status Scope
				</span>
				<div class="flex flex-wrap items-center bg-muted/40 p-1 rounded-xl border border-border/80 gap-1">
					<button
						onclick={() => handleStatusFilterChange('pending')}
						class={[
							'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
							statusFilter === 'pending'
								? 'bg-amber-500 text-white shadow-xs'
								: 'text-muted-foreground hover:text-foreground'
						].join(' ')}
					>
						<Clock class="h-3.5 w-3.5" />
						<span>Pending Review</span>
						{#if statusFilter === 'pending' && counts().total > 0}
							<span class="px-1.5 py-0.2 bg-white/20 text-white rounded text-[10px] font-bold">
								{counts().total}
							</span>
						{/if}
					</button>

					<button
						onclick={() => handleStatusFilterChange('approved_today')}
						class={[
							'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
							statusFilter === 'approved_today'
								? 'bg-emerald-600 text-white shadow-xs'
								: 'text-muted-foreground hover:text-foreground'
						].join(' ')}
					>
						<CheckCircle2 class="h-3.5 w-3.5" />
						<span>Approved Today</span>
					</button>

					<button
						onclick={() => handleStatusFilterChange('approved_all')}
						class={[
							'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
							statusFilter === 'approved_all'
								? 'bg-emerald-700 text-white shadow-xs'
								: 'text-muted-foreground hover:text-foreground'
						].join(' ')}
					>
						<Check class="h-3.5 w-3.5" />
						<span>All Approved History</span>
					</button>

					<button
						onclick={() => handleStatusFilterChange('all')}
						class={[
							'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
							statusFilter === 'all'
								? 'bg-primary text-primary-foreground shadow-xs'
								: 'text-muted-foreground hover:text-foreground'
						].join(' ')}
					>
						<span>All Statuses</span>
					</button>
				</div>
			</div>

			<!-- Date Range Presets -->
			<div class="space-y-1.5">
				<span class="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
					<Calendar class="h-3 w-3 text-primary" />
					Timeline Scope
				</span>
				<div class="flex flex-wrap items-center bg-muted/40 p-1 rounded-xl border border-border/80 gap-1">
					<button
						onclick={() => handleDatePresetChange('all')}
						class={[
							'px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
							datePreset === 'all' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
						].join(' ')}
					>
						All Time
					</button>
					<button
						onclick={() => handleDatePresetChange('today')}
						class={[
							'px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
							datePreset === 'today' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
						].join(' ')}
					>
						Today
					</button>
					<button
						onclick={() => handleDatePresetChange('yesterday')}
						class={[
							'px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
							datePreset === 'yesterday' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
						].join(' ')}
					>
						Yesterday
					</button>
					<button
						onclick={() => handleDatePresetChange('this_week')}
						class={[
							'px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
							datePreset === 'this_week' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
						].join(' ')}
					>
						This Week
					</button>
					<button
						onclick={() => handleDatePresetChange('this_month')}
						class={[
							'px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
							datePreset === 'this_month' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
						].join(' ')}
					>
						This Month
					</button>
				</div>
			</div>
		</div>

		<!-- Second Row: Custom Dates + Live Search + Reset -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/60">
			<div class="flex flex-wrap items-center gap-3">
				<div class="flex items-center gap-2">
					<span class="text-xs text-muted-foreground font-semibold">From:</span>
					<input
						type="date"
						bind:value={startDate}
						onchange={() => { datePreset = 'custom'; loadAllPending(); }}
						class="text-xs p-2 border border-border rounded-xl bg-background text-foreground focus:outline-none cursor-pointer shadow-xs"
					/>
				</div>
				<div class="flex items-center gap-2">
					<span class="text-xs text-muted-foreground font-semibold">To:</span>
					<input
						type="date"
						bind:value={endDate}
						onchange={() => { datePreset = 'custom'; loadAllPending(); }}
						class="text-xs p-2 border border-border rounded-xl bg-background text-foreground focus:outline-none cursor-pointer shadow-xs"
					/>
				</div>
				{#if startDate || endDate || searchQuery || statusFilter !== 'pending' || datePreset !== 'all'}
					<Button
						variant="ghost"
						size="sm"
						onclick={resetFilters}
						class="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-xl cursor-pointer flex items-center gap-1.5 border border-border/60"
					>
						<RotateCcw class="h-3.5 w-3.5" />
						<span>Reset Filters</span>
					</Button>
				{/if}
			</div>

			<div class="relative min-w-[280px] max-w-md w-full sm:w-auto">
				<Search class="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
				<input
					type="text"
					placeholder="Search reference #, submitter, beneficiary, amount..."
					bind:value={searchQuery}
					class="w-full pl-9.5 pr-8 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground shadow-xs"
				/>
				{#if searchQuery}
					<button
						type="button"
						onclick={() => (searchQuery = '')}
						class="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
					>
						<X class="h-3.5 w-3.5" />
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Not Accountant Alert Box -->
	{#if !hasRole('accountant')}
		<Alert.Root class="rounded-2xl border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 p-4">
			<AlertCircle class="h-4 w-4 text-amber-500" />
			<Alert.Title class="font-bold text-xs">Read-Only Approvals View</Alert.Title>
			<Alert.Description class="text-xs text-amber-700/80 dark:text-amber-400/80">
				You are viewing submitted approval requests. Only authorized accounting staff can approve or reject items.
			</Alert.Description>
		</Alert.Root>
	{/if}

	<!-- Category Segment Tabs -->
	<div class="flex items-center gap-2 overflow-x-auto pb-1 border-b border-border/80 scrollbar-none">
		<button
			onclick={() => switchTab('all')}
			class={[
				'px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0',
				activeTab === 'all'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
			].join(' ')}
		>
			<span>All Categories</span>
			<span class={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === 'all' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}`}>
				{counts().total}
			</span>
		</button>

		<button
			onclick={() => switchTab('expenses')}
			class={[
				'px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0',
				activeTab === 'expenses'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
			].join(' ')}
		>
			<Wallet class="h-3.5 w-3.5 text-blue-500" />
			<span>Payment Vouchers</span>
			<span class={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === 'expenses' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}`}>
				{counts().expenses}
			</span>
		</button>

		<button
			onclick={() => switchTab('journals')}
			class={[
				'px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0',
				activeTab === 'journals'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
			].join(' ')}
		>
			<BookOpen class="h-3.5 w-3.5 text-indigo-500" />
			<span>Party Transfers</span>
			<span class={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === 'journals' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}`}>
				{counts().journals}
			</span>
		</button>

		<button
			onclick={() => switchTab('supplier_settlements')}
			class={[
				'px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0',
				activeTab === 'supplier_settlements'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
			].join(' ')}
		>
			<Coins class="h-3.5 w-3.5 text-amber-500" />
			<span>Supplier Deposits & Settlements</span>
			<span class={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === 'supplier_settlements' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}`}>
				{counts().supplierSettlements}
			</span>
		</button>

		<button
			onclick={() => switchTab('purchase_returns')}
			class={[
				'px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0',
				activeTab === 'purchase_returns'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
			].join(' ')}
		>
			<ArrowDownLeft class="h-3.5 w-3.5 text-orange-500" />
			<span>Purchase Returns</span>
			<span class={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === 'purchase_returns' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}`}>
				{counts().purchaseReturns}
			</span>
		</button>

		<button
			onclick={() => switchTab('sales_returns')}
			class={[
				'px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0',
				activeTab === 'sales_returns'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
			].join(' ')}
		>
			<ArrowUpRight class="h-3.5 w-3.5 text-emerald-500" />
			<span>Sales Returns</span>
			<span class={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === 'sales_returns' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}`}>
				{counts().salesReturns}
			</span>
		</button>

		<button
			onclick={() => switchTab('transactions')}
			class={[
				'px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0',
				activeTab === 'transactions'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
			].join(' ')}
		>
			<Receipt class="h-3.5 w-3.5 text-purple-500" />
			<span>Treasury Txns</span>
			<span class={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === 'transactions' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}`}>
				{counts().transactions}
			</span>
		</button>

		<button
			onclick={() => switchTab('headers')}
			class={[
				'px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0',
				activeTab === 'headers'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
			].join(' ')}
		>
			<Layers class="h-3.5 w-3.5" />
			<span>Payment Headers</span>
			<span class={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === 'headers' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}`}>
				{counts().headers}
			</span>
		</button>

		<button
			onclick={() => switchTab('agents')}
			class={[
				'px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0',
				activeTab === 'agents'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
			].join(' ')}
		>
			<UserCheck class="h-3.5 w-3.5" />
			<span>Agents</span>
			<span class={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === 'agents' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}`}>
				{counts().agents}
			</span>
		</button>

		<button
			onclick={() => switchTab('suppliers')}
			class={[
				'px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0',
				activeTab === 'suppliers'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
			].join(' ')}
		>
			<Users class="h-3.5 w-3.5" />
			<span>Suppliers</span>
			<span class={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === 'suppliers' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}`}>
				{counts().suppliers}
			</span>
		</button>

		<button
			onclick={() => switchTab('banks')}
			class={[
				'px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0',
				activeTab === 'banks'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
			].join(' ')}
		>
			<Building class="h-3.5 w-3.5" />
			<span>Banks</span>
			<span class={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === 'banks' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}`}>
				{counts().banks}
			</span>
		</button>

		<button
			onclick={() => switchTab('accounts')}
			class={[
				'px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0',
				activeTab === 'accounts'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
			].join(' ')}
		>
			<Landmark class="h-3.5 w-3.5" />
			<span>Cash Accounts</span>
			<span class={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === 'accounts' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}`}>
				{counts().accounts}
			</span>
		</button>
	</div>

	<!-- Master Checkbox & Quick Selection Counter Bar -->
	{#if visibleKeys().length > 0 && hasRole('accountant') && statusFilter === 'pending'}
		<div class="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted/40 border border-border/80 rounded-2xl text-xs">
			<label class="flex items-center gap-2.5 font-semibold cursor-pointer select-none">
				<input
					type="checkbox"
					checked={isAllSelected}
					onchange={toggleSelectAll}
					class="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
				/>
				<span>Select all ({visibleKeys().length} request{visibleKeys().length === 1 ? '' : 's'} in view)</span>
			</label>

			<span class="text-muted-foreground font-mono">
				{#if selectedKeys.length > 0}
					<span class="font-bold text-foreground">{selectedKeys.length}</span> of {visibleKeys().length} selected
				{:else}
					Select checkboxes to trigger bulk approval or rejection
				{/if}
			</span>
		</div>
	{/if}

	<!-- Content Feed Area -->
	{#if loading}
		<div class="flex flex-col items-center justify-center p-16 space-y-4 bg-card rounded-3xl border border-border shadow-xs">
			<div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center animate-spin">
				<RefreshCw class="h-6 w-6" />
			</div>
			<div class="text-center space-y-1">
				<p class="text-sm font-bold text-foreground">Loading Approval Queue...</p>
				<p class="text-xs text-muted-foreground">Aggregating cross-department records and financial ledgers</p>
			</div>
		</div>
	{:else if counts().total === 0}
		<div class="flex flex-col items-center justify-center p-16 space-y-4 bg-card rounded-3xl border border-border shadow-xs text-center">
			<div class="w-16 h-16 rounded-3xl bg-muted/60 text-muted-foreground/50 flex items-center justify-center">
				<ListChecks class="h-8 w-8" />
			</div>
			<div class="space-y-1.5 max-w-sm">
				<p class="text-base font-bold text-foreground">Zero Pending Approvals</p>
				<p class="text-xs text-muted-foreground leading-relaxed">
					All financial transactions, payment vouchers, and master registrations are fully reconciled and up-to-date.
				</p>
			</div>
			{#if statusFilter !== 'pending' || datePreset !== 'all' || searchQuery}
				<Button variant="outline" size="sm" onclick={resetFilters} class="rounded-xl text-xs font-semibold cursor-pointer mt-2">
					<RotateCcw class="h-3.5 w-3.5 mr-1.5" />
					Reset All Filters
				</Button>
			{/if}
		</div>
	{:else if visibleKeys().length === 0}
		<div class="flex flex-col items-center justify-center p-16 space-y-4 bg-card rounded-3xl border border-border shadow-xs text-center">
			<div class="w-16 h-16 rounded-3xl bg-muted/60 text-muted-foreground/50 flex items-center justify-center">
				<ListChecks class="h-8 w-8" />
			</div>
			<div class="space-y-1.5 max-w-sm">
				<p class="text-base font-bold text-foreground">
					No Items in this Category
				</p>
				<p class="text-xs text-muted-foreground leading-relaxed">
					There are no pending requests matching the selected category and filter criteria.
				</p>
			</div>
			{#if statusFilter !== 'pending' || datePreset !== 'all' || searchQuery}
				<Button variant="outline" size="sm" onclick={resetFilters} class="rounded-xl text-xs font-semibold cursor-pointer mt-2">
					<RotateCcw class="h-3.5 w-3.5 mr-1.5" />
					Reset All Filters
				</Button>
			{/if}
		</div>
	{:else}
		<div class="space-y-4">
			<!-- 1. Pending Entity Registrations & Headers -->
			{#if activeTab === 'all' || activeTab === 'headers' || activeTab === 'agents' || activeTab === 'suppliers' || activeTab === 'banks' || activeTab === 'accounts'}
				{#each filteredApprovals() as item (item.id)}
					{@const type = (item.entityType || '').toLowerCase()}
					{@const isHeader = type === 'payment_header' || type === 'account_category' || type === 'expense_header'}
					{@const isAgent = type === 'agent'}
					{@const isSupplier = type === 'supplier'}
					{@const isBank = type === 'bank'}
					{@const isAccount = type === 'account'}

					{#if activeTab === 'all' || (activeTab === 'headers' && isHeader) || (activeTab === 'agents' && isAgent) || (activeTab === 'suppliers' && isSupplier) || (activeTab === 'banks' && isBank) || (activeTab === 'accounts' && isAccount)}
						{@const payload = parsePayload(item)}
						{@const itemKey = `approval-${item.id}`}
						{@const isSelected = selectedKeys.includes(itemKey)}
						
						<div class={[
							'bg-card border rounded-3xl p-5 shadow-xs transition-all space-y-4 relative overflow-hidden',
							isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border hover:border-border/90'
						].join(' ')}>
							<!-- Header Bar -->
							<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-border/60">
								<div class="flex items-center gap-3 flex-wrap">
									{#if hasRole('master_accountant') && statusFilter === 'pending'}
										<input
											type="checkbox"
											checked={isSelected}
											onchange={() => toggleSelect(itemKey)}
											class="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
										/>
									{/if}

									<span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20">
										<Layers class="h-3.5 w-3.5" />
										{item.entityType === 'payment_header' ? 'Payment Category Header' : item.entityType.replace('_', ' ')} Registration
									</span>

									<span class="text-xs font-mono font-bold text-foreground">PA-{item.id}</span>

									{#if item.status !== 'pending'}
										<span class={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${item.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'}`}>
											{item.status}
										</span>
									{:else}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
											<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
											Pending Review
										</span>
									{/if}
								</div>

								<div class="text-[11px] text-muted-foreground flex items-center gap-1.5">
									<span>Submitted by</span>
									<span class="font-bold text-foreground">{item.submittedByName}</span>
									<span>·</span>
									<span class="font-mono">{formatDateTime(item.submittedAt)}</span>
								</div>
							</div>

							<!-- Details Matrix -->
							<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-muted/20 p-4 rounded-2xl border border-border/50 text-xs">
								{#if isHeader}
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Header Name</span>
										<span class="font-bold text-foreground text-sm">{payload.name || payload.Name || '—'}</span>
									</div>
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Category Bucket</span>
										<span class="font-semibold capitalize text-foreground">{payload.category || payload.Category || 'Expenses'}</span>
									</div>
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Description</span>
										<span class="font-medium text-foreground break-words whitespace-normal block" title={payload.description || payload.Description || '—'}>{payload.description || payload.Description || '—'}</span>
									</div>
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Status</span>
										<span class="font-mono font-bold text-foreground capitalize">{item.status || 'Pending'}</span>
									</div>
								{:else if isAgent}
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Agency Name</span>
										<span class="font-bold text-foreground text-sm">{payload.agencyName || `${payload.firstName || ''} ${payload.lastName || ''}` || '—'}</span>
									</div>
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Contact Email</span>
										<span class="font-semibold text-foreground">{payload.emailId || payload.email || '—'}</span>
									</div>
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Phone Number</span>
										<span class="font-semibold text-foreground">{payload.phoneNo || payload.phone || '—'}</span>
									</div>
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Opening Balance</span>
										<span class="font-bold text-foreground font-mono">{payload.wallet || 0} BHD</span>
									</div>
								{:else if isSupplier}
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Supplier Name</span>
										<span class="font-bold text-foreground text-sm">{payload.name || '—'}</span>
									</div>
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Supplier Code</span>
										<span class="font-mono font-bold text-foreground">{payload.code || '—'}</span>
									</div>
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Currency</span>
										<span class="font-semibold text-foreground">{payload.currency || 'BHD'}</span>
									</div>
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Opening Balance</span>
										<span class="font-bold text-foreground font-mono">{payload.openingBalance || 0} BHD</span>
									</div>
								{:else if isBank}
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Bank Name</span>
										<span class="font-bold text-foreground text-sm">{payload.bankName || '—'}</span>
									</div>
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Account Number</span>
										<span class="font-mono font-bold text-foreground">{payload.accountNumber || '—'}</span>
									</div>
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">IBAN / Swift</span>
										<span class="font-mono text-foreground">{payload.iban || payload.swiftCode || '—'}</span>
									</div>
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Opening Balance</span>
										<span class="font-bold text-foreground font-mono">{payload.balance || 0} BHD</span>
									</div>
								{:else if isAccount}
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Account Name</span>
										<span class="font-bold text-foreground text-sm">{payload.name || '—'}</span>
									</div>
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Account Code</span>
										<span class="font-mono font-bold text-foreground">{payload.code || '—'}</span>
									</div>
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Currency</span>
										<span class="font-semibold text-foreground">{payload.currency || 'BHD'}</span>
									</div>
									<div class="space-y-0.5">
										<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Opening Balance</span>
										<span class="font-bold text-foreground font-mono">{payload.balance || 0} BHD</span>
									</div>
								{/if}
							</div>

							<!-- Action Buttons -->
							{#if hasRole('master_accountant') && item.status === 'pending'}
								<div class="flex items-center justify-end gap-2.5 pt-2 border-t border-border/40">
									<Button
										variant="outline"
										size="sm"
										class="h-8.5 px-3.5 rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold cursor-pointer"
										disabled={processingId !== null || isBulkProcessing}
										onclick={() => openRejectModalForApprovalItem(item)}
									>
										<X class="h-3.5 w-3.5 mr-1" />
										<span>Reject Request</span>
									</Button>
									<Button
										size="sm"
										class="h-8.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
										disabled={processingId !== null || isBulkProcessing}
										onclick={() => approvePendingItem(item)}
									>
										{#if processingId === `approval-${item.id}` && processingAction === 'approve'}
											<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />
											<span>Approving...</span>
										{:else}
											<Check class="h-3.5 w-3.5 mr-1.5" />
											<span>Approve & Register</span>
										{/if}
									</Button>
								</div>
							{:else if item.reviewedByName}
								<div class="text-[11px] text-muted-foreground pt-2 border-t border-border/40 flex justify-end items-center gap-1">
									<CheckCheck class="h-3.5 w-3.5 text-emerald-600" />
									<span>Reviewed by <strong class="text-foreground">{item.reviewedByName}</strong></span>
									{#if item.reviewedAt}
										<span>on {formatDateTime(item.reviewedAt)}</span>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				{/each}
			{/if}

			<!-- 2. Pending Payment Vouchers (Expenses) -->
			{#if activeTab === 'all' || activeTab === 'expenses'}
				{#each filteredExpenses() as expense (expense.id)}
					{@const itemKey = `expense-${expense.id}`}
					{@const isSelected = selectedKeys.includes(itemKey)}
					
					<div class={[
						'bg-card border rounded-3xl p-5 shadow-xs transition-all space-y-4 relative overflow-hidden',
						isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border hover:border-border/90'
					].join(' ')}>
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-border/60">
							<div class="flex items-center gap-3 flex-wrap">
								{#if hasRole('master_accountant') && (expense.status || '').toLowerCase() === 'pendingapproval'}
									<input
										type="checkbox"
										checked={isSelected}
										onchange={() => toggleSelect(itemKey)}
										class="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
									/>
								{/if}

								<span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20">
									<Wallet class="h-3.5 w-3.5" />
									Payment Voucher
								</span>

								<span class="text-xs font-mono font-bold text-foreground">{expense.expenseNumber}</span>

								{#if (expense.status || '').toLowerCase() === 'pendingapproval'}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
										<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
										Pending Approval
									</span>
								{:else}
									<span class="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
										{expense.status}
									</span>
								{/if}
							</div>

							<div class="text-[11px] text-muted-foreground flex items-center gap-1.5">
								<span>Submitted by</span>
								<span class="font-bold text-foreground">{getUserLabel(expense.createdBy)}</span>
								<span>·</span>
								<span class="font-mono">{formatDateTime(expense.expenseDate || expense.createdAt)}</span>
							</div>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-muted/20 p-4 rounded-2xl border border-border/50 text-xs">
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Expense Category</span>
								<span class="font-bold text-foreground text-sm">{getCategoryLabel(expense.expenseCategoryId)}</span>
							</div>
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Voucher Amount</span>
								<span class="font-bold text-emerald-600 dark:text-emerald-400 text-base">
									<MoneyDisplay amount={expense.amount} />
								</span>
							</div>
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Payment Channel</span>
								<span class="font-semibold text-foreground">{getPaymentChannelLabel(expense.paymentMethod, expense.sourceAccountId, expense.sourceBankId)}</span>
							</div>
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Description / Narration</span>
								<span class="text-foreground break-words whitespace-normal block font-medium" title={expense.description || expense.notes || '—'}>{expense.description || expense.notes || '—'}</span>
							</div>
						</div>

						{#if hasRole('master_accountant') && (expense.status || '').toLowerCase() === 'pendingapproval'}
							<div class="flex items-center justify-end gap-2.5 pt-2 border-t border-border/40">
								<Button
									variant="outline"
									size="sm"
									class="h-8.5 px-3.5 rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold cursor-pointer"
									disabled={processingId !== null || isBulkProcessing}
									onclick={() => openRejectModalForExpenseItem(expense)}
								>
									{#if processingId === `expense-${expense.id}` && processingAction === 'reject'}
										<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />
										<span>Rejecting...</span>
									{:else}
										<X class="h-3.5 w-3.5 mr-1" />
										<span>Reject Voucher</span>
									{/if}
								</Button>
								<Button
									size="sm"
									class="h-8.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
									disabled={processingId !== null || isBulkProcessing}
									onclick={() => handleApproveExpense(expense)}
								>
									{#if processingId === `expense-${expense.id}` && processingAction === 'approve'}
										<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />
										<span>Approving...</span>
									{:else}
										<Check class="h-3.5 w-3.5 mr-1.5" />
										<span>Approve & Post</span>
									{/if}
								</Button>
							</div>
						{/if}
					</div>
				{/each}
			{/if}

			<!-- 3. Pending Financial Transactions -->
			{#if activeTab === 'all' || activeTab === 'transactions'}
				{#each filteredTransactions() as txn (txn.id)}
					{@const itemKey = `txn-${txn.id}`}
					{@const isSelected = selectedKeys.includes(itemKey)}
					{@const isContra = (txn.transactionType || '').toLowerCase() === 'contra'}
					{@const destChannel = txn.destinationAccountName || txn.destinationBankName || (txn.destinationAccountId ? getCashAccountLabel(txn.destinationAccountId) : (txn.destinationBankId ? getBankAccountLabel(txn.destinationBankId) : (txn.destinationParty?.name || (isContra ? 'Internal treasury' : ''))))}
					{@const showDest = isContra || Boolean(destChannel)}

					<div class={[
						'bg-card border rounded-3xl p-5 shadow-xs transition-all space-y-4 relative overflow-hidden',
						isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border hover:border-border/90'
					].join(' ')}>
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-border/60">
							<div class="flex items-center gap-3 flex-wrap">
								{#if hasRole('master_accountant') && (txn.status || '').toLowerCase() === 'pending'}
									<input
										type="checkbox"
										checked={isSelected}
										onchange={() => toggleSelect(itemKey)}
										class="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
									/>
								{/if}

								<span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase rounded-lg bg-purple-500/10 text-purple-600 border border-purple-500/20">
									<Receipt class="h-3.5 w-3.5" />
									{txn.transactionType} Treasury Movement
								</span>

								<span class="text-xs font-mono font-bold text-foreground">TXN #{txn.id}</span>

								{#if (txn.status || '').toLowerCase() === 'pending'}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
										<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
										Pending Review
									</span>
								{:else}
									<span class="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
										{txn.status}
									</span>
								{/if}
							</div>

							<div class="text-[11px] text-muted-foreground flex items-center gap-1.5">
								<span>Submitted by</span>
								<span class="font-bold text-foreground">{getUserLabel(txn.createdBy, txn.createdByName)}</span>
								<span>·</span>
								<span class="font-mono">{formatDateTime(txn.createdAt)}</span>
							</div>
						</div>

						<div class={['grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/20 p-4 rounded-2xl border border-border/50 text-xs', showDest ? 'lg:grid-cols-5' : 'lg:grid-cols-4'].join(' ')}>
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Transaction Amount</span>
								<span class="font-bold text-purple-600 dark:text-purple-400 text-base">
									<MoneyDisplay amount={txn.amount} />
								</span>
							</div>
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Payment Method</span>
								<span class="font-semibold text-foreground capitalize">{txn.paymentMethod || 'Cash'}</span>
							</div>
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Source Channel</span>
								<span class="font-semibold text-foreground">{txn.sourceAccountName || txn.sourceBankName || (txn.sourceAccountId ? getCashAccountLabel(txn.sourceAccountId) : (txn.sourceBankId ? getBankAccountLabel(txn.sourceBankId) : 'Internal treasury'))}</span>
							</div>
							{#if showDest}
								<div class="space-y-0.5">
									<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Destination Channel</span>
									<span class="font-semibold text-foreground">{destChannel || 'Internal treasury'}</span>
								</div>
							{/if}
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Description</span>
								<span class="text-foreground break-words whitespace-normal block font-medium" title={txn.description || 'Direct treasury movement'}>{txn.description || 'Direct treasury movement'}</span>
							</div>
						</div>

						{#if hasRole('master_accountant') && (txn.status || '').toLowerCase() === 'pending'}
							<div class="flex items-center justify-end gap-2.5 pt-2 border-t border-border/40">
								<Button
									variant="outline"
									size="sm"
									class="h-8.5 px-3.5 rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold cursor-pointer"
									disabled={processingId !== null || isBulkProcessing}
									onclick={() => openRejectModalForTransactionItem(txn)}
								>
									{#if processingId === `txn-${txn.id}` && processingAction === 'reject'}
										<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />
										<span>Rejecting...</span>
									{:else}
										<X class="h-3.5 w-3.5 mr-1" />
										<span>Reject Transaction</span>
									{/if}
								</Button>
								<Button
									size="sm"
									class="h-8.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
									disabled={processingId !== null || isBulkProcessing}
									onclick={() => handleApproveTransaction(txn)}
								>
									{#if processingId === `txn-${txn.id}` && processingAction === 'approve'}
										<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />
										<span>Approving...</span>
									{:else}
										<Check class="h-3.5 w-3.5 mr-1.5" />
										<span>Approve & Post</span>
									{/if}
								</Button>
							</div>
						{/if}
					</div>
				{/each}
			{/if}

			<!-- 4. Pending Party Transfer Journals -->
			{#if activeTab === 'all' || activeTab === 'journals'}
				{#each filteredJournals() as journal (journal.id)}
					{@const itemKey = `journal-${journal.id}`}
					{@const isSelected = selectedKeys.includes(itemKey)}

					<div class={[
						'bg-card border rounded-3xl p-5 shadow-xs transition-all space-y-4 relative overflow-hidden',
						isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border hover:border-border/90'
					].join(' ')}>
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-border/60">
							<div class="flex items-center gap-3 flex-wrap">
								{#if hasRole('master_accountant') && (journal.status || '').toLowerCase() === 'pending'}
									<input
										type="checkbox"
										checked={isSelected}
										onchange={() => toggleSelect(itemKey)}
										class="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
									/>
								{/if}

								<span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase rounded-lg bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
									<BookOpen class="h-3.5 w-3.5" />
									Party Transfer Journal
								</span>

								<span class="text-xs font-mono font-bold text-foreground">{journal.journalNumber}</span>

								{#if (journal.status || '').toLowerCase() === 'pending'}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
										<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
										Pending Approval
									</span>
								{:else}
									<span class="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
										{journal.status}
									</span>
								{/if}
							</div>

							<div class="text-[11px] text-muted-foreground flex items-center gap-1.5">
								<span>Submitted by</span>
								<span class="font-bold text-foreground">{journal.createdByName || 'System User'}</span>
								<span>·</span>
								<span class="font-mono">{formatDateTime(journal.createdAt)}</span>
							</div>
						</div>

						<!-- Visual Party Transfer Flow -->
						<div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-muted/20 p-4 rounded-2xl border border-border/50 text-xs">
							<div class="md:col-span-4 space-y-1">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Debit Party (Deducted From)</span>
								<div class="flex items-center gap-2">
									<span class="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-red-500/10 text-red-600 border border-red-500/20">
										{journal.debitPartyType}
									</span>
									<span class="font-bold text-foreground text-sm truncate">{journal.debitPartyName}</span>
								</div>
							</div>

							<div class="md:col-span-4 flex flex-col items-center justify-center py-2 px-3 bg-background/80 rounded-xl border border-border/80 text-center shadow-xs">
								<span class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Transfer Amount</span>
								<span class="font-bold text-indigo-600 dark:text-indigo-400 text-base">
									<MoneyDisplay amount={journal.amount} />
								</span>
								<span class="text-[10px] text-muted-foreground break-words whitespace-normal text-center max-w-[240px] mt-0.5" title={journal.note || journal.transferReference || 'Wallet balance transfer'}>
									{journal.note || journal.transferReference || 'Wallet balance transfer'}
								</span>
							</div>

							<div class="md:col-span-4 space-y-1 text-left md:text-right">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Credit Party (Credited To)</span>
								<div class="flex items-center gap-2 justify-start md:justify-end">
									<span class="font-bold text-foreground text-sm truncate">{journal.creditPartyName}</span>
									<span class="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
										{journal.creditPartyType}
									</span>
								</div>
							</div>
						</div>

						{#if hasRole('master_accountant') && (journal.status || '').toLowerCase() === 'pending'}
							<div class="flex items-center justify-end gap-2.5 pt-2 border-t border-border/40">
								<Button
									variant="outline"
									size="sm"
									class="h-8.5 px-3.5 rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold cursor-pointer"
									disabled={processingId !== null || isBulkProcessing}
									onclick={() => openRejectModalForJournalItem(journal)}
								>
									{#if processingId === `journal-${journal.id}` && processingAction === 'reject'}
										<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />
										<span>Rejecting...</span>
									{:else}
										<X class="h-3.5 w-3.5 mr-1" />
										<span>Reject Journal</span>
									{/if}
								</Button>
								<Button
									size="sm"
									class="h-8.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
									disabled={processingId !== null || isBulkProcessing}
									onclick={() => handleApproveJournal(journal)}
								>
									{#if processingId === `journal-${journal.id}` && processingAction === 'approve'}
										<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />
										<span>Approving...</span>
									{:else}
										<Check class="h-3.5 w-3.5 mr-1.5" />
										<span>Approve & Post</span>
									{/if}
								</Button>
							</div>
						{/if}
					</div>
				{/each}
			{/if}

			<!-- 4b. Pending Supplier Deposits & Credit Settlements (Treasury Only) -->
			{#if activeTab === 'all' || activeTab === 'supplier_settlements'}
				{#each filteredSupplierSettlements() as item (item.id)}
					{@const itemKey = `supplier_settlement-${item.id}`}
					{@const isSelected = selectedKeys.includes(itemKey)}
					{@const st = (item.serviceType || '').toLowerCase()}
					{@const isCredit = st.includes('credit')}
					{@const supLabel = getSupplierLabel(item.supplierId)}

					<div class={[
						'bg-card border rounded-3xl p-5 shadow-xs transition-all space-y-4 relative overflow-hidden',
						isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border hover:border-border/90'
					].join(' ')}>
						<!-- Header Bar -->
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-border/60">
							<div class="flex items-center gap-3 flex-wrap">
								{#if hasRole('master_accountant') && (item.status || '').toLowerCase() === 'pending'}
									<input
										type="checkbox"
										checked={isSelected}
										onchange={() => toggleSelect(itemKey)}
										class="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
									/>
								{/if}

								{#if isCredit}
									<span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20">
										<Coins class="h-3.5 w-3.5 text-amber-600" />
										Supplier Credit Settlement
									</span>
								{:else}
									<span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
										<Coins class="h-3.5 w-3.5 text-emerald-600" />
										Supplier Deposit (Wallet Top-up)
									</span>
								{/if}

								<span class="text-xs font-mono font-bold text-foreground">
									{item.documentNumber || `SP-${item.id}`}
								</span>

								{#if (item.status || '').toLowerCase() === 'pending'}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
										<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
										Pending Review
									</span>
								{:else}
									<span class="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
										{item.status}
									</span>
								{/if}
							</div>

							<div class="text-[11px] text-muted-foreground flex items-center gap-1.5">
								<span>Submitted by</span>
								<span class="font-bold text-foreground">
									{item.requestedByName || getUserLabel(item.requestedByUserId || item.createdBy || 0)}
								</span>
								<span>·</span>
								<span class="font-mono">{formatDateTime(item.requestedAt || item.createdAt)}</span>
							</div>
						</div>

						<!-- Settlement Details Grid -->
						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-muted/20 p-4 rounded-2xl border border-border/50 text-xs">
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Settlement Amount</span>
								<span class="font-bold text-amber-600 dark:text-amber-400 text-base">
									<MoneyDisplay amount={item.amount} />
								</span>
							</div>
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Supplier Partner</span>
								<span class="font-bold text-foreground truncate block">{supLabel}</span>
							</div>
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Payment Channel</span>
								<span class="font-semibold text-foreground">
									{getPaymentChannelLabel(item.paymentMethod, item.sourceAccountId || null, item.sourceBankId || null)}
								</span>
							</div>
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Reference / Note</span>
								<span class="text-foreground break-words whitespace-normal block font-medium" title={item.description || (isCredit ? 'Credit debt settlement' : 'Prepaid wallet deposit')}>
									{item.referenceNumber ? `#${item.referenceNumber} • ` : ''}{item.description || (isCredit ? 'Credit debt settlement' : 'Prepaid wallet deposit')}
								</span>
							</div>
						</div>

						<!-- Master Accountant Actions -->
						{#if hasRole('master_accountant') && (item.status || '').toLowerCase() === 'pending'}
							<div class="flex items-center justify-end gap-2.5 pt-2 border-t border-border/40">
								<Button
									variant="outline"
									size="sm"
									class="h-8.5 px-3.5 rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold cursor-pointer"
									disabled={processingId !== null || isBulkProcessing}
									onclick={() => openRejectModalForSupplierSettlement(item)}
								>
									{#if processingId === `supplier_settlement-${item.id}` && processingAction === 'reject'}
										<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />
										<span>Rejecting...</span>
									{:else}
										<X class="h-3.5 w-3.5 mr-1" />
										<span>Reject</span>
									{/if}
								</Button>
								<Button
									size="sm"
									class="h-8.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
									disabled={processingId !== null || isBulkProcessing}
									onclick={() => handleApproveSupplierSettlement(item)}
								>
									{#if processingId === `supplier_settlement-${item.id}` && processingAction === 'approve'}
										<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />
										<span>Approving...</span>
									{:else}
										<Check class="h-3.5 w-3.5 mr-1.5" />
										<span>Approve & Settle</span>
									{/if}
								</Button>
							</div>
						{/if}
					</div>
				{/each}
			{/if}

			<!-- 5. Pending Purchase Returns -->
			{#if activeTab === 'all' || activeTab === 'purchase_returns'}
				{#each filteredPurchaseReturns() as pr (pr.id)}
					{@const itemKey = `purchase_return-${pr.id}`}
					{@const isSelected = selectedKeys.includes(itemKey)}

					<div class={[
						'bg-card border rounded-3xl p-5 shadow-xs transition-all space-y-4 relative overflow-hidden',
						isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border hover:border-border/90'
					].join(' ')}>
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-border/60">
							<div class="flex items-center gap-3 flex-wrap">
								{#if hasRole('accountant') && (pr.status || '').toLowerCase().includes('pending')}
									<input
										type="checkbox"
										checked={isSelected}
										onchange={() => toggleSelect(itemKey)}
										class="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
									/>
								{/if}

								<span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase rounded-lg bg-orange-500/10 text-orange-600 border border-orange-500/20">
									<ArrowDownLeft class="h-3.5 w-3.5" />
									Purchase Return
								</span>

								<span class="text-xs font-mono font-bold text-foreground">{pr.documentNumber || `PR-${pr.id}`}</span>

								{#if (pr.status || '').toLowerCase().includes('pending')}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
										<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
										Pending Review
									</span>
								{:else}
									<span class="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
										{pr.status}
									</span>
								{/if}
							</div>

							<div class="text-[11px] text-muted-foreground flex items-center gap-1.5">
								<span>Submitted by</span>
								<span class="font-bold text-foreground">{getUserLabel(pr.requestedByUserId, pr.creatorName || pr.requestedByName)}</span>
								<span>·</span>
								<span class="font-mono">{formatDateTime(pr.requestedAt || pr.createdAt)}</span>
							</div>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-muted/20 p-4 rounded-2xl border border-border/50 text-xs">
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Supplier</span>
								<span class="font-bold text-foreground text-sm">{getSupplierLabel(pr.supplierId)}</span>
							</div>
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Return Refund Amount</span>
								<span class="font-bold text-orange-600 dark:text-orange-400 text-base">
									<MoneyDisplay amount={pr.amount} />
								</span>
							</div>
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Destination Channel</span>
								<span class="font-semibold text-foreground">{getPaymentChannelLabel(pr.destinationType || 'cash', pr.destinationAccountId, pr.destinationBankId)}</span>
							</div>
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Reason / Reference</span>
								<span class="text-foreground break-words whitespace-normal block font-medium" title={pr.reason || pr.originalPurchaseReference || 'Supplier return refund'}>{pr.reason || pr.originalPurchaseReference || 'Supplier return refund'}</span>
							</div>
						</div>

						{#if hasRole('accountant') && (pr.status || '').toLowerCase().includes('pending')}
							<div class="flex items-center justify-end gap-2.5 pt-2 border-t border-border/40">
								<Button
									variant="outline"
									size="sm"
									class="h-8.5 px-3.5 rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold cursor-pointer"
									disabled={processingId !== null || isBulkProcessing}
									onclick={() => openRejectModalForPurchaseReturnItem(pr)}
								>
									{#if processingId === `purchase_return-${pr.id}` && processingAction === 'reject'}
										<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />
										<span>Rejecting...</span>
									{:else}
										<X class="h-3.5 w-3.5 mr-1" />
										<span>Reject Return</span>
									{/if}
								</Button>
								<Button
									size="sm"
									class="h-8.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
									disabled={processingId !== null || isBulkProcessing}
									onclick={() => handleApprovePurchaseReturn(pr)}
								>
									{#if processingId === `purchase_return-${pr.id}` && processingAction === 'approve'}
										<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />
										<span>Approving...</span>
									{:else}
										<Check class="h-3.5 w-3.5 mr-1.5" />
										<span>Approve & Post</span>
									{/if}
								</Button>
							</div>
						{/if}
					</div>
				{/each}
			{/if}

			<!-- 6. Pending Sales Returns -->
			{#if activeTab === 'all' || activeTab === 'sales_returns'}
				{#each filteredSalesReturns() as sr (sr.id)}
					{@const itemKey = `sales_return-${sr.id}`}
					{@const isSelected = selectedKeys.includes(itemKey)}

					<div class={[
						'bg-card border rounded-3xl p-5 shadow-xs transition-all space-y-4 relative overflow-hidden',
						isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border hover:border-border/90'
					].join(' ')}>
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-border/60">
							<div class="flex items-center gap-3 flex-wrap">
								{#if hasRole('accountant') && (sr.status || '').toLowerCase().includes('pending')}
									<input
										type="checkbox"
										checked={isSelected}
										onchange={() => toggleSelect(itemKey)}
										class="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
									/>
								{/if}

								<span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
									<ArrowUpRight class="h-3.5 w-3.5" />
									Sales Return
								</span>

								<span class="text-xs font-mono font-bold text-foreground">{sr.documentNumber || `SR-${sr.id}`}</span>

								{#if (sr.status || '').toLowerCase().includes('pending')}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
										<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
										Pending Review
									</span>
								{:else}
									<span class="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
										{sr.status}
									</span>
								{/if}
							</div>

							<div class="text-[11px] text-muted-foreground flex items-center gap-1.5">
								<span>Submitted by</span>
								<span class="font-bold text-foreground">{getUserLabel(sr.requestedByUserId, sr.creatorName || sr.requestedByName)}</span>
								<span>·</span>
								<span class="font-mono">{formatDateTime(sr.requestedAt || sr.createdAt)}</span>
							</div>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-muted/20 p-4 rounded-2xl border border-border/50 text-xs">
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Recipient Account</span>
								<span class="font-bold text-foreground text-sm">{getRecipientLabel(sr.recipientType, sr.recipientId, sr)}</span>
							</div>
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Refund Amount</span>
								<span class="font-bold text-emerald-600 dark:text-emerald-400 text-base">
									<MoneyDisplay amount={sr.amount} />
								</span>
							</div>
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Refund Source Channel</span>
								<span class="font-semibold text-foreground">{getPaymentChannelLabel(sr.sourceType || 'cash', sr.sourceAccountId, sr.sourceBankId)}</span>
							</div>
							<div class="space-y-0.5">
								<span class="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Reason / Reference</span>
								<span class="text-foreground break-words whitespace-normal block font-medium" title={sr.reason || sr.originalSaleReference || 'Sales return refund'}>{sr.reason || sr.originalSaleReference || 'Sales return refund'}</span>
							</div>
						</div>

						{#if hasRole('accountant') && (sr.status || '').toLowerCase().includes('pending')}
							<div class="flex items-center justify-end gap-2.5 pt-2 border-t border-border/40">
								<Button
									variant="outline"
									size="sm"
									class="h-8.5 px-3.5 rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold cursor-pointer"
									disabled={processingId !== null || isBulkProcessing}
									onclick={() => openRejectModalForSalesReturnItem(sr)}
								>
									{#if processingId === `sales_return-${sr.id}` && processingAction === 'reject'}
										<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />
										<span>Rejecting...</span>
									{:else}
										<X class="h-3.5 w-3.5 mr-1" />
										<span>Reject Return</span>
									{/if}
								</Button>
								<Button
									size="sm"
									class="h-8.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
									disabled={processingId !== null || isBulkProcessing}
									onclick={() => handleApproveSalesReturn(sr)}
								>
									{#if processingId === `sales_return-${sr.id}` && processingAction === 'approve'}
										<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />
										<span>Approving...</span>
									{:else}
										<Check class="h-3.5 w-3.5 mr-1.5" />
										<span>Approve & Post</span>
									{/if}
								</Button>
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	{/if}

	<!-- Sticky / Floating Bulk Action Dock (When items are selected) -->
	{#if selectedKeys.length > 0 && hasRole('accountant')}
		<div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-4 animate-in fade-in-50 zoom-in-95">
			<div class="flex items-center gap-2">
				<span class="w-6 h-6 rounded-full bg-primary text-primary-foreground font-mono text-xs font-bold flex items-center justify-center">
					{selectedKeys.length}
				</span>
				<span class="text-xs font-bold text-foreground">Items Selected</span>
			</div>

			<div class="h-4 w-px bg-border"></div>

			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					class="h-8 rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
					disabled={isBulkProcessing}
					onclick={openBulkRejectModal}
				>
					<X class="h-3.5 w-3.5 mr-1" />
					Reject Selected
				</Button>

				<Button
					size="sm"
					class="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
					disabled={isBulkProcessing}
					onclick={executeBulkApprove}
				>
					{#if isBulkProcessing && processingAction === 'approve'}
						<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />
						Approving...
					{:else}
						<Check class="h-3.5 w-3.5 mr-1.5" />
						Approve Selected ({selectedKeys.length})
					{/if}
				</Button>

				<button
					type="button"
					onclick={() => (selectedKeys = [])}
					class="text-xs text-muted-foreground hover:text-foreground font-semibold px-2 py-1 cursor-pointer transition-colors"
				>
					Deselect
				</button>
			</div>
		</div>
	{/if}

	<!-- Interactive Modern Rejection Modal -->
	{#if rejectionModalOpen}
		<div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50">
			<div class="w-full max-w-lg bg-card border border-border shadow-2xl rounded-3xl p-6 space-y-5 animate-in zoom-in-95">
				<div class="flex items-center justify-between pb-3 border-b border-border/80">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center border border-rose-500/20">
							<XCircle class="h-5 w-5" />
						</div>
						<div>
							<h3 class="text-base font-bold text-foreground">Reject Approval Request</h3>
							<p class="text-xs text-muted-foreground">This will decline the submission and notify the submitter.</p>
						</div>
					</div>

					<button
						type="button"
						onclick={() => (rejectionModalOpen = false)}
						class="w-8 h-8 rounded-xl bg-muted/60 text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
					>
						<X class="h-4 w-4" />
					</button>
				</div>

				<!-- Quick Chips -->
				<div class="space-y-1.5">
					<span class="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Quick Preset Reasons</span>
					<div class="flex flex-wrap gap-1.5">
						{#each quickRejectionReasons as chip}
							<button
								type="button"
								onclick={() => (rejectionReason = chip)}
								class={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer ${rejectionReason === chip ? 'bg-rose-500/10 text-rose-600 border-rose-500/30 font-bold' : 'border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted'}`}
							>
								{chip}
							</button>
						{/each}
					</div>
				</div>

				<div class="space-y-1.5">
					<label for="rejection-reason" class="text-xs font-bold text-foreground block">
						Detailed Reason / Audit Remarks <span class="text-destructive">*</span>
					</label>
					<textarea
						id="rejection-reason"
						bind:value={rejectionReason}
						rows="3"
						class="w-full text-xs p-3 rounded-2xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-foreground resize-none shadow-xs"
						placeholder="Explain why this request is being rejected..."
					></textarea>
				</div>

				<div class="flex items-center justify-end gap-2.5 pt-2 border-t border-border/80">
					<Button
						variant="outline"
						size="sm"
						class="h-9 px-4 rounded-xl text-xs font-semibold cursor-pointer"
						disabled={isRejectingModal}
						onclick={() => (rejectionModalOpen = false)}
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						size="sm"
						class="h-9 px-4 rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
						disabled={isRejectingModal || !rejectionReason.trim()}
						onclick={confirmRejectionModal}
					>
						{#if isRejectingModal}
							<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />
							Rejecting...
						{:else}
							<XCircle class="h-3.5 w-3.5 mr-1.5" />
							Confirm Rejection
						{/if}
					</Button>
				</div>
			</div>
		</div>
	{/if}
</div>
