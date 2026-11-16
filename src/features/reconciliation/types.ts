/**
 * Reconciliation feature — TypeScript types.
 * Mirrors backend ReconciliationContracts and ReportingContracts.
 */

/** GET /api/reconciliation/summary */
export interface ReconciliationSummaryResponse {
	totalBankBalance: number;
	totalAccountBalance: number;
	totalSupplierNetBalance: number;
	totalSupplierSurplusBalance: number;
	totalSupplierPayableBalance: number;
}

/** GET /api/reconciliation/gl-reconciliation */
export interface GlReconciliationReportResponse {
	missingJournals: MissingJournalItem[];
	unbalancedJournals: UnbalancedJournalItem[];
	duplicatePostings: DuplicatePostingItem[];
	isReconciled: boolean;
}

export interface MissingJournalItem {
	originType: string;
	id: number;
	reference: string;
	amount: number;
	date: string;
	status: string;
}

export interface UnbalancedJournalItem {
	journalId: number;
	journalNumber: string;
	description: string;
	totalDebits: number;
	totalCredits: number;
	entryDate: string;
}

export interface DuplicatePostingItem {
	sourceType: string;
	sourceId: string;
	count: number;
	details: DuplicateJournalDetails[];
}

export interface DuplicateJournalDetails {
	journalId: number;
	journalNumber: string;
	amount: number;
	entryDate: string;
}
