import type { StaffUserResponse, PortalType } from '../types/staff-types';
import { fetchAccountsStaff, fetchSalesStaff, fetchOperationalStaff } from '../api/staffs-api';

interface PortalStaffState {
	data: StaffUserResponse[];
	loading: boolean;
	error: string | null;
}

class StaffsStore {
	accounts = $state<PortalStaffState>({ data: [], loading: false, error: null });
	sales = $state<PortalStaffState>({ data: [], loading: false, error: null });
	operational = $state<PortalStaffState>({ data: [], loading: false, error: null });

	async loadAccounts(force = false) {
		if (this.accounts.loading) return;
		if (this.accounts.data.length > 0 && !force) return;

		this.accounts.loading = true;
		this.accounts.error = null;
		try {
			this.accounts.data = await fetchAccountsStaff();
		} catch (err: any) {
			this.accounts.error = err?.message || 'Unable to load Accounts staff.';
		} finally {
			this.accounts.loading = false;
		}
	}

	async loadSales(force = false) {
		if (this.sales.loading) return;
		if (this.sales.data.length > 0 && !force) return;

		this.sales.loading = true;
		this.sales.error = null;
		try {
			this.sales.data = await fetchSalesStaff();
		} catch (err: any) {
			this.sales.error = err?.message || 'Unable to load Sales staff.';
		} finally {
			this.sales.loading = false;
		}
	}

	async loadOperational(force = false) {
		if (this.operational.loading) return;
		if (this.operational.data.length > 0 && !force) return;

		this.operational.loading = true;
		this.operational.error = null;
		try {
			this.operational.data = await fetchOperationalStaff();
		} catch (err: any) {
			this.operational.error = err?.message || 'Unable to load Operational staff.';
		} finally {
			this.operational.loading = false;
		}
	}

	loadPortal(portal: PortalType, force = false) {
		if (portal === 'accounts') return this.loadAccounts(force);
		if (portal === 'sales') return this.loadSales(force);
		if (portal === 'operational') return this.loadOperational(force);
	}
}

export const staffsStore = new StaffsStore();
