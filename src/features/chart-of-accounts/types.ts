/**
 * Chart of Accounts feature — TypeScript types.
 * Mirrors backend ChartOfAccountsContracts.cs exactly.
 */

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type NormalBalance = 'debit' | 'credit';

export interface ChartOfAccountResponse {
	id: number;
	code: string;
	name: string;
	accountType: AccountType;
	normalBalance: NormalBalance;
	parentId: number | null;
	isControlAccount: boolean;
	isSystemAccount: boolean;
	isActive: boolean;
	description: string | null;
	createdAt: string;
}

export interface CreateChartOfAccountRequest {
	code: string;
	name: string;
	accountType: AccountType;
	normalBalance: NormalBalance;
	parentId: number | null;
	isControlAccount: boolean;
	description: string | null;
}

export interface UpdateChartOfAccountRequest {
	name: string;
	description: string | null;
}

/** Tree node for hierarchical UI rendering */
export interface ChartOfAccountNode extends ChartOfAccountResponse {
	children: ChartOfAccountNode[];
	depth: number;
}

/** Build a hierarchy tree from a flat list */
export function buildAccountTree(accounts: ChartOfAccountResponse[]): ChartOfAccountNode[] {
	const map = new Map<number, ChartOfAccountNode>();
	const roots: ChartOfAccountNode[] = [];

	// First pass: build map
	for (const acc of accounts) {
		map.set(acc.id, { ...acc, children: [], depth: 0 });
	}

	// Second pass: link children
	for (const node of map.values()) {
		if (node.parentId !== null) {
			const parent = map.get(node.parentId);
			if (parent) {
				node.depth = parent.depth + 1;
				parent.children.push(node);
			} else {
				roots.push(node);
			}
		} else {
			roots.push(node);
		}
	}

	// Sort by code within each level
	function sortNodes(nodes: ChartOfAccountNode[]): void {
		nodes.sort((a, b) => a.code.localeCompare(b.code));
		nodes.forEach((n) => sortNodes(n.children));
	}
	sortNodes(roots);

	return roots;
}

/** Flatten a tree back to a depth-annotated list for table rendering */
export function flattenTree(nodes: ChartOfAccountNode[]): ChartOfAccountNode[] {
	const result: ChartOfAccountNode[] = [];
	function visit(list: ChartOfAccountNode[]): void {
		for (const n of list) {
			result.push(n);
			visit(n.children);
		}
	}
	visit(nodes);
	return result;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
	asset: 'Asset',
	liability: 'Liability',
	equity: 'Equity',
	revenue: 'Revenue',
	expense: 'Expense'
};

export const NORMAL_BALANCE_LABELS: Record<NormalBalance, string> = {
	debit: 'Debit',
	credit: 'Credit'
};
