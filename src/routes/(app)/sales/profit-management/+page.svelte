<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/api/api-client';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { DateDisplay } from '$lib/components';
	import { getBahrainPresetRanges, formatDate, formatDateTime, formatBahrainTime, getBahrainDateString } from '$lib/formatters/date';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import { Button } from '$lib/components/ui/button';
	import { toast } from '$lib/stores/toast';
	import { hasRole } from '$lib/stores/auth';
	import { exportToCSV as downloadCSV } from '$lib/utils/csv-exporter';
	import {
		Users,
		TrendingUp,
		DollarSign,
		Search,
		RefreshCw,
		Download,
		CheckCircle2,
		AlertCircle,
		ShieldAlert,
		Plane,
		Building2,
		FileText,
		Calendar,
		Car,
		Compass,
		Layers,
		X,
		Save,
		Target,
		Edit3,
		ChevronLeft,
		ChevronRight,
		SlidersHorizontal,
		RotateCcw,
		Award,
		BarChart3,
		Check,
		HelpCircle,
		History,
		Clock,
		ArrowRight,
		ExternalLink,
		Briefcase
	} from 'lucide-svelte';

	interface Salesman {
		id: number;
		name: string;
		email?: string;
		totalSales: number;
		totalProfit: number;
		bookingCount: number;
		monthlyTarget?: number;
		profitTarget?: number;
	}

	interface ProfitRecord {
		id: number;
		salesmanId: number;
		salesmanName?: string;
		bookingType: string;
		bookingId: number;
		documentNumber?: string;
		clientName?: string;
		payableAmount: number;
		finalSupplierCost: number;
		profitAmount: number;
		profitType: string;
		supplierCostSource: string;
		accountsApprovedTotal?: number;
		isFinal: boolean;
		bookingCreatedAt: string;
		finalizedAt?: string;
		adjustmentsCount?: number;
	}

	interface ProfitModificationItem {
		id: string;
		recordId?: number;
		bookingType: string;
		bookingId: number;
		documentNumber?: string;
		salesmanId: number;
		salesmanName?: string;
		clientName?: string;
		payableAmount: number;
		previousProfit: number;
		newProfit: number;
		deltaAmount: number;
		reason: string;
		timestamp: string;
		modifiedBy?: string;
	}

	let loading = $state(true);
	let activeViewTab = $state<'records' | 'history'>('records');

	let salesmen = $state<Salesman[]>([]);
	let selectedSalesmanId = $state<string>('all');
	let selectedServiceType = $state<string>('all');
	let selectedStatus = $state<'all' | 'finalized' | 'estimated'>('all');
	let searchQuery = $state('');
	let startDate = $state('');
	let endDate = $state('');

	// Pagination for Profit Records
	let currentPage = $state(1);
	let pageSize = $state(20);

	// Pagination for History View
	let historyPage = $state(1);
	let historyPageSize = $state(20);

	let allProfitRecords = $state<ProfitRecord[]>([]);
	let modificationHistory = $state<ProfitModificationItem[]>([]);

	// Profit Adjustment Modal State
	let showAdjustModal = $state(false);
	let adjustingRecord = $state<ProfitRecord | null>(null);
	let adjustMode = $state<'direct' | 'delta'>('direct'); // 'direct' = edit profit itself, 'delta' = adjust delta
	let targetProfitAmount = $state<string>('');
	let adjustDeltaAmount = $state<string>('');
	let adjustReason = $state('');
	let isSubmittingAdjustment = $state(false);

	// Booking History Modal State
	let showHistoryModal = $state(false);
	let historyModalRecord = $state<ProfitRecord | null>(null);

	// Salesman Options for Searchable Select
	const salesmanOptions = $derived([
		{ id: 'all', name: 'All Salesmen' },
		...salesmen.map((s) => ({
			id: String(s.id),
			name: s.name
		}))
	]);

	// Helper to get modification count for a record
	function getRecordModificationsCount(r: ProfitRecord): number {
		const doc = (r.documentNumber || '').trim().toLowerCase();
		const bId = r.bookingId;
		const bType = (r.bookingType || '').trim().toLowerCase();
		return modificationHistory.filter((h) => {
			const hType = (h.bookingType || '').trim().toLowerCase();
			const hDoc = (h.documentNumber || '').trim().toLowerCase();
			return (hType === bType && h.bookingId === bId) || (Boolean(doc) && Boolean(hDoc) && hDoc === doc);
		}).length;
	}

	// Helper to get all modification items for a record
	function getRecordModifications(r: ProfitRecord): ProfitModificationItem[] {
		const doc = (r.documentNumber || '').trim().toLowerCase();
		const bId = r.bookingId;
		const bType = (r.bookingType || '').trim().toLowerCase();
		return modificationHistory.filter((h) => {
			const hType = (h.bookingType || '').trim().toLowerCase();
			const hDoc = (h.documentNumber || '').trim().toLowerCase();
			return (hType === bType && h.bookingId === bId) || (Boolean(doc) && Boolean(hDoc) && hDoc === doc);
		});
	}

	// Derived: Filtered profit records
	const filteredRecords = $derived.by(() => {
		return allProfitRecords.filter((r) => {
			if (selectedSalesmanId !== 'all' && String(r.salesmanId) !== selectedSalesmanId) {
				return false;
			}
			if (selectedServiceType !== 'all') {
				const norm = r.bookingType.toLowerCase();
				if (!norm.includes(selectedServiceType.toLowerCase())) return false;
			}
			if (selectedStatus === 'finalized' && !r.isFinal) return false;
			if (selectedStatus === 'estimated' && r.isFinal) return false;
			if (startDate && new Date(r.bookingCreatedAt) < new Date(startDate)) return false;
			if (endDate) {
				const end = new Date(endDate);
				end.setHours(23, 59, 59, 999);
				if (new Date(r.bookingCreatedAt) > end) return false;
			}
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase().trim();
				const doc = (r.documentNumber || '').toLowerCase();
				const client = (r.clientName || '').toLowerCase();
				const sName = (r.salesmanName || '').toLowerCase();
				const bId = String(r.bookingId);
				if (!doc.includes(q) && !client.includes(q) && !sName.includes(q) && !bId.includes(q)) {
					return false;
				}
			}
			return true;
		});
	});

	// Derived: Filtered modification history
	const filteredHistory = $derived.by(() => {
		return modificationHistory.filter((h) => {
			if (selectedSalesmanId !== 'all' && String(h.salesmanId) !== selectedSalesmanId) {
				return false;
			}
			if (selectedServiceType !== 'all') {
				const norm = h.bookingType.toLowerCase();
				if (!norm.includes(selectedServiceType.toLowerCase())) return false;
			}
			if (startDate && new Date(h.timestamp) < new Date(startDate)) return false;
			if (endDate) {
				const end = new Date(endDate);
				end.setHours(23, 59, 59, 999);
				if (new Date(h.timestamp) > end) return false;
			}
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase().trim();
				const doc = (h.documentNumber || '').toLowerCase();
				const client = (h.clientName || '').toLowerCase();
				const sName = (h.salesmanName || '').toLowerCase();
				const bId = String(h.bookingId);
				const reason = (h.reason || '').toLowerCase();
				if (!doc.includes(q) && !client.includes(q) && !sName.includes(q) && !bId.includes(q) && !reason.includes(q)) {
					return false;
				}
			}
			return true;
		});
	});

	// Pagination derived for Records
	const totalPages = $derived(Math.max(1, Math.ceil(filteredRecords.length / pageSize)));
	const paginatedRecords = $derived.by(() => {
		const start = (currentPage - 1) * pageSize;
		return filteredRecords.slice(start, start + pageSize);
	});

	// Pagination derived for History
	const totalHistoryPages = $derived(Math.max(1, Math.ceil(filteredHistory.length / historyPageSize)));
	const paginatedHistory = $derived.by(() => {
		const start = (historyPage - 1) * historyPageSize;
		return filteredHistory.slice(start, start + historyPageSize);
	});

	const hasActiveFilters = $derived(
		selectedSalesmanId !== 'all' ||
		selectedServiceType !== 'all' ||
		selectedStatus !== 'all' ||
		Boolean(searchQuery.trim()) ||
		Boolean(startDate) ||
		Boolean(endDate)
	);

	// KPI Metrics
	const totalProfitAmount = $derived.by(() => {
		return filteredRecords.reduce((acc, r) => acc + (r.profitAmount || 0), 0);
	});

	const finalizedProfitAmount = $derived.by(() => {
		return filteredRecords
			.filter((r) => r.isFinal)
			.reduce((acc, r) => acc + (r.profitAmount || 0), 0);
	});

	const estimatedProfitAmount = $derived.by(() => {
		return filteredRecords
			.filter((r) => !r.isFinal)
			.reduce((acc, r) => acc + (r.profitAmount || 0), 0);
	});

	const totalSalesVolume = $derived.by(() => {
		return filteredRecords.reduce((acc, r) => acc + (r.payableAmount || 0), 0);
	});

	const overallMargin = $derived.by(() => {
		if (totalSalesVolume <= 0) return 0;
		return (totalProfitAmount / totalSalesVolume) * 100;
	});

	// Calculated Delta and Projected Final Profit in Adjustment Modal
	const calculatedDelta = $derived.by(() => {
		if (!adjustingRecord) return 0;
		if (adjustMode === 'direct') {
			const target = parseFloat(targetProfitAmount);
			if (isNaN(target)) return 0;
			return target - adjustingRecord.profitAmount;
		} else {
			return parseFloat(adjustDeltaAmount) || 0;
		}
	});

	const projectedNewProfit = $derived.by(() => {
		if (!adjustingRecord) return 0;
		if (adjustMode === 'direct') {
			const target = parseFloat(targetProfitAmount);
			return isNaN(target) ? adjustingRecord.profitAmount : target;
		} else {
			const delta = parseFloat(adjustDeltaAmount) || 0;
			return adjustingRecord.profitAmount + delta;
		}
	});

	function getServiceIcon(type: string) {
		const norm = (type || '').toLowerCase();
		if (norm.includes('flight')) return Plane;
		if (norm.includes('hotel')) return Building2;
		if (norm.includes('visa')) return FileText;
		if (norm.includes('vfs')) return Calendar;
		if (norm.includes('holiday')) return Compass;
		if (norm.includes('transport')) return Car;
		return Layers;
	}

	function getServiceBadgeColor(type: string) {
		const norm = (type || '').toLowerCase();
		if (norm.includes('flight')) return 'bg-sky-500/10 text-sky-600 border-sky-500/20';
		if (norm.includes('hotel')) return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
		if (norm.includes('visa')) return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
		if (norm.includes('vfs')) return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
		if (norm.includes('holiday')) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
		if (norm.includes('transport')) return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
		return 'bg-muted text-muted-foreground border-border';
	}

	function getServiceRouteSlug(type: string): string {
		const norm = (type || '').toLowerCase();
		if (norm.includes('flight')) return 'flights';
		if (norm.includes('hotel')) return 'hotels';
		if (norm.includes('visa')) return 'visa';
		if (norm.includes('vfs')) return 'vfs';
		if (norm.includes('holiday')) return 'holiday-packages';
		if (norm.includes('transport')) return 'transportation';
		return 'other-services';
	}

	function loadModificationHistory() {
		if (typeof localStorage === 'undefined') return;
		try {
			const stored = localStorage.getItem('tx_profit_modification_history');
			if (stored) {
				modificationHistory = JSON.parse(stored);
			}
		} catch (e) {
			console.error('Error loading profit modification history from storage:', e);
		}
	}

	function saveModificationHistory(item: ProfitModificationItem) {
		modificationHistory = [item, ...modificationHistory];
		if (typeof localStorage !== 'undefined') {
			try {
				localStorage.setItem('tx_profit_modification_history', JSON.stringify(modificationHistory));
			} catch (e) {
				console.error('Error saving profit modification history:', e);
			}
		}
	}

	async function loadAllData() {
		if (!hasRole('master_accountant')) {
			loading = false;
			return;
		}
		loading = true;
		try {
			loadModificationHistory();

			const [salesmenRes, reportRes, historyRes] = await Promise.all([
				apiFetch<any[]>('api/sales-entries/salesmen').catch(() => []),
				apiFetch<any[]>('api/sales-entries/salesmen/report').catch(() => []),
				apiFetch<ProfitModificationItem[]>('api/sales-entries/profit-adjustments').catch(() => [])
			]);

			if (Array.isArray(historyRes) && historyRes.length > 0) {
				modificationHistory = historyRes.map((h: any) => ({
					...h,
					id: String(h.id),
					payableAmount: Number(h.payableAmount || 0),
					previousProfit: Number(h.previousProfit || 0),
					newProfit: Number(h.newProfit || 0),
					deltaAmount: Number(h.deltaAmount || 0)
				}));
				if (typeof localStorage !== 'undefined') {
					try {
						localStorage.setItem('tx_profit_modification_history', JSON.stringify(modificationHistory));
					} catch (e) {}
				}
			}

			const reportMap = new Map<number, any>();
			(Array.isArray(reportRes) ? reportRes : []).forEach((r) => {
				reportMap.set(r.id || r.salesmanId, r);
			});

			salesmen = (Array.isArray(salesmenRes) ? salesmenRes : []).map((s) => {
				const rep = reportMap.get(s.id);
				return {
					id: s.id,
					name: s.name || `Salesman #${s.id}`,
					email: s.email,
					totalSales: rep?.totalSalesVolume ?? rep?.totalSales ?? 0,
					totalProfit: rep?.totalProfit ?? s.profitGenerated ?? 0,
					bookingCount: rep?.totalBookingsCount ?? rep?.bookingCount ?? 0,
					monthlyTarget: s.monthlyTarget ?? 0,
					profitTarget: s.profitTarget ?? 0
				};
			});

			// Fetch booking client names mapping in parallel to guarantee clientName is resolved
			// even if backend response has missing or null client names
			const [flightRes, hotelRes, visaRes, vfsRes, holidayRes, transportRes, otherRes] = await Promise.all([
				apiFetch<any>('api/sales-entries/flights', { params: { pageSize: 1000 } }).catch(() => null),
				apiFetch<any>('api/sales-entries/hotels', { params: { pageSize: 1000 } }).catch(() => null),
				apiFetch<any>('api/sales-entries/visa', { params: { pageSize: 1000 } }).catch(() => null),
				apiFetch<any>('api/sales-entries/vfs', { params: { pageSize: 1000 } }).catch(() => null),
				apiFetch<any>('api/sales-entries/holiday-packages', { params: { pageSize: 1000 } }).catch(() => null),
				apiFetch<any>('api/sales-entries/transportations', { params: { pageSize: 1000 } }).catch(() => null),
				apiFetch<any>('api/sales-entries/other-services', { params: { pageSize: 1000 } }).catch(() => null)
			]);

			const clientMap = new Map<string, string>();
			const registerClient = (type: string, id: number | string | undefined, doc: string | undefined, name: string | undefined) => {
				const cleanName = (name || '').trim();
				if (!cleanName) return;
				if (doc) clientMap.set(doc.trim().toLowerCase(), cleanName);
				if (id) clientMap.set(`${type.toLowerCase()}:${id}`, cleanName);
			};

			(flightRes?.items || []).forEach((b: any) => registerClient('flight', b.id, b.documentNumber, b.headName || b.passengerNames || b.careOf || b.agent));
			(hotelRes?.items || []).forEach((b: any) => registerClient('hotel', b.id, b.documentNumber, b.headName || b.guestName || b.careOf || b.agent));
			(visaRes?.items || []).forEach((b: any) => registerClient('visa', b.id, b.documentNumber, b.headName || b.applicantNames || b.agent));
			(vfsRes?.items || []).forEach((b: any) => registerClient('vfs', b.id, b.documentNumber, b.headName || b.name || b.agent));
			(holidayRes?.items || []).forEach((b: any) => registerClient('holiday', b.id, b.documentNumber, b.headName || b.passengerName || b.agent));
			(transportRes?.items || []).forEach((b: any) => registerClient('transport', b.id, b.documentNumber, b.headName || b.name || b.careOf || b.agent));
			(otherRes?.items || []).forEach((b: any) => registerClient('other', b.id, b.documentNumber, b.headName || b.name || b.serviceName || b.agent));

			const recordPromises = salesmen.map((s) =>
				apiFetch<any[]>(`api/sales-entries/salesmen/${s.id}/profit-records`)
					.then((records) => {
						return (Array.isArray(records) ? records : []).map((r) => {
							const doc = (r.documentNumber || '').trim().toLowerCase();
							const bType = (r.bookingType || '').trim().toLowerCase();
							const typeKey = `${bType}:${r.bookingId}`;
							const resolvedClient = r.clientName || clientMap.get(doc) || clientMap.get(typeKey) || '';

							return {
								...r,
								salesmanId: s.id,
								salesmanName: s.name,
								clientName: resolvedClient
							};
						});
					})
					.catch(() => [])
			);

			const recordsArrays = await Promise.all(recordPromises);
			const rawRecords = recordsArrays.flat();

			// Enrich modification history with client names if missing
			modificationHistory = modificationHistory.map((h) => {
				if (h.clientName) return h;
				const doc = (h.documentNumber || '').trim().toLowerCase();
				const bType = (h.bookingType || '').trim().toLowerCase();
				const typeKey = `${bType}:${h.bookingId}`;
				const resolved = clientMap.get(doc) || clientMap.get(typeKey);
				return resolved ? { ...h, clientName: resolved } : h;
			});

			// Merge with persistent modification history so adjusted profit amounts are always reflected
			allProfitRecords = rawRecords.map((r) => {
				const doc = (r.documentNumber || '').trim().toLowerCase();
				const bId = r.bookingId;
				const bType = (r.bookingType || '').trim().toLowerCase();
				const latestMod = modificationHistory.find((h) => {
					const hType = (h.bookingType || '').trim().toLowerCase();
					const hDoc = (h.documentNumber || '').trim().toLowerCase();
					return (hType === bType && h.bookingId === bId) || (Boolean(doc) && Boolean(hDoc) && hDoc === doc);
				});

				if (latestMod && latestMod.newProfit !== undefined) {
					return {
						...r,
						profitAmount: latestMod.newProfit
					};
				}
				return r;
			});
		} catch (err: any) {
			console.error('Failed to load salesman profit data:', err);
			toast.error('Failed to load salesman profit records.');
		} finally {
			loading = false;
		}
	}

	function resetFilters() {
		selectedSalesmanId = 'all';
		selectedServiceType = 'all';
		selectedStatus = 'all';
		searchQuery = '';
		startDate = '';
		endDate = '';
		currentPage = 1;
		historyPage = 1;
	}

	function setQuickDatePreset(preset: 'all' | 'month' | 'lastMonth' | 'today') {
		currentPage = 1;
		historyPage = 1;
		if (preset === 'all') {
			startDate = '';
			endDate = '';
		} else if (preset === 'today') {
			const ranges = getBahrainPresetRanges();
			startDate = ranges.today.startDate;
			endDate = ranges.today.endDate;
		} else if (preset === 'month') {
			const ranges = getBahrainPresetRanges();
			startDate = ranges.thisMonth.startDate;
			endDate = ranges.thisMonth.endDate;
		} else if (preset === 'lastMonth') {
			const now = new Date();
			const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bahrain', year: 'numeric', month: 'numeric' }).formatToParts(now);
			const year = parseInt(parts.find((p) => p.type === 'year')?.value || '2026', 10);
			const month = parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10);
			const prevMonthDate = new Date(year, month - 2, 1);
			const prevYear = prevMonthDate.getFullYear();
			const prevMonth = prevMonthDate.getMonth() + 1;
			const lastDay = new Date(prevYear, prevMonth, 0).getDate();
			startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
			endDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
		}
	}

	function openAdjustModal(r: ProfitRecord) {
		adjustingRecord = r;
		adjustMode = 'direct';
		targetProfitAmount = r.profitAmount.toFixed(3);
		adjustDeltaAmount = '';
		adjustReason = '';
		showAdjustModal = true;
	}

	function openHistoryModal(r: ProfitRecord) {
		historyModalRecord = r;
		showHistoryModal = true;
	}

	function switchAdjustMode(mode: 'direct' | 'delta') {
		adjustMode = mode;
		if (mode === 'direct') {
			targetProfitAmount = projectedNewProfit.toFixed(3);
		} else {
			adjustDeltaAmount = calculatedDelta !== 0 ? calculatedDelta.toFixed(3) : '';
		}
	}

	async function submitProfitAdjustment(e: SubmitEvent) {
		e.preventDefault();
		if (!adjustingRecord) return;

		if (!adjustReason.trim()) {
			toast.error('A mandatory explanation/reason is required for modifying profit.');
			return;
		}

		const delta = calculatedDelta;
		if (Math.abs(delta) < 0.0001) {
			toast.error('Profit has not been changed. Please enter a new profit amount or delta.');
			return;
		}

		isSubmittingAdjustment = true;
		const previousProfit = adjustingRecord.profitAmount;
		const finalProfit = projectedNewProfit;
		const recordDoc = adjustingRecord.documentNumber || `#${adjustingRecord.bookingId}`;

		try {
			// Immediate local update for reactive UI feedback
			adjustingRecord.profitAmount = finalProfit;

			// Update in allProfitRecords list
			const matchIndex = allProfitRecords.findIndex(
				(item) => item.bookingType === adjustingRecord!.bookingType && item.bookingId === adjustingRecord!.bookingId
			);
			if (matchIndex >= 0 && allProfitRecords[matchIndex]) {
				const existing = allProfitRecords[matchIndex]!;
				allProfitRecords[matchIndex] = {
					...existing,
					profitAmount: finalProfit
				};
			}

			// Record in persistent audit history
			const historyItem: ProfitModificationItem = {
				id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
				recordId: adjustingRecord.id,
				bookingType: adjustingRecord.bookingType,
				bookingId: adjustingRecord.bookingId,
				documentNumber: adjustingRecord.documentNumber,
				salesmanId: adjustingRecord.salesmanId,
				salesmanName: adjustingRecord.salesmanName,
				clientName: adjustingRecord.clientName,
				payableAmount: adjustingRecord.payableAmount,
				previousProfit: previousProfit,
				newProfit: finalProfit,
				deltaAmount: delta,
				reason: adjustReason.trim(),
				timestamp: new Date().toISOString(),
				modifiedBy: 'Accountant'
			};
			saveModificationHistory(historyItem);

			// Submit to backend
			await apiFetch('api/sales-entries/profit-adjustments', {
				method: 'POST',
				body: JSON.stringify({
					bookingType: adjustingRecord.bookingType,
					bookingIdOrRef: String(adjustingRecord.bookingId),
					adjustmentType: 2, // ManualAdjustment
					amount: delta,
					referenceType: 'manual_adjustment',
					referenceId: adjustingRecord.documentNumber || String(adjustingRecord.bookingId),
					idempotencyKey: `adj_${adjustingRecord.bookingType}_${adjustingRecord.bookingId}_${Date.now()}`,
					description: adjustReason.trim()
				})
			});

			toast.success(`Profit updated to ${finalProfit.toFixed(3)} BHD (${delta >= 0 ? '+' : ''}${delta.toFixed(3)} BHD) for ${recordDoc}`);
			showAdjustModal = false;

			// Refresh data in background
			await loadAllData();
		} catch (err: any) {
			console.error('Failed to apply profit adjustment:', err);
			toast.error(err?.message || 'Failed to apply profit adjustment.');
		} finally {
			isSubmittingAdjustment = false;
		}
	}

	function exportToCSV() {
		if (filteredRecords.length === 0) {
			toast.error('No profit records to export.');
			return;
		}

		const headers = [
			'Booking Ref',
			'Service Type',
			'Salesman Name',
			'Client Name',
			'Selling Price (BHD)',
			'Supplier Cost (BHD)',
			'Net Profit (BHD)',
			'Cost Source',
			'Modifications',
			'Status',
			'Created Date'
		];

		const rows = filteredRecords.map((r) => [
			r.documentNumber || r.bookingId,
			r.bookingType,
			r.salesmanName || '',
			r.clientName || 'N/A',
			r.payableAmount.toFixed(3),
			r.finalSupplierCost.toFixed(3),
			r.profitAmount.toFixed(3),
			r.supplierCostSource,
			getRecordModificationsCount(r),
			r.isFinal ? 'Finalized / Deal Closed' : 'Estimated',
			formatDate(r.bookingCreatedAt)
		]);

		downloadCSV(`Salesman_Profit_Report_${getBahrainDateString()}.csv`, headers, rows);
		toast.success('Profit records exported to CSV.');
	}

	function exportHistoryToCSV() {
		if (filteredHistory.length === 0) {
			toast.error('No modification history records to export.');
			return;
		}

		const headers = [
			'Timestamp',
			'Booking Ref',
			'Service Type',
			'Salesman Name',
			'Client Name',
			'Previous Profit (BHD)',
			'New Net Profit (BHD)',
			'Delta Amount (BHD)',
			'Reason / Explanation',
			'Modified By'
		];

		const rows = filteredHistory.map((h) => [
			formatDateTime(h.timestamp),
			h.documentNumber || `#${h.bookingId}`,
			h.bookingType,
			h.salesmanName || '',
			h.clientName || 'N/A',
			h.previousProfit.toFixed(3),
			h.newProfit.toFixed(3),
			(h.deltaAmount >= 0 ? `+${h.deltaAmount.toFixed(3)}` : h.deltaAmount.toFixed(3)),
			h.reason || '',
			h.modifiedBy || 'Accountant'
		]);

		downloadCSV(`Profit_Modification_History_${getBahrainDateString()}.csv`, headers, rows);
		toast.success('Modification history exported to CSV.');
	}

	onMount(() => {
		loadAllData();
	});
