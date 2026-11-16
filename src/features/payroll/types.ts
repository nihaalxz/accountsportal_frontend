export interface UnifiedStaffUser {
	portalUserId: number;
	portalType: 'Account' | 'Sales' | 'Operational';
	name: string;
	email: string;
	userType: string;
}

export interface SalaryProfile {
	id: number;
	portalType: 'Account' | 'Sales' | 'Operational';
	portalUserId: number;
	employeeName: string;
	employeeEmail: string;
	employeeCode: string;
	basicSalary: number;
	defaultMonthlyIncentive: number;
	currency: string;
	effectiveFrom: string;
	effectiveTo?: string | null;
	status: 'Active' | 'Inactive';
	remarks?: string | null;
	createdAt: string;
	updatedAt?: string | null;
}

export interface SalaryRevision {
	id: number;
	salaryProfileId: number;
	oldBasicSalary: number;
	newBasicSalary: number;
	oldMonthlyIncentive: number;
	newMonthlyIncentive: number;
	reason: string;
	effectiveDate: string;
	changedBy: number;
	createdAt: string;
}

export interface CreateSalaryProfilePayload {
	portalType: 'Account' | 'Sales' | 'Operational';
	portalUserId: number;
	employeeCode: string;
	basicSalary: number;
	defaultMonthlyIncentive: number;
	currency: string;
	effectiveFrom: string;
	remarks?: string;
}

export interface UpdateSalaryProfilePayload {
	newBasicSalary: number;
	newMonthlyIncentive: number;
	reason: string;
	effectiveDate: string;
	remarks?: string;
}

export interface SalaryPayment {
	id: number;
	salaryProfileId: number;
	portalType: string;
	portalUserId: number;
	employeeName: string;
	employeeCode: string;
	payrollMonth: number;
	payrollYear: number;
	basicSalary: number;
	incentive: number;
	bonus: number;
	allowance: number;
	deduction: number;
	netSalary: number;
	paymentMethod: 'Cash Account' | 'Bank Account';
	cashAccountId?: number | null;
	cashAccountName?: string | null;
	bankAccountId?: number | null;
	bankAccountName?: string | null;
	transactionReference: string;
	paymentDate: string;
	paidByUserId: number;
	status: 'Pending' | 'Paid' | 'Cancelled';
	remarks?: string | null;
	createdAt: string;
	updatedAt?: string | null;
}

export interface CreateSalaryPaymentPayload {
	salaryProfileId: number;
	payrollMonth: number;
	payrollYear: number;
	basicSalary: number;
	incentive: number;
	bonus: number;
	allowance: number;
	deduction: number;
	paymentMethod: 'Cash Account' | 'Bank Account';
	cashAccountId?: number | null;
	bankAccountId?: number | null;
	transactionReference?: string;
	paymentDate: string;
	status: 'Pending' | 'Paid';
	remarks?: string;
}

export interface UpdateSalaryPaymentStatusPayload {
	status: 'Paid' | 'Cancelled';
	remarks?: string;
}
