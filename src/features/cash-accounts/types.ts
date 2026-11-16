/**
 * Cash Account (Account) feature types.
 * Derived from actual backend AccountContracts.cs
 */

/** Response from GET /api/account */
export interface AccountResponse {
	id: number;
	name: string;
	type: string; // "cash" | "bank" | "credit"
	ledgerType: string; // "asset" | "liability" | "capital" | "income" | "expense"
	balance: number; // Opening/book balance
	currentBalance: number; // Running balance — authoritative from backend
	bankId: number | null;
	isActive: boolean;
	createdAt: string;
}

/** Request body for POST /api/account */
export interface CreateAccountRequest {
	name: string;
	type: string;
	ledgerType: string;
	openingBalance: number;
	bankId?: number | null;
}

/** Request body for PUT /api/account/{id} */
export interface UpdateAccountRequest {
	name: string;
	type: string;
	ledgerType: string;
	bankId?: number | null;
}

/** Request body for POST /api/account/{id}/correct-balance */
export interface BalanceCorrectionRequest {
	adjustmentAmount: number;
	reason: string;
}

/** Response from POST /api/account/{id}/correct-balance */
export interface BalanceCorrectionResponse {
	message: string;
	currentBalance: number;
}

/** Response from POST /api/account/{id}/toggle-status */
export interface ToggleStatusResponse {
	message: string;
}
