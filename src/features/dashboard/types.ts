/**
 * Dashboard feature types.
 * Derived from GET /api/reconciliation/summary response contract.
 */

/** Response from GET /api/reconciliation/summary */
export interface ReconciliationSummary {
	totalBankBalance: number;
	totalAccountBalance: number;
	totalSupplierNetBalance: number;
	totalSupplierSurplusBalance: number;
	totalSupplierPayableBalance: number;
}

/** Composed dashboard data (summary + recent transactions) */
export interface DashboardData {
	summary: ReconciliationSummary;
	recentTransactions: import('../financial-transactions/types').TransactionResponse[];
}
