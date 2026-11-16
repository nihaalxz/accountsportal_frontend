import { describe, it, expect } from 'vitest';
import {
	canSubmitExpense,
	canApproveExpense,
	canRejectExpense,
	canCancelExpense
} from '../../features/expenses/types';
import {
	canSubmitJournal,
	canApproveJournal,
	canRejectJournal,
	canPostJournal,
	canReverseJournal,
	computeLineTotals
} from '../../features/journal-entries/types';

describe('Expense State Transition Helpers', () => {
	it('should allow submit only when draft', () => {
		expect(canSubmitExpense('draft')).toBe(true);
		expect(canSubmitExpense('pendingapproval')).toBe(false);
		expect(canSubmitExpense('approved')).toBe(false);
	});

	it('should allow approve/reject when pendingapproval or draft', () => {
		expect(canApproveExpense('pendingapproval')).toBe(true);
		expect(canApproveExpense('draft')).toBe(true);
		expect(canApproveExpense('approved')).toBe(false);

		expect(canRejectExpense('pendingapproval')).toBe(true);
		expect(canRejectExpense('draft')).toBe(true);
		expect(canRejectExpense('rejected')).toBe(false);
	});

	it('should allow cancel only when draft', () => {
		expect(canCancelExpense('draft')).toBe(true);
		expect(canCancelExpense('pendingapproval')).toBe(false);
		expect(canCancelExpense('approved')).toBe(false);
	});
});

describe('Journal Entry State Transition Helpers', () => {
	it('should check submission transitions', () => {
		expect(canSubmitJournal('draft')).toBe(true);
		expect(canSubmitJournal('submitted')).toBe(false);
	});

	it('should check approve/reject transitions', () => {
		expect(canApproveJournal('submitted')).toBe(true);
		expect(canApproveJournal('draft')).toBe(false);

		expect(canRejectJournal('submitted')).toBe(true);
		expect(canRejectJournal('draft')).toBe(false);
	});

	it('should check post transitions', () => {
		expect(canPostJournal('approved')).toBe(true);
		expect(canPostJournal('submitted')).toBe(false);
	});

	it('should check reverse transitions', () => {
		expect(canReverseJournal('posted')).toBe(true);
		expect(canReverseJournal('approved')).toBe(false);
	});

	it('should compute journal line totals accurately', () => {
		const lines = [
			{ debit: 150, credit: 0 },
			{ debit: 0, credit: 150 }
		];
		const totals = computeLineTotals(lines);
		expect(totals.totalDebit).toBe(150);
		expect(totals.totalCredit).toBe(150);
		expect(totals.difference).toBe(0);
		expect(totals.isBalanced).toBe(true);
	});

	it('should detect unbalanced lines', () => {
		const lines = [
			{ debit: 150, credit: 0 },
			{ debit: 0, credit: 100 }
		];
		const totals = computeLineTotals(lines);
		expect(totals.isBalanced).toBe(false);
		expect(totals.difference).toBe(50);
	});
});
