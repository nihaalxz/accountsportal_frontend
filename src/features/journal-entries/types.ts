/**
 * Journal Entries feature — TypeScript types.
 * Mirrors backend JournalEntryContracts.cs exactly.
 */

export type JournalStatus = 'pending' | 'approved' | 'rejected';

export interface JournalEntryResponse {
	id: number;
	journalNumber: string;
	transferReference: string | null;
	debitPartyType: string;
	debitPartyId: number;
	debitPartyName: string;
	creditPartyType: string;
	creditPartyId: number;
	creditPartyName: string;
	amount: number;
	status: JournalStatus;
	note: string | null;
	createdBy: number | null;
	createdByName: string | null;
	approvedBy: number | null;
	approvedByName: string | null;
	approvedAt: string | null;
	createdAt: string;
	updatedAt: string;
	rowVersion?: string; // Mapped dynamically in frontend if loaded
}

export interface CreateJournalEntryRequest {
	debitPartyType: string;
	debitPartyId: number;
	creditPartyType: string;
	creditPartyId: number;
	amount: number;
	note: string | null;
}

export const JOURNAL_STATUS_LABELS: Record<JournalStatus, string> = {
	pending: 'Pending Approval',
	approved: 'Approved (Transferred)',
	rejected: 'Rejected'
};

export function canSubmitJournal(status: string): boolean {
	return status === 'draft';
}

export function canApproveJournal(status: string): boolean {
	return status === 'submitted';
}

export function canRejectJournal(status: string): boolean {
	return status === 'submitted';
}

export function canPostJournal(status: string): boolean {
	return status === 'approved';
}

export function canReverseJournal(status: string): boolean {
	return status === 'posted';
}

export function computeLineTotals(lines: { debit: number; credit: number }[]) {
	const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
	const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
	const difference = Math.abs(totalDebit - totalCredit);
	return {
		totalDebit,
		totalCredit,
		difference,
		isBalanced: difference === 0
	};
}