</script>

<svelte:head>
	<title>Salesman Profit Management — Accounts Portal</title>
</svelte:head>

{#if !hasRole('master_accountant')}
	<div class="p-12 text-center border border-border rounded-2xl bg-card space-y-4 max-w-lg mx-auto my-12 shadow-sm">
		<ShieldAlert class="h-12 w-12 text-amber-500 mx-auto" />
		<div class="space-y-1">
			<h2 class="text-base font-bold text-foreground">Access Restricted</h2>
			<p class="text-xs text-muted-foreground">
				Salesman Profit Management is restricted exclusively to Master Accountants. Please contact your system administrator if you require access.
			</p>
		</div>
	</div>
{:else}
<div class="space-y-5 pb-12">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="space-y-1">
			<div class="flex items-center gap-2.5">
				<div class="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
					<TrendingUp class="h-5 w-5" />
				</div>
				<h1 class="text-xl font-bold text-foreground tracking-tight">
					Salesman Profit Management
				</h1>
			</div>
			<p class="text-xs text-muted-foreground">
				Review recognized profits, modify commissions/profits with audit trail, and track modification history.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			{#if activeViewTab === 'records'}
				<Button
					variant="outline"
					class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
					onclick={exportToCSV}
					disabled={loading || filteredRecords.length === 0}
				>
					<Download class="h-3.5 w-3.5" />
					<span>Export CSV</span>
				</Button>
			{:else}
				<Button
					variant="outline"
					class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
					onclick={exportHistoryToCSV}
					disabled={loading || filteredHistory.length === 0}
				>
					<Download class="h-3.5 w-3.5" />
					<span>Export History CSV</span>
				</Button>
			{/if}
			<Button
				variant="outline"
				class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
				onclick={loadAllData}
				disabled={loading}
			>
				<RefreshCw class="h-3.5 w-3.5 {loading ? 'animate-spin' : ''}" />
				<span>Refresh</span>
			</Button>
		</div>
	</div>


	<!-- Main View Switcher Tabs -->
	<div class="flex items-center justify-between border-b border-border pb-2">
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={() => activeViewTab = 'records'}
				class={['px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2',
					activeViewTab === 'records'
						? 'bg-primary text-primary-foreground shadow-xs'
						: 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
				].join(' ')}
			>
				<Layers class="h-4 w-4" />
				<span>Profit Applications</span>
				<span class="px-1.5 py-0.5 rounded-full text-[10px] font-mono {activeViewTab === 'records' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}">
					{allProfitRecords.length}
				</span>
			</button>

			<button
				type="button"
				onclick={() => activeViewTab = 'history'}
				class={['px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2',
					activeViewTab === 'history'
						? 'bg-primary text-primary-foreground shadow-xs'
						: 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
				].join(' ')}
			>
				<History class="h-4 w-4" />
				<span>Modification History</span>
				{#if modificationHistory.length > 0}
					<span class="px-1.5 py-0.5 rounded-full text-[10px] font-mono {activeViewTab === 'history' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-purple-500/20 text-purple-600 font-bold'}">
						{modificationHistory.length}
					</span>
				{/if}
			</button>
		</div>

		{#if activeViewTab === 'history' && modificationHistory.length > 0}
			<span class="text-[11px] text-muted-foreground font-medium hidden sm:inline">
				Chronological log of manual profit adjustments & commission overrides
			</span>
		{/if}
	</div>

	<!-- Content Container -->
	<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
		<!-- Universal Filter Bar -->
		<div class="p-4 border-b border-border bg-muted/20 space-y-3">
			<!-- Row 1: Search, Salesman, Status, Dates -->
			<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
				<div class="flex flex-wrap items-center gap-2 flex-1">
					<!-- Search Box -->
					<div class="relative min-w-[200px] flex-1 max-w-sm">
						<Search class="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
						<input
							type="text"
							placeholder={activeViewTab === 'records' ? 'Search by Doc #, Booking ID, Client...' : 'Search history by Doc #, Client, Reason...'}
							bind:value={searchQuery}
							class="h-8.5 w-full bg-background border border-border rounded-xl pl-8.5 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 font-medium"
						/>
						{#if searchQuery}
							<button
								type="button"
								onclick={() => searchQuery = ''}
								class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
							>
								<X class="h-3.5 w-3.5" />
							</button>
						{/if}
					</div>

					<!-- Salesman Dropdown -->
					<div class="min-w-[170px]">
						<SearchableSelect
							options={salesmanOptions}
							value={selectedSalesmanId}
							onchange={(val) => { selectedSalesmanId = val; currentPage = 1; historyPage = 1; }}
							placeholder="Select Salesman"
							searchPlaceholder="Search salesmen..."
						/>
					</div>

					<!-- Status Filter (for records view) -->
					{#if activeViewTab === 'records'}
						<div class="min-w-[130px]">
							<select
								bind:value={selectedStatus}
								onchange={() => currentPage = 1}
								class="h-8.5 w-full bg-background border border-border rounded-xl px-3 text-xs text-foreground font-semibold cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40"
							>
								<option value="all">All Statuses</option>
								<option value="finalized">Finalized / Closed</option>
								<option value="estimated">Estimated / Open</option>
							</select>
						</div>
					{/if}

					<!-- Date Range -->
					<div class="flex items-center gap-1.5">
						<input
							type="date"
							bind:value={startDate}
							onchange={() => { currentPage = 1; historyPage = 1; }}
							class="h-8.5 bg-background border border-border rounded-xl px-2.5 text-xs text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
						/>
						<span class="text-xs text-muted-foreground font-bold">to</span>
						<input
							type="date"
							bind:value={endDate}
							onchange={() => { currentPage = 1; historyPage = 1; }}
							class="h-8.5 bg-background border border-border rounded-xl px-2.5 text-xs text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
						/>
					</div>
				</div>

				<!-- Date Presets & Reset -->
				<div class="flex items-center gap-1.5 flex-wrap">
					<button
						type="button"
						onclick={() => setQuickDatePreset('all')}
						class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
					>
						All Time
					</button>
					<button
						type="button"
						onclick={() => setQuickDatePreset('month')}
						class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
					>
						This Month
					</button>
					<button
						type="button"
						onclick={() => setQuickDatePreset('lastMonth')}
						class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
					>
						Last Month
					</button>
					{#if hasActiveFilters}
						<button
							type="button"
							onclick={resetFilters}
							class="px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 flex items-center gap-1 cursor-pointer transition-colors"
							title="Reset all filters"
						>
							<RotateCcw class="h-3 w-3" />
							<span>Reset</span>
						</button>
					{/if}
				</div>
			</div>

			<!-- Row 2: Service Quick Filter Pills -->
			<div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs flex-nowrap scrollbar-thin">
				<span class="text-[11px] font-bold text-muted-foreground mr-1 shrink-0">Service:</span>
				{#each [
					{ id: 'all', label: 'All Services', icon: Layers },
					{ id: 'flight', label: 'Flights', icon: Plane },
					{ id: 'hotel', label: 'Hotels', icon: Building2 },
					{ id: 'visa', label: 'Visas', icon: FileText },
					{ id: 'holiday', label: 'Holidays', icon: Compass },
					{ id: 'vfs', label: 'VFS Appointments', icon: Calendar },
					{ id: 'transport', label: 'Transportation', icon: Car },
					{ id: 'other', label: 'Other Services', icon: Briefcase }
				] as srv}
					{@const isSrvActive = selectedServiceType === srv.id}
					{@const SrvIcon = srv.icon}
					<button
						type="button"
						onclick={() => { selectedServiceType = srv.id; currentPage = 1; historyPage = 1; }}
						class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap {isSrvActive ? 'bg-primary text-primary-foreground shadow-2xs font-bold' : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border'}"
					>
						<SrvIcon class="h-3 w-3" />
						<span>{srv.label}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- ================= VIEW 1: PROFIT APPLICATIONS TABLE ================= -->
		{#if activeViewTab === 'records'}
			{#if loading}
				<div class="p-16 flex items-center justify-center">
					<RefreshCw class="h-8 w-8 text-primary animate-spin" />
				</div>
			{:else if paginatedRecords.length === 0}
				<div class="p-16 text-center space-y-3">
					<div class="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
						<TrendingUp class="h-6 w-6" />
					</div>
					<h3 class="text-sm font-bold text-foreground">No Matching Profit Records</h3>
					<p class="text-xs text-muted-foreground max-w-sm mx-auto">
						No records matched your search criteria. Try adjusting or clearing your filters.
					</p>
					{#if hasActiveFilters}
						<Button variant="outline" size="sm" onclick={resetFilters} class="rounded-xl text-xs">
							<RotateCcw class="h-3 w-3 mr-1.5" />
							<span>Clear Filters</span>
						</Button>
					{/if}
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs border-collapse">
						<thead>
							<tr class="border-b border-border bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
								<th class="py-3 px-4">Booking Ref</th>
								<th class="py-3 px-4">Salesman</th>
								<th class="py-3 px-4 text-right">Selling Price</th>
								<th class="py-3 px-4 text-right">Supplier Cost</th>
								<th class="py-3 px-4 text-right">Net Profit</th>
								<th class="py-3 px-4 text-center">Modifications</th>
								<th class="py-3 px-4 text-right">Action</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/60">
							{#each paginatedRecords as r}
								{@const ServiceIcon = getServiceIcon(r.bookingType)}
								{@const modCount = getRecordModificationsCount(r)}
								<tr class="hover:bg-muted/30 transition-colors">
									<!-- Booking Ref -->
									<td class="py-3 px-4">
										<div class="flex items-center gap-2">
											<div class="p-1.5 rounded-lg border {getServiceBadgeColor(r.bookingType)}">
												<ServiceIcon class="h-3.5 w-3.5" />
											</div>
											<div>
												<a
													href="/sales/bookings/{getServiceRouteSlug(r.bookingType)}/{r.bookingId}"
													class="font-bold text-foreground font-mono hover:text-primary hover:underline flex items-center gap-1"
												>
													<span>{r.documentNumber || `#${r.bookingId}`}</span>
													<ExternalLink class="h-2.5 w-2.5 opacity-60" />
												</a>
												{#if r.clientName}
													<span class="text-[11px] font-semibold text-foreground/80 block truncate max-w-[160px]" title={r.clientName}>
														{r.clientName}
													</span>
												{/if}
												<span class="text-[10px] text-muted-foreground">
													<DateDisplay date={r.bookingCreatedAt} />
												</span>
											</div>
										</div>
									</td>

									<!-- Salesman -->
									<td class="py-3 px-4 font-semibold text-foreground">
										<div class="flex items-center gap-2">
											<div class="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
												{(r.salesmanName || 'S').charAt(0).toUpperCase()}
											</div>
											<span class="truncate max-w-[150px]">{r.salesmanName || `Salesman #${r.salesmanId}`}</span>
										</div>
									</td>

									<!-- Selling Price -->
									<td class="py-3 px-4 text-right font-mono font-bold text-foreground">
										<MoneyDisplay amount={r.payableAmount} />
									</td>

									<!-- Supplier Cost -->
									<td class="py-3 px-4 text-right">
										<span class="font-mono text-muted-foreground block">
											<MoneyDisplay amount={r.finalSupplierCost} />
										</span>
										<span class="text-[9px] uppercase tracking-wider font-bold text-muted-foreground/80">
											{r.supplierCostSource}
										</span>
									</td>

									<!-- Net Profit -->
									<td class="py-3 px-4 text-right">
										<span class="font-mono font-bold text-sm {r.profitAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
											<MoneyDisplay amount={r.profitAmount} />
										</span>
									</td>

									<!-- Modifications Status / Badge -->
									<td class="py-3 px-4 text-center">
										{#if modCount > 0}
											<button
												type="button"
												onclick={() => openHistoryModal(r)}
												class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border border-purple-500/20 cursor-pointer transition-colors"
												title="Click to view modification history for this booking"
											>
												<History class="h-3 w-3" />
												<span>Modified ({modCount})</span>
											</button>
										{:else}
											<span class="text-[10px] text-muted-foreground/60 font-medium">
												Standard
											</span>
										{/if}
									</td>

									<!-- Action -->
									<td class="py-3 px-4 text-right">
										<div class="flex items-center justify-end gap-1.5">
											{#if modCount > 0}
												<Button
													variant="ghost"
													size="sm"
													class="h-7 px-2 rounded-lg text-xs font-semibold cursor-pointer text-purple-600 hover:bg-purple-500/10"
													onclick={() => openHistoryModal(r)}
													title="View modification history"
												>
													<History class="h-3 w-3" />
												</Button>
											{/if}
											<Button
												variant="outline"
												size="sm"
												class="h-7 px-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all"
												onclick={() => openAdjustModal(r)}
											>
												<Edit3 class="h-3 w-3 mr-1" />
												<span>Adjust</span>
											</Button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Pagination Bar for Records -->
				<div class="p-3.5 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground bg-muted/10">
					<div class="flex items-center gap-2">
						<span>Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length} records</span>
						<select
							bind:value={pageSize}
							onchange={() => currentPage = 1}
							class="h-7 px-2 bg-background border border-border rounded-lg text-xs text-foreground cursor-pointer font-semibold"
						>
							<option value={10}>10 / page</option>
							<option value={20}>20 / page</option>
							<option value={50}>50 / page</option>
							<option value={100}>100 / page</option>
							<option value={200}>200 / page</option>
							<option value={500}>500 / page</option>
							<option value={1000}>1000 / page (All)</option>
						</select>
					</div>

					<div class="flex items-center gap-1.5">
						<button
							type="button"
							disabled={currentPage <= 1}
							onclick={() => currentPage--}
							class="h-7.5 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1 transition-colors"
						>
							<ChevronLeft class="h-3.5 w-3.5" />
							<span>Prev</span>
						</button>
						<span class="px-2 font-semibold text-foreground">
							Page {currentPage} of {totalPages}
						</span>
						<button
							type="button"
							disabled={currentPage >= totalPages}
							onclick={() => currentPage++}
							class="h-7.5 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1 transition-colors"
						>
							<span>Next</span>
							<ChevronRight class="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			{/if}
		{:else}
			<!-- ================= VIEW 2: MODIFICATION HISTORY AUDIT TRAIL ================= -->
			{#if filteredHistory.length === 0}
				<div class="p-16 text-center space-y-3">
					<div class="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto text-purple-600">
						<History class="h-6 w-6" />
					</div>
					<h3 class="text-sm font-bold text-foreground">No Profit Modifications Found</h3>
					<p class="text-xs text-muted-foreground max-w-sm mx-auto">
						No profit modifications have been recorded yet, or no records matched your search filters.
					</p>
					{#if hasActiveFilters}
						<Button variant="outline" size="sm" onclick={resetFilters} class="rounded-xl text-xs">
							<RotateCcw class="h-3 w-3 mr-1.5" />
							<span>Clear Filters</span>
						</Button>
					{/if}
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs border-collapse">
						<thead>
							<tr class="border-b border-border bg-purple-500/5 text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
								<th class="py-3 px-4">Timestamp & Date</th>
								<th class="py-3 px-4">Booking Ref</th>
								<th class="py-3 px-4">Salesman</th>
								<th class="py-3 px-4 text-right">Profit Shift</th>
								<th class="py-3 px-4 text-center">Adjustment Delta</th>
								<th class="py-3 px-4">Reason / Explanation</th>
								<th class="py-3 px-4 text-right">Action</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/60">
							{#each paginatedHistory as h}
								{@const ServiceIcon = getServiceIcon(h.bookingType)}
								<tr class="hover:bg-muted/30 transition-colors">
									<!-- Timestamp -->
									<td class="py-3 px-4">
										<div class="flex items-center gap-1.5 font-mono text-[11px] text-foreground">
											<Clock class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
											<div>
												<span class="block font-bold">
													{formatDate(h.timestamp)}
												</span>
												<span class="text-[10px] text-muted-foreground">
													{formatBahrainTime(h.timestamp)}
												</span>
											</div>
										</div>
									</td>

									<!-- Booking Ref -->
									<td class="py-3 px-4">
										<div class="flex items-center gap-2">
											<div class="p-1.5 rounded-lg border {getServiceBadgeColor(h.bookingType)}">
												<ServiceIcon class="h-3.5 w-3.5" />
											</div>
											<div>
												<a
													href="/sales/bookings/{getServiceRouteSlug(h.bookingType)}/{h.bookingId}"
													class="font-bold text-foreground font-mono hover:text-primary hover:underline flex items-center gap-1"
												>
													<span>{h.documentNumber || `#${h.bookingId}`}</span>
													<ExternalLink class="h-2.5 w-2.5 opacity-60" />
												</a>
												{#if h.clientName}
													<span class="text-[11px] font-semibold text-foreground/80 block truncate max-w-[150px]" title={h.clientName}>
														{h.clientName}
													</span>
												{/if}
												<span class="text-[10px] text-muted-foreground uppercase font-bold">
													{h.bookingType}
												</span>
											</div>
										</div>
									</td>

									<!-- Salesman -->
									<td class="py-3 px-4 font-semibold text-foreground">
										<div class="flex items-center gap-2">
											<div class="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
												{(h.salesmanName || 'S').charAt(0).toUpperCase()}
											</div>
											<span class="truncate max-w-[140px]">{h.salesmanName || `Salesman #${h.salesmanId}`}</span>
										</div>
									</td>

									<!-- Profit Shift (Before -> After) -->
									<td class="py-3 px-4 text-right font-mono">
										<div class="flex items-center justify-end gap-1 text-[11px]">
											<span class="text-muted-foreground line-through opacity-80">
												{h.previousProfit.toFixed(3)}
											</span>
											<ArrowRight class="h-3 w-3 text-muted-foreground" />
											<span class="font-bold text-foreground">
												{h.newProfit.toFixed(3)} BHD
											</span>
										</div>
									</td>

									<!-- Adjustment Delta -->
									<td class="py-3 px-4 text-center">
										<span class={['inline-block px-2.5 py-0.5 rounded-full font-mono text-xs font-bold',
											h.deltaAmount >= 0
												? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
												: 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
										].join(' ')}>
											{h.deltaAmount >= 0 ? '+' : ''}{h.deltaAmount.toFixed(3)} BHD
										</span>
									</td>

									<!-- Reason / Explanation -->
									<td class="py-3 px-4 max-w-xs">
										<div class="text-xs text-foreground font-medium line-clamp-2">
											{h.reason}
										</div>
										<span class="text-[10px] text-muted-foreground block font-mono mt-0.5">
											By {h.modifiedBy || 'Accountant'}
										</span>
									</td>

									<!-- Action -->
									<td class="py-3 px-4 text-right">
										<a
											href="/sales/bookings/{getServiceRouteSlug(h.bookingType)}/{h.bookingId}"
											class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
										>
											<span>View Deal</span>
											<ExternalLink class="h-3 w-3" />
										</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Pagination Bar for History -->
				<div class="p-3.5 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground bg-muted/10">
					<div class="flex items-center gap-2">
						<span>Showing {(historyPage - 1) * historyPageSize + 1} to {Math.min(historyPage * historyPageSize, filteredHistory.length)} of {filteredHistory.length} modifications</span>
						<select
							bind:value={historyPageSize}
							onchange={() => historyPage = 1}
							class="h-7 px-2 bg-background border border-border rounded-lg text-xs text-foreground cursor-pointer font-semibold"
						>
							<option value={10}>10 / page</option>
							<option value={20}>20 / page</option>
							<option value={50}>50 / page</option>
							<option value={100}>100 / page</option>
							<option value={200}>200 / page</option>
							<option value={500}>500 / page</option>
							<option value={1000}>1000 / page (All)</option>
						</select>
					</div>

					<div class="flex items-center gap-1.5">
						<button
							type="button"
							disabled={historyPage <= 1}
							onclick={() => historyPage--}
							class="h-7.5 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1 transition-colors"
						>
							<ChevronLeft class="h-3.5 w-3.5" />
							<span>Prev</span>
						</button>
						<span class="px-2 font-semibold text-foreground">
							Page {historyPage} of {totalHistoryPages}
						</span>
						<button
							type="button"
							disabled={historyPage >= totalHistoryPages}
							onclick={() => historyPage++}
							class="h-7.5 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1 transition-colors"
						>
							<span>Next</span>
							<ChevronRight class="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- ================= Modal 1: User-Friendly Profit Adjustment Modal ================= -->
{#if showAdjustModal && adjustingRecord}
	{@const recordPriorHistory = getRecordModifications(adjustingRecord)}
	<!-- Backdrop with Esc handling -->
	<div
		class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
		onclick={(e) => e.target === e.currentTarget && (showAdjustModal = false)}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onkeydown={(e) => e.key === 'Escape' && (showAdjustModal = false)}
	>
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
			<!-- Header -->
			<div class="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
				<div class="flex items-center gap-2.5">
					<div class="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
						<Edit3 class="h-4.5 w-4.5" />
					</div>
					<div>
						<h2 class="text-sm font-bold text-foreground">Edit Salesman Profit</h2>
						<p class="text-[10px] text-muted-foreground font-mono">
							{adjustingRecord.documentNumber || `#${adjustingRecord.bookingId}`} • {adjustingRecord.bookingType} • {adjustingRecord.salesmanName}
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={() => showAdjustModal = false}
					class="h-8 w-8 rounded-lg bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<form onsubmit={submitProfitAdjustment} class="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
				<!-- Current Financial Summary Card -->
				<div class="p-3.5 bg-muted/30 border border-border rounded-xl grid grid-cols-3 gap-2 text-center">
					<div>
						<span class="text-[10px] font-semibold text-muted-foreground block">Customer Price</span>
						<span class="font-bold font-mono text-foreground">
							{adjustingRecord.payableAmount.toFixed(3)} BHD
						</span>
					</div>
					<div>
						<span class="text-[10px] font-semibold text-muted-foreground block">Supplier Cost</span>
						<span class="font-bold font-mono text-muted-foreground">
							{adjustingRecord.finalSupplierCost.toFixed(3)} BHD
						</span>
					</div>
					<div>
						<span class="text-[10px] font-semibold text-muted-foreground block">Current Profit</span>
						<span class="font-bold font-mono text-emerald-600">
							{adjustingRecord.profitAmount.toFixed(3)} BHD
						</span>
					</div>
				</div>

				<!-- Mode Selector: Direct Profit Edit vs Adjustment Delta -->
				<div class="space-y-1.5">
					<span class="text-[11px] font-semibold text-muted-foreground block">Adjustment Method</span>
					<div class="grid grid-cols-2 gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/60">
						<button
							type="button"
							class={['py-1.5 text-center rounded-lg font-semibold transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5',
								adjustMode === 'direct'
									? 'bg-card text-foreground font-bold shadow-xs border border-border'
									: 'text-muted-foreground hover:text-foreground'
							].join(' ')}
							onclick={() => switchAdjustMode('direct')}
						>
							<DollarSign class="h-3.5 w-3.5 text-emerald-600" />
							<span>Edit Profit Amount</span>
						</button>
						<button
							type="button"
							class={['py-1.5 text-center rounded-lg font-semibold transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5',
								adjustMode === 'delta'
									? 'bg-card text-foreground font-bold shadow-xs border border-border'
									: 'text-muted-foreground hover:text-foreground'
							].join(' ')}
							onclick={() => switchAdjustMode('delta')}
						>
							<SlidersHorizontal class="h-3.5 w-3.5 text-primary" />
							<span>Adjustment Delta (+/-)</span>
						</button>
					</div>
				</div>

				<!-- Option 1: Direct Profit Amount Input -->
				{#if adjustMode === 'direct'}
					<div class="space-y-1.5 animate-in fade-in duration-150">
						<div class="flex items-center justify-between">
							<label for="targetProfitInput" class="font-semibold text-foreground">
								New Profit Amount (BHD) <span class="text-red-500">*</span>
							</label>
							<div class="flex items-center gap-1.5">
								<button
									type="button"
									onclick={() => targetProfitAmount = adjustingRecord?.profitAmount.toFixed(3) || '0.000'}
									class="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer"
								>
									Reset to Current ({adjustingRecord.profitAmount.toFixed(3)})
								</button>
								<span class="text-muted-foreground">•</span>
								<button
									type="button"
									onclick={() => targetProfitAmount = '0.000'}
									class="text-[10px] text-rose-600 hover:underline cursor-pointer"
								>
									0.000
								</button>
							</div>
						</div>
						<div class="flex items-center rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-emerald-500/30 overflow-hidden h-9">
							<span class="px-3 bg-muted/50 border-r border-border text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono">
								BHD
							</span>
							<input
								id="targetProfitInput"
								type="number"
								step="0.001"
								placeholder="Enter exact new profit..."
								bind:value={targetProfitAmount}
								class="flex-1 h-full px-3 bg-transparent font-mono text-xs font-bold text-foreground focus:outline-none"
								required
							/>
						</div>
					</div>
				{:else}
					<!-- Option 2: Adjustment Delta Input -->
					<div class="space-y-1.5 animate-in fade-in duration-150">
						<label for="adjustAmtInput" class="font-semibold text-foreground">
							Adjustment Delta (BHD) <span class="text-red-500">*</span>
						</label>
						<div class="flex items-center rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-primary/20 overflow-hidden h-9">
							<span class="px-3 bg-muted/50 border-r border-border text-xs font-bold text-muted-foreground font-mono">
								BHD
							</span>
							<input
								id="adjustAmtInput"
								type="number"
								step="0.001"
								placeholder="+10.000 (increase) or -5.000 (deduct)"
								bind:value={adjustDeltaAmount}
								class="flex-1 h-full px-3 bg-transparent font-mono text-xs font-bold text-foreground focus:outline-none"
								required
							/>
						</div>
					</div>
				{/if}

				<!-- Mandatory Reason Field -->
				<div class="space-y-1.5">
					<label for="profitReasonInput" class="font-semibold text-foreground flex items-center justify-between">
						<span>Reason / Explanation <span class="text-rose-500">*</span></span>
						<span class="text-[10px] text-muted-foreground font-normal">Audit Logged</span>
					</label>

					<textarea
						id="profitReasonInput"
						rows="2"
						placeholder="Explain why this profit change or commission override is being recorded..."
						bind:value={adjustReason}
						class="w-full p-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
						required
					></textarea>
				</div>

				<!-- Live Preview Bar -->
				<div class="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between text-xs">
					<div>
						<span class="text-[10px] font-bold text-muted-foreground block">Projected New Profit</span>
						<span class="text-sm font-bold font-mono text-emerald-600">
							{projectedNewProfit.toFixed(3)} BHD
						</span>
					</div>
					<div class="text-right">
						<span class="text-[10px] font-bold text-muted-foreground block">Calculated Delta</span>
						<span class={['text-xs font-bold font-mono px-2 py-0.5 rounded-md inline-block',
							calculatedDelta > 0 ? 'bg-emerald-500/10 text-emerald-600' :
							calculatedDelta < 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-muted text-muted-foreground'
						].join(' ')}>
							{calculatedDelta >= 0 ? '+' : ''}{calculatedDelta.toFixed(3)} BHD
						</span>
					</div>
				</div>

				<!-- Prior Modifications for this Booking (if any) -->
				{#if recordPriorHistory.length > 0}
					<div class="pt-2 border-t border-border space-y-2">
						<div class="flex items-center gap-1.5 text-muted-foreground font-bold text-[11px]">
							<History class="h-3.5 w-3.5 text-purple-600" />
							<span>Prior Modifications ({recordPriorHistory.length})</span>
						</div>
						<div class="space-y-1.5 max-h-32 overflow-y-auto">
							{#each recordPriorHistory as ph}
								<div class="p-2 rounded-lg bg-muted/40 border border-border/80 text-[11px] space-y-0.5">
									<div class="flex items-center justify-between font-mono">
										<span class="text-muted-foreground">{new Date(ph.timestamp).toLocaleString()}</span>
										<span class="font-bold {ph.deltaAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
											{ph.deltaAmount >= 0 ? '+' : ''}{ph.deltaAmount.toFixed(3)} BHD
										</span>
									</div>
									<div class="text-foreground text-[10px] font-medium italic">
										"{ph.reason}"
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Actions -->
				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={() => showAdjustModal = false}
						disabled={isSubmittingAdjustment}
						class="h-8.5 px-3 rounded-xl border border-border bg-background text-foreground hover:bg-muted text-xs font-medium cursor-pointer transition-colors"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isSubmittingAdjustment || !adjustReason.trim() || Math.abs(calculatedDelta) < 0.0001}
						class="h-8.5 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60"
					>
						{#if isSubmittingAdjustment}
							<RefreshCw class="h-3.5 w-3.5 animate-spin" />
							<span>Applying...</span>
						{:else}
							<Save class="h-3.5 w-3.5" />
							<span>Save & Apply Adjustment</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ================= Modal 2: Single Booking Modification History Modal ================= -->
{#if showHistoryModal && historyModalRecord}
	{@const recordHistory = getRecordModifications(historyModalRecord)}
	<div
		class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
		onclick={(e) => e.target === e.currentTarget && (showHistoryModal = false)}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onkeydown={(e) => e.key === 'Escape' && (showHistoryModal = false)}
	>
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
			<!-- Header -->
			<div class="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
				<div class="flex items-center gap-2.5">
					<div class="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shadow-xs">
						<History class="h-4.5 w-4.5" />
					</div>
					<div>
						<h2 class="text-sm font-bold text-foreground">Profit Modification History</h2>
						<p class="text-[10px] text-muted-foreground font-mono">
							{historyModalRecord.documentNumber || `#${historyModalRecord.bookingId}`} • {historyModalRecord.bookingType} • {historyModalRecord.salesmanName}
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={() => showHistoryModal = false}
					class="h-8 w-8 rounded-lg bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<div class="p-6 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
				<!-- Current Status Banner -->
				<div class="p-3.5 bg-muted/30 border border-border rounded-xl flex items-center justify-between text-xs">
					<div>
						<span class="text-[10px] font-semibold text-muted-foreground block">Current Net Profit</span>
						<span class="font-bold font-mono text-base text-emerald-600">
							{historyModalRecord.profitAmount.toFixed(3)} BHD
						</span>
					</div>
					<div class="text-right">
						<span class="text-[10px] font-semibold text-muted-foreground block">Modifications</span>
						<span class="font-bold font-mono text-purple-600">
							{recordHistory.length} change{recordHistory.length === 1 ? '' : 's'} logged
						</span>
					</div>
				</div>

				<!-- History Timeline List -->
				{#if recordHistory.length === 0}
					<div class="p-8 text-center text-muted-foreground space-y-1.5">
						<History class="h-6 w-6 mx-auto opacity-40" />
						<p class="font-medium text-xs">No manual modifications recorded for this application.</p>
					</div>
				{:else}
					<div class="space-y-2.5">
						{#each recordHistory as item, idx}
							<div class="p-3 bg-background border border-border rounded-xl space-y-2 relative">
								<div class="flex items-center justify-between text-[11px]">
									<div class="flex items-center gap-1.5 text-muted-foreground font-mono">
										<Clock class="h-3 w-3 text-purple-500" />
										<span>{new Date(item.timestamp).toLocaleString()}</span>
									</div>
									<span class={['font-mono font-bold px-2 py-0.5 rounded-md text-xs',
										item.deltaAmount >= 0
											? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
											: 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
									].join(' ')}>
										{item.deltaAmount >= 0 ? '+' : ''}{item.deltaAmount.toFixed(3)} BHD
									</span>
								</div>

								<div class="flex items-center justify-between text-xs font-mono bg-muted/30 p-2 rounded-lg">
									<span class="text-muted-foreground">
										Before: <strong class="text-foreground">{item.previousProfit.toFixed(3)} BHD</strong>
									</span>
									<ArrowRight class="h-3 w-3 text-muted-foreground" />
									<span class="text-emerald-600 font-bold">
										After: {item.newProfit.toFixed(3)} BHD
									</span>
								</div>

								<div class="space-y-0.5">
									<span class="text-[10px] font-bold text-muted-foreground uppercase">Reason / Explanation:</span>
									<p class="text-xs text-foreground bg-muted/20 p-2 rounded-md font-medium">
										"{item.reason}"
									</p>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="px-6 py-3.5 border-t border-border bg-muted/20 flex items-center justify-between">
				<a
					href="/sales/bookings/{getServiceRouteSlug(historyModalRecord.bookingType)}/{historyModalRecord.bookingId}"
					class="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
				>
					<span>Open Full Booking Details</span>
					<ExternalLink class="h-3 w-3" />
				</a>
				<Button
					variant="outline"
					size="sm"
					onclick={() => showHistoryModal = false}
					class="rounded-xl text-xs"
				>
					Close
				</Button>
			</div>
		</div>
	</div>
{/if}
{/if}
