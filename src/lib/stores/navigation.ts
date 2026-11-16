import { derived } from 'svelte/store';
import { currentUser } from './auth';
import {
	LayoutDashboard,
	Receipt,
	ShoppingBag,
	Users,
	UserCheck,
	Landmark,
	Wallet,
	BookOpen,
	CheckSquare,
	BarChart3,
	Settings,
	ShieldCheck,
	Globe,
	Folder,
	Briefcase,
	FileText,
	TrendingUp,
	BookUser,
	CreditCard,
	RotateCcw
} from 'lucide-svelte';

export interface NavigationItem {
	label: string;
	route: string;
	icon: typeof LayoutDashboard;
	requiredRole?: 'accounts' | 'master_accountant';
	requiredPermission?: string;
	mobilePrimary?: boolean; // Set to true to display in mobile bottom tab bar (limit 4-5)
	children?: {
		label: string;
		route: string;
		requiredRole?: 'accounts' | 'master_accountant';
	}[];
}

/**
 * Unified Texas Accounts Portal navigation tree.
 */
export const navigationItems: NavigationItem[] = [
	{
		label: 'Dashboard',
		route: '/dashboard',
		icon: LayoutDashboard,
		mobilePrimary: true
	},
	{
		label: 'Transactions',
		route: '/transactions',
		icon: Receipt,
		mobilePrimary: true
	},
	{
		label: 'Sales Entries',
		route: '/sales',
		icon: ShoppingBag,
		mobilePrimary: false,
		children: [
			{ label: 'Overview Dashboard', route: '/sales/dashboard' },
			{ label: 'Open Deals', route: '/sales/open-deals' },
			{ label: 'Flights Bookings', route: '/sales/bookings/flights' },
			{ label: 'Hotels Bookings', route: '/sales/bookings/hotels' },
			{ label: 'Visa Bookings', route: '/sales/bookings/visa' },
			{ label: 'Holiday Packages', route: '/sales/bookings/holiday' },
			{ label: 'VFS Appointments', route: '/sales/bookings/vfs' },
			{ label: 'Transportation', route: '/sales/bookings/transportation' },
			{ label: 'Other Services', route: '/sales/bookings/other-services' },
			{ label: 'Sales Leads', route: '/sales/leads', requiredRole: 'master_accountant' },
			{ label: 'Visa Countries & Packages', route: '/master-data/visa', requiredRole: 'master_accountant' },
			{ label: 'Disputes & Chargebacks', route: '/sales/disputes' },
			{ label: 'All heads', route: '/sales/heads' }
		]
	},
	{
		label: 'Sales Quotations',
		route: '/sales/quotations',
		icon: FileText
	},
	{
		label: 'Receipts & Ledger',
		route: '/sales/receipts',
		icon: CreditCard
	},
	{
		label: 'Customer Ledger Explorer',
		route: '/sales/ledger',
		icon: BookUser
	},
	{
		label: 'Salesman Profit Management',
		route: '/sales/profit-management',
		icon: TrendingUp,
		requiredRole: 'master_accountant'
	},
	{
		label: 'Suppliers',
		route: '/suppliers',
		icon: Users,
		mobilePrimary: true,
		children: [
			{ label: 'All Suppliers', route: '/suppliers' },
			{ label: 'Pending Operational Payments', route: '/suppliers/pending-payments' },
			{ label: 'Sales & Purchase Returns', route: '/suppliers/returns' }
		]
	},
	{
		label: 'Record Return',
		route: '/suppliers/returns/record',
		icon: RotateCcw
	},
	{
		label: 'Agents',
		route: '/agents',
		icon: UserCheck
	},
	{
		label: 'Cash Accounts',
		route: '/accounts',
		icon: Landmark
	},
	{
		label: 'Bank Accounts',
		route: '/banks',
		icon: Landmark
	},
	{
		label: 'Payments',
		route: '/payments',
		icon: Wallet
	},
	{
		label: 'Pending Approvals',
		route: '/pending-approvals',
		icon: CheckSquare,
		requiredRole: 'master_accountant'
	},
	{
		label: 'Journal Entries',
		route: '/accounting/journals',
		icon: BookOpen
	},
	{
		label: 'Salesmen Report',
		route: '/reports/salesmen',
		icon: BarChart3,
		mobilePrimary: true
	},
	{
		label: 'Profit & Loss',
		route: '/reports/profit-loss',
		icon: TrendingUp
	},
	{
		label: 'Staffs',
		route: '/staffs',
		icon: Folder,
		requiredRole: 'master_accountant',
		children: [
			{ label: 'Accounts Staff', route: '/staffs/accounts' },
			{ label: 'Sales Staff', route: '/staffs/sales' },
			{ label: 'Operational Staff', route: '/staffs/operational' }
		]
	},
	{
		label: 'Payroll',
		route: '/payroll',
		icon: Wallet,
		requiredRole: 'master_accountant',
		children: [
			{ label: 'Salary Profiles', route: '/payroll/salary-profiles' },
			{ label: 'Payroll History', route: '/payroll/history' }
		]
	}
];

/**
 * Reactively filters the navigation configuration based on the current user's authenticated context.
 */
export const filteredNavigation = derived(currentUser, ($user) => {
	if (!$user) return [];

	const role = $user.userType.toLowerCase().replace(/\s+/g, '_');

	return navigationItems
		.filter((item) => {
			// Validate role requirements
			if (item.requiredRole === 'master_accountant' && role !== 'master_accountant') {
				return false;
			}
			return true;
		})
		.map((item) => {
			// Filter children submenus
			if (item.children) {
				const filteredChildren = item.children.filter((child) => {
					if (
						child.requiredRole === 'master_accountant' &&
						role !== 'master_accountant'
					) {
						return false;
					}
					return true;
				});
				return { ...item, children: filteredChildren };
			}
			return item;
		});
});
