<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { currentUser, hasRole } from '$lib/stores/auth';
	import { toast } from '$lib/stores/toast';
	import { apiFetch } from '$lib/api/api-client';
	import { createPurchaseReturn, createSalesReturn, getSuppliers } from '$features/suppliers/api';
	import type { SupplierResponse } from '$features/suppliers/types';
	import { getBanks } from '$features/bank-accounts/api';
	import type { BankResponse } from '$features/bank-accounts/types';
	import { getAccounts } from '$features/cash-accounts/api';
	import type { AccountResponse } from '$features/cash-accounts/types';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		RotateCcw,
		Undo2,
		Plane,
		Building,
		FileBadge,
		Palmtree,
		Car,
		Stamp,
		PackageCheck,
		Search,
		ArrowLeft,
		AlertCircle,
		CheckCircle2,
		Coins,
		Landmark,
		Wallet,
		CreditCard,
		Users,
		UserCheck,
		RefreshCw,
		Info,
		Layers,
		Calendar,
		Building2,
		ShieldCheck,
		FileText,
		Check,
		HelpCircle,
		Lock
	} from 'lucide-svelte';

	interface ServiceConfig {
		id: string;
		label: string;
		icon: any;
		segment: string;
		color: string;
	}

	// ─── 7 Services Configuration ────────────────────────────────────────────────
	const SERVICES: ServiceConfig[] = [
		{ id: 'flight', label: 'Flights', icon: Plane, segment: 'flights', color: 'sky' },
		{ id: 'hotel', label: 'Hotels', icon: Building, segment: 'hotels', color: 'indigo' },
		{ id: 'visa', label: 'Visa', icon: FileBadge, segment: 'visa', color: 'emerald' },
		{ id: 'holiday', label: 'Holiday Packages', icon: Palmtree, segment: 'holiday-packages', color: 'amber' },
		{ id: 'transportation', label: 'Transportation', icon: Car, segment: 'transportation', color: 'purple' },
		{ id: 'vfs', label: 'VFS Appointments', icon: Stamp, segment: 'vfs', color: 'cyan' },
		{ id: 'other', label: 'Other Services', icon: PackageCheck, segment: 'other-services', color: 'rose' }
	];

	function getServiceConfig(type: string): ServiceConfig {
		const norm = (type || '').toLowerCase().trim();
		const found = SERVICES.find((s) => s.id === norm || s.segment === norm || norm.includes(s.id) || s.id.includes(norm));
		return (found || SERVICES[0]) as ServiceConfig;
	}

	// ─── Active Mode: 'purchase' | 'sales' ──────────────────────────────────────
	let activeTab = $state<'purchase' | 'sales'>('purchase');

	// Global data states
	let loadingMasterData = $state(true);
	let salesmenList = $state<any[]>([]);
	let headsList = $state<any[]>([]);
	let suppliersList = $state<SupplierResponse[]>([]);
	let banksList = $state<BankResponse[]>([]);
	let cashAccountsList = $state<AccountResponse[]>([]);

	// ─── Sales Return States ────────────────────────────────────────────────────
	let srSalesmanId = $state<number | string>('');
	let srHeadId = $state<number | string>('');
	let srServiceType = $state<string>('flight');
	let srBookingsList = $state<any[]>([]);
	let srSelectedBookingId = $state<number | string>('');
	let srSelectedBookingDetail = $state<any>(null);
	let srLoadingBookings = $state(false);
	let srLoadingDetail = $state(false);

	let srRefundMethod = $state<'wallet'>('wallet');
	let srSelectedAccountId = $state<string>('');
	let srAmount = $state<number>(0);
	let srReason = $state<string>('');
	let srSubmitting = $state<boolean>(false);

	// ─── Purchase Return States (Supplier-First Architecture) ───────────────────
	let prSupplierId = $state<number | string>('');
	let prServiceType = $state<string>('flight');
	let prBookingsList = $state<any[]>([]);
	let prSelectedBookingId = $state<number | string>('');
	let prSelectedBookingDetail = $state<any>(null);
	let prLoadingBookings = $state(false);
	let prLoadingDetail = $state(false);
	let prLoadingServices = $state(false);

	let prSupplierPayments = $state<any[]>([]);
	let prSupplierReturns = $state<any[]>([]);
	let prAvailableServices = $state<{
		id: string;
		label: string;
		icon: any;
		bookingCount: number;
		totalPaid: number;
		totalReturned: number;
		refundableBalance: number;
	}[]>([]);

	let prDestinationType = $state<'wallet'>('wallet');
	let prSelectedAccountId = $state<string>('');
	let prAmount = $state<number>(0);
	let prReason = $state<string>('');
	let prSubmitting = $state<boolean>(false);

	// ─── Derived Options for SearchableSelect ───────────────────────────────────
	const salesmanOptions = $derived([
		{ id: '', name: 'All Salesmen (No Filter)', subtext: 'View all heads' },
		...salesmenList.map((s) => ({
			id: s.id,
			name: s.name || `Salesman #${s.id}`,
			subtext: s.email || ''
		}))
	]);

	const filteredHeads = $derived.by(() => {
		if (!srSalesmanId) return headsList;
		const sId = Number(srSalesmanId);
		const sObj = salesmenList.find((s) => s.id === sId);
		const sName = sObj?.name?.toLowerCase() || '';
		return headsList.filter((h) => {
			if (h.salesmanId && Number(h.salesmanId) === sId) return true;
			if (h.salesmanName && sName && h.salesmanName.toLowerCase().includes(sName)) return true;
			return false;
		});
	});

	const headOptions = $derived(
		filteredHeads.map((h) => ({
			id: h.id,
			name: `${h.firstName || ''} ${h.lastName || ''}`.trim() || `Head #${h.id}`,
			subtext: `${(h.type || 'Customer').toUpperCase()} • Balance: ${(h.wallet ?? 0).toFixed(3)} BHD`
		}))
	);

	const supplierOptions = $derived(
		suppliersList.map((s) => ({
			id: s.id,
			name: s.name,
			subtext: `Balance: ${(s.wallet ?? 0) > 0 ? '+' : ''}${(s.wallet ?? 0).toFixed(3)} BHD`
		}))
	);

	const srBookingOptions = $derived(
		srBookingsList.map((b) => ({
			id: b.id,
			name: b.documentNumber ? `${b.documentNumber} (ID #${b.id})` : `Booking #${b.id}`,
			subtext: `Sale: ${(Number(b.payableAmount ?? b.payable_amount ?? 0)).toFixed(3)} BHD • ${b.headName || b.passengerName || b.name || ''}`
		}))
	);

	const prBookingOptions = $derived(
		prBookingsList.map((b) => {
			const paid = Number(b.paidAmount ?? b.totalPaid ?? 0);
			const refBal = Number(b.refundableBalance ?? b.maxRefundable ?? paid);
			const nameOrHead = b.customerName || b.headName || b.passengerName || b.guestName || b.name || '';
			const docNo = b.documentNumber || `Booking #${b.id}`;
			const hasApprovedPay = b.hasApprovedPayment || paid > 0;
			return {
				id: b.id,
				name: `${docNo} (ID #${b.id})`,
				subtext: paid > 0
					? `Paid: ${paid.toFixed(3)} BHD • Refundable: ${refBal.toFixed(3)} BHD • ${nameOrHead}`
					: hasApprovedPay
						? `Settled Payment Recorded • Sale: ${(Number(b.payableAmount ?? 0)).toFixed(3)} BHD • ${nameOrHead}`
						: `Sale: ${(Number(b.payableAmount ?? 0)).toFixed(3)} BHD • ${nameOrHead}`
			};
		})
	);

	const bankAccountOptions = $derived(
		banksList.map((b) => ({
			id: `bank_${b.id}`,
			name: `${b.bankName} (${b.accountNumber})`,
			subtext: `Balance: ${(b.currentBalance ?? 0).toFixed(3)} BHD`
		}))
	);

	const cashAccountOptions = $derived(
		cashAccountsList.map((a) => ({
			id: `account_${a.id}`,
			name: a.name,
			subtext: `Drawer Balance: ${(a.currentBalance ?? 0).toFixed(3)} BHD`
		}))
	);

	// ─── Financial Calculations & Sequence Rules for Sales Return ───────────────
	const srTotalSalesReturns = $derived.by(() => {
		if (!srSelectedBookingDetail) return 0;
		const d = srSelectedBookingDetail;
		return (d.salesReturns || d.sales_returns || [])
			.filter((r: any) => (r.status || '').toLowerCase() === 'approved')
			.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
	});

	const srTotalPaid = $derived.by(() => {
		if (!srSelectedBookingDetail) return 0;
		const d = srSelectedBookingDetail;
		return (d.supplierPayments || d.supplier_payments || [])
			.filter((p: any) => (p.status || '').toLowerCase() === 'approved')
			.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
	});

	const srTotalPurchaseReturns = $derived.by(() => {
		if (!srSelectedBookingDetail) return 0;
		const d = srSelectedBookingDetail;
		return (d.purchaseReturns || d.purchase_returns || [])
			.filter((r: any) => (r.status || '').toLowerCase() === 'approved')
			.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
	});

	const srIsPaymentConfirmed = $derived.by(() => {
		if (!srSelectedBookingDetail) return false;
		const status = (srSelectedBookingDetail.paymentStatus || srSelectedBookingDetail.payment_status || '').toLowerCase();
		return status === 'paid' || status === 'success';
	});

	const srIsDealClosed = $derived.by(() => {
		if (!srSelectedBookingDetail) return false;
		const d = srSelectedBookingDetail;
		return Boolean(d.isDealClosed || d.is_deal_closed || d.processingStatus === 'deal_closed' || d.processing_status === 'deal_closed' || d.dealClosed);
	});

	const srMaxRefundable = $derived.by(() => {
		if (!srSelectedBookingDetail) return 0;
		const d = srSelectedBookingDetail;
		const payable = Number(d.payableAmount ?? d.payable_amount ?? 0) || 0;
		return Math.max(0, payable - srTotalSalesReturns);
	});

	const canSalesReturn = $derived(
		srSelectedBookingDetail !== null &&
		srIsPaymentConfirmed &&
		srMaxRefundable > 0 &&
		!srIsDealClosed
	);

	// ─── Financial Calculations & Sequence Rules for Purchase Return ────────────
	const prSupplierInfo = $derived.by(() => {
		if (!prSelectedBookingDetail) return null;
		const d = prSelectedBookingDetail;
		const sId = prSupplierId ? Number(prSupplierId) : null;

		const supPayments = (d.supplierPayments || d.supplier_payments || [])
			.filter((p: any) => (p.status || '').toLowerCase() === 'approved' && (!sId || !p.supplierId || Number(p.supplierId) === sId));
		const totalPaid = supPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
		const hasApprovedPayment = supPayments.length > 0;

		const supReturns = (d.purchaseReturns || d.purchase_returns || [])
			.filter((r: any) => (r.status || '').toLowerCase() === 'approved' && (!sId || !r.supplierId || Number(r.supplierId) === sId));
		const totalReturned = supReturns.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);

		const maxRefundable = Math.max(0, totalPaid - totalReturned);
		return { totalPaid, totalReturned, maxRefundable, hasApprovedPayment };
	});

	const prIsPaymentConfirmed = $derived.by(() => {
		if (!prSelectedBookingDetail) return false;
		const status = (prSelectedBookingDetail.paymentStatus || prSelectedBookingDetail.payment_status || '').toLowerCase();
		return status === 'paid' || status === 'success';
	});

	const prIsDealClosed = $derived.by(() => {
		if (!prSelectedBookingDetail) return false;
		const d = prSelectedBookingDetail;
		return Boolean(d.isDealClosed || d.is_deal_closed || d.processingStatus === 'deal_closed' || d.processing_status === 'deal_closed' || d.dealClosed);
	});

	const canPurchaseReturn = $derived(
		prSelectedBookingDetail !== null &&
		((prSupplierInfo?.totalPaid ?? 0) > 0 || (prSupplierInfo?.hasApprovedPayment ?? false)) &&
		prSupplierId !== ''
	);

	// ─── Lifecycle & Master Data Loading ─────────────────────────────────────────
	onMount(async () => {
		try {
			const [salesmenRes, headsRes, suppliersRes, banksRes, accountsRes] = await Promise.allSettled([
				apiFetch<any>('/api/sales-entries/salesmen'),
				apiFetch<any>('/api/sales-entries/heads?pageSize=500'),
				getSuppliers(),
				getBanks(),
				getAccounts()
			]);

			if (salesmenRes.status === 'fulfilled') {
				salesmenList = Array.isArray(salesmenRes.value) ? salesmenRes.value : (salesmenRes.value?.items || []);
			}
			if (headsRes.status === 'fulfilled') {
				headsList = Array.isArray(headsRes.value) ? headsRes.value : (headsRes.value?.items || []);
			}
			if (suppliersRes.status === 'fulfilled') {
				suppliersList = suppliersRes.value || [];
			}
			if (banksRes.status === 'fulfilled') {
				banksList = banksRes.value || [];
			}
			if (accountsRes.status === 'fulfilled') {
				cashAccountsList = accountsRes.value || [];
			}

			// Parse URL Search Parameters for context pre-filling
			const urlParams = $page.url.searchParams;
			const initialType = urlParams.get('type');
			if (initialType === 'sales') activeTab = 'sales';
			else if (initialType === 'purchase') activeTab = 'purchase';

			const initialService = urlParams.get('serviceType');
			if (initialService && SERVICES.some((s) => s.id === initialService)) {
				if (activeTab === 'sales') srServiceType = initialService;
				else prServiceType = initialService;
			}

			const initialBookingId = urlParams.get('bookingId');
			const initialHeadId = urlParams.get('headId');
			const initialSupplierId = urlParams.get('supplierId');

			if (initialHeadId) srHeadId = Number(initialHeadId);
			if (initialSupplierId) prSupplierId = Number(initialSupplierId);

			if (activeTab === 'sales') {
				await fetchSalesBookings();
				if (initialBookingId) {
					srSelectedBookingId = Number(initialBookingId);
					await fetchSalesBookingDetail(srSelectedBookingId);
				}
			} else {
				await fetchPurchaseBookings();
				if (initialBookingId) {
					prSelectedBookingId = Number(initialBookingId);
					await fetchPurchaseBookingDetail(prSelectedBookingId);
				}
			}
		} catch (err: any) {
			console.error('Error loading master data:', err);
			toast.error('Failed to load initial workspace data.');
		} finally {
			loadingMasterData = false;
		}
	});

	// ─── Fetch Bookings for Sales Return ─────────────────────────────────────────
	async function fetchSalesBookings() {
		srLoadingBookings = true;
		srBookingsList = [];
		srSelectedBookingDetail = null;
		try {
			const serviceConfig = getServiceConfig(srServiceType);
			const segment = serviceConfig.segment;
			const params: any = { page: 1, pageSize: 100 };

			const res = await apiFetch<any>(`api/sales-entries/${segment}`, { params });
			const rawItems = res?.items || (Array.isArray(res) ? res : []);

			if (srHeadId) {
				const selectedHead = headsList.find((h) => h.id === Number(srHeadId));
				const headNameLower = selectedHead ? `${selectedHead.firstName || ''} ${selectedHead.lastName || ''}`.trim().toLowerCase() : '';
				srBookingsList = rawItems.filter((b: any) => {
					if (b.headId && Number(b.headId) === Number(srHeadId)) return true;
					if (b.agentId && Number(b.agentId) === Number(srHeadId)) return true;
					if (headNameLower && b.headName && b.headName.toLowerCase().includes(headNameLower)) return true;
					return false;
				});
			} else {
				srBookingsList = rawItems;
			}
		} catch (err: any) {
			console.error('Failed to load sales bookings:', err);
		} finally {
			srLoadingBookings = false;
		}
	}

	async function fetchSalesBookingDetail(bookingId: number | string) {
		if (!bookingId) {
			srSelectedBookingDetail = null;
			return;
		}
		srLoadingDetail = true;
		try {
			const serviceConfig = getServiceConfig(srServiceType);
			const segment = serviceConfig.segment;
			const res = await apiFetch<any>(`api/sales-entries/${segment}/${bookingId}`);
			const rawDetail = res?.data || res;
			const salesDetail = rawDetail?.salesDetail || rawDetail?.sales_detail || rawDetail;
			srSelectedBookingDetail = {
				...salesDetail,
				supplierPayments: rawDetail?.supplierPayments || rawDetail?.supplier_payments || salesDetail?.supplierPayments || [],
				purchaseReturns: rawDetail?.purchaseReturns || rawDetail?.purchase_returns || salesDetail?.purchaseReturns || [],
				salesReturns: rawDetail?.salesReturns || rawDetail?.sales_returns || salesDetail?.salesReturns || [],
				ledgerEntries: rawDetail?.ledgerEntries || rawDetail?.ledger_entries || [],
				journalEntries: rawDetail?.journalEntries || rawDetail?.journal_entries || []
			};
			
			// Auto set suggested amount according to sequence rules
			if (srSelectedBookingDetail) {
				const isConfirmed = ['paid', 'success'].includes((srSelectedBookingDetail.paymentStatus || '').toLowerCase());
				const salesReturns = (srSelectedBookingDetail.salesReturns || [])
					.filter((r: any) => (r.status || '').toLowerCase() === 'approved')
					.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
				const payable = Number(srSelectedBookingDetail.payableAmount ?? 0) || 0;
				
				if (isConfirmed && payable > salesReturns) {
					srAmount = Math.max(0, payable - salesReturns);
				} else {
					srAmount = 0;
				}
				srReason = `Customer refund for ${serviceConfig.label} ${srSelectedBookingDetail.documentNumber || '#' + bookingId}`;
			}
		} catch (err: any) {
			console.error('Failed to load booking detail:', err);
			toast.error('Failed to load service booking details.');
		} finally {
			srLoadingDetail = false;
		}
	}

	// ─── Fetch Supplier Services & Bookings (Supplier-First) ────────────────────
	async function onSupplierChange() {
		prSelectedBookingId = '';
		prSelectedBookingDetail = null;
		prBookingsList = [];
		prAvailableServices = [];

		if (!prSupplierId) return;

		prLoadingServices = true;
		try {
			const supObj = suppliersList.find((s) => s.id === Number(prSupplierId));
			const supNameLower = supObj?.name?.trim().toLowerCase() || '';

			// Parse categories from supplier master data
			let supplierCategories: string[] = [];
			if (Array.isArray(supObj?.categories)) {
				supplierCategories = supObj.categories;
			} else if (typeof supObj?.categories === 'string') {
				try {
					supplierCategories = JSON.parse(supObj.categories);
				} catch {
					supplierCategories = [supObj.categories];
				}
			}

			const allowedServiceIds = new Set<string>();

			supplierCategories.forEach((cat) => {
				const c = String(cat).toLowerCase().trim();
				if (c.includes('visa')) allowedServiceIds.add('visa');
				if (c.includes('flight') || c.includes('air')) allowedServiceIds.add('flight');
				if (c.includes('hotel')) allowedServiceIds.add('hotel');
				if (c.includes('holiday') || c.includes('package')) allowedServiceIds.add('holiday');
				if (c.includes('transport')) allowedServiceIds.add('transportation');
				if (c.includes('vfs')) allowedServiceIds.add('vfs');
				if (c.includes('other') || c.includes('attestation')) allowedServiceIds.add('other');
			});

			// If categories not set or fallback by supplier name
			if (allowedServiceIds.size === 0 && supNameLower) {
				if (supNameLower.includes('visa')) allowedServiceIds.add('visa');
				if (supNameLower.includes('air') || supNameLower.includes('flight')) allowedServiceIds.add('flight');
				if (supNameLower.includes('hotel')) allowedServiceIds.add('hotel');
				if (supNameLower.includes('holiday') || supNameLower.includes('package')) allowedServiceIds.add('holiday');
				if (supNameLower.includes('transport') || supNameLower.includes('transfer') || supNameLower.includes('car')) allowedServiceIds.add('transportation');
				if (supNameLower.includes('vfs')) allowedServiceIds.add('vfs');
				if (supNameLower.includes('other') || supNameLower.includes('attestation') || supNameLower.includes('service')) allowedServiceIds.add('other');
			}

			// Fetch all approved supplier payments and approved purchase returns for this supplier
			const [paymentsRes, returnsRes] = await Promise.all([
				apiFetch<any>('api/supplier-payments', { params: { supplierId: prSupplierId, status: 'approved' } }).catch(() => []),
				apiFetch<any>('api/purchase-returns', { params: { supplierId: prSupplierId, status: 'approved' } }).catch(() => [])
			]);

			prSupplierPayments = Array.isArray(paymentsRes) ? paymentsRes : (paymentsRes?.data || []);
			prSupplierReturns = Array.isArray(returnsRes) ? returnsRes : (returnsRes?.data || []);

			const srvMap: Record<string, string> = {
				flight: 'flight',
				flights: 'flight',
				flight_booking: 'flight',
				hotel: 'hotel',
				hotels: 'hotel',
				hotel_booking: 'hotel',
				visa: 'visa',
				visas: 'visa',
				visa_application: 'visa',
				vfs: 'vfs',
				vfs_appointment: 'vfs',
				'vfs-appointments': 'vfs',
				holiday: 'holiday',
				holidays: 'holiday',
				holiday_package: 'holiday',
				'holiday-packages': 'holiday',
				transport: 'transportation',
				transportation: 'transportation',
				transportations: 'transportation',
				other: 'other',
				other_service: 'other',
				'other-services': 'other'
			};

			function detectServiceCategory(item: any): string | undefined {
				if (!item) return undefined;
				const raw = (item.serviceType || '').toLowerCase().trim();
				if (raw && srvMap[raw]) return srvMap[raw];

				const haystack = `${item.externalReference || ''} ${item.originalPurchaseReference || ''} ${item.description || ''} ${item.referenceNumber || ''}`.toUpperCase();
				if (haystack.includes('TXSFLT') || haystack.includes('FLIGHT')) return 'flight';
				if (haystack.includes('TXSHOTL') || haystack.includes('HOTEL')) return 'hotel';
				if (haystack.includes('TXSVISA') || haystack.includes('VISA')) return 'visa';
				if (haystack.includes('TXSVFS') || haystack.includes('VFS')) return 'vfs';
				if (haystack.includes('TXSHOL') || haystack.includes('HOLIDAY')) return 'holiday';
				if (haystack.includes('TXSTRANS') || haystack.includes('TRANSPORT')) return 'transportation';
				if (haystack.includes('TXSOTHR') || haystack.includes('OTHER')) return 'other';

				return undefined;
			}

			const groupedByService = new Map<string, { refs: Set<string>; totalPaid: number; totalReturned: number }>();

			// Group payments
			prSupplierPayments.forEach((p) => {
				let normalized = detectServiceCategory(p);
				if (!normalized && allowedServiceIds.size === 1) {
					normalized = Array.from(allowedServiceIds)[0];
				}
				if (normalized) {
					if (!groupedByService.has(normalized)) {
						groupedByService.set(normalized, { refs: new Set(), totalPaid: 0, totalReturned: 0 });
					}
					const g = groupedByService.get(normalized)!;
					const ref = String(p.externalReference || '').trim();
					const docMatch = (p.description || '').match(/\bTXS[A-Z0-9]+\b/i)?.[0];
					const primaryRef = docMatch || ref;
					if (primaryRef) {
						g.refs.add(primaryRef);
					}
					g.totalPaid += Number(p.amount) || 0;
				}
			});

			// Group returns
			prSupplierReturns.forEach((r) => {
				let normalized = detectServiceCategory(r);
				if (!normalized && allowedServiceIds.size === 1) {
					normalized = Array.from(allowedServiceIds)[0];
				}
				if (normalized && groupedByService.has(normalized)) {
					const g = groupedByService.get(normalized)!;
					g.totalReturned += Number(r.amount) || 0;
				}
			});

			const available: typeof prAvailableServices = [];
			for (const s of SERVICES) {
				// Only include services that belong to the supplier's allowed categories (or have payments)
				const isAllowed = allowedServiceIds.size === 0 || allowedServiceIds.has(s.id);
				if (isAllowed) {
					const g = groupedByService.get(s.id);
					const count = g ? g.refs.size : 0;
					const paid = g ? g.totalPaid : 0;
					const returned = g ? g.totalReturned : 0;
					available.push({
						id: s.id,
						label: s.label,
						icon: s.icon,
						bookingCount: count,
						totalPaid: paid,
						totalReturned: returned,
						refundableBalance: Math.max(0, paid - returned)
					});
				}
			}

			prAvailableServices = available.length > 0 ? available : SERVICES.map((s) => ({
				id: s.id,
				label: s.label,
				icon: s.icon,
				bookingCount: 0,
				totalPaid: 0,
				totalReturned: 0,
				refundableBalance: 0
			}));

			// Auto-select first available service
			if (prAvailableServices.length > 0) {
				if (!prAvailableServices.some((a) => a.id === prServiceType)) {
					prServiceType = prAvailableServices[0]?.id || 'flight';
				}
			}
			await fetchPurchaseBookings();
		} catch (err: any) {
			console.error('Failed to load supplier services:', err);
		} finally {
			prLoadingServices = false;
		}
	}

	// ─── Fetch Bookings for Purchase Return ──────────────────────────────────────
	async function fetchPurchaseBookings() {
		prLoadingBookings = true;
		prBookingsList = [];
		prSelectedBookingId = '';
		prSelectedBookingDetail = null;
		try {
			const serviceConfig = getServiceConfig(prServiceType);
			const segment = serviceConfig.segment;
			const params: any = { page: 1, pageSize: 200 };

			const res = await apiFetch<any>(`api/sales-entries/${segment}`, { params }).catch(() => ({ items: [] }));
			const rawItems: any[] = res?.items || (Array.isArray(res) ? res : []);

			if (prSupplierId) {
				const supObj = suppliersList.find((s) => s.id === Number(prSupplierId));
				const supNameLower = supObj?.name?.trim().toLowerCase() || '';

				const srvKeys: Record<string, string[]> = {
					flight: ['flight', 'flights', 'flight_booking', 'txsflt'],
					hotel: ['hotel', 'hotels', 'hotel_booking', 'txshotl'],
					visa: ['visa', 'visas', 'visa_application', 'txsvisa'],
					vfs: ['vfs', 'vfs_appointment', 'vfs-appointments', 'txsvfs'],
					holiday: ['holiday', 'holidays', 'holiday_package', 'holiday-packages', 'txshol'],
					transportation: ['transport', 'transportation', 'transportations', 'txstrans'],
					other: ['other', 'other_service', 'other-services', 'txsothr']
				};
				const targetKeys = srvKeys[prServiceType.toLowerCase()] || [prServiceType.toLowerCase()];

				// Prefix check for document numbers to prevent cross-service leakage
				const servicePrefixMap: Record<string, string> = {
					flight: 'TXSFLT',
					hotel: 'TXSHOTL',
					visa: 'TXSVISA',
					vfs: 'TXSVFS',
					holiday: 'TXSHOL',
					transportation: 'TXSTRANS',
					other: 'TXSOTHR'
				};
				const currentPrefix = servicePrefixMap[prServiceType.toLowerCase()] || '';

				// Group payments by booking ref
				const paymentsByRef = new Map<string, { totalPaid: number; lastDate: string; description: string; hasApprovedPayment: boolean }>();
				prSupplierPayments.forEach((p) => {
					const detectedSrv = (p.serviceType || '').toLowerCase().trim() ||
						(p.description && /TXSFLT|flight/i.test(p.description) ? 'flight' : '') ||
						(p.description && /TXSHOTL|hotel/i.test(p.description) ? 'hotel' : '') ||
						(p.description && /TXSVISA|visa/i.test(p.description) ? 'visa' : '') ||
						(p.description && /TXSVFS|vfs/i.test(p.description) ? 'vfs' : '') ||
						(p.description && /TXSHOL|holiday/i.test(p.description) ? 'holiday' : '') ||
						(p.description && /TXSTRANS|transport/i.test(p.description) ? 'transportation' : '') ||
						(p.description && /TXSOTHR|other/i.test(p.description) ? 'other' : '');

					const ref = String(p.externalReference || '').trim();
					const descDocMatch = (p.description || '').match(/\bTXS[A-Z0-9]+\b/i)?.[0];

					// Check if matches current selected service
					let matchesService = false;
					if (detectedSrv && targetKeys.some((k) => detectedSrv.includes(k) || k.includes(detectedSrv))) {
						matchesService = true;
					} else if (currentPrefix && (ref.toUpperCase().startsWith(currentPrefix) || (descDocMatch && descDocMatch.toUpperCase().startsWith(currentPrefix)))) {
						matchesService = true;
					} else if (!detectedSrv && prAvailableServices.length === 1 && prAvailableServices[0]?.id === prServiceType) {
						matchesService = true;
					}

					if (matchesService) {
						const payInfo = {
							totalPaid: Number(p.amount) || 0,
							lastDate: p.requestedAt || p.createdAt,
							description: p.description || '',
							hasApprovedPayment: (p.status || '').toLowerCase() === 'approved'
						};

						const registerRef = (key: string) => {
							if (!key) return;
							if (!paymentsByRef.has(key)) {
								paymentsByRef.set(key, { ...payInfo });
							} else {
								const entry = paymentsByRef.get(key)!;
								entry.totalPaid += payInfo.totalPaid;
								if (payInfo.hasApprovedPayment) entry.hasApprovedPayment = true;
							}
						};

						if (ref) registerRef(ref);
						if (descDocMatch) registerRef(descDocMatch);
					}
				});

				const returnsByRef = new Map<string, number>();
				prSupplierReturns.forEach((r) => {
					const rSrv = (r.serviceType || '').toLowerCase().trim();
					const ref = String(r.originalPurchaseReference || r.externalReference || '').trim();
					const descDocMatch = (r.reason || '').match(/\bTXS[A-Z0-9]+\b/i)?.[0];

					let matchesService = false;
					if (rSrv && targetKeys.some((k) => rSrv.includes(k) || k.includes(rSrv))) {
						matchesService = true;
					} else if (currentPrefix && (ref.toUpperCase().startsWith(currentPrefix) || (descDocMatch && descDocMatch.toUpperCase().startsWith(currentPrefix)))) {
						matchesService = true;
					} else if (!rSrv && prAvailableServices.length === 1 && prAvailableServices[0]?.id === prServiceType) {
						matchesService = true;
					}

					if (matchesService) {
						const amt = Number(r.amount) || 0;
						if (ref) returnsByRef.set(ref, (returnsByRef.get(ref) || 0) + amt);
						if (descDocMatch) returnsByRef.set(descDocMatch, (returnsByRef.get(descDocMatch) || 0) + amt);
					}
				});

				const resultList: any[] = [];
				const matchedRefs = new Set<string>();

				// 1. Check rawItems from sales portal
				rawItems.forEach((b: any) => {
					const idStr = String(b.id || '').trim();
					const docStr = String(b.documentNumber || '').trim();

					let isMatch = false;
					let refKey = idStr;

					if (paymentsByRef.has(idStr)) {
						isMatch = true;
						refKey = idStr;
					} else if (docStr && paymentsByRef.has(docStr)) {
						isMatch = true;
						refKey = docStr;
					} else if (b.supplierId && Number(b.supplierId) === Number(prSupplierId)) {
						isMatch = true;
					} else {
						const bSupName = (b.supplierName || b.supplier_name || b.supplier || b.airlineCompany || b.hotelName || '').trim().toLowerCase();
						if (supNameLower && bSupName && (bSupName === supNameLower || bSupName.includes(supNameLower) || supNameLower.includes(bSupName))) {
							isMatch = true;
						}
					}

					if (isMatch) {
						matchedRefs.add(idStr);
						if (docStr) matchedRefs.add(docStr);

						const payData = paymentsByRef.get(refKey) || (docStr ? paymentsByRef.get(docStr) : undefined);
						const paid = payData?.totalPaid ?? (Number(b.expectedSupplierCost) || 0);
						const ret = returnsByRef.get(refKey) || (docStr ? returnsByRef.get(docStr) || 0 : 0);
						const bal = Math.max(0, paid - ret);

						resultList.push({
							...b,
							hasApprovedPayment: payData?.hasApprovedPayment || false,
							paidAmount: paid,
							returnedAmount: ret,
							refundableBalance: bal
						});
					}
				});

				// 2. Also include payments that were not found on page 1 of sales entries
				paymentsByRef.forEach((payInfo, ref) => {
					if (!matchedRefs.has(ref)) {
						// Ensure the ref belongs to current service
						if (!currentPrefix || ref.toUpperCase().startsWith(currentPrefix) || !ref.toUpperCase().startsWith('TXS')) {
							const ret = returnsByRef.get(ref) || 0;
							const bal = Math.max(0, payInfo.totalPaid - ret);
							resultList.push({
								id: isNaN(Number(ref)) ? ref : Number(ref),
								documentNumber: ref.startsWith('TXS') ? ref : `Booking #${ref}`,
								payableAmount: payInfo.totalPaid,
								headName: payInfo.description || `Supplier Settled Payment`,
								hasApprovedPayment: payInfo.hasApprovedPayment,
								paidAmount: payInfo.totalPaid,
								returnedAmount: ret,
								refundableBalance: bal
							});
						}
					}
				});

				prBookingsList = resultList;
			} else {
				prBookingsList = rawItems;
			}
		} catch (err: any) {
			console.error('Failed to load purchase bookings:', err);
		} finally {
			prLoadingBookings = false;
		}
	}

	async function fetchPurchaseBookingDetail(bookingId: number | string) {
		if (!bookingId) {
			prSelectedBookingDetail = null;
			return;
		}
		prLoadingDetail = true;
		try {
			const serviceConfig = getServiceConfig(prServiceType);
			const segment = serviceConfig.segment;
			const res = await apiFetch<any>(`api/sales-entries/${segment}/${bookingId}`);
			const rawDetail = res?.data || res;
			const salesDetail = rawDetail?.salesDetail || rawDetail?.sales_detail || rawDetail;
			prSelectedBookingDetail = {
				...salesDetail,
				supplierPayments: rawDetail?.supplierPayments || rawDetail?.supplier_payments || salesDetail?.supplierPayments || [],
				purchaseReturns: rawDetail?.purchaseReturns || rawDetail?.purchase_returns || salesDetail?.purchaseReturns || [],
				salesReturns: rawDetail?.salesReturns || rawDetail?.sales_returns || salesDetail?.salesReturns || [],
				ledgerEntries: rawDetail?.ledgerEntries || rawDetail?.ledger_entries || [],
				journalEntries: rawDetail?.journalEntries || rawDetail?.journal_entries || []
			};

			// Auto calculate max refundable for supplier adhering to sequence rules
			const foundBooking = prBookingsList.find((b) => String(b.id) === String(bookingId) || b.documentNumber === bookingId);
			if (foundBooking && foundBooking.refundableBalance !== undefined) {
				prAmount = Number(foundBooking.refundableBalance) || 0;
			} else if (prSelectedBookingDetail && prSupplierId) {
				const sId = Number(prSupplierId);
				const supPayments = (prSelectedBookingDetail.supplierPayments || [])
					.filter((p: any) => (p.status || '').toLowerCase() === 'approved' && (!p.supplierId || Number(p.supplierId) === sId));
				const totalPaid = supPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
				const supReturns = (prSelectedBookingDetail.purchaseReturns || [])
					.filter((r: any) => (r.status || '').toLowerCase() === 'approved' && (!r.supplierId || Number(r.supplierId) === sId));
				const totalReturned = supReturns.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
				prAmount = Math.max(0, totalPaid - totalReturned);
			} else {
				prAmount = 0;
			}

			prReason = `Refund received from supplier for ${serviceConfig.label} ${prSelectedBookingDetail?.documentNumber || '#' + bookingId}`;
		} catch (err: any) {
			console.error('Failed to load booking detail:', err);
			// If not found in sales-entries (synthesized booking), create a virtual detail
			const foundBooking = prBookingsList.find((b) => String(b.id) === String(bookingId) || b.documentNumber === bookingId);
			if (foundBooking) {
				prSelectedBookingDetail = {
					id: foundBooking.id,
					documentNumber: foundBooking.documentNumber,
					payableAmount: foundBooking.payableAmount,
					paymentStatus: 'success',
					headName: foundBooking.headName,
					supplierName: suppliersList.find((s) => s.id === Number(prSupplierId))?.name || 'Supplier',
					supplierPayments: [{ amount: foundBooking.paidAmount || foundBooking.payableAmount, status: 'approved' }],
					purchaseReturns: foundBooking.returnedAmount ? [{ amount: foundBooking.returnedAmount, status: 'approved' }] : []
				};
				prAmount = Number(foundBooking.refundableBalance ?? foundBooking.paidAmount ?? 0);
				prReason = `Refund received from supplier for Booking ${foundBooking.documentNumber || '#' + bookingId}`;
			} else {
				toast.error('Failed to load supplier booking details.');
			}
		} finally {
			prLoadingDetail = false;
		}
	}

	// ─── Form Submission: Sales Return ───────────────────────────────────────────
	async function submitSalesReturn(e: Event) {
		e.preventDefault();
		if (srSubmitting) return;

		if (!srSelectedBookingDetail) {
			toast.error('Please select a valid service booking.');
			return;
		}
		if (srAmount <= 0) {
			toast.error('Return amount must be greater than 0.');
			return;
		}
		if (srAmount > srMaxRefundable + 0.001) {
			toast.error(`Refund amount cannot exceed maximum refundable balance (${srMaxRefundable.toFixed(3)} BHD).`);
			return;
		}


		srSubmitting = true;
		try {
			const isMaster = hasRole('master_accountant');
			const d = srSelectedBookingDetail;

			let recipientType = 'Head';
			let recipientId = Number(srHeadId || d.headId || d.agentId || 0);

			if (d.clientType?.toLowerCase() === 'agent' || (d.agentId && d.agentId > 0)) {
				recipientType = 'Agent';
				recipientId = Number(d.agentId || recipientId);
			}

			if (!recipientId || recipientId <= 0) {
				recipientId = Number(headsList[0]?.id || 1);
			}

			const payload = {
				recipientType,
				recipientId,
				serviceId: d.documentNumber || String(srSelectedBookingId),
				amount: srAmount,
				returnReason: srReason.trim() || 'Sales Return Customer Refund',
				sourceType: 'account',
				sourceId: '',
				serviceType: srServiceType
			};

			const idempotencyKey = `sr-record-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
			await createSalesReturn(payload, idempotencyKey);

			toast.success(
				isMaster
					? 'Sales Return recorded and auto-approved successfully.'
					: 'Sales Return draft submitted for Master Accountant approval.'
			);

			goto('/suppliers/returns');
		} catch (err: any) {
			console.error('Failed to submit sales return:', err);
			toast.error(err.message || 'Failed to submit sales return.');
		} finally {
			srSubmitting = false;
		}
	}

	// ─── Form Submission: Purchase Return ────────────────────────────────────────
	async function submitPurchaseReturn(e: Event) {
		e.preventDefault();
		if (prSubmitting) return;

		if (!prSupplierId) {
			toast.error('Please select a supplier.');
			return;
		}
		if (!prSelectedBookingDetail) {
			toast.error('Please select a service booking.');
			return;
		}
		if (prAmount <= 0) {
			toast.error('Return amount must be greater than 0.');
			return;
		}
		if (prSupplierInfo && prSupplierInfo.maxRefundable > 0 && prAmount > prSupplierInfo.maxRefundable + 0.001) {
			toast.error(`Return amount cannot exceed available paid balance (${prSupplierInfo.maxRefundable.toFixed(3)} BHD).`);
			return;
		}


		prSubmitting = true;
		try {
			const isMaster = hasRole('master_accountant');
			const d = prSelectedBookingDetail;
			const supplierObj = suppliersList.find((s) => s.id === Number(prSupplierId));

			const payload = {
				supplierId: Number(prSupplierId),
				originalPurchaseReference: d.documentNumber || String(prSelectedBookingId),
				externalReference: String(d.id || prSelectedBookingId),
				amount: prAmount,
				reason: prReason.trim() || 'Purchase Return Supplier Refund',
				destinationType: 'supplier_wallet' as const,
				destinationId: '',
				serviceType: prServiceType,
				supplierName: supplierObj?.name || 'Supplier'
			};

			const idempotencyKey = `pr-record-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
			await createPurchaseReturn(payload, idempotencyKey);

			toast.success(
				isMaster
					? 'Purchase Return recorded and auto-approved successfully.'
					: 'Purchase Return draft submitted for Master Accountant approval.'
			);

			goto('/suppliers/returns');
		} catch (err: any) {
			console.error('Failed to submit purchase return:', err);
			toast.error(err.message || 'Failed to submit purchase return.');
		} finally {
			prSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Record Return Workspace — Texas Accounts Portal</title>
</svelte:head>

<div class="space-y-6 max-w-7xl mx-auto pb-12">
	<!-- Top Navigation & Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div class="space-y-1">
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => goto('/suppliers/returns')}
					class="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
					title="Back to Returns List"
				>
					<ArrowLeft class="h-4 w-4" />
				</button>
				<div>
					<h1 class="text-xl font-bold text-foreground font-sans flex items-center gap-2">
						Record Return Workspace
					</h1>
					<p class="text-xs text-muted-foreground">
						Process customer sales refunds or supplier purchase returns with real-time financial validation.
					</p>
				</div>
			</div>
		</div>

		<!-- Role Privilege Badge -->
		<div class="flex items-center gap-2">
			{#if hasRole('master_accountant')}
				<div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
					<ShieldCheck class="h-4 w-4 text-emerald-500" />
					<span>Auto-Approval Mode (Master Accountant)</span>
				</div>
			{:else}
				<div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-semibold">
					<AlertCircle class="h-4 w-4 text-amber-500" />
					<span>Draft Mode (Pending Approval)</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- Mode Switcher: Purchase Return (Left) vs Sales Return (Right) -->
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
		<button
			type="button"
			onclick={() => { activeTab = 'purchase'; }}
			class={['p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between relative overflow-hidden',
				activeTab === 'purchase'
					? 'bg-card border-emerald-500/60 ring-2 ring-emerald-500/20 shadow-md'
					: 'bg-card/60 border-border hover:border-border/80 hover:bg-card'
			].join(' ')}
		>
			<div class="flex items-center gap-3">
				<div class={['p-2.5 rounded-xl transition-colors', activeTab === 'purchase' ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'].join(' ')}>
					<RotateCcw class="h-5 w-5" />
				</div>
				<div>
					<h3 class="text-sm font-bold text-foreground">Purchase Return (Supplier Refund)</h3>
					<p class="text-xs text-muted-foreground">Receive refund from Supplier into Bank, Cash Drawer, or Supplier Wallet.</p>
				</div>
			</div>
			{#if activeTab === 'purchase'}
				<div class="h-2.5 w-2.5 rounded-full bg-emerald-500"></div>
			{/if}
		</button>

		<button
			type="button"
			onclick={() => { activeTab = 'sales'; }}
			class={['p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between relative overflow-hidden',
				activeTab === 'sales'
					? 'bg-card border-rose-500/60 ring-2 ring-rose-500/20 shadow-md'
					: 'bg-card/60 border-border hover:border-border/80 hover:bg-card'
			].join(' ')}
		>
			<div class="flex items-center gap-3">
				<div class={['p-2.5 rounded-xl transition-colors', activeTab === 'sales' ? 'bg-rose-500 text-white' : 'bg-muted text-muted-foreground'].join(' ')}>
					<Undo2 class="h-5 w-5" />
				</div>
				<div>
					<h3 class="text-sm font-bold text-foreground">Sales Return (Customer Refund)</h3>
					<p class="text-xs text-muted-foreground">Refund money to Agent or Customer from Bank, Cash, or Credit Wallet.</p>
				</div>
			</div>
			{#if activeTab === 'sales'}
				<div class="h-2.5 w-2.5 rounded-full bg-rose-500"></div>
			{/if}
		</button>
	</div>

	<!-- ════════════════════════════════════════════════════════════════════════════ -->
	<!-- TAB 1: SALES RETURN WORKSPACE                                               -->
	<!-- ════════════════════════════════════════════════════════════════════════════ -->
	{#if activeTab === 'sales'}
		<form onsubmit={submitSalesReturn} class="space-y-6">
			<div class="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6">
				<div class="flex items-center justify-between pb-4 border-b border-border/60">
					<div class="flex items-center gap-2">
						<Undo2 class="h-5 w-5 text-rose-500" />
						<h2 class="text-base font-bold text-foreground">Record Sales Return</h2>
					</div>
					<span class="text-xs text-muted-foreground font-medium">Step 1 of 3: Select Beneficiary & Service</span>
				</div>

				<!-- Step 1 & 2: Salesman & Head Selection -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- Select Salesman -->
					<div class="space-y-1.5">
						<label for="sr-salesman" class="block text-xs font-bold text-foreground">
							1. Select Salesman
						</label>
						<SearchableSelect
							id="sr-salesman"
							options={salesmanOptions}
							bind:value={srSalesmanId}
							placeholder="-- All Salesmen --"
							searchPlaceholder="Search salesman name or email..."
							onchange={() => {
								srHeadId = '';
								fetchSalesBookings();
							}}
						/>
						<p class="text-[11px] text-muted-foreground">Filter customer heads by their assigned sales executive.</p>
					</div>

					<!-- Select Head (Agents & Customers) -->
					<div class="space-y-1.5">
						<label for="sr-head" class="block text-xs font-bold text-foreground">
							2. Select Head (Agent / Customer)
						</label>
						<SearchableSelect
							id="sr-head"
							options={headOptions}
							bind:value={srHeadId}
							placeholder="-- Select Agent or Customer Head --"
							searchPlaceholder="Search head name, type, or mobile..."
							onchange={() => {
								fetchSalesBookings();
							}}
						/>
						<p class="text-[11px] text-muted-foreground">Choose the customer or agent entity requesting the refund.</p>
					</div>
				</div>

				<!-- Step 3: 7 Services Selector -->
				<div class="space-y-2.5 pt-2">
					<div class="block text-xs font-bold text-foreground">
						3. Select Service Category (All 7 Services) <span class="text-red-500">*</span>
					</div>
					<div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
						{#each SERVICES as s}
							{@const IconComponent = s.icon}
							{@const isSelected = srServiceType === s.id}
							<button
								type="button"
								onclick={() => {
									srServiceType = s.id;
									srSelectedBookingId = '';
									srSelectedBookingDetail = null;
									fetchSalesBookings();
								}}
								class={['p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer',
									isSelected
										? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
										: 'bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium'
								].join(' ')}
							>
								<IconComponent class="h-4.5 w-4.5" />
								<span class="text-xs tracking-tight">{s.label}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- Service Booking Selection -->
				<div class="space-y-1.5 pt-2">
					<div class="flex items-center justify-between">
						<label for="sr-booking" class="block text-xs font-bold text-foreground">
							Select Service Booking / Reference <span class="text-red-500">*</span>
						</label>
						{#if srLoadingBookings}
							<span class="text-xs text-muted-foreground flex items-center gap-1">
								<RefreshCw class="h-3 w-3 animate-spin" /> Loading service bookings...
							</span>
						{:else}
							<span class="text-[11px] text-muted-foreground">
								{srBookingsList.length} matching booking(s) found
							</span>
						{/if}
					</div>
					<SearchableSelect
						id="sr-booking"
						options={srBookingOptions}
						bind:value={srSelectedBookingId}
						placeholder="-- Select Booking / Document Number --"
						searchPlaceholder="Search document number, ID, or passenger..."
						required
						onchange={(val) => {
							fetchSalesBookingDetail(val);
						}}
					/>
				</div>

				<!-- Step 4: Service & Financial Overview Display Banner -->
				{#if srLoadingDetail}
					<div class="p-8 text-center text-xs text-muted-foreground bg-muted/20 border border-border rounded-2xl flex items-center justify-center gap-2">
						<RefreshCw class="h-4 w-4 animate-spin text-primary" /> Fetching full service financial summary...
					</div>
				{:else if srSelectedBookingDetail}
					{@const d = srSelectedBookingDetail}
					<div class="p-5 bg-card border border-rose-500/20 rounded-2xl shadow-xs space-y-4">
						<div class="flex items-center justify-between pb-3 border-b border-border/50">
							<div class="flex items-center gap-2">
								<span class="text-xs font-bold uppercase tracking-wider text-rose-600 bg-rose-500/10 px-2.5 py-1 rounded-lg">
									{srServiceType} Details
								</span>
								<span class="text-xs font-bold text-foreground font-mono">
									{d.documentNumber || '#' + srSelectedBookingId}
								</span>
								<span class="text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide {srIsPaymentConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
									Payment: {d.paymentStatus || 'Pending'}
								</span>
								{#if srIsDealClosed}
									<span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-300">
										<Lock class="h-3 w-3 text-emerald-700" /> Deal Closed
									</span>
								{/if}
							</div>
							<div class="text-xs text-muted-foreground">
								Customer Head: <strong class="text-foreground font-semibold">{d.headName || d.clientType || 'Retail'}</strong>
							</div>
						</div>

						<!-- Metric Cards Grid -->
						<div class="grid grid-cols-2 md:grid-cols-5 gap-3">
							<div class="p-3 bg-muted/40 rounded-xl border border-border/60 space-y-1">
								<span class="text-[10px] text-muted-foreground uppercase font-semibold block">Customer Sale Price</span>
								<span class="text-xs font-bold font-mono text-foreground block">
									<MoneyDisplay amount={Number(d.payableAmount ?? d.payable_amount ?? 0)} />
								</span>
							</div>
							<div class="p-3 bg-muted/40 rounded-xl border border-border/60 space-y-1">
								<span class="text-[10px] text-muted-foreground uppercase font-semibold block">Supplier Settled (Paid)</span>
								<span class="text-xs font-bold font-mono text-rose-600 block">
									<MoneyDisplay amount={srTotalPaid} />
								</span>
							</div>
							<div class="p-3 bg-muted/40 rounded-xl border border-border/60 space-y-1">
								<span class="text-[10px] text-muted-foreground uppercase font-semibold block">Purchase Refunds Received</span>
								<span class="text-xs font-bold font-mono text-emerald-600 block">
									<MoneyDisplay amount={srTotalPurchaseReturns} />
								</span>
							</div>
							<div class="p-3 bg-muted/40 rounded-xl border border-border/60 space-y-1">
								<span class="text-[10px] text-muted-foreground uppercase font-semibold block">Customer Already Refunded</span>
								<span class="text-xs font-bold font-mono text-muted-foreground block">
									<MoneyDisplay amount={srTotalSalesReturns} />
								</span>
							</div>
							<div class="p-3 bg-rose-500/5 rounded-xl border border-rose-500/20 space-y-1">
								<span class="text-[10px] text-rose-600 uppercase font-semibold block">Max Customer Refund</span>
								<span class="text-xs font-bold font-mono text-rose-600 block">
									<MoneyDisplay amount={srMaxRefundable} />
								</span>
							</div>
						</div>

						<!-- Sequence Validation Warnings -->
						{#if !srIsPaymentConfirmed}
							<div class="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2">
								<AlertCircle class="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
								<div>
									<strong class="font-bold">Customer Payment Pending:</strong> The customer payment status for this booking is <span class="uppercase font-bold">{d.paymentStatus || 'Pending'}</span>. Customer payment must be confirmed as <strong>Success / Paid</strong> before customer refunds can be issued.
								</div>
							</div>
						{#if srTotalPurchaseReturns === 0}
							<div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2">
								<Info class="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
								<div>
									<strong class="font-bold">Supplier Return Pending / None:</strong> No approved purchase return has been recorded from the supplier yet for this booking. You can still issue this customer refund / credit note.
								</div>
							</div>
						{/if}
						{:else if srIsDealClosed}
							<div class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-900 dark:text-emerald-300 flex items-start gap-2">
								<Lock class="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
								<div>
									<strong class="font-bold">Deal Closed & Finalized:</strong> This deal is marked as finalized and closed. Customer refunds are locked.
								</div>
							</div>
						{:else if srMaxRefundable <= 0}
							<div class="p-3 bg-muted/40 border border-border rounded-xl text-xs text-muted-foreground flex items-start gap-2">
								<Info class="h-4 w-4 shrink-0 mt-0.5" />
								<div>
									<strong class="font-bold">No Remaining Refund Balance:</strong> The total eligible refund for this booking has already been processed.
								</div>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Step 5: Refund Method Selection -->
				<div class="space-y-4 pt-2 border-t border-border/60">
					<div class="flex items-center justify-between">
						<div class="block text-xs font-bold text-foreground">
							4. Choose Refund Method <span class="text-red-500">*</span>
						</div>
						<span class="text-[11px] text-muted-foreground">Where will the refund be debited from or credited to?</span>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
						<!-- Head Balance / Wallet Option -->
						<div
							class="p-3.5 rounded-xl border text-left bg-card border-primary ring-2 ring-primary/20 shadow-xs flex flex-col gap-1.5"
						>
							<div class="flex items-center justify-between">
								<span class="text-xs font-bold text-foreground flex items-center gap-1.5">
									<Wallet class="h-4 w-4 text-primary" /> Credit to Head Balance
								</span>
								<Check class="h-3.5 w-3.5 text-primary" />
							</div>
							<p class="text-[11px] text-muted-foreground">Credit funds straight to customer or agent account balance.</p>
						</div>
					</div>
				</div>

				<!-- Step 6: Refund Amount & Reason -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/60">
					<div class="space-y-1.5">
						<div class="flex items-center justify-between">
							<label for="sr-amt" class="block text-xs font-bold text-foreground">
								Refund Amount (BHD) <span class="text-red-500">*</span>
							</label>
							{#if srSelectedBookingDetail}
								<button
									type="button"
									onclick={() => { srAmount = srMaxRefundable; }}
									class="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
								>
									Max ({srMaxRefundable.toFixed(3)} BHD)
								</button>
							{/if}
						</div>
						<Input
							id="sr-amt"
							type="number"
							step="0.001"
							min="0.001"
							max={srMaxRefundable + 0.001}
							bind:value={srAmount}
							required
							placeholder="0.000"
						/>
					</div>

					<div class="space-y-1.5">
						<label for="sr-reason-text" class="block text-xs font-bold text-foreground">
							Refund Reason / Narrative <span class="text-red-500">*</span>
						</label>
						<Input
							id="sr-reason-text"
							type="text"
							bind:value={srReason}
							required
							placeholder="Reason for customer refund..."
						/>
					</div>
				</div>

				<!-- Submit Button Row -->
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-border/60">
					<div class="text-xs text-muted-foreground flex items-center gap-1.5">
						<Info class="h-4 w-4 text-primary shrink-0" />
						{#if hasRole('master_accountant')}
							<span>This transaction will be <strong>auto-approved</strong> and posted to the General Ledger immediately.</span>
						{:else}
							<span>This transaction will be routed to the <strong>Master Accountant Pending Approvals</strong> queue.</span>
						{/if}
					</div>

					<Button
						type="submit"
						disabled={srSubmitting || !canSalesReturn || srAmount <= 0 || srAmount > srMaxRefundable + 0.001}
						class="h-10 px-6 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-md flex items-center gap-2"
					>
						{#if srSubmitting}
							<RefreshCw class="h-4 w-4 animate-spin" />
							<span>Posting Sales Return...</span>
						{:else}
							<Undo2 class="h-4 w-4" />
							<span>{hasRole('master_accountant') ? 'Post & Auto-Approve Sales Return' : 'Submit Sales Return for Approval'}</span>
						{/if}
					</Button>
				</div>
			</div>
		</form>

	<!-- ════════════════════════════════════════════════════════════════════════════ -->
	<!-- TAB 2: PURCHASE RETURN WORKSPACE                                             -->
	<!-- ════════════════════════════════════════════════════════════════════════════ -->
	{:else if activeTab === 'purchase'}
		<form onsubmit={submitPurchaseReturn} class="space-y-6">
			<div class="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6">
				<div class="flex items-center justify-between pb-4 border-b border-border/60">
					<div class="flex items-center gap-2">
						<RotateCcw class="h-5 w-5 text-emerald-500" />
						<h2 class="text-base font-bold text-foreground">Record Purchase Return</h2>
					</div>
					<span class="text-xs text-muted-foreground font-medium">Step 1 of 3: Select Supplier & Service</span>
				</div>

				<!-- Step 1: Select Supplier -->
				<div class="space-y-1.5">
					<label for="pr-sup" class="block text-xs font-bold text-foreground">
						1. Select Supplier <span class="text-red-500">*</span>
					</label>
					<SearchableSelect
						id="pr-sup"
						options={supplierOptions}
						bind:value={prSupplierId}
						placeholder="-- Select Supplier --"
						searchPlaceholder="Search supplier name or wallet..."
						required
						onchange={() => {
							onSupplierChange();
						}}
					/>
					<p class="text-[11px] text-muted-foreground">Select the supplier to discover all active service applications and settled payments.</p>
				</div>

				<!-- Step 2: Linked Services for Selected Supplier -->
				<div class="space-y-2.5 pt-2">
					<div class="flex items-center justify-between">
						<div class="block text-xs font-bold text-foreground">
							2. Select Service Category <span class="text-red-500">*</span>
						</div>
						{#if prLoadingServices}
							<span class="text-xs text-muted-foreground flex items-center gap-1">
								<RefreshCw class="h-3 w-3 animate-spin" /> Discovering supplier services...
							</span>
						{:else if prSupplierId && prAvailableServices.length > 0}
							{@const activeCount = prAvailableServices.filter(s => s.bookingCount > 0).length}
							<span class="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
								{activeCount} active service categor{activeCount === 1 ? 'y' : 'ies'} linked
							</span>
						{/if}
					</div>

					{#if !prSupplierId}
						<div class="p-5 bg-muted/20 border border-dashed border-border rounded-2xl text-center text-xs text-muted-foreground">
							Please select a supplier in Step 1 above to view their linked services and settled bookings.
						</div>
					{:else if prLoadingServices}
						<div class="p-6 bg-muted/20 border border-border rounded-2xl text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
							<RefreshCw class="h-4 w-4 animate-spin text-emerald-500" />
							<span>Loading settled applications for selected supplier...</span>
						</div>
					{:else}
						<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
							{#each prAvailableServices as s}
								{@const IconComponent = s.icon}
								{@const isSelected = prServiceType === s.id}
								{@const hasBookings = s.bookingCount > 0}
								<button
									type="button"
									onclick={() => {
										prServiceType = s.id;
										prSelectedBookingId = '';
										prSelectedBookingDetail = null;
										fetchPurchaseBookings();
									}}
									class={[
										'p-3 rounded-xl border text-left transition-all flex items-start justify-between gap-2 cursor-pointer',
										isSelected
											? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs'
											: hasBookings
												? 'bg-card border-border hover:border-emerald-500/40 hover:bg-muted/40 text-foreground font-medium'
												: 'bg-muted/15 border-border/50 text-muted-foreground opacity-60 hover:opacity-100 font-medium'
									].join(' ')}
								>
									<div class="flex items-center gap-2.5">
										<div class={['p-2 rounded-lg', isSelected ? 'bg-emerald-500/20 text-emerald-600' : 'bg-muted text-muted-foreground'].join(' ')}>
											<IconComponent class="h-4 w-4" />
										</div>
										<div>
											<span class="text-xs font-semibold block">{s.label}</span>
											<span class="text-[10px] text-muted-foreground block">
												{s.bookingCount} settled booking{s.bookingCount === 1 ? '' : 's'}
											</span>
										</div>
									</div>
									{#if s.refundableBalance > 0}
										<span class="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
											{s.refundableBalance.toFixed(3)} BHD
										</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Step 3: Service Booking Selection -->
				<div class="space-y-1.5 pt-2">
					<div class="flex items-center justify-between">
						<label for="pr-booking" class="block text-xs font-bold text-foreground">
							3. Select Service Booking / Reference <span class="text-red-500">*</span>
						</label>
						{#if prLoadingBookings}
							<span class="text-xs text-muted-foreground flex items-center gap-1">
								<RefreshCw class="h-3 w-3 animate-spin" /> Loading supplier bookings...
							</span>
						{:else}
							<span class="text-[11px] text-muted-foreground">
								{prBookingsList.length} matching booking(s) found
							</span>
						{/if}
					</div>
					<SearchableSelect
						id="pr-booking"
						options={prBookingOptions}
						bind:value={prSelectedBookingId}
						placeholder={prBookingsList.length > 0 ? '-- Select Booking / Document Number --' : '-- No bookings found for this supplier --'}
						searchPlaceholder="Search document number, ID, or passenger..."
						required
						onchange={(val) => {
							fetchPurchaseBookingDetail(val);
						}}
					/>

					{#if !prLoadingBookings && prSupplierId && prBookingsList.length === 0}
						{@const selectedSup = suppliersList.find((s) => s.id === Number(prSupplierId))}
						{@const selectedService = getServiceConfig(prServiceType)}
						<div class="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2 mt-2">
							<AlertCircle class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
							<span>
								No <strong>{selectedService.label}</strong> applications found for supplier <strong>{selectedSup?.name || 'Selected Supplier'}</strong>.
							</span>
						</div>
					{/if}
				</div>

				<!-- Step 3: Service & Financial Overview Display Banner -->
				{#if prLoadingDetail}
					<div class="p-8 text-center text-xs text-muted-foreground bg-muted/20 border border-border rounded-2xl flex items-center justify-center gap-2">
						<RefreshCw class="h-4 w-4 animate-spin text-emerald-500" /> Fetching supplier payment history & costs...
					</div>
				{:else if prSelectedBookingDetail}
					{@const d = prSelectedBookingDetail}
					<div class="p-5 bg-card border border-emerald-500/20 rounded-2xl shadow-xs space-y-4">
						<div class="flex items-center justify-between pb-3 border-b border-border/50">
							<div class="flex items-center gap-2">
								<span class="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
									{prServiceType} Supplier Costs
								</span>
								<span class="text-xs font-bold text-foreground font-mono">
									{d.documentNumber || '#' + prSelectedBookingId}
								</span>
								<span class="text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide {prIsPaymentConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
									Payment: {d.paymentStatus || 'Pending'}
								</span>
								{#if prIsDealClosed}
									<span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-300">
										<Lock class="h-3 w-3 text-emerald-700" /> Deal Closed
									</span>
								{/if}
							</div>
							<div class="text-xs text-muted-foreground">
								Selected Supplier: <strong class="text-foreground font-semibold">{suppliersList.find((s) => s.id === Number(prSupplierId))?.name || d.supplierName || 'Supplier'}</strong>
							</div>
						</div>

						<!-- Metric Cards Grid -->
						<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
							<div class="p-3 bg-muted/40 rounded-xl border border-border/60 space-y-1">
								<span class="text-[10px] text-muted-foreground uppercase font-semibold block">Expected Supplier Cost</span>
								<span class="text-xs font-bold font-mono text-foreground block">
									<MoneyDisplay amount={Number(d.expectedSupplierCost ?? d.expected_supplier_cost ?? 0)} />
								</span>
							</div>
							<div class="p-3 bg-muted/40 rounded-xl border border-border/60 space-y-1">
								<span class="text-[10px] text-muted-foreground uppercase font-semibold block">Total Paid to Supplier</span>
								<span class="text-xs font-bold font-mono text-emerald-600 block">
									<MoneyDisplay amount={prSupplierInfo?.totalPaid ?? 0} />
								</span>
							</div>
							<div class="p-3 bg-muted/40 rounded-xl border border-border/60 space-y-1">
								<span class="text-[10px] text-muted-foreground uppercase font-semibold block">Previously Returned</span>
								<span class="text-xs font-bold font-mono text-muted-foreground block">
									<MoneyDisplay amount={prSupplierInfo?.totalReturned ?? 0} />
								</span>
							</div>
							<div class="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20 space-y-1">
								<span class="text-[10px] text-emerald-600 uppercase font-semibold block">Available Refund Balance</span>
								<span class="text-xs font-bold font-mono text-emerald-600 block">
									<MoneyDisplay amount={prSupplierInfo?.maxRefundable ?? 0} />
								</span>
							</div>
						</div>

						<!-- Sequence Validation Warnings -->
						{#if !prIsPaymentConfirmed}
							<div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2">
								<Info class="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
								<div>
									<strong class="font-bold">Customer Payment Status:</strong> Customer payment status is currently <span class="uppercase font-bold">{d.paymentStatus || 'Pending'}</span>. Supplier refund will be credited to Texas Travel independently of the customer payment status.
								</div>
							</div>
						{/if}
						{#if !prSupplierInfo?.hasApprovedPayment && (prSupplierInfo?.totalPaid ?? 0) === 0}
							<div class="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2">
								<AlertCircle class="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
								<div>
									<strong class="font-bold">No Supplier Payment Recorded:</strong> Supplier refund (Purchase Return) requires an approved supplier payment for this booking.
								</div>
							</div>
						{:else if (prSupplierInfo?.totalPaid ?? 0) > 0 && (prSupplierInfo?.maxRefundable ?? 0) <= 0}
							<div class="p-3 bg-muted/40 border border-border rounded-xl text-xs text-muted-foreground flex items-start gap-2">
								<Info class="h-4 w-4 shrink-0 mt-0.5" />
								<div>
									<strong class="font-bold">No Remaining Return Balance:</strong> All settled funds for this supplier on this booking have already been refunded.
								</div>
							</div>
						{/if}
						{#if prIsDealClosed}
							<div class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-900 dark:text-emerald-300 flex items-start gap-2">
								<Lock class="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
								<div>
									<strong class="font-bold">Deal Closed:</strong> This booking deal is closed and finalized. The supplier return will be recorded and credited to the company account.
								</div>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Step 4: Where the Purchase Return Should Increment (Destination) -->
				<div class="space-y-4 pt-2 border-t border-border/60">
					<div class="flex items-center justify-between">
						<div class="block text-xs font-bold text-foreground">
							3. Where should the Purchase Return Increment? <span class="text-red-500">*</span>
						</div>
						<span class="text-[11px] text-muted-foreground">Which account or wallet receives the returned funds?</span>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
						<!-- Supplier Wallet Destination -->
						<div
							class="p-3.5 rounded-xl border text-left bg-card border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs flex flex-col gap-1.5"
						>
							<div class="flex items-center justify-between">
								<span class="text-xs font-bold text-foreground flex items-center gap-1.5">
									<Wallet class="h-4 w-4 text-emerald-500" /> Supplier Wallet Balance
								</span>
								<Check class="h-3.5 w-3.5 text-emerald-500" />
							</div>
							<p class="text-[11px] text-muted-foreground">Credit supplier's wallet balance for future bookings.</p>
						</div>
					</div>
				</div>

				<!-- Step 5: Return Amount & Reason -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/60">
					<div class="space-y-1.5">
						<div class="flex items-center justify-between">
							<label for="pr-amt" class="block text-xs font-bold text-foreground">
								Return Amount (BHD) <span class="text-red-500">*</span>
							</label>
							{#if prSupplierInfo}
								<button
									type="button"
									onclick={() => { prAmount = prSupplierInfo.maxRefundable; }}
									class="text-[11px] font-semibold text-emerald-600 hover:underline cursor-pointer"
								>
									Max ({prSupplierInfo.maxRefundable.toFixed(3)} BHD)
								</button>
							{/if}
						</div>
						<Input
							id="pr-amt"
							type="number"
							step="0.001"
							min="0.001"
							max={(prSupplierInfo?.maxRefundable ?? 0) + 0.001}
							bind:value={prAmount}
							required
							placeholder="0.000"
						/>
					</div>

					<div class="space-y-1.5">
						<label for="pr-reason-text" class="block text-xs font-bold text-foreground">
							Return Reason / Narrative <span class="text-red-500">*</span>
						</label>
						<Input
							id="pr-reason-text"
							type="text"
							bind:value={prReason}
							required
							placeholder="Reason for supplier refund..."
						/>
					</div>
				</div>

				<!-- Submit Button Row -->
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-border/60">
					<div class="text-xs text-muted-foreground flex items-center gap-1.5">
						<Info class="h-4 w-4 text-emerald-500 shrink-0" />
						{#if hasRole('master_accountant')}
							<span>This transaction will be <strong>auto-approved</strong> and posted to the General Ledger immediately.</span>
						{:else}
							<span>This transaction will be routed to the <strong>Master Accountant Pending Approvals</strong> queue.</span>
						{/if}
					</div>

					<Button
						type="submit"
						disabled={prSubmitting || !canPurchaseReturn || !prSupplierId || prAmount <= 0 || (prSupplierInfo && prSupplierInfo.maxRefundable > 0 && prAmount > prSupplierInfo.maxRefundable + 0.001)}
						class="h-10 px-6 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-md flex items-center gap-2"
					>
						{#if prSubmitting}
							<RefreshCw class="h-4 w-4 animate-spin" />
							<span>Posting Purchase Return...</span>
						{:else}
							<RotateCcw class="h-4 w-4" />
							<span>{hasRole('master_accountant') ? 'Post & Auto-Approve Purchase Return' : 'Submit Purchase Return for Approval'}</span>
						{/if}
					</Button>
				</div>
			</div>
		</form>
	{/if}
</div>
