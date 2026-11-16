/**
 * Reporting feature — TypeScript types.
 * Mirrors backend ReportingContracts.cs exactly.
 * Extends the existing GeneralLedgerReportResponse types.
 */

// ─── General Ledger Report ────────────────────────────────────────────────────

export interface GeneralLedgerReportItem {
	id: number;
	postingDate: string;
	debit: number;
	credit: number;
	description: string;
	sourceType: string | null;
	sourceId: string | null;
	sourceReference: string | null;
	correlationId: string | null;
	createdAt: string;
}

export interface GeneralLedgerReportResponse {
	accountId: number;
	accountCode: string;
	accountName: string;
	openingBalance: number;
	endingBalance: number;
	totalDebit: number;
	totalCredit: number;
	items: GeneralLedgerReportItem[];
}

// ─── Trial Balance ────────────────────────────────────────────────────────────

export interface TrialBalanceItem {
	accountId: number;
	accountCode: string;
	accountName: string;
	accountType: string;
	normalBalance: string;
	totalDebit: number;
	totalCredit: number;
	endingBalance: number;
}

export interface TrialBalanceResponse {
	items: TrialBalanceItem[];
	totalDebitSum: number;
	totalCreditSum: number;
	isBalanced: boolean;
}

// ─── Account Statement ────────────────────────────────────────────────────────

export interface AccountStatementLine {
	date: string;
	description: string;
	debit: number;
	credit: number;
	runningBalance: number;
	sourceType: string;
	sourceId: string;
	reference: string | null;
}

export interface AccountStatementResponse {
	accountCode: string;
	accountName: string;
	openingBalance: number;
	endingBalance: number;
	totalDebits: number;
	totalCredits: number;
	lines: AccountStatementLine[];
}

// ─── Expense Report ───────────────────────────────────────────────────────────

export interface ExpenseCategorySummary {
	categoryId: number;
	categoryName: string;
	accountCode: string;
	totalAmount: number;
	count: number;
}

export interface ExpenseReportItem {
	expenseId: number;
	expenseNumber: string;
	categoryName: string;
	amount: number;
	date: string;
	description: string;
	paymentMethod: string;
	status: string;
}

export interface ExpenseReportResponse {
	startDate: string;
	endDate: string;
	totalExpenseAmount: number;
	categories: ExpenseCategorySummary[];
	items: ExpenseReportItem[];
}
