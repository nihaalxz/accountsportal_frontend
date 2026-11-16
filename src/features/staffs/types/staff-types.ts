export type PortalType = 'accounts' | 'sales' | 'operational';

export interface StaffUserResponse {
	id: number;
	name: string;
	email: string;
	role: string;
	isActive: boolean;
	profilePicture?: string | null;
	lastLoginAt?: string | null;
	lastLoginIp?: string | null;
	createdAt?: string | null;
	updatedAt?: string | null;
	operationalPermissions: string[];
	monthlyTarget?: number | null;
	profitTarget?: number | null;
}
