/**
 * Return Calculation Utilities for Record Return Workspace
 * Provides a single authoritative source of truth for computing supplier totals,
 * remaining refundable balances, and supplier attribution.
 */

export interface SupplierTotalsResult {
	totalPaid: number;
	totalReturned: number;
	refundableBalance: number;
	hasApprovedPayment: boolean;
	unattributedPaymentCount: number;
	unattributedPaymentAmount: number;
}

/**
 * Computes aggregated financial totals for a given supplier on a booking.
 * 
 * Rules:
 * 1. Sums all approved payments using .reduce() (never last-write-wins).
 * 2. If a payment has an explicit supplierId, it is attributed if and only if it matches selectedSupplierId.
 * 3. If a payment has a null/missing supplierId:
 *    - If the booking has exactly one unattributed payment AND the booking has a single assigned supplier
 *      (bookingSupplierId), it is attributed to bookingSupplierId only.
 *    - Otherwise (ambiguous), it is excluded from any single supplier's totalPaid and flagged as unattributed.
 * 4. Sums all approved purchase returns for this supplier.
 * 5. Calculates refundableBalance = Math.max(0, totalPaid - totalReturned).
 */
export function computeSupplierTotals(
	payments: any[] = [],
	returns: any[] = [],
	selectedSupplierId?: number | string | null,
	bookingSupplierId?: number | string | null
): SupplierTotalsResult {
	const sId = selectedSupplierId != null && selectedSupplierId !== '' ? Number(selectedSupplierId) : null;
	const bSupId = bookingSupplierId != null && bookingSupplierId !== '' ? Number(bookingSupplierId) : null;

	const approvedPayments = payments.filter(
		(p) => (p?.status || '').toLowerCase() === 'approved'
	);

	const nullSupplierPayments = approvedPayments.filter(
		(p) => p.supplierId == null || p.supplierId === ''
	);

	let unattributedCount = 0;
	let unattributedAmount = 0;

	const attributedPayments = approvedPayments.filter((p) => {
		const pSupId = p.supplierId != null && p.supplierId !== '' ? Number(p.supplierId) : null;

		if (pSupId != null) {
			return sId != null && pSupId === sId;
		}

		// Payment has null/empty supplierId
		if (nullSupplierPayments.length === 1 && bSupId != null) {
			// Single unattributed payment on a booking with single assigned supplier:
			// Attribute to bookingSupplierId only.
			if (sId != null && bSupId === sId) {
				return true;
			}
			return false;
		}

		// Ambiguous or unassigned: cannot safely attribute to selected supplier
		unattributedCount++;
		unattributedAmount += Number(p.amount) || 0;
		return false;
	});

	const totalPaid = attributedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
	const hasApprovedPayment = attributedPayments.length > 0;

	// Returns attribution
	const approvedReturns = returns.filter((r) => {
		if ((r?.status || '').toLowerCase() !== 'approved') return false;
		const rSupId = r.supplierId != null && r.supplierId !== '' ? Number(r.supplierId) : null;
		if (rSupId != null) {
			return sId != null && rSupId === sId;
		}
		if (nullSupplierPayments.length === 1 && bSupId != null) {
			return sId != null && bSupId === sId;
		}
		return false;
	});

	const totalReturned = approvedReturns.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
	const refundableBalance = Math.max(0, totalPaid - totalReturned);

	return {
		totalPaid,
		totalReturned,
		refundableBalance,
		hasApprovedPayment,
		unattributedPaymentCount: unattributedCount,
		unattributedPaymentAmount: unattributedAmount
	};
}
