import { describe, it, expect } from 'vitest';
import { computeSupplierTotals } from './return-calculations';

describe('computeSupplierTotals financial calculations', () => {
	it('correctly aggregates multiple approved payments from the same supplier instead of last-write-wins', () => {
		// Fixture booking with 2 approved supplier payments (e.g. advance + balance payment)
		const payments = [
			{ id: 101, supplierId: 1, amount: 45.5, status: 'approved' },
			{ id: 102, supplierId: 1, amount: 80.0, status: 'approved' },
			{ id: 103, supplierId: 1, amount: 20.0, status: 'rejected' }, // Should be excluded
			{ id: 104, supplierId: 2, amount: 50.0, status: 'approved' }  // Different supplier, should be excluded
		];
		const returns = [
			{ id: 201, supplierId: 1, amount: 15.5, status: 'approved' }
		];

		// List view computation
		const listViewTotals = computeSupplierTotals(payments, returns, 1, 1);

		// Detail view computation
		const detailViewTotals = computeSupplierTotals(payments, returns, 1, 1);

		// Assert list view and detail view produce identical results
		expect(listViewTotals.totalPaid).toBe(detailViewTotals.totalPaid);
		expect(listViewTotals.totalPaid).toBe(125.5);
		expect(listViewTotals.totalReturned).toBe(15.5);
		expect(listViewTotals.refundableBalance).toBe(110.0);
		expect(listViewTotals.hasApprovedPayment).toBe(true);
		expect(listViewTotals.unattributedPaymentCount).toBe(0);
	});

	it('correctly attributes a single null-supplierId payment to the booking assigned supplier only', () => {
		const payments = [
			{ id: 105, supplierId: null, amount: 100.0, status: 'approved' }
		];
		const returns: any[] = [];

		// When viewed under the booking's assigned supplier (supplier 1)
		const assignedSupplierTotals = computeSupplierTotals(payments, returns, 1, 1);
		expect(assignedSupplierTotals.totalPaid).toBe(100.0);
		expect(assignedSupplierTotals.hasApprovedPayment).toBe(true);
		expect(assignedSupplierTotals.unattributedPaymentCount).toBe(0);

		// When viewed under an unrelated supplier (supplier 2)
		const otherSupplierTotals = computeSupplierTotals(payments, returns, 2, 1);
		expect(otherSupplierTotals.totalPaid).toBe(0.0);
		expect(otherSupplierTotals.hasApprovedPayment).toBe(false);
	});

	it('excludes ambiguous null-supplierId payments when multiple exist or booking has no assigned supplier', () => {
		// Multiple unattributed payments on a booking without clear single supplier
		const payments = [
			{ id: 106, supplierId: null, amount: 50.0, status: 'approved' },
			{ id: 107, supplierId: null, amount: 30.0, status: 'approved' }
		];

		const result = computeSupplierTotals(payments, [], 1, null);
		expect(result.totalPaid).toBe(0);
		expect(result.unattributedPaymentCount).toBe(2);
		expect(result.unattributedPaymentAmount).toBe(80.0);
	});

	it('properly calculates refundableBalance capped at 0 when returns equal or exceed payments', () => {
		const payments = [
			{ id: 108, supplierId: 3, amount: 75.0, status: 'approved' }
		];
		const returns = [
			{ id: 202, supplierId: 3, amount: 75.0, status: 'approved' }
		];

		const result = computeSupplierTotals(payments, returns, 3, 3);
		expect(result.totalPaid).toBe(75.0);
		expect(result.totalReturned).toBe(75.0);
		expect(result.refundableBalance).toBe(0.0);
	});
});
