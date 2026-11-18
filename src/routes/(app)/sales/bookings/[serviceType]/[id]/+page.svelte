<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { apiFetch } from '$lib/api/api-client';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { DateDisplay } from '$lib/components';
	import { Button } from '$lib/components/ui/button';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import { getAccounts } from '$features/cash-accounts/api';
	import { getBanks } from '$features/bank-accounts/api';
	import { getSuppliers, createSupplierPayment, approveSupplierPayment, rejectSupplierPayment, updateSupplierPayment, createPurchaseReturn, createSalesReturn, approvePurchaseReturn, rejectPurchaseReturn, approveSalesReturn, rejectSalesReturn, updateBookingProcessingStatus, updateBookingOperationClosed } from '$features/suppliers/api';
	import { fetchAccountsStaff, fetchSalesStaff, fetchOperationalStaff } from '$features/staffs/api/staffs-api';
	import type { StaffUserResponse } from '$features/staffs/types/staff-types';
	import type { AccountResponse } from '$features/cash-accounts/types';
	import type { BankResponse } from '$features/bank-accounts/types';
	import {
		ArrowLeft,
		RefreshCw,
		Printer,
		User,
		CreditCard,
		FileText,
		Package,
		ReceiptText,
		BookOpen,
		Send,
		Clock,
		Coins,
		PlusCircle,
		Undo2,
		AlertCircle,
		Pencil,
		Check,
		X,
		Lock,
		CheckCircle2,
		Unlock
	} from 'lucide-svelte';
	import { currentUser, hasRole } from '$lib/stores/auth';
	import { toast } from '$lib/stores/toast';
	import { getSalesPortalFileUrl } from '$lib/config';
	import { Input } from '$lib/components/ui/input';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import SupplierPaymentRejectDialog from '$lib/components/SupplierPaymentRejectDialog.svelte';
	import { previewDocument } from '$lib/utils/preview-document';
	import { createIdempotentOperation } from '$lib/utils/idempotency';

	function getInvoiceEntityType(type: string): string {
		const map: Record<string, string> = {
			flights: 'flight',
			flight: 'flight',
			hotels: 'hotel',
			hotel: 'hotel',
			visa: 'visa',
			visas: 'visa',
			vfs: 'vfs',
			holiday: 'holiday',
			holidays: 'holiday',
			'holiday-packages': 'holiday',
			transportation: 'transport',
			transport: 'transport',
			'other-services': 'other',
			other: 'other'
		};
		return map[(type || '').toLowerCase()] ?? type;
	}


	const serviceType = $derived($page.params.serviceType || 'flights');
	const bookingId   = $derived($page.params.id);

	let detail = $state<any>(null);
	let loading = $state(false);
	let actionLoading = $state(false);
	let error = $state<string | null>(null);
	let activeTab = $state('overview');
	let cashAccounts = $state<AccountResponse[]>([]);
	let banks = $state<BankResponse[]>([]);
	let suppliersList = $state<any[]>([]);
	let systemUsers = $state<StaffUserResponse[]>([]);
	let headsList = $state<any[]>([]);
	let agentsList = $state<any[]>([]);
	let selectedCashAccountIdVal = $state('');

	// Booking status confirmation modal state
	let showStatusConfirmModal = $state(false);
	let showReferenceIdModal = $state(false);
	let onlineReferenceIdVal = $state('');
	let refIdModalError = $state<string | null>(null);
	let statusConfirmTitle = $state('');
	let statusConfirmMessage = $state('');
	let statusConfirmActionLabel = $state('');
	let statusConfirmIsDestructive = $state(false);
	let targetBookingStatusToApply = $state('');

	// Supplier payment reject modal state
	let showSpRejectModal = $state(false);
	let spToReject = $state<any>(null);
	let spRejectLoading = $state(false);

	// Booking Deal Close & unlock modal state
	let showMarkDealClosedModal = $state(false);
	let showUnlockModal = $state(false);
	let showUnlockOperationModal = $state(false);
	let showLockOperationModal = $state(false);
	let completionLoading = $state(false);
	let localOperationClosedOverride = $state<boolean | null>(null);
	let localDealClosedOverride = $state<boolean | null>(null);

	async function handleMarkAsDealClosed() {
		try {
			if (!bookingId) return;
			completionLoading = true;
			localDealClosedOverride = true;
			await updateBookingProcessingStatus(serviceType, bookingId, 'deal_closed');
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(`tx_deal_closed_${serviceType}_${bookingId}`, 'true');
				localStorage.setItem(`txops_${serviceType}_closed_${bookingId}`, 'true');
				if (serviceType === 'visa') {
					localStorage.setItem(`txops_visa_closed_${bookingId}`, 'true');
				}
			}
			if (sd) {
				sd.isDealClosed = true;
			}
			toast.success('Deal marked as closed successfully. Supplier payouts and returns are now locked.');
			showMarkDealClosedModal = false;
			await fetchDetail();
		} catch (err: any) {
			toast.error(err?.message || 'Failed to mark deal as closed');
		} finally {
			completionLoading = false;
		}
	}

	
	
	async function handleLockOperation() {
		try {
			if (!bookingId) return;
			completionLoading = true;
			localOperationClosedOverride = true;
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(`txops_${serviceType}_closed_${bookingId}`, 'true');
				if (serviceType === 'visa') {
					localStorage.setItem(`txops_visa_closed_${bookingId}`, 'true');
				}
			}
			if (sd) {
				sd.operationClosed = true;
				sd.operation_closed = true;
			}
			if (detail) {
				detail.operationClosed = true;
				detail.operation_closed = true;
			}
			await updateBookingOperationClosed(serviceType, bookingId, true);
			toast.success('Operation locked successfully by Master Accountant. Operational actions are now locked in Operational Portal.');
			showLockOperationModal = false;
			await fetchDetail();
		} catch (err: any) {
			localOperationClosedOverride = null;
			toast.error(err?.message || 'Failed to lock operation');
		} finally {
			completionLoading = false;
		}
	}

	async function handleUnlockOperation() {
		try {
			if (!bookingId) return;
			completionLoading = true;
			localOperationClosedOverride = false;
			if (typeof localStorage !== 'undefined') {
				localStorage.removeItem(`txops_${serviceType}_closed_${bookingId}`);
				localStorage.removeItem(`txops_visa_closed_${bookingId}`);
			}
			if (sd) {
				sd.operationClosed = false;
				sd.operation_closed = false;
			}
			if (detail) {
				detail.operationClosed = false;
				detail.operation_closed = false;
			}
			await updateBookingOperationClosed(serviceType, bookingId, false);
			toast.success('Operation unlocked successfully by Master Accountant. Operational actions are now editable in Operational Portal.');
			showUnlockOperationModal = false;
			await fetchDetail();
		} catch (err: any) {
			localOperationClosedOverride = null;
			toast.error(err?.message || 'Failed to unlock operation');
		} finally {
			completionLoading = false;
		}
	}

	async function handleUnlockBooking() {
		try {
			if (!bookingId) return;
			completionLoading = true;
			localDealClosedOverride = false;
			await updateBookingProcessingStatus(serviceType, bookingId, 'unlocked');
			if (typeof localStorage !== 'undefined') {
				localStorage.removeItem(`tx_deal_closed_${serviceType}_${bookingId}`);
				localStorage.removeItem(`txops_${serviceType}_closed_${bookingId}`);
				if (serviceType === 'visa') {
					localStorage.removeItem(`txops_visa_closed_${bookingId}`);
				}
			}
			if (sd) {
				sd.isDealClosed = false;
				sd.is_deal_closed = false;
			}
			if (detail) {
				(detail as any).isDealClosed = false;
				(detail as any).is_deal_closed = false;
			}
			toast.success('Deal unlocked successfully by Master Accountant. Payouts and returns are now accessible.');
			showUnlockModal = false;
			await fetchDetail();
		} catch (err: any) {
			localDealClosedOverride = null;
			toast.error(err?.message || 'Failed to unlock deal');
		} finally {
			completionLoading = false;
		}
	}

	// Idempotency keys for write operations
	const payIdempotency = createIdempotentOperation();
	const purchaseReturnIdempotency = createIdempotentOperation();
	const salesReturnIdempotency = createIdempotentOperation();

	// Shorthand metrics
	const sd = $derived(detail?.salesDetail ?? null);
	const isAgent = $derived(sd?.clientType?.toLowerCase() === 'agent');
	const isCashBooking = $derived(
		sd?.paymentMethod?.toLowerCase() === 'cash' ||
		sd?.paymentMode?.toLowerCase() === 'cash' ||
		(serviceType === 'visa' && sd?.applicants?.[0]?.paymentMethod?.toLowerCase() === 'cash')
	);
	const displayPaymentMethod = $derived(
		sd?.paymentMethod || (serviceType === 'visa' && sd?.applicants?.[0]?.paymentMethod) || sd?.paymentMode || ''
	);

	const totalPaid = $derived(
		detail?.supplierPayments
			?.filter((p: any) => p.status?.toLowerCase() === 'approved')
			?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) ?? 0
	);

	const hasSettledSupplierPayments = $derived(
		detail?.supplierPayments?.some((p: any) => p.status?.toLowerCase() === 'approved') ?? false
	);

	const pendingSupplierPayments = $derived(
		detail?.supplierPayments?.filter((p: any) => p.status?.toLowerCase().includes('pending') || p.status?.toLowerCase() === 'draft') ?? []
	);

	const pendingPurchaseReturns = $derived(
		detail?.purchaseReturns?.filter((r: any) => r.status?.toLowerCase().includes('pending') || r.status?.toLowerCase() === 'draft') ?? []
	);

	const pendingSalesReturns = $derived(
		detail?.salesReturns?.filter((r: any) => r.status?.toLowerCase().includes('pending') || r.status?.toLowerCase() === 'draft') ?? []
	);

	const totalPendingSettlements = $derived(
		pendingSupplierPayments.length + pendingPurchaseReturns.length + pendingSalesReturns.length
	);

	const totalPurchaseReturns = $derived(
		detail?.purchaseReturns
			?.filter((r: any) => r.status?.toLowerCase() === 'approved')
			?.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0) ?? 0
	);

	const totalSalesReturns = $derived(
		detail?.salesReturns
			?.filter((r: any) => r.status?.toLowerCase() === 'approved')
			?.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0) ?? 0
	);

	// Payment status validation (Supplier/Returns tab is locked until payment_status = 'success' / 'paid')
	const isPaymentSuccessful = $derived.by(() => {
		const raw = (
			sd?.paymentStatus ||
			sd?.payment_status ||
			(serviceType === 'visa' && sd?.applicants?.[0]?.paymentStatus) ||
			(serviceType === 'visa' && sd?.applicants?.[0]?.payment_status) ||
			''
		).toLowerCase().trim();
		return raw === 'success' || raw === 'paid';
	});

	
	const isOperationClosed = $derived.by(() => {
		if (localOperationClosedOverride !== null) {
			return localOperationClosedOverride;
		}
		if (typeof localStorage !== 'undefined') {
			if (
				localStorage.getItem(`txops_${serviceType}_closed_${bookingId}`) === 'true' ||
				(serviceType === 'visa' && localStorage.getItem(`txops_visa_closed_${bookingId}`) === 'true')
			) {
				return true;
			}
		}
		return Boolean(
			sd?.operationClosed === true ||
			sd?.operationClosed === 1 ||
			sd?.operation_closed === true ||
			sd?.operation_closed === 1 ||
			(detail as any)?.operationClosed === true ||
			(detail as any)?.operation_closed === true
		);
	});

	const isDealClosed = $derived.by(() => {
		if (localDealClosedOverride !== null) {
			return localDealClosedOverride;
		}
		if (typeof localStorage !== 'undefined') {
			if (localStorage.getItem(`tx_deal_closed_${serviceType}_${bookingId}`) === 'true') {
				return true;
			}
		}
		if (sd?.isDealClosed === true || sd?.is_deal_closed === true || (detail as any)?.isDealClosed === true || (detail as any)?.is_deal_closed === true) {
			return true;
		}
		if (sd?.isDealClosed === false || sd?.is_deal_closed === false || (detail as any)?.isDealClosed === false || (detail as any)?.is_deal_closed === false) {
			return false;
		}
		const proc = (sd?.processingStatus || (detail as any)?.processingStatus || '').toLowerCase().trim();
		if (proc === 'deal_closed' || proc === 'locked') return true;
		if (proc === 'unlocked' || proc === 'open') return false;

		const ord = (sd?.orderStatus || (detail as any)?.orderStatus || '').toLowerCase().trim();
		if (ord === 'closed' || ord === 'deal_closed') {
			return true;
		}
		return false;
	});

	// Sequence rule properties
	const canPay = $derived(isPaymentSuccessful && !isDealClosed);
	const canPurchaseReturn = $derived(isPaymentSuccessful && totalPaid > 0 && !isDealClosed);
	const canSalesReturn = $derived(isPaymentSuccessful && totalPurchaseReturns > 0 && !isDealClosed);

	// Calculated authoritative profit for the booking
	const calculatedProfit = $derived.by(() => {
		if (sd?.isInhouse) return 0;
		if (serviceType === 'visa' && (sd?.processingStatus?.toLowerCase() === 'rejected' || sd?.isRejected)) {
			return sd?.rejectionFee ?? 0;
		}
		// If supplier payouts have been settled/approved (including when settled at 0):
		if (hasSettledSupplierPayments || totalPaid > 0) {
			const effectiveCost = totalPaid - totalPurchaseReturns;
			return (sd?.payableAmount ?? 0) - totalSalesReturns - effectiveCost;
		}
		// If expected supplier cost was explicitly provided (> 0):
		if ((sd?.expectedSupplierCost ?? 0) > 0) {
			return (sd?.payableAmount ?? 0) - totalSalesReturns - sd.expectedSupplierCost;
		}
		// When supplier cost is not yet entered/settled, profit is 0 (not full payable sale):
		return 0;
	});

	function supplierMatchesServiceType(supplier: any, sType: string): boolean {
		if (!supplier) return false;
		if (sd?.supplierId && Number(supplier.id) === Number(sd.supplierId)) return true;
		
		const cats = Array.isArray(supplier.categories) ? supplier.categories : [];
		if (cats.length === 0) return false;
		
		const st = (sType || '').toLowerCase();
		return cats.some((cat: string) => {
			const c = (cat || '').toLowerCase().trim();
			if ((st === 'flights' || st === 'flight') && (c.includes('flight') || c.includes('air'))) return true;
			if ((st === 'hotels' || st === 'hotel') && c.includes('hotel')) return true;
			if ((st === 'visa' || st === 'visas') && c.includes('visa')) return true;
			if (st === 'vfs' && c.includes('vfs')) return true;
			if ((st === 'holiday' || st === 'holiday-packages') && (c.includes('holiday') || c.includes('package'))) return true;
			if ((st === 'transportation' || st === 'transport') && c.includes('transport')) return true;
			if ((st === 'other-services' || st === 'other' || st === 'other_service') && c.includes('other')) return true;
			return false;
		});
	}

	// Form dropdown options and filtered sets (strictly filtered to suppliers in matching service category)
	const filteredSuppliersList = $derived.by(() => {
		const active = (suppliersList || []).filter((s) => s.isActive !== false);
		const matching = active.filter((s) => supplierMatchesServiceType(s, serviceType));
		return matching.length > 0 ? matching : active;
	});

	const selectedPaySupplier = $derived(
		suppliersList.find((s) => Number(s.id) === Number(paySupplierId)) ?? null
	);

	const filteredSourceAccounts = $derived.by(() => {
		if (payMethod === 'cash') {
			return cashAccounts.map((a) => ({ id: `account_${a.id}`, name: `[Cash] ${a.name} (Bal: ${a.currentBalance.toFixed(3)} BHD)` }));
		}
		return banks.map((b) => ({ id: `bank_${b.id}`, name: `[Bank] ${b.bankName} (Bal: ${b.currentBalance.toFixed(3)} BHD)` }));
	});

	const filteredPurchaseReturnDestAccounts = $derived.by(() => {
		if (prDestType === 'account') {
			return cashAccounts.map((a) => ({ id: `account_${a.id}`, name: `[Cash] ${a.name} (Bal: ${a.currentBalance.toFixed(3)} BHD)` }));
		}
		return banks.map((b) => ({ id: `bank_${b.id}`, name: `[Bank] ${b.bankName} (Bal: ${b.currentBalance.toFixed(3)} BHD)` }));
	});

	const filteredSalesReturnSourceAccounts = $derived.by(() => {
		if (srSourceType === 'account') {
			return cashAccounts.map((a) => ({ id: `account_${a.id}`, name: `[Cash] ${a.name} (Bal: ${a.currentBalance.toFixed(3)} BHD)` }));
		}
		return banks.map((b) => ({ id: `bank_${b.id}`, name: `[Bank] ${b.bankName} (Bal: ${b.currentBalance.toFixed(3)} BHD)` }));
	});

	const paidSuppliersForBooking = $derived.by(() => {
		const payments = (detail?.supplierPayments ?? []).filter((p: any) => (p.status || '').toLowerCase() === 'approved');
		const returns = (detail?.purchaseReturns ?? []).filter((r: any) => (r.status || '').toLowerCase() === 'approved');
		
		const supMap = new Map<number, { id: number; name: string; code?: string; totalPaid: number; totalReturned: number; maxRefundable: number }>();
		for (const p of payments) {
			const sId = Number(p.supplierId);
			if (!sId) continue;
			const sup = suppliersList.find((s) => Number(s.id) === sId);
			const supName = sup?.name || p.supplierName || `Supplier #${sId}`;
			const supCode = sup?.code;
			if (!supMap.has(sId)) {
				supMap.set(sId, { id: sId, name: supName, code: supCode, totalPaid: 0, totalReturned: 0, maxRefundable: 0 });
			}
			const entry = supMap.get(sId)!;
			entry.totalPaid += Number(p.amount) || 0;
		}

		for (const r of returns) {
			const sId = Number(r.supplierId);
			if (supMap.has(sId)) {
				const entry = supMap.get(sId)!;
				entry.totalReturned += Number(r.amount) || 0;
			}
		}

		for (const entry of supMap.values()) {
			entry.maxRefundable = Math.max(0, entry.totalPaid - entry.totalReturned);
		}

		return Array.from(supMap.values());
	});

	function formatPaymentMethodLabel(sp: any): string {
		if (!sp) return '—';
		const status = (sp.status || '').toLowerCase();
		if (status === 'pending' || status === 'draft' || status.includes('pending')) {
			return '—';
		}
		const pm = (sp.paymentMethod || '').toLowerCase();
		if (pm.includes('bank')) {
			const bId = sp.sourceBankId || sp.source_bank_id || (sp.sourceAccountId && String(sp.sourceAccountId).startsWith('bank_') ? String(sp.sourceAccountId).substring(5) : null);
			const bankName = sp.sourceBankName || sp.source_bank_name || (bId ? banks.find((b) => Number(b.id) === Number(bId))?.bankName : null) || sp.sourceAccountName || sp.source_account_name;
			return bankName ? `Bank (${bankName})` : 'Bank Account';
		}
		if (pm.includes('cash')) {
			const aId = sp.sourceAccountId || sp.source_account_id || (sp.sourceAccountId && String(sp.sourceAccountId).startsWith('account_') ? String(sp.sourceAccountId).substring(8) : null);
			const cashName = sp.sourceAccountName || sp.source_account_name || (aId ? cashAccounts.find((a) => Number(a.id) === Number(aId))?.name : null);
			return cashName ? `Cash (${cashName})` : 'Cash Account';
		}
		if (pm.includes('wallet')) return 'Supplier Wallet';
		if (pm.includes('credit')) return 'Credit';
		return sp.paymentMethod || '—';
	}

	// Dropdowns mapping helper
	const allAccountsAndBanks = $derived([
		...cashAccounts.map((a) => ({ id: `account_${a.id}`, name: `[Cash] ${a.name} (Bal: ${a.currentBalance.toFixed(3)} BHD)` })),
		...banks.map((b) => ({ id: `bank_${b.id}`, name: `[Bank] ${b.bankName} (Bal: ${b.currentBalance.toFixed(3)} BHD)` }))
	]);

	const recipientOptions = $derived.by(() => {
		const list: { id: number; name: string }[] = [];

		const bookingAgentId = sd?.agentId || (sd?.clientType?.toLowerCase() === 'agent' ? sd?.headId : null);
		const bookingAgentName = sd?.agent || (sd?.clientType?.toLowerCase() === 'agent' ? sd?.headName : null) || 'Agent';

		const bookingHeadId = sd?.headId || (sd?.clientType?.toLowerCase() === 'agent' ? sd?.agentId : null);
		const bookingHeadName = sd?.headName || (sd?.clientType?.toLowerCase() === 'agent' ? sd?.agent : null) || sd?.name || sd?.guestName || sd?.passengerName || 'Customer Head';

		if (srRecipientType === 'Agent') {
			if (bookingAgentId) {
				list.push({
					id: Number(bookingAgentId),
					name: `${bookingAgentName} (ID: ${bookingAgentId})`
				});
			}
			if (bookingHeadId && bookingHeadId !== bookingAgentId) {
				list.push({
					id: Number(bookingHeadId),
					name: `${bookingHeadName} (Head ID: ${bookingHeadId})`
				});
			}
			for (const a of agentsList) {
				if (!list.some((i) => i.id === a.id)) {
					list.push({
						id: a.id,
						name: `${a.firstName || a.fullName || a.name || 'Agent'} (ID: ${a.id})`
					});
				}
			}
			for (const h of headsList) {
				if (h.type === 'agent' && !list.some((i) => i.id === h.id)) {
					list.push({
						id: h.id,
						name: `${h.fullName || (h.firstName ? `${h.firstName} ${h.lastName || ''}`.trim() : h.name || 'Agent Head')} (ID: ${h.id})`
					});
				}
			}
		} else {
			if (bookingHeadId) {
				list.push({
					id: Number(bookingHeadId),
					name: `${bookingHeadName} (ID: ${bookingHeadId})`
				});
			}
			if (bookingAgentId && bookingAgentId !== bookingHeadId) {
				list.push({
					id: Number(bookingAgentId),
					name: `${bookingAgentName} (Agent Head ID: ${bookingAgentId})`
				});
			}
			for (const h of headsList) {
				if (!list.some((i) => i.id === h.id)) {
					list.push({
						id: h.id,
						name: `${h.fullName || (h.firstName ? `${h.firstName} ${h.lastName || ''}`.trim() : h.name || 'Head')} (ID: ${h.id})`
					});
				}
			}
		}

		if (list.length === 0) {
			const fallbackId = sd?.agentId || sd?.headId || 1;
			const fallbackName = sd?.agent || sd?.headName || sd?.name || 'Recipient';
			list.push({
				id: Number(fallbackId),
				name: `${fallbackName} (ID: ${fallbackId})`
			});
		}

		return list;
	});

	const prSupplierOptions = $derived.by(() => {
		if (paidSuppliersForBooking.length > 0) {
			return paidSuppliersForBooking.map((s) => ({
				id: s.id,
				name: s.code ? `${s.name} (${s.code})` : s.name,
				subtext: `Paid: ${s.totalPaid.toFixed(3)} BHD | Available Refund: ${s.maxRefundable.toFixed(3)} BHD`
			}));
		}
		return suppliersList.map((s) => ({
			id: s.id,
			name: s.code ? `${s.name} (${s.code})` : s.name
		}));
	});

	const selectedPrSupplierInfo = $derived.by(() => {
		return paidSuppliersForBooking.find((s) => s.id === Number(prSupplierId)) ?? null;
	});

	const currentSelectedSupplierMaxRefund = $derived.by(() => {
		if (selectedPrSupplierInfo) {
			return selectedPrSupplierInfo.maxRefundable;
		}
		return Math.max(0, totalPaid - totalPurchaseReturns);
	});

	$effect(() => {
		if (showPurchaseReturnModal && prSupplierId) {
			const maxVal = currentSelectedSupplierMaxRefund;
			if (prAmount > maxVal || prAmount <= 0) {
				prAmount = maxVal;
			}
		}
	});

	// Modal visibility
	let showPaymentModal = $state(false);
	let showPurchaseReturnModal = $state(false);
	let showSalesReturnModal = $state(false);
	let showEditGovtFeeModal = $state(false);

	let editGovtFeePaymentId = $state(0);
	let editGovtFeeAmount = $state(0);
	let editGovtFeeRefNum = $state('');
	let editGovtFeeDesc = $state('');
	let editGovtFeeSupplierId = $state(0);

	function openEditGovtFeeModal(sp: any) {
		editGovtFeePaymentId = sp.id;
		editGovtFeeAmount = sp.amount;
		editGovtFeeRefNum = sp.referenceNumber ?? '';
		editGovtFeeDesc = sp.description ?? '';
		editGovtFeeSupplierId = sp.supplierId;
		showEditGovtFeeModal = true;
	}

	async function submitEditGovtFeeForm(e: Event) {
		e.preventDefault();
		if (editGovtFeeAmount == null || isNaN(editGovtFeeAmount) || editGovtFeeAmount < 0) return;
		actionLoading = true;
		try {
			await updateSupplierPayment(editGovtFeePaymentId, {
				amount: editGovtFeeAmount,
				referenceNumber: editGovtFeeRefNum || null,
				description: editGovtFeeDesc || null,
				supplierId: editGovtFeeSupplierId || null
			});
			toast.success('Supplier payment / government fee updated successfully.');
			showEditGovtFeeModal = false;
			await fetchDetail();
		} catch (err: any) {
			toast.error(err.message || 'Failed to update payment.');
		} finally {
			actionLoading = false;
		}
	}

	let approvingPendingPayment = $state<any>(null);

	function onPayMethodChange() {
		if (payMethod === 'cash') {
			paySourceId = cashAccounts[0] ? `account_${cashAccounts[0].id}` : '';
		} else if (payMethod === 'bank_transfer' || payMethod === 'bank') {
			paySourceId = banks[0] ? `bank_${banks[0].id}` : '';
		} else {
			paySourceId = '';
		}
	}

	function handleApproveSupplierPayment(sp: any) {
		payIdempotency.regenerate();
		approvingPendingPayment = sp;
		const rawSupplierId = sp.supplierId ? Number(sp.supplierId) : (sd?.supplierId ? Number(sd.supplierId) : 0);
		paySupplierId = rawSupplierId || (filteredSuppliersList[0]?.id ? Number(filteredSuppliersList[0].id) : 0);
		payAmount = Number(sp.amount) || 0;
		payMethod = 'supplier_wallet';
		paySourceId = '';

		payRefNum = sp.referenceNumber || sp.transaction_no || '';
		payDesc = sp.description || `Supplier Payment for ${serviceLabel(serviceType)} ${sd?.documentNumber || `#${bookingId}`}`;
		showPaymentModal = true;
	}

	async function handleRejectSupplierPayment(sp: any) {
		spToReject = sp;
		showSpRejectModal = true;
	}

	async function handleApprovePurchaseReturn(pr: any) {
		actionLoading = true;
		try {
			await approvePurchaseReturn(pr.id);
			toast.success('Purchase Return approved and posted successfully.');
			await fetchDetail();
		} catch (err: any) {
			toast.error(err.message || 'Failed to approve purchase return.');
		} finally {
			actionLoading = false;
		}
	}

	async function handleRejectPurchaseReturn(pr: any) {
		spToReject = { ...pr, type: 'purchase_return' };
		showSpRejectModal = true;
	}

	async function handleApproveSalesReturn(sr: any) {
		actionLoading = true;
		try {
			await approveSalesReturn(sr.id);
			toast.success('Sales Return approved and posted successfully.');
			await fetchDetail();
		} catch (err: any) {
			toast.error(err.message || 'Failed to approve sales return.');
		} finally {
			actionLoading = false;
		}
	}

	async function handleRejectSalesReturn(sr: any) {
		spToReject = { ...sr, type: 'sales_return' };
		showSpRejectModal = true;
	}

	/** Replace stored raw "#<id>" in descriptions with the proper document number */
	function formatSpDesc(desc: string | null | undefined): string {
		if (!desc) return 'Government Payment Log';
		const docNum = sd?.documentNumber;
		if (!docNum) return desc;
		return desc.replace(new RegExp(`#${bookingId}\\b`, 'g'), docNum);
	}

	async function submitSpRejection(reason: string) {
		if (!spToReject) return;
		spRejectLoading = true;
		try {
			if (spToReject.type === 'purchase_return') {
				await rejectPurchaseReturn(spToReject.id, reason);
				toast.success('Purchase Return rejected.');
			} else if (spToReject.type === 'sales_return') {
				await rejectSalesReturn(spToReject.id, reason);
				toast.success('Sales Return rejected.');
			} else {
				await rejectSupplierPayment(spToReject.id, reason);
				toast.success('Supplier payment / government fee rejected.');
			}
			showSpRejectModal = false;
			spToReject = null;
			await fetchDetail();
		} catch (err: any) {
			toast.error(err.message || 'Failed to reject payment.');
		} finally {
			spRejectLoading = false;
		}
	}

	// Form states
	let paySupplierId = $state(0);
	let payAmount = $state(0);
	let payMethod = $state('supplier_wallet');
	let paySourceId = $state('');
	let payRefNum = $state('');
	let payDesc = $state('');

	let prSupplierId = $state(0);
	let prAmount = $state(0);
	let prReason = $state('');
	let prDestType = $state('supplier_wallet');
	let prDestId = $state('');

	let srRecipientType = $state('Agent');
	let srRecipientId = $state(0);
	let srAmount = $state(0);
	let srReason = $state('');
	let srSourceType = $state('bank');
	let srSourceId = $state('');

	// Map serviceType → API segment
	function getSegment(type: string): string {
		const map: Record<string, string> = {
			flights: 'flights',
			flight: 'flights',
			hotels: 'hotels',
			hotel: 'hotels',
			visa: 'visa',
			visas: 'visa',
			vfs: 'vfs',
			holiday: 'holiday-packages',
			holidays: 'holiday-packages',
			'holiday-packages': 'holiday-packages',
			transportation: 'transportation',
			transport: 'transportation',
			'other-services': 'other-services',
			other: 'other-services'
		};
		return map[(type || '').toLowerCase()] ?? type;
	}

	// Friendly label for service type
	function serviceLabel(type: string): string {
		const map: Record<string, string> = {
			flights: 'Flight Booking',
			flight: 'Flight Booking',
			hotels: 'Hotel Booking',
			hotel: 'Hotel Booking',
			visa: 'Visa Application',
			visas: 'Visa Application',
			vfs: 'VFS Appointment',
			holiday: 'Holiday Package',
			holidays: 'Holiday Package',
			'holiday-packages': 'Holiday Package',
			transportation: 'Transportation',
			transport: 'Transportation',
			'other-services': 'Other Service',
			other: 'Other Service'
		};
		return map[(type || '').toLowerCase()] ?? type;
	}

	async function loadCashAccounts() {
		try {
			const res = await getAccounts();
			cashAccounts = res.filter((a) => a.type.toLowerCase() === 'cash' && a.isActive);
		} catch (err) {
			console.error('Failed to load cash accounts', err);
		}
	}

	async function loadBanks() {
		try {
			const res = await getBanks();
			banks = res.filter((b) => b.isActive);
		} catch (err) {
			console.error('Failed to load banks', err);
		}
	}

	async function loadSuppliersList() {
		try {
			suppliersList = await getSuppliers();
		} catch (err) {
			console.error('Failed to load suppliers list', err);
		}
	}

	function getSupplierLabel(supplierId: number): string {
		const sup = suppliersList.find((s) => Number(s.id) === Number(supplierId));
		if (sup) {
			return `${sup.name} (${sup.code})`;
		}
		return `Supplier #${supplierId}`;
	}

	function getRecipientLabel(type: string | undefined, id: number | string | undefined, item?: any): string {
		if (item?.recipientName) return item.recipientName;
		if (!id) return 'N/A';
		const rType = (type || '').toLowerCase().trim();
		const numericId = Number(id);

		if (rType === 'agent') {
			if (sd?.agentId && Number(sd.agentId) === numericId && sd.agent) {
				return sd.agent;
			}
			const ag = agentsList.find((a: any) => Number(a.id) === numericId);
			if (ag) {
				const name = ag.agencyName || ag.name || ag.fullName || `${ag.firstName || ''} ${ag.lastName || ''}`.trim();
				if (name) return name;
			}
			if (sd?.agent) return sd.agent;
			return `Agent #${id}`;
		}

		if (rType === 'head') {
			if (sd?.headId && Number(sd.headId) === numericId && sd.headName) {
				return sd.headName;
			}
			const hd = headsList.find((h: any) => Number(h.id) === numericId);
			if (hd) {
				const name = hd.fullName || hd.headName || hd.name || `${hd.firstName || ''} ${hd.lastName || ''}`.trim();
				if (name) return name;
			}
			if (sd?.headName) return sd.headName;
			return `Head #${id}`;
		}

		return `${type || 'Recipient'} #${id}`;
	}

	async function loadSystemUsers() {
		try {
			const [accounts, sales, ops] = await Promise.all([
				fetchAccountsStaff().catch(() => []),
				fetchSalesStaff().catch(() => []),
				fetchOperationalStaff().catch(() => [])
			]);
			systemUsers = [...accounts, ...sales, ...ops];
		} catch (err) {
			console.error('Failed to load system users', err);
		}
	}

	async function loadHeadsAndAgents() {
		try {
			const [headsRes, agentsRes] = await Promise.all([
				apiFetch<any>('api/sales-entries/heads?pageSize=500').catch(() => null),
				apiFetch<any>('api/agent').catch(() => null)
			]);

			if (headsRes && headsRes.items) {
				headsList = headsRes.items;
			}
			if (agentsRes) {
				agentsList = Array.isArray(agentsRes) ? agentsRes : (agentsRes.items || []);
			}
		} catch (err) {
			console.error('Failed to load heads and agents', err);
		}
	}

	async function fetchDetail() {
		loading = true;
		error = null;
		try {
			const segment = getSegment(serviceType);
			const res = await apiFetch<any>(`api/sales-entries/${segment}/${bookingId}`);
			detail = res;

			await Promise.all([loadCashAccounts(), loadBanks(), loadSuppliersList(), loadHeadsAndAgents(), loadSystemUsers()]);
		} catch (err: any) {
			if (err?.status === 503 || err?.message?.includes('unavailable')) {
				error = 'Sales portal service is unavailable. Please ensure the backend is running.';
			} else if (err?.status === 404) {
				error = `Booking #${bookingId} not found.`;
			} else {
				error = err?.message ?? `Failed to load booking detail. (${err?.status ?? 'unknown status'})`;
			}
			console.error('[BookingDetail] fetch error:', err);
		} finally {
			loading = false;
		}
	}

	const isOnlinePayment = $derived.by(() => {
		if (!sd) return false;
		const pm = (displayPaymentMethod || sd?.paymentMethod || sd?.paymentMode || sd?.applicants?.[0]?.paymentMethod || '').toLowerCase().trim();
		if (pm === 'cash' || pm === 'wallet' || pm.includes('wallet') || pm === 'credit' || pm.includes('credit')) return false;
		return true;
	});

	function requestStatusChange(newStatus: string) {
		if (actionLoading) return;
		targetBookingStatusToApply = newStatus;

		if (newStatus === 'success') {
			if (isCashBooking && !selectedCashAccountIdVal) {
				toast.warning('Please select a destination cash account before approving.');
				return;
			}

			if (isOnlinePayment) {
				onlineReferenceIdVal = sd?.paymentReference || sd?.applicants?.[0]?.paymentReference || '';
				refIdModalError = null;
				showReferenceIdModal = true;
				return;
			}
		}

		const docRef = sd?.documentNumber || `#${bookingId}`;

		if (newStatus === 'success') {
			statusConfirmTitle = `Approve ${serviceLabel(serviceType)} Payment`;
			statusConfirmMessage = `Are you sure you want to approve payment for ${serviceLabel(serviceType)} ${docRef}? This will mark the booking as Paid.`;
			statusConfirmActionLabel = 'Approve Payment';
			statusConfirmIsDestructive = false;
		} else {
			statusConfirmTitle = `Reject ${serviceLabel(serviceType)} Payment`;
			statusConfirmMessage = `Are you sure you want to reject payment for ${serviceLabel(serviceType)} ${docRef}? This will set the booking payment status to Failed.`;
			statusConfirmActionLabel = 'Reject Payment';
			statusConfirmIsDestructive = true;
		}
		showStatusConfirmModal = true;
	}

	async function executeBookingStatusUpdate(refId?: string) {
		const statusToApply = targetBookingStatusToApply || 'success';
		actionLoading = true;
		refIdModalError = null;
		try {
			const segment = getSegment(serviceType);
			const cashAccountId = selectedCashAccountIdVal ? parseInt(selectedCashAccountIdVal) : null;
			await apiFetch<any>(`api/sales-entries/${segment}/${bookingId}/payment-status`, {
				method: 'POST',
				body: JSON.stringify({ 
					status: statusToApply,
					cashAccountId: cashAccountId,
					referenceId: refId || null
				})
			});
			toast.success(statusToApply === 'success' ? 'Booking payment approved successfully.' : 'Booking payment rejected.');
			showReferenceIdModal = false;
			showStatusConfirmModal = false;
			await fetchDetail();
		} catch (err: any) {
			const msg = err?.message ?? 'Failed to update payment status.';
			toast.error(msg);
			if (showReferenceIdModal) {
				refIdModalError = msg;
			}
		} finally {
			actionLoading = false;
		}
	}

	async function submitPaymentForm(e: Event) {
		e.preventDefault();
		if (actionLoading) return;
		if (!paySupplierId || payAmount == null || isNaN(payAmount) || payAmount < 0) return;
		actionLoading = true;
		try {
			let cleanSource = (payMethod === 'credit' || payMethod === 'supplier_wallet') ? null : paySourceId;
			if (payMethod === 'cash' && (!cleanSource || !cleanSource.startsWith('account_'))) {
				cleanSource = cashAccounts[0] ? `account_${cashAccounts[0].id}` : null;
			} else if ((payMethod === 'bank_transfer' || payMethod === 'bank') && (!cleanSource || !cleanSource.startsWith('bank_'))) {
				cleanSource = banks[0] ? `bank_${banks[0].id}` : null;
			}

			if (approvingPendingPayment) {
				await updateSupplierPayment(approvingPendingPayment.id, {
					supplierId: paySupplierId,
					amount: payAmount,
					paymentMethod: payMethod,
					sourceAccountId: cleanSource,
					referenceNumber: payRefNum || null,
					description: payDesc || null
				});
				await approveSupplierPayment(approvingPendingPayment.id);
				toast.success('Supplier payment approved and posted successfully.');
			} else {
				await createSupplierPayment({
					supplierId: paySupplierId,
					amount: payAmount,
					paymentMethod: payMethod,
					sourceAccountId: cleanSource,
					referenceNumber: payRefNum || null,
					externalReference: bookingId,
					serviceType: serviceType,
					description: payDesc || null,
					supplierName: suppliersList.find((s) => s.id === paySupplierId)?.name ?? 'Supplier'
				}, payIdempotency.key);
				payIdempotency.retire();
				toast.success('Supplier Payment recorded and approved successfully.');
			}
			showPaymentModal = false;
			approvingPendingPayment = null;
			await fetchDetail();
		} catch (err: any) {
			toast.error(err.message || 'Failed to process payment.');
		} finally {
			actionLoading = false;
		}
	}

	async function submitPurchaseReturnForm(e: Event) {
		e.preventDefault();
		if (actionLoading) return;
		if (!prSupplierId || prAmount <= 0) return;
		actionLoading = true;
		try {
			const isMaster = hasRole('master_accountant');
			await createPurchaseReturn({
				supplierId: prSupplierId,
				originalPurchaseReference: sd?.documentNumber || (bookingId ?? ''),
				amount: prAmount,
				reason: prReason,
				destinationType: prDestType as any,
				destinationId: prDestType === 'supplier_wallet' ? '' : prDestId,
				serviceType: serviceType,
				supplierName: suppliersList.find((s) => s.id === prSupplierId)?.name ?? 'Supplier'
			}, purchaseReturnIdempotency.key);
			purchaseReturnIdempotency.retire();
			toast.success(
				isMaster
					? 'Purchase Return recorded and auto-approved.'
					: 'Purchase Return draft submitted for approval.'
			);
			showPurchaseReturnModal = false;
			await fetchDetail();
		} catch (err: any) {
			toast.error(err.message || 'Failed to submit return.');
		} finally {
			actionLoading = false;
		}
	}

	async function submitSalesReturnForm(e: Event) {
		e.preventDefault();
		if (actionLoading) return;
		if (srAmount <= 0) return;

		let finalRecipientId = Number(srRecipientId);
		if (!finalRecipientId || finalRecipientId <= 0) {
			finalRecipientId = Number(sd?.agentId || sd?.headId || recipientOptions[0]?.id || 0);
		}
		if (!finalRecipientId || finalRecipientId <= 0) {
			toast.error('Please select a valid refund recipient.');
			return;
		}

		actionLoading = true;
		try {
			const isMaster = hasRole('master_accountant');
			await createSalesReturn({
				recipientType: srRecipientType,
				recipientId: finalRecipientId,
				serviceId: sd?.documentNumber || (bookingId ?? ''),
				amount: srAmount,
				returnReason: srReason,
				sourceType: srSourceType,
				sourceId: srSourceId,
				serviceType: serviceType
			}, salesReturnIdempotency.key);
			salesReturnIdempotency.retire();
			toast.success(
				isMaster
					? 'Sales Return recorded and auto-approved.'
					: 'Sales Return draft submitted for approval.'
			);
			showSalesReturnModal = false;
			await fetchDetail();
		} catch (err: any) {
			toast.error(err.message || 'Failed to submit sales return.');
		} finally {
			actionLoading = false;
		}
	}

	// ─── Modal Openers ────────────────────────────────────────────────────────────
	function openPaymentForm() {
		payIdempotency.regenerate();
		approvingPendingPayment = null;
		const matchedSupplier = filteredSuppliersList.find((s) => s.id === sd?.supplierId);
		paySupplierId = matchedSupplier ? sd?.supplierId : (filteredSuppliersList[0]?.id || 0);
		payAmount = Math.max(0, (sd?.expectedSupplierCost ?? 0) - totalPaid);
		payMethod = 'supplier_wallet';
		paySourceId = '';
		payRefNum = '';
		payDesc = `Supplier Payment for ${serviceLabel(serviceType)} ${sd?.documentNumber || `#${bookingId}`}`;
		showPaymentModal = true;
	}

	function openPurchaseReturnForm() {
		purchaseReturnIdempotency.regenerate();
		const firstRefundableSup = paidSuppliersForBooking.find((s) => s.maxRefundable > 0) ?? paidSuppliersForBooking[0];
		prSupplierId = firstRefundableSup?.id ?? sd?.supplierId ?? (suppliersList[0]?.id || 0);

		const supInfo = paidSuppliersForBooking.find((s) => s.id === prSupplierId);
		prAmount = supInfo ? supInfo.maxRefundable : Math.max(0, totalPaid - totalPurchaseReturns);

		prReason = `Refund received from supplier for ${serviceLabel(serviceType)} ${sd?.documentNumber || `#${bookingId}`}`;
		prDestType = 'supplier_wallet';
		prDestId = allAccountsAndBanks[0]?.id || '';
		showPurchaseReturnModal = true;
	}

	function openSalesReturnForm() {
		salesReturnIdempotency.regenerate();
		const isBookingAgent = sd?.clientType?.toLowerCase() === 'agent' || Boolean(sd?.agentId && sd.agentId > 0) || Boolean(sd?.agent && sd.agent.trim().length > 0);
		srRecipientType = isBookingAgent ? 'Agent' : 'Head';
		const targetId = isBookingAgent ? (sd?.agentId || sd?.headId || 0) : (sd?.headId || sd?.agentId || 0);
		srRecipientId = targetId || (recipientOptions[0]?.id ?? 0);
		srAmount = Math.max(0, (sd?.payableAmount ?? 0) - totalSalesReturns);
		srReason = `Customer refund for ${serviceLabel(serviceType)} ${sd?.documentNumber || `#${bookingId}`}`;
		srSourceType = 'bank';
		srSourceId = allAccountsAndBanks[0]?.id || '';
		showSalesReturnModal = true;
	}

	$effect(() => {
		if (bookingId) fetchDetail();
	});

	function getUserLabel(userId: number | string, item?: any): string {
		if (item) {
			const directName = item.requestedByName || item.submittedByName || item.createdByName || item.userName || (typeof item.requestedBy === 'string' ? item.requestedBy : null);
			if (directName && typeof directName === 'string' && !directName.startsWith('Staff #') && !directName.startsWith('User #')) return directName;
		}
		if (!userId) return 'System';

		const numId = Number(userId);

		if ($currentUser?.id && Number($currentUser.id) === numId) {
			return $currentUser.name || $currentUser.email || `Staff #${userId}`;
		}

		const u = systemUsers.find((user) => Number(user.id) === numId || (user as any).userId === numId || (user as any).staffId === numId);
		if (u && (u.name || (u as any).displayName || (u as any).fullName)) {
			return u.name || (u as any).displayName || (u as any).fullName;
		}

		if ($currentUser?.name && numId === 2) {
			return $currentUser.name;
		}

		return `Staff #${userId}`;
	}

	function statusClass(status: string): string {
		const s = (status ?? '').toLowerCase();
		if (s === 'paid' || s === 'success' || s === 'approved' || s === 'completed')
			return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
		if (s.includes('pending') || s === 'processing' || s === 'in progress' || s === 'draft')
			return 'bg-amber-50 text-amber-700 border border-amber-200';
		return 'bg-red-50 text-red-700 border border-red-200';
	}

	const tabs = [
		{ id: 'overview',   label: 'Overview',   icon: FileText },
		{ id: 'financial',  label: 'Financial',  icon: CreditCard },
		{ id: 'items',      label: 'Items',       icon: Package },
		{ id: 'supplier',   label: 'Supplier/Returns', icon: Send },
		{ id: 'timeline',   label: 'Timeline',   icon: Clock }
	];
