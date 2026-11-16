<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/api/api-client';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { DateDisplay } from '$lib/components';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { currentUser, hasRole } from '$lib/stores/auth';
	import { toast } from '$lib/stores/toast';
	import { previewDocument } from '$lib/utils/preview-document';
	import {
		UserCheck,
		RefreshCw,
		Plus,
		Pencil,
		X,
		ShieldCheck,
		Wallet,
		Search,
		Download,
		Printer,
		Phone,
		Mail,
		Globe,
		Clock,
		Check,
		Trash2,
		AlertTriangle
	} from 'lucide-svelte';

	// ─── Types ────────────────────────────────────────────────────────────────────
	interface AgentResponse {
		id: number;
		firstName: string;
		lastName: string;
		fullName: string;
		salesmanId: number | null;
		phoneNo: string | null;
		emailId: string | null;
		nationality: string | null;
		address: string | null;
		wallet: number;
		isVerified: boolean;
		createdAt: string;
	}

	interface PendingItem {
		id: number;
		entityType: string;
		payloadJson: string;
		submittedByName: string;
		submittedByUserId: number;
		submittedAt: string;
		status: string;
		reviewedByName: string | null;
		reviewedAt: string | null;
	}

	interface AgentPayload {
		firstName: string;
		lastName: string;
		salesmanId: number | null;
		phoneNo: string | null;
		emailId: string | null;
		nationality: string | null;
		address: string | null;
	}

	interface SalesmanResponse {
		id: number;
		name: string;
		email: string;
	}

	// ─── State ────────────────────────────────────────────────────────────────────
	let agents = $state<AgentResponse[]>([]);
	let pending = $state<PendingItem[]>([]);
	let salesmen = $state<SalesmanResponse[]>([]);
	let loadingAgents = $state(false);
	let loadingPending = $state(false);
	let loadingSalesmen = $state(false);
	let searchVal = $state('');
	let activeTab = $state<'list' | 'pending'>('list');

	// Form state
	let showForm = $state(false);
	let isEditing = $state(false);
	let editingId = $state<number | null>(null);
	let isSaving = $state(false);

	// Country codes for all countries worldwide
	const COUNTRY_CODES = [
		// Regional / Frequent
		{ code: '+973', country: 'Bahrain', flag: '🇧🇭' },
		{ code: '+971', country: 'UAE', flag: '🇦🇪' },
		{ code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
		{ code: '+968', country: 'Oman', flag: '🇴🇲' },
		{ code: '+965', country: 'Kuwait', flag: '🇰🇼' },
		{ code: '+974', country: 'Qatar', flag: '🇶🇦' },
		{ code: '+91', country: 'India', flag: '🇮🇳' },
		{ code: '+92', country: 'Pakistan', flag: '🇵🇰' },
		{ code: '+880', country: 'Bangladesh', flag: '🇧🇩' },
		{ code: '+94', country: 'Sri Lanka', flag: '🇱🇰' },
		{ code: '+63', country: 'Philippines', flag: '🇵🇭' },
		{ code: '+20', country: 'Egypt', flag: '🇪🇬' },
		{ code: '+962', country: 'Jordan', flag: '🇯🇴' },
		{ code: '+961', country: 'Lebanon', flag: '🇱🇧' },
		{ code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
		{ code: '+1', country: 'United States', flag: '🇺🇸' },
		{ code: '+1-CA', country: 'Canada', flag: '🇨🇦', actualCode: '+1' },

		// All Global Countries Alphabetically
		{ code: '+93', country: 'Afghanistan', flag: '🇦🇫' },
		{ code: '+355', country: 'Albania', flag: '🇦🇱' },
		{ code: '+213', country: 'Algeria', flag: '🇩🇿' },
		{ code: '+376', country: 'Andorra', flag: '🇦🇩' },
		{ code: '+244', country: 'Angola', flag: '🇦🇴' },
		{ code: '+54', country: 'Argentina', flag: '🇦🇷' },
		{ code: '+374', country: 'Armenia', flag: '🇦🇲' },
		{ code: '+61', country: 'Australia', flag: '🇦🇺' },
		{ code: '+43', country: 'Austria', flag: '🇦🇹' },
		{ code: '+994', country: 'Azerbaijan', flag: '🇦🇿' },
		{ code: '+375', country: 'Belarus', flag: '🇧🇾' },
		{ code: '+32', country: 'Belgium', flag: '🇧🇪' },
		{ code: '+501', country: 'Belize', flag: '🇧🇿' },
		{ code: '+229', country: 'Benin', flag: '🇧🇯' },
		{ code: '+975', country: 'Bhutan', flag: '🇧🇹' },
		{ code: '+591', country: 'Bolivia', flag: '🇧🇴' },
		{ code: '+387', country: 'Bosnia and Herzegovina', flag: '🇧🇦' },
		{ code: '+267', country: 'Botswana', flag: '🇧🇼' },
		{ code: '+55', country: 'Brazil', flag: '🇧🇷' },
		{ code: '+673', country: 'Brunei', flag: '🇧🇳' },
		{ code: '+359', country: 'Bulgaria', flag: '🇧🇬' },
		{ code: '+226', country: 'Burkina Faso', flag: '🇧🇫' },
		{ code: '+257', country: 'Burundi', flag: '🇧🇮' },
		{ code: '+855', country: 'Cambodia', flag: '🇰🇭' },
		{ code: '+237', country: 'Cameroon', flag: '🇨🇲' },
		{ code: '+238', country: 'Cape Verde', flag: '🇨🇻' },
		{ code: '+236', country: 'Central African Republic', flag: '🇨🇫' },
		{ code: '+235', country: 'Chad', flag: '🇹🇩' },
		{ code: '+56', country: 'Chile', flag: '🇨🇱' },
		{ code: '+86', country: 'China', flag: '🇨🇳' },
		{ code: '+57', country: 'Colombia', flag: '🇨🇴' },
		{ code: '+269', country: 'Comoros', flag: '🇰🇲' },
		{ code: '+242', country: 'Congo', flag: '🇨🇬' },
		{ code: '+506', country: 'Costa Rica', flag: '🇨🇷' },
		{ code: '+385', country: 'Croatia', flag: '🇭🇷' },
		{ code: '+53', country: 'Cuba', flag: '🇨🇺' },
		{ code: '+357', country: 'Cyprus', flag: '🇨🇾' },
		{ code: '+420', country: 'Czech Republic', flag: '🇨🇿' },
		{ code: '+45', country: 'Denmark', flag: '🇩🇰' },
		{ code: '+253', country: 'Djibouti', flag: '🇩🇯' },
		{ code: '+593', country: 'Ecuador', flag: '🇪🇨' },
		{ code: '+503', country: 'El Salvador', flag: '🇸🇻' },
		{ code: '+240', country: 'Equatorial Guinea', flag: '🇬🇶' },
		{ code: '+291', country: 'Eritrea', flag: '🇪🇷' },
		{ code: '+372', country: 'Estonia', flag: '🇪🇪' },
		{ code: '+251', country: 'Ethiopia', flag: '🇪🇹' },
		{ code: '+679', country: 'Fiji', flag: '🇫🇯' },
		{ code: '+358', country: 'Finland', flag: '🇫🇮' },
		{ code: '+33', country: 'France', flag: '🇫🇷' },
		{ code: '+241', country: 'Gabon', flag: '🇬🇦' },
		{ code: '+220', country: 'Gambia', flag: '🇬🇲' },
		{ code: '+995', country: 'Georgia', flag: '🇬🇪' },
		{ code: '+49', country: 'Germany', flag: '🇩🇪' },
		{ code: '+233', country: 'Ghana', flag: '🇬🇭' },
		{ code: '+30', country: 'Greece', flag: '🇬🇷' },
		{ code: '+502', country: 'Guatemala', flag: '🇬🇹' },
		{ code: '+224', country: 'Guinea', flag: '🇬🇳' },
		{ code: '+509', country: 'Haiti', flag: '🇭🇹' },
		{ code: '+504', country: 'Honduras', flag: '🇭🇳' },
		{ code: '+852', country: 'Hong Kong', flag: '🇭🇰' },
		{ code: '+36', country: 'Hungary', flag: '🇭🇺' },
		{ code: '+354', country: 'Iceland', flag: '🇮🇸' },
		{ code: '+62', country: 'Indonesia', flag: '🇮🇩' },
		{ code: '+98', country: 'Iran', flag: '🇮🇷' },
		{ code: '+964', country: 'Iraq', flag: '🇮🇶' },
		{ code: '+353', country: 'Ireland', flag: '🇮🇪' },
		{ code: '+972', country: 'Israel', flag: '🇮🇱' },
		{ code: '+39', country: 'Italy', flag: '🇮🇹' },
		{ code: '+225', country: 'Ivory Coast', flag: '🇨🇮' },
		{ code: '+81', country: 'Japan', flag: '🇯🇵' },
		{ code: '+7-KZ', country: 'Kazakhstan', flag: '🇰🇿', actualCode: '+7' },
		{ code: '+254', country: 'Kenya', flag: '🇰🇪' },
		{ code: '+383', country: 'Kosovo', flag: '🇽🇰' },
		{ code: '+996', country: 'Kyrgyzstan', flag: '🇰🇬' },
		{ code: '+856', country: 'Laos', flag: '🇱🇦' },
		{ code: '+371', country: 'Latvia', flag: '🇱🇻' },
		{ code: '+218', country: 'Libya', flag: '🇱🇾' },
		{ code: '+370', country: 'Lithuania', flag: '🇱🇹' },
		{ code: '+352', country: 'Luxembourg', flag: '🇱🇺' },
		{ code: '+853', country: 'Macao', flag: '🇲🇴' },
		{ code: '+261', country: 'Madagascar', flag: '🇲🇬' },
		{ code: '+265', country: 'Malawi', flag: '🇲🇼' },
		{ code: '+60', country: 'Malaysia', flag: '🇲🇾' },
		{ code: '+960', country: 'Maldives', flag: '🇲🇻' },
		{ code: '+223', country: 'Mali', flag: '🇲🇱' },
		{ code: '+356', country: 'Malta', flag: '🇲🇹' },
		{ code: '+222', country: 'Mauritania', flag: '🇲🇷' },
		{ code: '+230', country: 'Mauritius', flag: '🇲🇺' },
		{ code: '+52', country: 'Mexico', flag: '🇲🇽' },
		{ code: '+373', country: 'Moldova', flag: '🇲🇩' },
		{ code: '+377', country: 'Monaco', flag: '🇲🇨' },
		{ code: '+976', country: 'Mongolia', flag: '🇲🇳' },
		{ code: '+382', country: 'Montenegro', flag: '🇲🇪' },
		{ code: '+212', country: 'Morocco', flag: '🇲🇦' },
		{ code: '+258', country: 'Mozambique', flag: '🇲🇿' },
		{ code: '+95', country: 'Myanmar', flag: '🇲🇲' },
		{ code: '+264', country: 'Namibia', flag: '🇳🇦' },
		{ code: '+977', country: 'Nepal', flag: '🇳🇵' },
		{ code: '+31', country: 'Netherlands', flag: '🇳🇱' },
		{ code: '+64', country: 'New Zealand', flag: '🇳🇿' },
		{ code: '+505', country: 'Nicaragua', flag: '🇳🇮' },
		{ code: '+227', country: 'Niger', flag: '🇳🇪' },
		{ code: '+234', country: 'Nigeria', flag: '🇳🇬' },
		{ code: '+47', country: 'Norway', flag: '🇳🇴' },
		{ code: '+970', country: 'Palestine', flag: '🇵🇸' },
		{ code: '+507', country: 'Panama', flag: '🇵🇦' },
		{ code: '+595', country: 'Paraguay', flag: '🇵🇾' },
		{ code: '+51', country: 'Peru', flag: '🇵🇪' },
		{ code: '+48', country: 'Poland', flag: '🇵🇱' },
		{ code: '+351', country: 'Portugal', flag: '🇵🇹' },
		{ code: '+40', country: 'Romania', flag: '🇷🇴' },
		{ code: '+7', country: 'Russia', flag: '🇷🇺' },
		{ code: '+250', country: 'Rwanda', flag: '🇷🇼' },
		{ code: '+378', country: 'San Marino', flag: '🇸🇲' },
		{ code: '+221', country: 'Senegal', flag: '🇸🇳' },
		{ code: '+381', country: 'Serbia', flag: '🇷🇸' },
		{ code: '+248', country: 'Seychelles', flag: '🇸🇨' },
		{ code: '+232', country: 'Sierra Leone', flag: '🇸🇱' },
		{ code: '+65', country: 'Singapore', flag: '🇸🇬' },
		{ code: '+421', country: 'Slovakia', flag: '🇸🇰' },
		{ code: '+386', country: 'Slovenia', flag: '🇸🇮' },
		{ code: '+252', country: 'Somalia', flag: '🇸🇴' },
		{ code: '+27', country: 'South Africa', flag: '🇿🇦' },
		{ code: '+82', country: 'South Korea', flag: '🇰🇷' },
		{ code: '+34', country: 'Spain', flag: '🇪🇸' },
		{ code: '+249', country: 'Sudan', flag: '🇸🇩' },
		{ code: '+46', country: 'Sweden', flag: '🇸🇪' },
		{ code: '+41', country: 'Switzerland', flag: '🇨🇭' },
		{ code: '+963', country: 'Syria', flag: '🇸🇾' },
		{ code: '+886', country: 'Taiwan', flag: '🇹🇼' },
		{ code: '+992', country: 'Tajikistan', flag: '🇹🇯' },
		{ code: '+255', country: 'Tanzania', flag: '🇹🇿' },
		{ code: '+66', country: 'Thailand', flag: '🇹🇭' },
		{ code: '+216', country: 'Tunisia', flag: '🇹🇳' },
		{ code: '+90', country: 'Turkey', flag: '🇹🇷' },
		{ code: '+993', country: 'Turkmenistan', flag: '🇹🇲' },
		{ code: '+256', country: 'Uganda', flag: '🇺🇬' },
		{ code: '+380', country: 'Ukraine', flag: '🇺🇦' },
		{ code: '+598', country: 'Uruguay', flag: '🇺🇾' },
		{ code: '+998', country: 'Uzbekistan', flag: '🇺🇿' },
		{ code: '+58', country: 'Venezuela', flag: '🇻🇪' },
		{ code: '+84', country: 'Vietnam', flag: '🇻🇳' },
		{ code: '+967', country: 'Yemen', flag: '🇾🇪' },
		{ code: '+260', country: 'Zambia', flag: '🇿🇲' },
		{ code: '+263', country: 'Zimbabwe', flag: '🇿🇼' }
	];

	// Form fields
	let fFirstName = $state('');
	let fLastName = $state('');
	let fSalesmanId = $state('');
	let fCountryCode = $state('+973');
	let fPhone = $state('');
	let fEmail = $state('');
	let fNationality = $state('');
	let fAddress = $state('');

	// Approval UI
	let approvingId = $state<number | null>(null);

	function parsePhoneNumber(phoneStr: string | null) {
		if (!phoneStr) return { code: '+973', phone: '' };
		const trimmed = phoneStr.trim();
		const matched = COUNTRY_CODES.find((c) => trimmed.startsWith(c.code));
		if (matched) {
			return {
				code: matched.code,
				phone: trimmed.slice(matched.code.length).trim()
			};
		}
		return { code: '+973', phone: trimmed };
	}

	// ─── Derived ─────────────────────────────────────────────────────────────────
	let filteredAgents = $derived(
		agents.filter((a) => {
			if (!searchVal.trim()) return true;
			const q = searchVal.toLowerCase();
			const salesmanName = getSalesmanName(a.salesmanId).toLowerCase();
			return (
				a.fullName.toLowerCase().includes(q) ||
				a.emailId?.toLowerCase().includes(q) ||
				a.phoneNo?.includes(q) ||
				String(a.salesmanId).includes(q) ||
				salesmanName.includes(q)
			);
		})
	);

	// ─── API ─────────────────────────────────────────────────────────────────────
	async function loadAgents() {
		loadingAgents = true;
		try {
			agents = (await apiFetch<AgentResponse[]>('api/agent')) || [];
		} catch (err: any) {
			toast.error(err.message || 'Failed to load agents.');
		} finally {
			loadingAgents = false;
		}
	}

	async function loadPending() {
		loadingPending = true;
		try {
			// Normal accountants see their own; master sees all — handled by the backend
			pending = (await apiFetch<PendingItem[]>('api/pending-approvals?entityType=agent&status=pending')) || [];
		} catch (err: any) {
			toast.error(err.message || 'Failed to load pending requests.');
		} finally {
			loadingPending = false;
		}
	}

	async function loadSalesmen() {
		loadingSalesmen = true;
		try {
			salesmen = (await apiFetch<SalesmanResponse[]>('api/sales-entries/salesmen')) || [];
		} catch (err: any) {
			toast.error(err.message || 'Failed to load salesmen.');
		} finally {
			loadingSalesmen = false;
		}
	}

	function getSalesmanName(id: number | null): string {
		if (!id) return '';
		const found = salesmen.find((sm) => sm.id === id);
		return found ? found.name : `Salesman #${id}`;
	}


	// ─── Form submit ─────────────────────────────────────────────────────────────
	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!fFirstName.trim()) {
			toast.error('First name is required.');
			return;
		}
		isSaving = true;
		const isMaster = hasRole('master_accountant');
		const fullPhone = fPhone.trim() ? `${fCountryCode} ${fPhone.trim()}` : null;

		try {
			if (isEditing && editingId !== null) {
				await apiFetch(`api/agent/${editingId}`, {
					method: 'PUT',
					body: JSON.stringify({
						firstName: fFirstName.trim(),
						lastName: fLastName.trim(),
						phoneNo: fullPhone,
						emailId: fEmail.trim() || null,
						nationality: fNationality.trim() || null,
						address: fAddress.trim() || null
					}),
					headers: { 'Content-Type': 'application/json' }
				});
				toast.success('Agent updated successfully.');
				resetForm();
				await loadAgents();
			} else if (isMaster) {
				// Master accountant: create directly
				await apiFetch('api/agent', {
					method: 'POST',
					body: JSON.stringify({
						firstName: fFirstName.trim(),
						lastName: fLastName.trim(),
						salesmanId: fSalesmanId ? parseInt(fSalesmanId, 10) : null,
						phoneNo: fullPhone,
						emailId: fEmail.trim() || null,
						nationality: fNationality.trim() || null,
						address: fAddress.trim() || null
					}),
					headers: { 'Content-Type': 'application/json' }
				});
				toast.success('Agent registered successfully.');
				resetForm();
				await loadAgents();
			} else {
				// Normal accountant: submit pending request to API
				const payload: AgentPayload = {
					firstName: fFirstName.trim(),
					lastName: fLastName.trim(),
					salesmanId: fSalesmanId ? parseInt(fSalesmanId, 10) : null,
					phoneNo: fullPhone,
					emailId: fEmail.trim() || null,
					nationality: fNationality.trim() || null,
					address: fAddress.trim() || null
				};
				await apiFetch('api/pending-approvals', {
					method: 'POST',
					body: JSON.stringify({
						entityType: 'agent',
						payloadJson: JSON.stringify(payload),
						submittedByName: $currentUser?.name ?? 'Accountant'
					}),
					headers: { 'Content-Type': 'application/json' }
				});
				toast.success('Agent registration submitted for master accountant approval.');
				resetForm();
				await loadPending();
			}
		} catch (err: any) {
			toast.error(err.message || 'Failed to save agent.');
		} finally {
			isSaving = false;
		}
	}

	// ─── Approve / Reject ────────────────────────────────────────────────────────
	async function approveAgent(item: PendingItem) {
		approvingId = item.id;
		try {
			await apiFetch(`api/pending-approvals/${item.id}/approve`, { method: 'POST' });
			toast.success('Agent approved and registered.');
			await Promise.all([loadAgents(), loadPending()]);
		} catch (err: any) {
			toast.error(err.message || 'Approval failed.');
		} finally {
			approvingId = null;
		}
	}

	async function rejectAgent(item: PendingItem) {
		approvingId = item.id;
		try {
			await apiFetch(`api/pending-approvals/${item.id}/reject`, { method: 'POST' });
			toast.success('Request rejected.');
			await loadPending();
		} catch (err: any) {
			toast.error(err.message || 'Rejection failed.');
		} finally {
			approvingId = null;
		}
	}

	// ─── Edit helpers ─────────────────────────────────────────────────────────────
	function startEdit(a: AgentResponse) {
		isEditing = true;
		editingId = a.id;
		showForm = true;
		fFirstName = a.firstName;
		fLastName = a.lastName;
		fSalesmanId = a.salesmanId ? String(a.salesmanId) : '';
		const parsedPhone = parsePhoneNumber(a.phoneNo);
		fCountryCode = parsedPhone.code;
		fPhone = parsedPhone.phone;
		fEmail = a.emailId ?? '';
		fNationality = a.nationality ?? '';
		fAddress = a.address ?? '';
	}

	function resetForm() {
		showForm = false;
		isEditing = false;
		editingId = null;
		fFirstName = '';
		fLastName = '';
		fSalesmanId = '';
		fCountryCode = '+973';
		fPhone = '';
		fEmail = '';
		fNationality = '';
		fAddress = '';
	}

	import { exportToCSV as downloadCSV } from '$lib/utils/csv-exporter';
	import { formatDateOnly, getBahrainDateString } from '$lib/formatters/date';

	function exportToCSV() {
		if (agents.length === 0) return;
		const headers = ['Agent ID', 'Full Name', 'Salesman', 'Phone Number', 'Email Address', 'Nationality', 'Wallet Balance (BHD)', 'Verification Status', 'Registration Date'];
		const rows = agents.map(a => [
			a.id,
			a.fullName || '',
			getSalesmanName(a.salesmanId),
			a.phoneNo || '',
			a.emailId || '',
			a.nationality || '',
			a.wallet || 0,
			a.isVerified ? 'Verified' : 'Pending',
			a.createdAt ? formatDateOnly(a.createdAt) : ''
		]);
		downloadCSV(`agents_export_${getBahrainDateString()}.csv`, headers, rows);
		toast.success('Agents exported successfully.');
	}

	onMount(() => {
		loadAgents();
		loadPending();
		loadSalesmen();
	});