</script>

<svelte:head>
	<title>{serviceLabel(serviceType)} {sd?.documentNumber || bookingId} — Accounts Portal</title>
</svelte:head>

<div class="space-y-6 print:space-y-2">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
		<div class="flex items-center gap-3">
			<Button
				variant="outline"
				class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs"
				onclick={() => goto(`/sales/bookings/${serviceType}`)}
			>
				<ArrowLeft class="h-3.5 w-3.5" /> Back to {serviceLabel(serviceType)}s
			</Button>
			<div>
				<h1 class="text-xl font-bold text-foreground capitalize">
					{serviceLabel(serviceType)} <span class="font-mono text-primary">{sd?.documentNumber || bookingId}</span>
				</h1>
				{#if sd}
					<p class="text-xs text-muted-foreground mt-0.5">
						{isAgent ? `Agent: ${sd.agent ?? '—'}` : `Head: ${sd.headName ?? '—'}`}
						&nbsp;•&nbsp;
						<span class="capitalize font-medium">{sd.clientType}</span>
					</p>
				{/if}
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			{#if hasRole('master_accountant')}
				{#if isOperationClosed}
					<Button
						variant="outline"
						class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs border-amber-400 bg-amber-100 hover:bg-amber-200 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-semibold"
						onclick={() => (showUnlockOperationModal = true)}
						disabled={actionLoading || completionLoading}
					>
						<Unlock class="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" /> Unlock Operation
					</Button>
				{:else}
					<Button
						variant="outline"
						class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs border-slate-300 hover:bg-slate-100 text-slate-700 font-medium"
						onclick={() => (showLockOperationModal = true)}
						disabled={actionLoading || completionLoading}
					>
						<Lock class="h-3.5 w-3.5 text-slate-600" /> Lock Operation
					</Button>
				{/if}
			{/if}
			<Button variant="outline" class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs" onclick={fetchDetail}>
				<RefreshCw class="h-3.5 w-3.5" /> Reload
			</Button>
			<Button variant="default" class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs bg-primary text-primary-foreground" onclick={() => previewDocument('invoice', getInvoiceEntityType(serviceType), bookingId)}>
				<Printer class="h-3.5 w-3.5" /> Print Invoice
			</Button>
		</div>

	</div>

	<!-- Loading / Error -->
	{#if loading}
		<div class="bg-card border border-border rounded-2xl p-16 flex items-center justify-center animate-pulse">
			<RefreshCw class="h-8 w-8 text-primary animate-spin" />
		</div>
	{:else if error}
		<div class="bg-card border border-border rounded-2xl p-16 text-center text-red-600 text-sm">
			{error}
		</div>
	{:else if sd}
		<!-- Status Bar -->
		<div class="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-3 items-center">
			<span class="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide {statusClass(sd.paymentStatus)}">
				{sd.paymentStatus}
			</span>
			<span class="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-sky-50 text-sky-700 border border-sky-200">
				{sd.processingStatus ?? sd.orderStatus ?? '—'}
			</span>
			{#if isDealClosed}
				<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700">
					<Lock class="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" /> Deal Closed (Locked)
				</span>
			{/if}
			<span class="ml-auto text-xs text-muted-foreground">
				Created: <DateDisplay value={sd.createdAt} />
				&nbsp;•&nbsp;
				Updated: <DateDisplay value={sd.updatedAt} />
			</span>
		</div>

		
		<!-- Operation Closed Notice Banner -->
		{#if isOperationClosed}
			<div class="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
				<div class="flex items-center gap-3">
					<div class="p-2.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl shrink-0">
						<Lock class="h-5 w-5" />
					</div>
					<div>
						<h3 class="font-bold text-foreground text-sm flex items-center gap-2">
							<span>Operation Finalized & Locked</span>
							<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-200 text-amber-900">Operational Lock</span>
						</h3>
						<p class="text-muted-foreground mt-0.5 leading-relaxed">
							This booking is marked as closed in operations. Operational actions (visa approvals, government fee entries, document requests) are locked in the Operational Portal.
						</p>
					</div>
				</div>
				{#if hasRole('master_accountant')}
					<Button
						onclick={() => (showUnlockOperationModal = true)}
						disabled={actionLoading || completionLoading}
						variant="outline"
						class="h-8.5 px-3.5 rounded-xl text-xs font-semibold cursor-pointer border-amber-400 bg-amber-100 hover:bg-amber-200 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 shrink-0"
					>
						<Unlock class="h-3.5 w-3.5 mr-1.5 text-amber-700 dark:text-amber-400" /> Unlock Operation
					</Button>
				{/if}
			</div>
		{/if}

		<!-- Deal Closed Notice Banner -->
		{#if isDealClosed}
			<div class="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
				<div class="flex items-center gap-3">
					<div class="p-2.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl shrink-0">
						<Lock class="h-5 w-5" />
					</div>
					<div>
						<h3 class="font-bold text-foreground text-sm flex items-center gap-2">
							<span>Deal Finalized & Locked</span>
						</h3>
						<p class="text-muted-foreground mt-0.5 leading-relaxed">
							This booking is marked as closed. Customer payments, supplier payouts, purchase returns, and customer refunds are strictly locked.
						</p>
					</div>
				</div>
				{#if hasRole('master_accountant')}
					<Button
						onclick={() => (showUnlockModal = true)}
						disabled={actionLoading || completionLoading}
						variant="outline"
						class="h-8.5 px-3.5 rounded-xl text-xs font-semibold cursor-pointer border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 shrink-0"
					>
						<Unlock class="h-3.5 w-3.5 mr-1.5 text-amber-600 dark:text-amber-400" /> Unlock Deal
					</Button>
				{/if}
			</div>
		{/if}

		<!-- Pending Settlement Approvals Prompt (Supplier Payments, Purchase Returns, Sales Returns) -->
		{#if totalPendingSettlements > 0 && hasRole('normal_accountant')}
			<div class="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-5 space-y-4 shadow-xs">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2 text-amber-700 font-bold text-sm">
						<AlertCircle class="h-5 w-5 text-amber-600 animate-pulse" />
						<span>Pending Settlement Approvals Prompt</span>
					</div>
					<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-900">
						{totalPendingSettlements} Pending Approval
					</span>
				</div>
				<p class="text-xs text-amber-800">
					Submissions requiring review and approval:
				</p>
				<div class="space-y-3">
					{#each pendingSupplierPayments as sp}
						<div class="bg-card border border-amber-300/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
							<div class="space-y-1">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="font-bold text-foreground text-sm font-mono"><MoneyDisplay amount={sp.amount} /></span>
									<span class="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">{sp.serviceType || 'Govt Fee'}</span>
									<span class="text-xs text-muted-foreground font-mono">Ref: {sp.referenceNumber || 'N/A'}</span>
								</div>
								<p class="text-xs text-muted-foreground">{formatSpDesc(sp.description)}</p>
								<p class="text-[11px] text-muted-foreground">Supplier: {getSupplierLabel(sp.supplierId)} • Requested: <DateDisplay value={sp.requestedAt} /></p>
							</div>
							<div class="flex items-center gap-2">
								{#if isDealClosed}
									<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-muted-foreground bg-muted/50 border border-border">
										<Lock class="h-3 w-3 text-muted-foreground/70" /> Locked
									</span>
								{:else}
									<button
										class="px-3 py-1.5 text-xs font-semibold rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer flex items-center gap-1"
										onclick={() => openEditGovtFeeModal(sp)}
										disabled={actionLoading}
									>
										<Pencil class="h-3.5 w-3.5" /> Edit Fee
									</button>
									{#if hasRole('accountant')}
										<button
											class="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
											onclick={() => handleApproveSupplierPayment(sp)}
											disabled={actionLoading}
										>
											<Check class="h-3.5 w-3.5" /> Approve Payment
										</button>
										<button
											class="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
											onclick={() => handleRejectSupplierPayment(sp)}
											disabled={actionLoading}
										>
											<X class="h-3.5 w-3.5" /> Reject
										</button>
									{/if}
								{/if}
							</div>
						</div>
					{/each}

					{#each pendingPurchaseReturns as pr}
						<div class="bg-card border border-emerald-300/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
							<div class="space-y-1">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="font-bold text-foreground text-sm font-mono"><MoneyDisplay amount={pr.amount} /></span>
									<span class="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">Purchase Return</span>
									<span class="text-xs text-muted-foreground font-mono">Dest: {pr.destinationType || 'Bank'}</span>
								</div>
								<p class="text-xs text-muted-foreground">{pr.reason || 'Supplier Purchase Return'}</p>
								<p class="text-[11px] text-muted-foreground">Supplier: {getSupplierLabel(pr.supplierId)} • Requested: <DateDisplay value={pr.requestedAt} /></p>
							</div>
							<div class="flex items-center gap-2">
								{#if isDealClosed}
									<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-muted-foreground bg-muted/50 border border-border">
										<Lock class="h-3 w-3 text-muted-foreground/70" /> Locked
									</span>
								{:else if hasRole('accountant')}
									<button
										class="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
										onclick={() => handleApprovePurchaseReturn(pr)}
										disabled={actionLoading}
									>
										<Check class="h-3.5 w-3.5" /> Approve Return
									</button>
									<button
										class="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
										onclick={() => handleRejectPurchaseReturn(pr)}
										disabled={actionLoading}
									>
										<X class="h-3.5 w-3.5" /> Reject
									</button>
								{/if}
							</div>
						</div>
					{/each}

					{#each pendingSalesReturns as sr}
						<div class="bg-card border border-sky-300/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
							<div class="space-y-1">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="font-bold text-foreground text-sm font-mono"><MoneyDisplay amount={sr.amount} /></span>
									<span class="text-[11px] px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-semibold">Sales Return (Customer Refund)</span>
									<span class="text-xs text-muted-foreground font-mono">Recipient: {getRecipientLabel(sr.recipientType, sr.recipientId, sr)}</span>
								</div>
								<p class="text-xs text-muted-foreground">{sr.reason || 'Customer Sales Return'}</p>
								<p class="text-[11px] text-muted-foreground">Requested: <DateDisplay value={sr.requestedAt} /></p>
							</div>
							<div class="flex items-center gap-2">
								{#if isDealClosed}
									<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-muted-foreground bg-muted/50 border border-border">
										<Lock class="h-3 w-3 text-muted-foreground/70" /> Locked
									</span>
								{:else if hasRole('accountant')}
									<button
										class="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
										onclick={() => handleApproveSalesReturn(sr)}
										disabled={actionLoading}
									>
										<Check class="h-3.5 w-3.5" /> Approve Refund
									</button>
									<button
										class="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
										onclick={() => handleRejectSalesReturn(sr)}
										disabled={actionLoading}
									>
										<X class="h-3.5 w-3.5" /> Reject
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Tab Navigation -->
		<div class="border-b border-border flex gap-1 overflow-x-auto print:hidden">
			{#each tabs as tab}
				{#if tab.id !== 'items' || serviceType === 'flights' || serviceType === 'visa'}
					{@const IconComp = tab.icon}
					{@const isTabLocked = tab.id === 'supplier' && !isPaymentSuccessful}
					<button
						onclick={() => (activeTab = tab.id)}
						class="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer
							{activeTab === tab.id
								? 'border-primary text-primary'
								: 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}"
					>
						<IconComp class="h-3.5 w-3.5" />
						<span>{tab.label}</span>
						{#if isTabLocked}
							<Lock class="h-3 w-3 text-amber-500 ml-0.5" />
						{/if}
					</button>
				{/if}
			{/each}
		</div>

		<!-- ─── OVERVIEW TAB ─────────────────────────────────────────────────── -->
		{#if activeTab === 'overview'}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<!-- Client Information -->
				<div class="bg-card border border-border rounded-2xl p-5 space-y-3">
					<h2 class="text-sm font-bold text-foreground flex items-center gap-2">
						<User class="h-4 w-4 text-primary" /> Client Information
					</h2>
					<div class="space-y-2 text-xs">
						<div class="flex justify-between border-b border-border/40 pb-1.5">
							<span class="text-muted-foreground">Client Type</span>
							<span class="font-semibold capitalize">{sd.clientType}</span>
						</div>
						<div class="flex justify-between border-b border-border/40 pb-1.5">
							<span class="text-muted-foreground">Customer Head</span>
							<span class="font-semibold">{sd.headName ?? '—'}</span>
						</div>
						{#if isAgent}
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Agent Name</span>
								<span class="font-semibold">{sd.agent ?? '—'}</span>
							</div>
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Agent ID</span>
								<span class="font-mono text-muted-foreground">#{sd.agentId ?? '—'}</span>
							</div>
						{/if}
						{#if sd.careOf}
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Care Of</span>
								<span class="font-semibold">{sd.careOf}</span>
							</div>
						{/if}
					</div>
				</div>

				<!-- Service Specifics -->
				<div class="bg-card border border-border rounded-2xl p-5 space-y-3">
					<h2 class="text-sm font-bold text-foreground flex items-center gap-2">
						<Package class="h-4 w-4 text-primary" /> Service Details
					</h2>
					<div class="space-y-2 text-xs">
						{#if serviceType === 'flights'}
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Route</span>
								<span class="font-semibold">{sd.fromLocation} → {sd.toLocation}</span>
							</div>
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Payment Method</span>
								<span class="capitalize">{sd.paymentMethod}</span>
							</div>
							{#if sd.supplier}<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Supplier</span><span>{sd.supplier}</span>
							</div>{/if}
						{:else if serviceType === 'hotels'}
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Guest Name</span>
								<span class="font-semibold">{sd.prefix ? sd.prefix + ' ' : ''}{sd.guestName}</span>
							</div>
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Country</span><span>{sd.country}</span>
							</div>
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Check-In</span>
								<span><DateDisplay value={sd.checkInDate} /></span>
							</div>
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Duration</span><span>{sd.days} days</span>
							</div>
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Order Status</span>
								<span class="capitalize">{sd.orderStatus}</span>
							</div>
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Payment Method</span>
								<span class="capitalize">{sd.paymentMethod}</span>
							</div>
						{:else if serviceType === 'visa'}
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Visa Package</span>
								<span class="font-semibold">{sd.visaPackName}</span>
							</div>
							{#if sd.supplierName}<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Supplier</span><span>{sd.supplierName}</span>
							</div>{/if}
							{#if sd.approvalNote}<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Approval Note</span><span class="text-right max-w-48">{sd.approvalNote}</span>
							</div>{/if}
						{:else if serviceType === 'vfs'}
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Applicant</span>
								<span class="font-semibold">{sd.prefix ? sd.prefix + ' ' : ''}{sd.name}</span>
							</div>
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Country</span><span>{sd.country}</span>
							</div>
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Visa Type</span><span>{sd.visaType}</span>
							</div>
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Appointment</span>
								<span><DateDisplay value={sd.appointmentDate} /> {sd.appointmentTime}</span>
							</div>
						{:else if serviceType === 'holiday'}
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Passenger</span>
								<span class="font-semibold">{sd.prefix ? sd.prefix + ' ' : ''}{sd.passengerName}</span>
							</div>
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Country</span><span>{sd.country}</span>
							</div>
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Duration</span><span>{sd.days} days</span>
							</div>
						{:else if serviceType === 'transportation'}
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Passenger</span>
								<span class="font-semibold">{sd.prefix ? sd.prefix + ' ' : ''}{sd.name}</span>
							</div>
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Route</span>
								<span>{sd.pickup} → {sd.drop}</span>
							</div>
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Drop Date/Time</span>
								<span><DateDisplay value={sd.dropDate} /> {sd.dropTime}</span>
							</div>
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Vehicle</span><span>{sd.vehicle ?? '—'}</span>
							</div>
						{:else if serviceType === 'other-services'}
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Service Name</span>
								<span class="font-semibold">{sd.serviceName}</span>
							</div>
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Customer Name</span>
								<span>{sd.prefix ? sd.prefix + ' ' : ''}{sd.name}</span>
							</div>
							{#if sd.narration}<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Narration</span>
								<span class="text-right max-w-48">{sd.narration}</span>
							</div>{/if}
						{/if}

						{#if sd.supplierName && serviceType !== 'visa'}
							<div class="flex justify-between border-b border-border/40 pb-1.5">
								<span class="text-muted-foreground">Supplier</span><span>{sd.supplierName}</span>
							</div>
						{/if}
					</div>
				</div>
			</div>

		<!-- ─── FINANCIAL TAB ────────────────────────────────────────────────── -->
		{:else if activeTab === 'financial'}
			<div class="bg-card border border-border rounded-2xl p-5 space-y-4">
				<h2 class="text-sm font-bold text-foreground flex items-center gap-2">
					<CreditCard class="h-4 w-4 text-primary" /> Financial Summary
				</h2>
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
					{#each [
						{ label: 'Payable Sale', value: sd.payableAmount, cls: 'text-foreground' },
						{ label: 'Expected Cost', value: sd.expectedSupplierCost ?? 0, cls: 'text-muted-foreground' },
						{ label: 'Markup Margin', value: calculatedProfit, cls: calculatedProfit > 0 ? 'text-emerald-600' : 'text-muted-foreground' },
						{ label: 'Rejection Fee', value: sd.rejectionFee ?? 0, cls: 'text-red-600' }
					] as item}
						<div class="bg-muted/30 rounded-xl p-4 text-center space-y-1">
							<p class="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">{item.label}</p>
							<p class="text-lg font-bold {item.cls} font-mono">
								<MoneyDisplay amount={item.value} />
							</p>
						</div>
					{/each}
				</div>
				<div class="text-xs space-y-2 pt-2 border-t border-border/40">
					{#if displayPaymentMethod}
						<div class="flex justify-between">
							<span class="text-muted-foreground">Payment Method</span>
							<span class="capitalize font-semibold">{displayPaymentMethod}</span>
						</div>
					{/if}
					{#if sd.bankName || (sd.applicants && sd.applicants.length > 0 && sd.applicants[0]?.bankName)}
						<div class="flex justify-between">
							<span class="text-muted-foreground">Target Bank</span>
							<span class="font-semibold text-primary">{sd.bankName || sd.applicants[0]?.bankName}</span>
						</div>
					{/if}
					{#if sd.isInhouse !== undefined}
						<div class="flex justify-between">
							<span class="text-muted-foreground">In-house</span>
							<span class="font-semibold">{sd.isInhouse ? 'Yes' : 'No'}</span>
						</div>
					{/if}
					{#if sd.paymentProof}
						<div class="flex justify-between items-center pt-2 border-t border-border/40">
							<span class="text-muted-foreground">Payment Proof</span>
							<div class="flex items-center gap-2">
								<span class="font-mono text-muted-foreground truncate max-w-[150px] sm:max-w-[250px]" title={sd.paymentProof}>
									{sd.paymentProof.split('/').pop()}
								</span>
								<a
									href={getSalesPortalFileUrl(sd.paymentProof)}
									target="_blank"
									rel="noopener noreferrer"
									class="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer inline-flex items-center"
								>
									View
								</a>
								<a
									href={getSalesPortalFileUrl(sd.paymentProof)}
									download
									class="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer inline-flex items-center"
								>
									Download
								</a>
							</div>
						</div>
					{/if}
				</div>

				{#if sd.paymentStatus?.toLowerCase() === 'pending' && isCashBooking && hasRole('normal_accountant')}
					<div class="flex flex-col gap-1.5 pt-2 border-t border-border/40 text-xs">
						<label for="cashAccountId" class="font-semibold text-muted-foreground">Destination Cash Account</label>
						<select
							id="cashAccountId"
							class="h-9.5 w-full bg-background border border-border rounded-xl px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground disabled:opacity-50"
							disabled={actionLoading}
							bind:value={selectedCashAccountIdVal}
						>
							<option value="">-- Select Cash Account --</option>
							{#each cashAccounts as acc}
								<option value={String(acc.id)}>{acc.name} (Bal: {acc.currentBalance.toFixed(3)} BHD)</option>
							{/each}
						</select>
					</div>
				{/if}

				{#if sd.paymentStatus?.toLowerCase() === 'pending' && hasRole('normal_accountant')}
					{#if isDealClosed}
						<div class="p-3 bg-muted/40 border border-border rounded-xl text-xs text-muted-foreground flex items-center gap-2 mt-4">
							<Lock class="h-4 w-4 text-emerald-600 shrink-0" />
							<span>Payment status actions are locked because this deal is finalized and closed.</span>
						</div>
					{:else}
						<div class="flex gap-3 pt-4 border-t border-border/40 justify-end">
							<button
								class="px-4 py-2 text-xs font-bold rounded-xl cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
								onclick={() => requestStatusChange('success')}
								disabled={actionLoading || (isCashBooking && !selectedCashAccountIdVal)}
							>
								{#if actionLoading}
									<RefreshCw class="h-3.5 w-3.5 animate-spin" />
								{/if}
								Approve Payment
							</button>
							<button
								class="px-4 py-2 text-xs font-bold rounded-xl cursor-pointer bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 transition-all shadow-sm"
								onclick={() => requestStatusChange('failed')}
								disabled={actionLoading}
							>
								{#if actionLoading}
									<RefreshCw class="h-3.5 w-3.5 animate-spin" />
								{/if}
								Reject Payment
							</button>
						</div>
					{/if}
				{/if}
			</div>

		<!-- ─── ITEMS TAB (Flights / Visa only) ─────────────────────────────── -->
		{:else if activeTab === 'items'}
			{#if serviceType === 'flights' && sd.passengers?.length}
				<div class="bg-card border border-border rounded-2xl overflow-hidden">
					<div class="p-4 border-b border-border">
						<h2 class="text-sm font-bold">Passengers ({sd.passengers.length})</h2>
					</div>
					<table class="w-full text-xs text-left">
						<thead class="bg-muted/30 text-muted-foreground font-semibold border-b border-border">
							<tr>
								<th class="p-3">Passenger</th>
								<th class="p-3">Payable</th>
								<th class="p-3">Cost</th>
								<th class="p-3">Profit</th>
								<th class="p-3">In-house</th>
								<th class="p-3">Supplier</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/60">
							{#each sd.passengers as p}
								<tr class="hover:bg-muted/10">
									<td class="p-3 font-semibold">{p.prefix ? p.prefix + ' ' : ''}{p.passengerName}</td>
									<td class="p-3 font-mono"><MoneyDisplay amount={p.payableAmount} /></td>
									<td class="p-3 font-mono text-muted-foreground"><MoneyDisplay amount={p.expectedSupplierCost} /></td>
									<td class="p-3 font-mono text-emerald-600"><MoneyDisplay amount={p.profit} /></td>
									<td class="p-3">{p.isInhouse ? '✓' : '—'}</td>
									<td class="p-3 text-muted-foreground">{p.supplierName ?? '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else if serviceType === 'visa' && sd.applicants?.length}
				<div class="bg-card border border-border rounded-2xl overflow-hidden">
					<div class="p-4 border-b border-border">
						<h2 class="text-sm font-bold">Applicants ({sd.applicants.length})</h2>
					</div>
					<table class="w-full text-xs text-left">
						<thead class="bg-muted/30 text-muted-foreground font-semibold border-b border-border">
							<tr>
								<th class="p-3">Name</th>
								<th class="p-3">Passport</th>
								<th class="p-3">Nationality</th>
								<th class="p-3">Payable</th>
								<th class="p-3">Profit</th>
								<th class="p-3">Status</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/60">
							{#each sd.applicants as a}
								<tr class="hover:bg-muted/10">
									<td class="p-3 font-semibold">{a.prefix ? a.prefix + ' ' : ''}{a.fName} {a.lName}</td>
									<td class="p-3 font-mono text-muted-foreground">{a.passportNo}</td>
									<td class="p-3">{a.nationality}</td>
									<td class="p-3 font-mono"><MoneyDisplay amount={a.payableAmount} /></td>
									<td class="p-3 font-mono text-emerald-600"><MoneyDisplay amount={a.profit} /></td>
									<td class="p-3">
										<span class="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold {statusClass(a.paymentStatus)}">
											{a.paymentStatus}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground text-xs">
					No line items for this service type.
				</div>
			{/if}

		<!-- ─── SUPPLIER / RETURNS TAB ───────────────────────────────────────── -->
		{:else if activeTab === 'supplier'}
			{#if !isPaymentSuccessful}
				<!-- Locked State Banner when payment is not success/paid -->
				<div class="bg-card border-2 border-dashed border-amber-300 dark:border-amber-700/60 rounded-3xl p-10 text-center space-y-4 shadow-xs">
					<div class="inline-flex items-center justify-center p-4 bg-amber-100 dark:bg-amber-950/50 rounded-2xl text-amber-600 dark:text-amber-400">
						<Lock class="h-8 w-8" />
					</div>
					<div class="space-y-2 max-w-lg mx-auto">
						<h3 class="text-base font-extrabold text-foreground">Supplier Settlements & Returns Locked</h3>
						<p class="text-xs text-muted-foreground leading-relaxed">
							This section is currently locked because the customer payment status is
							<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide {statusClass(sd.paymentStatus)}">
								{sd.paymentStatus || 'Pending'}
							</span>.
						</p>
						<p class="text-xs text-muted-foreground leading-relaxed">
							Supplier payouts, purchase returns, and customer refunds can only be processed once customer payment is confirmed as <strong class="text-foreground font-semibold">Success</strong> or <strong class="text-foreground font-semibold">Paid</strong>.
						</p>
					</div>
					<div class="pt-2">
						<Button
							variant="outline"
							class="rounded-xl text-xs font-semibold cursor-pointer border-border"
							onclick={() => (activeTab = 'financial')}
						>
							<CreditCard class="h-3.5 w-3.5 mr-1.5" /> View Financial Breakdown
						</Button>
					</div>
				</div>
			{:else}
				<div class="space-y-6">
					<!-- Metrics Summary Cards -->
					<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
						<div class="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-xs border-l-4 border-l-primary">
							<p class="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Payable Sale Amount</p>
							<p class="text-base font-bold font-mono text-foreground"><MoneyDisplay amount={sd.payableAmount ?? 0} /></p>
						</div>
						<div class="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-xs">
							<p class="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Expected Cost</p>
							<p class="text-base font-bold font-mono text-foreground"><MoneyDisplay amount={sd.expectedSupplierCost ?? 0} /></p>
						</div>
						<div class="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-xs border-l-4 border-l-rose-500">
							<p class="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Total Settled (Paid)</p>
							<p class="text-base font-bold font-mono text-rose-600"><MoneyDisplay amount={totalPaid} /></p>
						</div>
						<div class="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-xs border-l-4 border-l-emerald-500">
							<p class="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Purchase Returns (Refunds)</p>
							<p class="text-base font-bold font-mono text-emerald-600"><MoneyDisplay amount={totalPurchaseReturns} /></p>
						</div>
						<div class="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-xs border-l-4 border-l-sky-500">
							<p class="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Sales Returns (Cust Refunds)</p>
							<p class="text-base font-bold font-mono text-sky-600"><MoneyDisplay amount={totalSalesReturns} /></p>
						</div>
						<div class="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-xs border-l-4 {(hasSettledSupplierPayments || totalPaid > 0) ? (calculatedProfit >= 0 ? 'border-l-emerald-500 bg-emerald-500/5' : 'border-l-rose-500 bg-rose-500/5') : (calculatedProfit > 0 ? 'border-l-emerald-500/70 bg-emerald-500/5' : 'border-l-muted-foreground/30')}">
							<p class="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
								Profit
							</p>
							<p class="text-base font-bold font-mono {(hasSettledSupplierPayments || totalPaid > 0) ? (calculatedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400') : (calculatedProfit > 0 ? 'text-emerald-600/80 dark:text-emerald-400/80' : 'text-foreground')}">
								<MoneyDisplay amount={calculatedProfit} />
							</p>
						</div>
					</div>

				<!-- Actions Bar -->
				<div class="flex flex-wrap items-center gap-2.5 bg-muted/20 p-3 rounded-2xl border border-border/50">
					<Button onclick={openPaymentForm} disabled={!canPay} class="h-8.5 rounded-xl flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
						<Coins class="h-4 w-4" /> Post Supplier Payment
					</Button>
					<a
						href="/suppliers/returns/record"
						class="h-8.5 px-3.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer"
					>
						<Undo2 class="h-3.5 w-3.5 text-emerald-600" /> Go to Returns Hub
					</a>

					<!-- Mark as Deal Closed / Unlock Action -->
					{#if !isDealClosed}
						<Button
							onclick={() => (showMarkDealClosedModal = true)}
							disabled={actionLoading || completionLoading}
							class="h-8.5 rounded-xl flex items-center gap-1.5 text-xs font-semibold cursor-pointer bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 sm:ml-auto"
						>
							<CheckCircle2 class="h-4 w-4 text-emerald-400" /> Mark as Deal Closed
						</Button>
					{:else}
						{#if hasRole('master_accountant')}
							<Button
								onclick={() => (showUnlockModal = true)}
								disabled={actionLoading || completionLoading}
								variant="outline"
								class="h-8.5 rounded-xl flex items-center gap-1.5 text-xs font-semibold cursor-pointer border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 sm:ml-auto"
							>
								<Unlock class="h-4 w-4 text-amber-600 dark:text-amber-400" /> Unlock Deal
							</Button>
						{:else}
							<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 sm:ml-auto">
								<CheckCircle2 class="h-4 w-4 text-emerald-600" /> Deal Closed (Locked)
							</span>
						{/if}
					{/if}
				</div>

				<!-- Sequence Warnings -->
				{#if isDealClosed}
					<div class="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-xs">
						<AlertCircle class="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
						<div>
							<strong class="font-bold">Deal Closed & Finalized:</strong> This deal is marked as closed. All supplier payouts, purchase returns, and customer refunds are locked.
							{#if hasRole('master_accountant')}
								<span class="block mt-0.5 text-amber-800 font-medium">As a Master Accountant, you have privilege to unlock this deal using the "Unlock Deal" button above.</span>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Supplier Payments List -->
				<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
					<div class="p-4 border-b border-border bg-muted/20">
						<h2 class="text-xs font-bold text-foreground">Supplier Payments ({detail.supplierPayments?.length ?? 0})</h2>
					</div>
					{#if detail.supplierPayments?.length}
						<table class="w-full text-xs text-left">
							<thead class="bg-muted/30 text-muted-foreground font-semibold border-b border-border text-[10px] uppercase tracking-wider">
								<tr>
									<th class="p-3">Supplier Name & Code</th>
									<th class="p-3">Amount</th>
									<th class="p-3">Method</th>
									<th class="p-3">Status</th>
									<th class="p-3">Reference</th>
									<th class="p-3">Requested By</th>
									<th class="p-3">Date</th>
									<th class="p-3">Actions</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60">
								{#each detail.supplierPayments as sp}
									<tr class="hover:bg-muted/10 transition-colors">
										<td class="p-3 font-semibold text-foreground">{getSupplierLabel(sp.supplierId)}</td>
										<td class="p-3 font-mono font-bold text-rose-600"><MoneyDisplay amount={sp.amount} /></td>
										<td class="p-3 capitalize">{formatPaymentMethodLabel(sp)}</td>
										<td class="p-3">
											<span class="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold {statusClass(sp.status)}">{sp.status}</span>
										</td>
										<td class="p-3 text-muted-foreground font-mono">{sp.referenceNumber ?? '—'}</td>
										<td class="p-3 font-medium text-foreground">{getUserLabel(sp.requestedByUserId, sp)}</td>
										<td class="p-3 text-muted-foreground"><DateDisplay value={sp.requestedAt} /></td>
										<td class="p-3">
											{#if isDealClosed}
												<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
													<Lock class="h-3 w-3 text-muted-foreground/70" /> Locked
												</span>
											{:else if (sp.status ?? '').toLowerCase().includes('pending') || (sp.status ?? '').toLowerCase() === 'draft'}
												<div class="flex items-center gap-1.5">
													{#if hasRole('accountant')}
														<button class="px-2 py-1 text-[11px] font-semibold border border-border rounded-lg bg-card hover:bg-muted cursor-pointer" onclick={() => openEditGovtFeeModal(sp)}>Edit</button>
														<button class="px-2 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer" onclick={() => handleApproveSupplierPayment(sp)}>Approve</button>
														<button class="px-2 py-1 text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg cursor-pointer" onclick={() => handleRejectSupplierPayment(sp)}>Reject</button>
													{:else}
														<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">Pending Approval</span>
													{/if}
												</div>
											{:else}
												<span class="text-muted-foreground text-[11px]">—</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{:else}
						<div class="p-8 text-center text-muted-foreground text-xs">No supplier payments recorded.</div>
					{/if}
				</div>

				<!-- Purchase Returns List -->
				<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
					<div class="p-4 border-b border-border bg-muted/20">
						<h2 class="text-xs font-bold text-foreground">Purchase Returns (Supplier Refunds) ({detail.purchaseReturns?.length ?? 0})</h2>
					</div>
					{#if detail.purchaseReturns?.length}
						<table class="w-full text-xs text-left">
							<thead class="bg-muted/30 text-muted-foreground font-semibold border-b border-border text-[10px] uppercase tracking-wider">
								<tr>
									<th class="p-3">Supplier Name & Code</th>
									<th class="p-3">Amount</th>
									<th class="p-3">Destination</th>
									<th class="p-3">Status</th>
									<th class="p-3">Reason</th>
									<th class="p-3">Requested By</th>
									<th class="p-3">Date</th>
									<th class="p-3">Actions</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60">
								{#each detail.purchaseReturns as pr}
									<tr class="hover:bg-muted/10 transition-colors">
										<td class="p-3 font-semibold text-foreground">{getSupplierLabel(pr.supplierId)}</td>
										<td class="p-3 font-mono font-bold text-emerald-600"><MoneyDisplay amount={pr.amount} /></td>
										<td class="p-3 capitalize">{pr.destinationType}</td>
										<td class="p-3">
											<span class="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold {statusClass(pr.status)}">{pr.status}</span>
										</td>
										<td class="p-3 text-muted-foreground">{pr.reason}</td>
										<td class="p-3 font-medium text-foreground">{getUserLabel(pr.requestedByUserId, pr)}</td>
										<td class="p-3 text-muted-foreground"><DateDisplay value={pr.requestedAt} /></td>
										<td class="p-3">
											{#if isDealClosed}
												<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
													<Lock class="h-3 w-3 text-muted-foreground/70" /> Locked
												</span>
											{:else if (pr.status ?? '').toLowerCase().includes('pending') && hasRole('accountant')}
												<div class="flex items-center gap-1.5">
													<button class="px-2 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer" onclick={() => handleApprovePurchaseReturn(pr)}>Approve</button>
													<button class="px-2 py-1 text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg cursor-pointer" onclick={() => handleRejectPurchaseReturn(pr)}>Reject</button>
												</div>
											{:else}
												<span class="text-muted-foreground text-[11px]">—</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{:else}
						<div class="p-8 text-center text-muted-foreground text-xs">No purchase refunds received.</div>
					{/if}
				</div>

				<!-- Sales Returns List -->
				<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
					<div class="p-4 border-b border-border bg-muted/20">
						<h2 class="text-xs font-bold text-foreground">Sales Returns (Customer Refunds) ({detail.salesReturns?.length ?? 0})</h2>
					</div>
					{#if detail.salesReturns?.length}
						<table class="w-full text-xs text-left">
							<thead class="bg-muted/30 text-muted-foreground font-semibold border-b border-border text-[10px] uppercase tracking-wider">
								<tr>
									<th class="p-3">Recipient</th>
									<th class="p-3">Amount</th>
									<th class="p-3">Reason</th>
									<th class="p-3">Status</th>
									<th class="p-3">Requested By</th>
									<th class="p-3">Date</th>
									<th class="p-3">Actions</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60">
								{#each detail.salesReturns as sr}
									<tr class="hover:bg-muted/10 transition-colors">
										<td class="p-3 capitalize">{getRecipientLabel(sr.recipientType, sr.recipientId, sr)}</td>
										<td class="p-3 font-mono font-bold text-sky-600"><MoneyDisplay amount={sr.amount} /></td>
										<td class="p-3 text-muted-foreground">{sr.reason}</td>
										<td class="p-3">
											<span class="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold {statusClass(sr.status)}">{sr.status}</span>
										</td>
										<td class="p-3 font-medium text-foreground">{getUserLabel(sr.requestedByUserId, sr)}</td>
										<td class="p-3 text-muted-foreground"><DateDisplay value={sr.requestedAt} /></td>
										<td class="p-3">
											{#if isDealClosed}
												<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
													<Lock class="h-3 w-3 text-muted-foreground/70" /> Locked
												</span>
											{:else if (sr.status ?? '').toLowerCase().includes('pending') && hasRole('accountant')}
												<div class="flex items-center gap-1.5">
													<button class="px-2 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer" onclick={() => handleApproveSalesReturn(sr)}>Approve</button>
													<button class="px-2 py-1 text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg cursor-pointer" onclick={() => handleRejectSalesReturn(sr)}>Reject</button>
												</div>
											{:else}
												<span class="text-muted-foreground text-[11px]">—</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{:else}
						<div class="p-8 text-center text-muted-foreground text-xs">No client refunds processed.</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- ─── TIMELINE TAB ─────────────────────────────────────────────────── -->
		{:else if activeTab === 'timeline'}
			<div class="bg-card border border-border rounded-2xl p-5 space-y-3">
				<h2 class="text-sm font-bold flex items-center gap-2">
					<Clock class="h-4 w-4 text-primary" /> Booking Timeline
				</h2>
				<ol class="relative border-l border-border/60 ml-3 space-y-6">
					<li class="ml-5">
						<span class="absolute -left-1.5 mt-0.5 h-3 w-3 rounded-full border-2 border-primary bg-card"></span>
						<div class="text-xs">
							<p class="font-semibold text-foreground">Booking Created</p>
							<p class="text-muted-foreground"><DateDisplay value={sd.createdAt} /></p>
						</div>
					</li>
					{#each (detail?.journalEntries ?? []) as j}
						<li class="ml-5">
							<span class="absolute -left-1.5 mt-0.5 h-3 w-3 rounded-full border-2 border-sky-400 bg-card"></span>
							<div class="text-xs">
								<p class="font-semibold text-foreground">Journal Entry — {j.journalNumber}</p>
								<p class="text-muted-foreground">{j.description} • <DateDisplay value={j.entryDate} /></p>
							</div>
						</li>
					{/each}
					{#each (detail?.supplierPayments ?? []) as sp}
						<li class="ml-5">
							<span class="absolute -left-1.5 mt-0.5 h-3 w-3 rounded-full border-2 border-amber-400 bg-card"></span>
							<div class="text-xs">
								<p class="font-semibold text-foreground">Supplier Payment — <MoneyDisplay amount={sp.amount} /></p>
								<p class="text-muted-foreground">Status: {sp.status} • <DateDisplay value={sp.requestedAt} /></p>
							</div>
						</li>
					{/each}
					{#each (detail?.purchaseReturns ?? []) as pr}
						<li class="ml-5">
							<span class="absolute -left-1.5 mt-0.5 h-3 w-3 rounded-full border-2 border-emerald-400 bg-card"></span>
							<div class="text-xs">
								<p class="font-semibold text-foreground">Purchase Return — <MoneyDisplay amount={pr.amount} /></p>
								<p class="text-muted-foreground">Status: {pr.status} • <DateDisplay value={pr.requestedAt} /></p>
							</div>
						</li>
					{/each}
					{#each (detail?.salesReturns ?? []) as sr}
						<li class="ml-5">
							<span class="absolute -left-1.5 mt-0.5 h-3 w-3 rounded-full border-2 border-sky-400 bg-card"></span>
							<div class="text-xs">
								<p class="font-semibold text-foreground">Sales Return — <MoneyDisplay amount={sr.amount} /></p>
								<p class="text-muted-foreground">Status: {sr.status} • <DateDisplay value={sr.requestedAt} /></p>
							</div>
						</li>
					{/each}
					<li class="ml-5">
						<span class="absolute -left-1.5 mt-0.5 h-3 w-3 rounded-full border-2 border-emerald-400 bg-card"></span>
						<div class="text-xs">
							<p class="font-semibold text-foreground">Last Updated</p>
							<p class="text-muted-foreground"><DateDisplay value={sd.updatedAt} /></p>
						</div>
					</li>
				</ol>
			</div>
		{/if}
	{:else}
		<div class="bg-card border border-border rounded-2xl p-16 text-center text-muted-foreground text-xs">
			Booking not found.
		</div>
	{/if}
</div>

<!-- Form Modals -->

<!-- 1. POST SUPPLIER PAYMENT MODAL -->
{#if showPaymentModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
			<div class="flex items-center justify-between pb-3 border-b border-border/50">
				<h3 class="text-sm font-bold text-foreground flex items-center gap-1.5">
					<Coins class="h-4.5 w-4.5 text-primary" /> {approvingPendingPayment ? 'Approve & Post Supplier Payment' : 'Post Supplier Payment'}
				</h3>
				<button onclick={() => { showPaymentModal = false; approvingPendingPayment = null; }} class="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground cursor-pointer">
					<X class="h-4 w-4" />
				</button>
			</div>
			
			<form onsubmit={submitPaymentForm} class="space-y-4 text-xs">
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-1.5 col-span-2">
						<label for="pay-supplier" class="block font-semibold text-foreground">Select Supplier <span class="text-red-500">*</span></label>
						<SearchableSelect
							id="pay-supplier"
							options={filteredSuppliersList.map((s) => ({
								id: s.id,
								name: `${s.name} (${s.code})`,
								subtext: s.wallet !== undefined ? `Wallet Bal: ${s.wallet.toFixed(3)} BHD` : undefined
							}))}
							bind:value={paySupplierId}
							placeholder="-- Select Supplier --"
							searchPlaceholder="Search supplier name or code..."
							required
						/>
					</div>

					{#if selectedPaySupplier}
						<div class="col-span-2 p-3 bg-muted/30 border border-border/80 rounded-xl text-xs flex items-center justify-between">
							<div class="space-y-0.5">
								<span class="text-[10px] text-muted-foreground uppercase font-semibold block">Current Supplier Wallet Balance</span>
								<span class="text-sm font-bold font-mono {selectedPaySupplier.wallet > 0 ? 'text-emerald-600' : selectedPaySupplier.wallet < 0 ? 'text-rose-600' : 'text-foreground'}">
									{selectedPaySupplier.wallet > 0 ? '+' : ''}<MoneyDisplay amount={selectedPaySupplier.wallet ?? 0} />
								</span>
							</div>
							<span class="px-2 py-0.5 text-[10px] font-bold rounded-md {selectedPaySupplier.wallet > 0 ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : selectedPaySupplier.wallet < 0 ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-muted text-muted-foreground'}">
								{selectedPaySupplier.wallet > 0 ? 'Surplus (+)' : selectedPaySupplier.wallet < 0 ? 'Debt (-)' : 'Settled'}
							</span>
						</div>
					{/if}

					<div class="space-y-1.5">
						<label for="pay-amount" class="block font-semibold text-foreground">Payment Amount <span class="text-red-500">*</span></label>
						<Input id="pay-amount" type="number" step="0.001" min="0" bind:value={payAmount} required />
					</div>

					<div class="space-y-1.5">
						<label for="pay-method" class="block font-semibold text-foreground">Payment Method <span class="text-red-500">*</span></label>
						<select id="pay-method" bind:value={payMethod} class="h-9.5 w-full bg-muted/60 border border-border rounded-xl px-2.5 text-foreground cursor-not-allowed opacity-80" disabled>
							<option value="supplier_wallet">Credit</option>
						</select>
					</div>

					{#if payMethod !== 'credit' && payMethod !== 'supplier_wallet'}
						<div class="space-y-1.5 col-span-2">
							<label for="pay-source" class="block font-semibold text-foreground">
								Source {payMethod === 'cash' ? 'Cash' : 'Bank'} Account <span class="text-red-500">*</span>
							</label>
							<SearchableSelect
								id="pay-source"
								options={filteredSourceAccounts}
								bind:value={paySourceId}
								placeholder={`-- Select Source ${payMethod === 'cash' ? 'Cash' : 'Bank'} Account --`}
								searchPlaceholder="Search bank or cash account..."
								required
							/>
						</div>
					{/if}

					{#if (payMethod === 'supplier_wallet' || payMethod === 'credit') && selectedPaySupplier && payAmount != null && !isNaN(payAmount) && (selectedPaySupplier.wallet ?? 0) - payAmount < 0}
						<div class="col-span-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-400 font-medium text-[11px] flex items-center gap-1.5">
							<AlertCircle class="h-4 w-4 shrink-0 text-amber-500" />
							<span>This will put the supplier balance into credit ({((selectedPaySupplier.wallet ?? 0) - payAmount).toFixed(3)} BHD).</span>
						</div>
					{/if}

					<div class="space-y-1.5 col-span-2">
						<label for="pay-ref" class="block font-semibold text-foreground">Reference / Cheque Number</label>
						<Input id="pay-ref" type="text" bind:value={payRefNum} placeholder="e.g. TXN-998822" />
					</div>

					<div class="space-y-1.5 col-span-2">
						<label for="pay-desc" class="block font-semibold text-foreground">Description / Notes</label>
						<Input id="pay-desc" type="text" bind:value={payDesc} placeholder="Enter payment description..." />
					</div>
				</div>

				<div class="flex justify-end gap-2.5 pt-4 border-t border-border/50">
					<Button type="button" variant="outline" onclick={() => { showPaymentModal = false; approvingPendingPayment = null; }} class="rounded-xl">Cancel</Button>
					<Button type="submit" disabled={actionLoading || !paySupplierId || payAmount == null || isNaN(payAmount) || payAmount < 0 || (payMethod !== 'credit' && payMethod !== 'supplier_wallet' && !paySourceId)} class="rounded-xl bg-primary text-white font-semibold">
						{#if actionLoading}<RefreshCw class="h-3 w-3 mr-1.5 animate-spin" />{/if}
						{approvingPendingPayment ? 'Approve & Post Payment' : 'Post Payment'}
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}

<ConfirmationDialog
	bind:open={showStatusConfirmModal}
	title={statusConfirmTitle}
	message={statusConfirmMessage}
	confirmLabel={statusConfirmActionLabel}
	isDestructive={statusConfirmIsDestructive}
	onConfirm={executeBookingStatusUpdate}
/>

<!-- Online Payment Reference ID Modal -->
{#if showReferenceIdModal}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
		<div class="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
			<div class="flex items-center justify-between border-b border-border/40 pb-3">
				<div class="flex items-center gap-2">
					<CreditCard class="h-5 w-5 text-primary" />
					<h3 class="text-base font-bold text-foreground">Enter Bank Reference ID</h3>
				</div>
				<button 
					onclick={() => showReferenceIdModal = false}
					class="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<p class="text-xs text-muted-foreground leading-relaxed">
				Please enter the unique Bank / Online Transaction Reference ID for this payment application. Duplicate reference IDs are strictly prohibited and cannot be reused.
			</p>

			<form onsubmit={(e) => {
				e.preventDefault();
				if (!onlineReferenceIdVal.trim()) {
					toast.error('Bank Reference ID is required for online payments.');
					return;
				}
				targetBookingStatusToApply = 'success';
				executeBookingStatusUpdate(onlineReferenceIdVal.trim());
			}} class="space-y-4">
				<div class="space-y-1.5">
					<label for="refIdInput" class="text-xs font-semibold text-foreground">Transaction Reference ID *</label>
					<Input
						id="refIdInput"
						type="text"
						placeholder="e.g. TXN-987654321"
						bind:value={onlineReferenceIdVal}
						oninput={() => (refIdModalError = null)}
						required
						class={['text-xs font-mono', refIdModalError ? 'border-red-500 ring-2 ring-red-500/20' : ''].join(' ')}
					/>
					{#if refIdModalError}
						<p class="text-[11px] font-semibold text-red-600 flex items-center gap-1 mt-1.5 animate-in fade-in duration-150">
							<AlertCircle class="h-3.5 w-3.5 shrink-0 text-red-600" />
							<span>{refIdModalError}</span>
						</p>
					{/if}
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
					<Button 
						type="button" 
						variant="outline" 
						class="rounded-xl h-9 text-xs" 
						disabled={actionLoading}
						onclick={() => showReferenceIdModal = false}
					>
						Cancel
					</Button>
					<Button 
						type="submit" 
						class="rounded-xl h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white" 
						disabled={actionLoading || !onlineReferenceIdVal.trim()}
					>
						{#if actionLoading}
							<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />
						{/if}
						Confirm & Approve Payment
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Edit Government Fee Modal -->
{#if showEditGovtFeeModal}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
		<div class="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
			<div class="flex items-center justify-between border-b border-border/40 pb-3">
				<div class="flex items-center gap-2">
					<Pencil class="h-5 w-5 text-primary" />
					<h3 class="text-base font-bold text-foreground">Edit Government Fee / Supplier Payment</h3>
				</div>
				<button 
					onclick={() => showEditGovtFeeModal = false}
					class="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<form onsubmit={submitEditGovtFeeForm} class="space-y-4 text-xs">
				<div class="space-y-1.5">
					<label for="editGovtAmt" class="font-semibold text-foreground">Government Fee Amount (BHD) *</label>
					<Input id="editGovtAmt" type="number" step="0.001" min="0" bind:value={editGovtFeeAmount} required class="h-9.5 text-xs font-mono" />
				</div>
				<div class="space-y-1.5">
					<label for="editGovtSupplier" class="font-semibold text-foreground">Supplier *</label>
					<select id="editGovtSupplier" class="h-9.5 w-full bg-background border border-border rounded-xl px-2.5 text-xs font-medium" bind:value={editGovtFeeSupplierId}>
						{#each filteredSuppliersList as sup}
							<option value={sup.id}>{sup.name} ({sup.code})</option>
						{/each}
					</select>
				</div>
				<div class="space-y-1.5">
					<label for="editGovtRef" class="font-semibold text-foreground">Reference / Txn Number</label>
					<Input id="editGovtRef" type="text" placeholder="e.g. TXN-123456" bind:value={editGovtFeeRefNum} class="h-9.5 text-xs font-mono" />
				</div>
				<div class="space-y-1.5">
					<label for="editGovtDesc" class="font-semibold text-foreground">Description / Narration</label>
					<Input id="editGovtDesc" type="text" placeholder="Government Payment description..." bind:value={editGovtFeeDesc} class="h-9.5 text-xs" />
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
					<Button type="button" variant="outline" class="rounded-xl h-9 text-xs" disabled={actionLoading} onclick={() => showEditGovtFeeModal = false}>
						Cancel
					</Button>
					<Button type="submit" class="rounded-xl h-9 text-xs font-semibold bg-primary text-primary-foreground" disabled={actionLoading || editGovtFeeAmount == null || isNaN(editGovtFeeAmount) || editGovtFeeAmount < 0}>
						{#if actionLoading}
							<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />
						{/if}
						Save Fee Changes
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Supplier Payment Reject Dialog -->
<SupplierPaymentRejectDialog
	bind:open={showSpRejectModal}
	paymentAmount={spToReject?.amount ?? null}
	paymentDescription={formatSpDesc(spToReject?.description)}
	loading={spRejectLoading}
	onConfirm={submitSpRejection}
	onClose={() => { showSpRejectModal = false; spToReject = null; }}
/>

<!-- Mark as Deal Closed Confirmation Dialog -->
<ConfirmationDialog
	bind:open={showMarkDealClosedModal}
	title="Mark as Deal Closed"
	message="Are you sure you want to mark this deal as closed? Once deal is closed, supplier payouts, purchase returns, and customer refunds will be locked. (Only Master Accountants can unlock this deal later)."
	confirmLabel="Mark as Deal Closed"
	isDestructive={false}
	onConfirm={handleMarkAsDealClosed}
	onCancel={() => (showMarkDealClosedModal = false)}
/>

<!-- Unlock Deal Confirmation Dialog (Master Accountant Only) -->
<ConfirmationDialog
	bind:open={showUnlockModal}
	title="Unlock Deal / Re-open Deal?"
	message="As a Master Accountant, do you want to unlock this deal? This will re-open supplier payments, purchase refunds, and sales refund workflows for accountants to make necessary adjustments."
	confirmLabel="Unlock Deal"
	isDestructive={false}
	onConfirm={handleUnlockBooking}
	onCancel={() => (showUnlockModal = false)}
/>

<!-- Unlock Operation Confirmation Dialog (Master Accountant Only) -->
<ConfirmationDialog
	bind:open={showUnlockOperationModal}
	title="Unlock Operational Processing"
	message="Are you sure you want to unlock this application for operations? This will re-enable all operational processing (approvals, document requests, fee entries) in the Operational Portal."
	confirmLabel="Unlock Operation"
	isDestructive={false}
	onConfirm={handleUnlockOperation}
	onCancel={() => (showUnlockOperationModal = false)}
/>

<!-- Lock Operation Confirmation Dialog (Master Accountant Only) -->
<ConfirmationDialog
	bind:open={showLockOperationModal}
	title="Lock Operational Processing"
	message="Are you sure you want to lock operational processing for this application? Operational staff will no longer be able to make changes in the Operational Portal until unlocked by a Master Accountant."
	confirmLabel="Lock Operation"
	isDestructive={true}
	onConfirm={handleLockOperation}
	onCancel={() => (showLockOperationModal = false)}
/>