</script>

<svelte:head>
	<title>Agent Accounts — Accounts Portal</title>
</svelte:head>

<div class="space-y-6 print:p-0">
	<!-- ── Header ────────────────────────────────────────────────────────── -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-bold text-foreground flex items-center gap-2">
				<UserCheck class="h-5 w-5 text-primary" />
				Agent Accounts
			</h1>
			<p class="text-xs text-muted-foreground">
				Sales Portal salesman profiles linked to Accounts Portal agents — wallet balances, contact
				details, and verification status.
			</p>
		</div>

		<div class="flex flex-wrap gap-2">
			<Button
				onclick={() => { showForm = !showForm; if (!showForm) resetForm(); }}
				class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
			>
				{#if showForm}
					<X class="h-3.5 w-3.5" /> Cancel
				{:else}
					<Plus class="h-3.5 w-3.5" />
					{hasRole('master_accountant') ? 'Register Agent' : 'Submit Agent Request'}
				{/if}
			</Button>

			<Button variant="outline" class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold" onclick={() => { loadAgents(); loadPending(); }} disabled={loadingAgents}>
				<RefreshCw class="h-3.5 w-3.5 {loadingAgents ? 'animate-spin' : ''}" /> Reload
			</Button>
		</div>
	</div>

	<!-- ── Pending notice for normal accountant ──────────────────────────── -->
	{#if !hasRole('master_accountant') && pending.length > 0}
		<div class="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-xs text-amber-800">
			<Clock class="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
			<div>
				<span class="font-bold">{pending.length} agent {pending.length === 1 ? 'request' : 'requests'} awaiting master accountant approval.</span>
				<span class="text-amber-700 ml-1">These will be registered once approved.</span>
			</div>
		</div>
	{/if}

	<!-- ── Create / Edit Form ────────────────────────────────────────────── -->
	{#if showForm}
		<div class="bg-card border border-border rounded-2xl p-6 shadow-xs">
			<h2 class="text-sm font-bold text-foreground mb-1">
				{#if isEditing}Editing Agent — {fFirstName} {fLastName}
				{:else if hasRole('master_accountant')}Register New Agent
				{:else}Submit Agent Registration Request{/if}
			</h2>
			{#if !isEditing && !hasRole('master_accountant')}
				<p class="text-[11px] text-amber-600 flex items-center gap-1.5 mb-5">
					<AlertTriangle class="h-3.5 w-3.5 shrink-0" />
					Your request will be stored in the database and needs master accountant approval before the agent is registered.
				</p>
			{:else}
				<div class="mb-5"></div>
			{/if}
			<form onsubmit={handleSubmit}>
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
					<div class="space-y-1.5">
						<label for="a-firstname" class="block font-semibold text-foreground">First Name <span class="text-red-500">*</span></label>
						<Input id="a-firstname" type="text" bind:value={fFirstName} required placeholder="e.g. Ali" />
					</div>
					<div class="space-y-1.5">
						<label for="a-lastname" class="block font-semibold text-foreground">Last Name <span class="text-muted-foreground font-normal text-[11px]">(Optional)</span></label>
						<Input id="a-lastname" type="text" bind:value={fLastName} placeholder="e.g. Hassan (optional)" />
					</div>
					<div class="space-y-1.5">
						<label for="a-salesmanid" class="block font-semibold text-foreground">
							Sales Portal Salesman ID
							{#if isEditing}<span class="text-muted-foreground font-normal">(read-only)</span>{/if}
						</label>
						<select
							id="a-salesmanid"
							bind:value={fSalesmanId}
							disabled={isEditing}
							class="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
						>
							<option value="">-- Select Salesman (Optional) --</option>
							{#each salesmen as sm}
								<option value={String(sm.id)}>{sm.name} ({sm.email})</option>
							{/each}
						</select>
					</div>
					<div class="space-y-1.5">
						<label for="a-phone" class="block font-semibold text-foreground">Phone Number</label>
						<div class="flex gap-1.5">
							<select
								id="a-countrycode"
								bind:value={fCountryCode}
								class="flex h-9 w-36 shrink-0 rounded-xl border border-input bg-background px-2.5 py-1 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring text-foreground cursor-pointer"
							>
								{#each COUNTRY_CODES as c}
									<option value={c.actualCode || c.code}>{c.flag} {c.actualCode || c.code} ({c.country})</option>
								{/each}
							</select>
							<Input
								id="a-phone"
								type="text"
								bind:value={fPhone}
								placeholder="39 000 000"
								class="flex-1 font-mono"
							/>
						</div>
					</div>
					<div class="space-y-1.5">
						<label for="a-email" class="block font-semibold text-foreground">Email Address</label>
						<Input id="a-email" type="email" bind:value={fEmail} placeholder="agent@example.com" />
					</div>
					<div class="space-y-1.5">
						<label for="a-nationality" class="block font-semibold text-foreground">Nationality</label>
						<Input id="a-nationality" type="text" bind:value={fNationality} placeholder="e.g. Pakistani" />
					</div>
					<div class="space-y-1.5 sm:col-span-2 lg:col-span-3">
						<label for="a-address" class="block font-semibold text-foreground">Billing Address</label>
						<Input id="a-address" type="text" bind:value={fAddress} placeholder="Full mailing address" />
					</div>
				</div>
				<div class="flex gap-2.5 mt-5 pt-4 border-t border-border/50">
					<Button type="submit" disabled={isSaving || !fFirstName.trim() || !fLastName.trim()} class="rounded-xl font-semibold text-xs px-5">
						{#if isSaving}<RefreshCw class="h-3.5 w-3.5 mr-1.5 animate-spin" />{/if}
						{#if isEditing}Save Changes
						{:else if hasRole('master_accountant')}Register Agent
						{:else}Submit for Approval{/if}
					</Button>
					<Button type="button" variant="outline" onclick={resetForm} class="rounded-xl text-xs">Cancel</Button>
				</div>
			</form>
		</div>
	{/if}

	<!-- ── Tabs ───────────────────────────────────────────────────────────── -->
	<div class="flex gap-1 bg-muted/40 rounded-xl p-1 w-fit border border-border/50 print:hidden">
		<button onclick={() => (activeTab = 'list')} class="px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer {activeTab === 'list' ? 'bg-card text-foreground shadow-sm border border-border/30' : 'text-muted-foreground hover:text-foreground'}">
			All Agents ({agents.length})
		</button>
		<button onclick={() => { activeTab = 'pending'; loadPending(); }} class="px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 {activeTab === 'pending' ? 'bg-card text-foreground shadow-sm border border-border/30' : 'text-muted-foreground hover:text-foreground'}">
			Pending Approvals
			{#if pending.length > 0}
				<span class="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[9px] font-bold bg-amber-500 text-white">{pending.length}</span>
			{/if}
		</button>
	</div>

	<!-- ══ TAB: Pending Approvals ════════════════════════════════════════════ -->
	{#if activeTab === 'pending'}
		{#if loadingPending}
			<div class="bg-card border border-border rounded-2xl h-40 flex items-center justify-center">
				<RefreshCw class="h-7 w-7 text-primary animate-spin" />
			</div>
		{:else if pending.length === 0}
			<div class="bg-card border border-border rounded-2xl p-16 text-center text-muted-foreground text-xs">
				<ShieldCheck class="h-10 w-10 mx-auto mb-3 text-emerald-400 opacity-60" />
				No pending agent registration requests.
			</div>
		{:else}
			<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
				<div class="px-5 py-4 border-b border-border/50 bg-amber-50/50">
					<h2 class="text-xs font-bold text-amber-800 flex items-center gap-1.5">
						<Clock class="h-3.5 w-3.5" />
						Pending Agent Registration Requests — awaiting master accountant approval
					</h2>
				</div>
				<div class="divide-y divide-border/50">
					{#each pending as item}
						{@const p = JSON.parse(item.payloadJson) as AgentPayload}
						<div class="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
							<div class="flex-1 space-y-2">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="font-bold text-sm text-foreground">{p.firstName} {p.lastName}</span>
									{#if p.salesmanId}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-mono font-bold text-[10px] border border-primary/20">
											<UserCheck class="h-3 w-3" /> #{p.salesmanId}
										</span>
									{/if}
								</div>
								<div class="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
									{#if p.phoneNo}<span class="flex items-center gap-1"><Phone class="h-3 w-3" />{p.phoneNo}</span>{/if}
									{#if p.emailId}<span class="flex items-center gap-1"><Mail class="h-3 w-3" />{p.emailId}</span>{/if}
									{#if p.nationality}<span class="flex items-center gap-1"><Globe class="h-3 w-3" />{p.nationality}</span>{/if}
								</div>
								<div class="text-[10px] text-muted-foreground/60 flex items-center gap-1.5">
									<Clock class="h-3 w-3" />
									Submitted by <strong class="text-muted-foreground">{item.submittedByName}</strong> at
									<DateDisplay value={item.submittedAt} />
								</div>
							</div>
							{#if hasRole('master_accountant')}
								<div class="flex gap-2 shrink-0">
									<Button onclick={() => approveAgent(item)} disabled={approvingId === item.id} class="rounded-xl h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer">
										{#if approvingId === item.id}<RefreshCw class="h-3 w-3 animate-spin" />{:else}<Check class="h-3 w-3" />{/if}
										Approve
									</Button>
									<Button variant="outline" onclick={() => rejectAgent(item)} disabled={approvingId === item.id} class="rounded-xl h-8 text-xs font-semibold border-red-200 text-red-600 hover:bg-red-50 gap-1.5 cursor-pointer">
										<Trash2 class="h-3 w-3" /> Reject
									</Button>
								</div>
							{:else}
								<span class="text-[10px] text-amber-600 flex items-center gap-1 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl font-semibold">
									<Clock class="h-3 w-3" /> Awaiting Approval
								</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}

	<!-- ══ TAB: All Agents ════════════════════════════════════════════════════ -->
	{#if activeTab === 'list'}
		<div class="bg-card border border-border rounded-2xl p-4 print:hidden">
			<div class="relative">
				<Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
				<input type="text" placeholder="Search by name, email, phone, or Salesman ID..." bind:value={searchVal}
					class="w-full text-xs pl-10 pr-4 py-2 border border-border rounded-xl bg-background text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20" />
			</div>
		</div>

		{#if loadingAgents}
			<div class="bg-card border border-border rounded-2xl h-64 flex items-center justify-center">
				<RefreshCw class="h-8 w-8 text-primary animate-spin" />
			</div>
		{:else if filteredAgents.length === 0}
			<div class="bg-card border border-border rounded-2xl p-16 text-center text-muted-foreground text-xs">
				{searchVal ? `No agents matching "${searchVal}".` : 'No agents registered yet.'}
			</div>
		{:else}
			<div class="bg-card border border-border rounded-2xl overflow-x-auto shadow-xs max-w-full print:border-none">
				<table class="w-full min-w-[750px] text-left border-collapse text-xs">
					<thead>
						<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">
							<th class="p-4 w-16">ID</th>
							<th class="p-4">Agent Name</th>
							<th class="p-4 w-40">Salesman</th>
							<th class="p-4">Contact</th>
							<th class="p-4 w-28">Nationality</th>
							<th class="p-4 w-32 text-right">Wallet</th>
							<th class="p-4 w-24 text-center">Verified</th>
							<th class="p-4 w-28">Registered</th>
							{#if hasRole('master_accountant')}<th class="p-4 w-20 text-center print:hidden">Actions</th>{/if}
						</tr>
					</thead>
					<tbody class="divide-y divide-border/50">
						{#each filteredAgents as agent}
							<tr class="hover:bg-muted/10 transition-colors">
								<td class="p-4 font-mono text-muted-foreground">#{agent.id}</td>
								<td class="p-4">
									<span class="font-bold text-foreground block">{agent.fullName}</span>
									{#if agent.address}<span class="text-[10px] text-muted-foreground mt-0.5 block truncate max-w-[200px]">{agent.address}</span>{/if}
								</td>
								<td class="p-4">
									{#if agent.salesmanId}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-semibold text-[10px] border border-primary/20">
											<UserCheck class="h-3 w-3" />{getSalesmanName(agent.salesmanId)}
										</span>
									{:else}
										<span class="text-muted-foreground/40 text-[10px]">Not linked</span>
									{/if}
								</td>
								<td class="p-4 space-y-0.5">
									{#if agent.phoneNo}<div class="flex items-center gap-1 text-muted-foreground"><Phone class="h-3 w-3 shrink-0" /><span class="font-mono">{agent.phoneNo}</span></div>{/if}
									{#if agent.emailId}<div class="flex items-center gap-1 text-muted-foreground"><Mail class="h-3 w-3 shrink-0" /><span class="truncate max-w-[150px]">{agent.emailId}</span></div>{/if}
									{#if !agent.phoneNo && !agent.emailId}<span class="text-muted-foreground/40">—</span>{/if}
								</td>
								<td class="p-4">
									{#if agent.nationality}<div class="flex items-center gap-1 text-muted-foreground"><Globe class="h-3 w-3 shrink-0" />{agent.nationality}</div>
									{:else}<span class="text-muted-foreground/40">—</span>{/if}
								</td>
								<td class="p-4 text-right font-mono font-bold text-emerald-600">
									<div class="flex items-center justify-end gap-1"><Wallet class="h-3 w-3 text-emerald-500" /><MoneyDisplay amount={agent.wallet} /></div>
								</td>
								<td class="p-4 text-center">
									{#if agent.isVerified}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><ShieldCheck class="h-3 w-3" /> Verified</span>
									{:else}
										<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Pending</span>
									{/if}
								</td>
								<td class="p-4 font-mono text-muted-foreground"><DateDisplay value={agent.createdAt} /></td>
								{#if hasRole('master_accountant')}
									<td class="p-4 text-center print:hidden">
										<div class="flex items-center justify-center gap-1">
											<a
												href="/sales/receipts/new-client?clientType=agent&agentId={agent.id}&salesmanId={agent.salesmanId || ''}"
												class="p-1.5 hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600 rounded-lg transition-colors cursor-pointer inline-flex items-center"
												title="Create Client Receipt (Deposit to Wallet)"
											>
												<Plus class="h-3.5 w-3.5" />
											</a>
											<button onclick={() => startEdit(agent)} class="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer" title="Edit agent">
												<Pencil class="h-3.5 w-3.5" />
											</button>
										</div>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
				<div class="px-4 py-3 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground bg-muted/10 print:hidden">
					<span>Showing <strong>{filteredAgents.length}</strong> of <strong>{agents.length}</strong> agents</span>
					<span>Total wallet: <strong class="text-emerald-600 font-mono"><MoneyDisplay amount={agents.reduce((s, a) => s + a.wallet, 0)} /></strong></span>
				</div>
			</div>
		{/if}
	{/if}
</div>
