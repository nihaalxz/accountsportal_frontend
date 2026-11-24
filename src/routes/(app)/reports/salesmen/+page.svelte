<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/api/api-client';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import { DateDisplay } from '$lib/components';
	import { getBahrainDateString } from '$lib/formatters/date';
	import { Button } from '$lib/components/ui/button';
	import { toast } from '$lib/stores/toast';
	import { previewDocument } from '$lib/utils/preview-document';
	import {
		Users,
		RefreshCw,
		FileSpreadsheet,
		FileDown,
		Search,
		ChevronDown,
		ChevronUp,
		ArrowUpDown,
		Calendar,
		X,
		BarChart2,
		List,
		Loader2,
		ExternalLink,
		TrendingUp,
		CheckCircle,
		AlertCircle
	} from 'lucide-svelte';

	interface SalesmanProfitRecord {
		id: number;
		salesmanId: number;
		bookingType: string;
		bookingId: number;
		documentNumber?: string;
		payableAmount: number;
		finalSupplierCost: number;
		profitAmount: number;
		profitType: string;
		supplierCostSource: string;
		accountsApprovedTotal?: number;
		rejectionFee?: number;
		isFinal: boolean;
		bookingCreatedAt: string;
		finalizedAt?: string;
		lastReconciledAt?: string;
		createdAt: string;
		updatedAt: string;
		clientName?: string;
	}

	interface SalesmanReportResponse {
		id: number;
		name: string;
		email: string;
		leadsCount: number;
		bookingsCount: number;
		totalSalesValue: number;
		totalProfit: number;
		flightCount: number;
		flightSales: number;
		flightProfit: number;
		hotelCount: number;
		hotelSales: number;
		hotelProfit: number;
		visaCount: number;
		visaSales: number;
		visaProfit: number;
		vfsCount: number;
		vfsSales: number;
		vfsProfit: number;
		holidayCount: number;
		holidaySales: number;
		holidayProfit: number;
		transportCount: number;
		transportSales: number;
		transportProfit: number;
		otherCount: number;
		otherSales: number;
		otherProfit: number;
		creditToCollect: number;
		totalFinalProfit: number;
		flightFinalProfit: number;
		hotelFinalProfit: number;
		visaFinalProfit: number;
		vfsFinalProfit: number;
		holidayFinalProfit: number;
		transportFinalProfit: number;
		otherFinalProfit: number;
		isReconciled?: boolean;
		reconciliationDifference?: number;
	}

	type ServiceType = 'flights' | 'hotels' | 'visa' | 'vfs' | 'holiday-packages' | 'transportation' | 'other-services' | 'leads' | 'receipts';

	const SERVICE_LABELS: Record<ServiceType, string> = {
		flights: 'Flights',
		hotels: 'Hotels',
		visa: 'Visa',
		vfs: 'VFS',
		'holiday-packages': 'Holiday',
		transportation: 'Transport',
		'other-services': 'Others',
		leads: 'Leads',
		receipts: 'Receipts'
	};

	// ─── States ──────────────────────────────────────────────────────────────────
	let loading = $state(true);
	let rawReports = $state<SalesmanReportResponse[]>([]);
	let search = $state('');
	let expandedSalesmanId = $state<number | null>(null);

	// Per-expanded-salesman tab state: 'summary' | 'entries' | 'profit'
	let expandedTab = $state<'summary' | 'entries' | 'profit'>('summary');
	// Which service type is selected in the entries tab
	let entriesServiceType = $state<ServiceType>('flights');
	// The loaded entries for the entries tab
	let entriesData = $state<any[]>([]);
	let entriesLoading = $state(false);

	// Search query within expanded individual salesman report
	let individualSearch = $state('');

	// Profit records state
	let profitRecordsData = $state<SalesmanProfitRecord[]>([]);
	let profitRecordsLoading = $state(false);
	let profitRecordsError = $state<string | null>(null);

	// Date filtering states
	let startDate = $state('');
	let endDate = $state('');
	type PresetType = 'all' | 'today' | 'this_week' | 'this_month' | 'last_30' | 'this_year';
	let activePreset = $state<PresetType>('all');

	// Individual Salesman Date filtering states
	let indStartDate = $state('');
	let indEndDate = $state('');
	let indActivePreset = $state<PresetType>('all');
	let indSalesmanReport = $state<SalesmanReportResponse | null>(null);
	let indSummaryLoading = $state(false);
	
	type SortField = 'name' | 'leadsCount' | 'bookingsCount' | 'totalSalesValue' | 'totalProfit' | 'totalFinalProfit' | 'creditToCollect';
	let sortField = $state<SortField>('totalSalesValue');
	let sortDirection = $state<'asc' | 'desc'>('desc');

	// ─── Date Preset Helper ──────────────────────────────────────────────────────
	function formatDateForInput(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function calculatePresetRange(preset: PresetType): { start: string; end: string } {
		const now = new Date();
		const todayStr = getBahrainDateString(now);

		if (preset === 'today') {
			return { start: todayStr, end: todayStr };
		} else if (preset === 'this_week') {
			const startOfWeek = new Date(now);
			const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0
			startOfWeek.setDate(now.getDate() - dayOfWeek);
			return { start: getBahrainDateString(startOfWeek), end: todayStr };
		} else if (preset === 'this_month') {
			const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
			const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
			return { start: getBahrainDateString(startOfMonth), end: getBahrainDateString(endOfMonth) };
		} else if (preset === 'last_30') {
			const past30 = new Date();
			past30.setDate(now.getDate() - 30);
			return { start: getBahrainDateString(past30), end: todayStr };
		} else if (preset === 'this_year') {
			const startOfYear = new Date(now.getFullYear(), 0, 1);
			return { start: getBahrainDateString(startOfYear), end: todayStr };
		} else {
			return { start: '', end: '' };
		}
	}

	function setPreset(preset: PresetType) {
		activePreset = preset;
		const { start, end } = calculatePresetRange(preset);
		startDate = start;
		endDate = end;
		loadReports();
	}

	function handleCustomDateChange() {
		activePreset = 'all';
		loadReports();
	}

	// ─── Derived Calculations ────────────────────────────────────────────────────
	const filteredReports = $derived.by(() => {
		let list = rawReports;
		
		// Apply search
		if (search.trim()) {
			const term = search.toLowerCase().trim();
			list = list.filter(
				x => x.name.toLowerCase().includes(term) || x.email.toLowerCase().includes(term)
			);
		}

		// Apply sort
		list = [...list].sort((a, b) => {
			let valA = a[sortField];
			let valB = b[sortField];

			if (typeof valA === 'string' && typeof valB === 'string') {
				return sortDirection === 'asc' 
					? valA.localeCompare(valB) 
					: valB.localeCompare(valA);
			} else {
				return sortDirection === 'asc' 
					? (valA as number) - (valB as number) 
					: (valB as number) - (valA as number);
			}
		});

		return list;
	});

	const summary = $derived.by(() => {
		const totalSalesmen = rawReports.length;
		const totalSales = rawReports.reduce((sum, x) => sum + x.totalSalesValue, 0);
		const totalProfit = rawReports.reduce((sum, x) => sum + x.totalProfit, 0);
		const totalFinalProfit = rawReports.reduce((sum, x) => sum + (x.totalFinalProfit || 0), 0);
		const totalCreditToCollect = rawReports.reduce((sum, x) => sum + (x.creditToCollect || 0), 0);
		
		let topPerformer = 'N/A';
		let maxSales = -1;
		rawReports.forEach(x => {
			if (x.totalSalesValue > maxSales) {
				maxSales = x.totalSalesValue;
				topPerformer = x.name;
			}
		});

		return { totalSalesmen, totalSales, totalProfit, totalFinalProfit, totalCreditToCollect, topPerformer };
	});

	// ─── API Loader ─────────────────────────────────────────────────────────────
	async function loadReports() {
		loading = true;
		try {
			const params: Record<string, string> = {};
			if (startDate) params.startDate = startDate;
			if (endDate) params.endDate = endDate.includes('T') ? endDate : `${endDate}T23:59:59`;
			const query = new URLSearchParams(params).toString();
			const res = await apiFetch<SalesmanReportResponse[]>(
				`api/sales-entries/salesmen/report${query ? `?${query}` : ''}`
			);
			rawReports = res || [];
		} catch (err: any) {
			toast.error(err.message || 'Failed to load salesmen report.');
		} finally {
			loading = false;
		}
	}

	// ─── Entries Loader ──────────────────────────────────────────────────────────
	// Fetch up to 500 entries for the selected service/leads, then filter client-side by salesmanName
	async function loadEntries(salesmanId: number, salesmanName: string, serviceType: ServiceType) {
		entriesLoading = true;
		entriesData = [];
		try {
			const params: Record<string, any> = { page: 1, pageSize: 500 };
			if (indStartDate) params.startDate = indStartDate;
			if (indEndDate) params.endDate = indEndDate.includes('T') ? indEndDate : `${indEndDate}T23:59:59`;
			const query = new URLSearchParams(params).toString();
			const res = await apiFetch<any>(`api/sales-entries/${serviceType}${query ? `?${query}` : ''}`);
			const all: any[] = res?.items ?? [];
			// Filter by salesman numeric id first; fallback to salesman name
			entriesData = all.filter((e: any) => {
				if (salesmanId > 0) {
					if (e.salesmanId === salesmanId || e.userId === salesmanId || e.createdBy === salesmanId) {
						return true;
					}
				} else if (salesmanId === 0) {
					if ((!e.salesmanId && !e.userId && !e.createdBy) || e.salesmanName === 'Unassigned') {
						return true;
					}
				}
				return (e.salesmanName && e.salesmanName.toLowerCase() === salesmanName.toLowerCase()) ||
					(e.createdByName && e.createdByName.toLowerCase() === salesmanName.toLowerCase());
			});
		} catch (err: any) {
			toast.error('Failed to load entries: ' + (err.message || ''));
		} finally {
			entriesLoading = false;
		}
	}

	function loadModificationHistory(): any[] {
		if (typeof localStorage === 'undefined') return [];
		try {
			const stored = localStorage.getItem('tx_profit_modification_history');
			return stored ? JSON.parse(stored) : [];
		} catch (e) {
			console.error('Error loading profit modification history from storage:', e);
			return [];
		}
	}

	async function loadProfitRecords(salesmanId: number) {
		profitRecordsLoading = true;
		profitRecordsError = null;
		profitRecordsData = [];
		try {
			const params: Record<string, string> = {};
			if (indStartDate) params.startDate = indStartDate;
			if (indEndDate) params.endDate = indEndDate.includes('T') ? indEndDate : `${indEndDate}T23:59:59`;
			const query = new URLSearchParams(params).toString();
			const [res, dbMods] = await Promise.all([
				apiFetch<SalesmanProfitRecord[]>(`api/sales-entries/salesmen/${salesmanId}/profit-records${query ? `?${query}` : ''}`).catch(() => []),
				apiFetch<any[]>(`api/sales-entries/profit-adjustments`, { params: { salesmanId } }).catch(() => [])
			]);
			const rawRecords = res || [];
			const mods = (Array.isArray(dbMods) && dbMods.length > 0) ? dbMods : loadModificationHistory();

			// Merge with persistent modification history so adjusted profit amounts are always reflected
			profitRecordsData = rawRecords.map((r) => {
				const doc = (r.documentNumber || '').trim().toLowerCase();
				const bId = r.bookingId;
				const bType = (r.bookingType || '').trim().toLowerCase();
				const latestMod = mods.find((h: any) => {
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
			const msg = err.message || 'Failed to load profit records from server.';
			profitRecordsError = msg;
			toast.error('Failed to load profit records: ' + msg);
		} finally {
			profitRecordsLoading = false;
		}
	}

	async function loadIndividualSalesmanSummary(salesmanId: number) {
		indSummaryLoading = true;
		try {
			const params: Record<string, string> = {};
			if (indStartDate) params.startDate = indStartDate;
			if (indEndDate) params.endDate = indEndDate.includes('T') ? indEndDate : `${indEndDate}T23:59:59`;
			const query = new URLSearchParams(params).toString();
			const res = await apiFetch<SalesmanReportResponse[]>(`api/sales-entries/salesmen/report${query ? `?${query}` : ''}`);
			const found = res?.find(x => x.id === salesmanId);
			if (found) {
				indSalesmanReport = found;
			}
		} catch (err: any) {
			console.error('Failed to load individual salesman summary:', err);
		} finally {
			indSummaryLoading = false;
		}
	}

	function applyIndividualDateFilter(s: SalesmanReportResponse) {
		// Update individual summary breakdown
		loadIndividualSalesmanSummary(s.id);

		// Reload entries or profit records depending on active tab
		if (expandedTab === 'entries') {
			loadEntries(s.id, s.name, entriesServiceType);
		} else if (expandedTab === 'profit') {
			loadProfitRecords(s.id);
		}
	}

	function setIndividualPreset(s: SalesmanReportResponse, preset: PresetType) {
		indActivePreset = preset;
		const { start, end } = calculatePresetRange(preset);
		indStartDate = start;
		indEndDate = end;
		applyIndividualDateFilter(s);
	}

	function handleIndividualCustomDateChange(s: SalesmanReportResponse) {
		indActivePreset = 'all';
		applyIndividualDateFilter(s);
	}

	function switchToProfit(salesmanId: number) {
		expandedTab = 'profit';
		loadProfitRecords(salesmanId);
	}

	function formatProfitType(type: any): string {
		if (type === 0 || type === '0' || type === 'Normal' || type === 'normal') return 'Normal';
		if (type === 1 || type === '1' || type === 'Inhouse' || type === 'inhouse') return 'Inhouse';
		if (type === 2 || type === '2' || type === 'Rejection' || type === 'rejection') return 'Rejection';
		return String(type ?? '—');
	}

	function formatCostSource(source: any): string {
		if (source === 1 || source === '1' || source === 'Approved' || source === 'approved') return 'Approved';
		if (source === 0 || source === '0' || source === 'Estimated' || source === 'estimated') return 'Estimated';
		return String(source ?? '—');
	}

	function handleSort(field: SortField) {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = 'desc';
		}
	}

	function toggleExpand(id: number, salesmanName: string) {
		if (expandedSalesmanId === id) {
			expandedSalesmanId = null;
			entriesData = [];
			individualSearch = '';
			indSalesmanReport = null;
		} else {
			expandedSalesmanId = id;
			expandedTab = 'summary';
			entriesServiceType = 'flights';
			entriesData = [];
			individualSearch = '';
			indSalesmanReport = null;
			indStartDate = startDate;
			indEndDate = endDate;
			indActivePreset = activePreset;
			if (startDate || endDate) {
				loadIndividualSalesmanSummary(id);
			}
		}
	}

	function switchToEntries(salesmanId: number, salesmanName: string, service: ServiceType) {
		expandedTab = 'entries';
		entriesServiceType = service;
		individualSearch = '';
		loadEntries(salesmanId, salesmanName, service);
	}

	function handleEntriesServiceChange(salesmanId: number, salesmanName: string, service: ServiceType) {
		entriesServiceType = service;
		individualSearch = '';
		loadEntries(salesmanId, salesmanName, service);
	}

	// ─── Row display helpers ──────────────────────────────────────────────────────
	function getEntryMainDetail(row: any, service: ServiceType): string {
		switch (service) {
			case 'flights': return `${row.fromLocation ?? ''} → ${row.toLocation ?? ''} (${row.passengerCount ?? 0} pax)`;
			case 'hotels': return `${row.guestName ?? '—'} · ${row.country ?? ''} (${row.days ?? 0} days)`;
			case 'visa': return `${row.visaPackName ?? '—'} (${row.applicantCount ?? 0} applicants)`;
			case 'vfs': return `${row.name ?? '—'} · ${row.visaType ?? ''}`;
			case 'holiday-packages': return `${row.passengerName ?? '—'} in ${row.country ?? ''} (${row.days ?? 0} days)`;
			case 'transportation': return `${row.pickup ?? '—'} → ${row.drop ?? '—'}`;
			case 'other-services': return `${row.serviceName ?? '—'} · ${row.name ?? '—'}`;
			default: return '—';
		}
	}

	function getEntryLinkPath(row: any, service: ServiceType): string {
		const seg = service === 'holiday-packages' ? 'holiday' : service === 'other-services' ? 'other-services' : service;
		return `/sales/bookings/${seg}/${row.id}`;
	}

	// Filtered collections for individual salesman report
	const filteredEntriesData = $derived.by(() => {
		let list = entriesData;

		// Apply individual date filter client-side as well
		if (indStartDate || indEndDate) {
			const startTs = indStartDate ? new Date(indStartDate + 'T00:00:00').getTime() : null;
			const endTs = indEndDate ? new Date(indEndDate + 'T23:59:59.999').getTime() : null;

			list = list.filter((row: any) => {
				const rawDate = row.createdAt || row.date || row.bookingCreatedAt || row.issueDate;
				if (!rawDate) return true;
				const itemTs = new Date(rawDate).getTime();
				if (isNaN(itemTs)) return true;
				if (startTs !== null && itemTs < startTs) return false;
				if (endTs !== null && itemTs > endTs) return false;
				return true;
			});
		}

		if (!individualSearch.trim()) return list;
		const q = individualSearch.toLowerCase().trim();
		return list.filter((row: any) => {
			const docNo = (row.documentNumber || row.receiptId || String(row.id || '')).toLowerCase();
			const headName = (row.headName || row.name || row.passengerName || row.guestName || '').toLowerCase();
			const detail = getEntryMainDetail(row, entriesServiceType).toLowerCase();
			const services = (row.services || row.service || '').toLowerCase();
			const status = (row.status || row.paymentStatus || row.processingStatus || '').toLowerCase();
			const paymentMode = (row.paymentMode || '').toLowerCase();
			const contact = `${row.countryCode || ''} ${row.mobileNo || ''}`.toLowerCase();
			return (
				docNo.includes(q) ||
				headName.includes(q) ||
				detail.includes(q) ||
				services.includes(q) ||
				status.includes(q) ||
				paymentMode.includes(q) ||
				contact.includes(q)
			);
		});
	});

	const filteredProfitRecordsData = $derived.by(() => {
		let list = profitRecordsData;

		// Apply individual date filter client-side as well
		if (indStartDate || indEndDate) {
			const startTs = indStartDate ? new Date(indStartDate + 'T00:00:00').getTime() : null;
			const endTs = indEndDate ? new Date(indEndDate + 'T23:59:59.999').getTime() : null;

			list = list.filter((row: SalesmanProfitRecord) => {
				const rawDate = row.bookingCreatedAt || row.createdAt;
				if (!rawDate) return true;
				const itemTs = new Date(rawDate).getTime();
				if (isNaN(itemTs)) return true;
				if (startTs !== null && itemTs < startTs) return false;
				if (endTs !== null && itemTs > endTs) return false;
				return true;
			});
		}

		if (!individualSearch.trim()) return list;
		const q = individualSearch.toLowerCase().trim();
		return list.filter((row: SalesmanProfitRecord) => {
			const docNo = (row.documentNumber || `#${row.bookingId}`).toLowerCase();
			const type = (row.bookingType || '').toLowerCase();
			const src = formatCostSource(row.supplierCostSource).toLowerCase();
			const pType = formatProfitType(row.profitType).toLowerCase();
			return docNo.includes(q) || type.includes(q) || src.includes(q) || pType.includes(q);
		});
	});

	// ─── CSV/PDF Exports ─────────────────────────────────────────────────────────
	import { exportToCSV as downloadCSV } from '$lib/utils/csv-exporter';

	function handleExportCSV() {
		if (filteredReports.length === 0) return;
		const headers = ['Salesman ID', 'Name', 'Email', 'Leads Generated', 'Entries Made', 'Total Sales Value (BHD)', 'Final Profit (BHD)', 'Credit to Collect (BHD)'];
		
		const rows = filteredReports.map((row) => [
			row.id,
			row.name || '',
			row.email || '',
			row.leadsCount || 0,
			row.bookingsCount || 0,
			row.totalSalesValue || 0,
			row.totalFinalProfit || 0,
			row.creditToCollect || 0
		]);
		
		downloadCSV(`salesmen_performance_${startDate || 'all'}_to_${endDate || 'all'}.csv`, headers, rows);
		toast.success('CSV exported successfully.');
	}

	function handleExportPDF() {
		previewDocument('report', 'salesmen-summary', { startDate, endDate });
		toast.info('Generating Salesmen Summary PDF...');
	}

	function handleExportIndividualCSV(s: SalesmanReportResponse) {
		if (expandedTab === 'profit') {
			const recordsToExport = (filteredProfitRecordsData && filteredProfitRecordsData.length > 0)
				? filteredProfitRecordsData
				: profitRecordsData;

			if (recordsToExport.length === 0) {
				toast.info('No profit records available to export.');
				return;
			}

			const headers = [
				'Document #',
				'Category',
				'Deal Status',
				'Client / Pax',
				'Payable Sale (BHD)',
				'Supplier Cost (BHD)',
				'Approved Cost (BHD)',
				'Open Deal (BHD)',
				'Closed Deal (BHD)',
				'Net Profit (BHD)',
				'Margin %',
				'Profit Type',
				'Cost Source',
				'Date'
			];

			const rows: (string | number | boolean | null | undefined)[][] = recordsToExport.map((row) => {
				const docNo = row.documentNumber || `#${row.bookingId}`;
				const category = (row.bookingType || '—').toUpperCase();
				const dealStatus = row.isFinal ? 'Closed Deal' : 'Open Deal';
				const client = row.clientName || '—';
				const sale = Number(row.payableAmount || 0);
				const supplierCost = Number(row.finalSupplierCost || 0);
				const approvedCost = (row.accountsApprovedTotal !== null && row.accountsApprovedTotal !== undefined)
					? Number(row.accountsApprovedTotal).toFixed(3)
					: '—';
				const profit = Number(row.profitAmount || 0);
				const openDeal = !row.isFinal ? profit.toFixed(3) : '—';
				const closedDeal = row.isFinal ? profit.toFixed(3) : '—';
				const margin = sale > 0 ? `${((profit / sale) * 100).toFixed(1)}%` : '—';
				const profitType = formatProfitType(row.profitType);
				const costSource = formatCostSource(row.supplierCostSource);
				const rawDate = row.bookingCreatedAt || row.createdAt;
				const dateFormatted = rawDate ? new Date(rawDate).toLocaleDateString('en-GB') : '—';

				return [
					docNo,
					category,
					dealStatus,
					client,
					sale.toFixed(3),
					supplierCost.toFixed(3),
					approvedCost,
					openDeal,
					closedDeal,
					profit.toFixed(3),
					margin,
					profitType,
					costSource,
					dateFormatted
				];
			});

			const totalSale = recordsToExport.reduce((acc, r) => acc + (r.payableAmount || 0), 0);
			const totalSupplierCost = recordsToExport.reduce((acc, r) => acc + (r.finalSupplierCost || 0), 0);
			const totalApprovedCost = recordsToExport.reduce((acc, r) => acc + (r.accountsApprovedTotal ?? 0), 0);
			const totalOpenDealProfit = recordsToExport.filter((r) => !r.isFinal).reduce((acc, r) => acc + (r.profitAmount || 0), 0);
			const totalClosedDealProfit = recordsToExport.filter((r) => r.isFinal).reduce((acc, r) => acc + (r.profitAmount || 0), 0);
			const totalProfit = recordsToExport.reduce((acc, r) => acc + (r.profitAmount || 0), 0);
			const totalMargin = totalSale > 0 ? `${((totalProfit / totalSale) * 100).toFixed(1)}%` : '—';
			const finalizedCount = recordsToExport.filter((r) => r.isFinal).length;

			rows.push([
				'TOTAL',
				'',
				`${finalizedCount} Closed / ${recordsToExport.length - finalizedCount} Open`,
				`${recordsToExport.length} records`,
				totalSale.toFixed(3),
				totalSupplierCost.toFixed(3),
				totalApprovedCost > 0 ? totalApprovedCost.toFixed(3) : '—',
				totalOpenDealProfit.toFixed(3),
				totalClosedDealProfit.toFixed(3),
				totalProfit.toFixed(3),
				totalMargin,
				'',
				'',
				''
			]);

			downloadCSV(
				`salesman_${s.name.replace(/\s+/g, '_').toLowerCase()}_profit_records_${indStartDate || 'all'}_to_${indEndDate || 'all'}.csv`,
				headers,
				rows
			);
			toast.success(`Exported ${recordsToExport.length} profit records for ${s.name}.`);
			return;
		}

		if (expandedTab === 'entries') {
			const entriesToExport = (filteredEntriesData && filteredEntriesData.length > 0)
				? filteredEntriesData
				: entriesData;

			if (entriesToExport.length === 0) {
				toast.info('No entries available to export.');
				return;
			}

			const headers = ['Document #', 'Customer / Head', 'Service', 'Details', 'Amount (BHD)', 'Date', 'Status'];
			const rows: (string | number | boolean | null | undefined)[][] = entriesToExport.map((row) => {
				const rawDate = row.createdAt || row.bookingCreatedAt;
				return [
					row.documentNumber || row.receiptId || `#${row.id}`,
					row.headName || row.clientName || '—',
					SERVICE_LABELS[entriesServiceType] || row.service || '—',
					getEntryMainDetail(row, entriesServiceType) || '—',
					Number(row.payableAmount ?? row.amount ?? 0).toFixed(3),
					rawDate ? new Date(rawDate).toLocaleDateString('en-GB') : '—',
					row.paymentStatus || row.status || '—'
				];
			});

			const totalAmt = entriesToExport.reduce((acc, r) => acc + Number(r.payableAmount ?? r.amount ?? 0), 0);
			rows.push([
				'TOTAL',
				'',
				`${entriesToExport.length} entries`,
				'',
				totalAmt.toFixed(3),
				'',
				''
			]);

			downloadCSV(
				`salesman_${s.name.replace(/\s+/g, '_').toLowerCase()}_${entriesServiceType}_entries_${indStartDate || 'all'}_to_${indEndDate || 'all'}.csv`,
				headers,
				rows
			);
			toast.success(`Exported ${entriesToExport.length} entries for ${s.name}.`);
			return;
		}

		const currentS = (expandedSalesmanId === s.id && indSalesmanReport) ? indSalesmanReport : s;
		const headers = ['Booking Category', 'Total Entries', 'Total Sales Value (BHD)', 'Final Profit (BHD)'];
		const rows = [
			['Leads Logged', currentS.leadsCount, 0, 0],
			['Flight Bookings', currentS.flightCount, currentS.flightSales, currentS.flightFinalProfit || 0],
			['Hotel Bookings', currentS.hotelCount, currentS.hotelSales, currentS.hotelFinalProfit || 0],
			['Visa Applications', currentS.visaCount, currentS.visaSales, currentS.visaFinalProfit || 0],
			['VFS Appointments', currentS.vfsCount, currentS.vfsSales, currentS.vfsFinalProfit || 0],
			['Holiday Packages', currentS.holidayCount, currentS.holidaySales, currentS.holidayFinalProfit || 0],
			['Transportations', currentS.transportCount, currentS.transportSales, currentS.transportFinalProfit || 0],
			['Other Services', currentS.otherCount, currentS.otherSales, currentS.otherFinalProfit || 0],
			['Credit to Collect', 0, currentS.creditToCollect || 0, 0],
			['Total', currentS.bookingsCount, currentS.totalSalesValue, currentS.totalFinalProfit || 0]
		];

		downloadCSV(`salesman_${s.name.replace(/\s+/g, '_').toLowerCase()}_breakdown_${indStartDate || 'all'}_to_${indEndDate || 'all'}.csv`, headers, rows);
		toast.success(`CSV exported for ${s.name}.`);
	}

	function handleExportIndividualPDF(s: SalesmanReportResponse) {
		previewDocument('report', 'salesman-detail', { salesmanId: s.id, salesmanName: s.name, startDate: indStartDate, endDate: indEndDate });
		toast.info(`Generating PDF for ${s.name}...`);
	}

	onMount(() => {
		loadReports();
	});
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-bold text-foreground flex items-center gap-2">
				<Users class="h-5 w-5 text-primary" /> Salesmen Performance Report
			</h1>
			<p class="text-xs text-muted-foreground">Aggregated booking sales, profits, and lead metrics across all active agency salesmen.</p>
		</div>
		<div class="flex items-center gap-2">
			<Button variant="outline" class="h-8.5 rounded-xl cursor-pointer" onclick={loadReports} disabled={loading}>
				<RefreshCw class={['h-3.5 w-3.5 mr-1.5', loading ? 'animate-spin' : ''].join(' ')} />
				<span>Refresh</span>
			</Button>
		</div>
	</div>

	<!-- Date Filter Controls -->
	<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3">
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
			<div class="flex items-center gap-2">
				<Calendar class="h-4 w-4 text-primary" />
				<span class="text-xs font-bold text-foreground">Date Range Filter</span>
				{#if startDate || endDate}
					<span class="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary font-mono text-[11px] font-semibold">
						{startDate || 'Start'} &rarr; {endDate || 'End'}
					</span>
				{:else}
					<span class="px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono text-[11px]">
						All Time
					</span>
				{/if}
			</div>

			<!-- Preset Buttons -->
			<div class="flex items-center gap-1.5 text-xs overflow-x-auto flex-nowrap pb-1 scrollbar-thin">
				<button
					type="button"
					onclick={() => setPreset('all')}
					class="px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap {activePreset === 'all' && !startDate && !endDate ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
				>
					All Time
				</button>
				<button
					type="button"
					onclick={() => setPreset('today')}
					class="px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap {activePreset === 'today' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
				>
					Today
				</button>
				<button
					type="button"
					onclick={() => setPreset('this_week')}
					class="px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap {activePreset === 'this_week' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
				>
					This Week
				</button>
				<button
					type="button"
					onclick={() => setPreset('this_month')}
					class="px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap {activePreset === 'this_month' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
				>
					This Month
				</button>
				<button
					type="button"
					onclick={() => setPreset('last_30')}
					class="px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap {activePreset === 'last_30' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
				>
					Last 30 Days
				</button>
				<button
					type="button"
					onclick={() => setPreset('this_year')}
					class="px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap {activePreset === 'this_year' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
				>
					This Year
				</button>
			</div>
		</div>

		<!-- Custom Date Pickers -->
		<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-border/40 text-xs">
			<div class="flex items-center gap-2">
				<label for="startDate" class="text-muted-foreground font-medium text-[11px]">From:</label>
				<input
					id="startDate"
					type="date"
					bind:value={startDate}
					onchange={handleCustomDateChange}
					class="px-2.5 py-1 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
			</div>

			<div class="flex items-center gap-2">
				<label for="endDate" class="text-muted-foreground font-medium text-[11px]">To:</label>
				<input
					id="endDate"
					type="date"
					bind:value={endDate}
					onchange={handleCustomDateChange}
					class="px-2.5 py-1 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
			</div>

			{#if startDate || endDate}
				<Button
					variant="ghost"
					class="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 sm:ml-auto"
					onclick={() => setPreset('all')}
				>
					<X class="h-3 w-3" />
					<span>Clear Dates</span>
				</Button>
			{/if}
		</div>
	</div>

	{#if loading}
		<div class="animate-pulse space-y-6">
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{#each Array(4) as _}
					<div class="h-28 bg-muted rounded-2xl"></div>
				{/each}
			</div>
			<div class="h-96 bg-muted rounded-2xl"></div>
		</div>
	{:else}
		<!-- Performance Cards -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
			<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-1">
				<span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Total Salesmen</span>
				<span class="text-xl font-bold text-foreground">{summary.totalSalesmen}</span>
			</div>
			<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-1">
				<span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Top Performer</span>
				<span class="text-base font-bold text-primary truncate block">{summary.topPerformer}</span>
			</div>
			<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-1">
				<span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Total Sales Value</span>
				<span class="text-lg font-bold font-mono text-foreground"><MoneyDisplay amount={summary.totalSales} /></span>
			</div>
			<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-1">
				<div class="flex items-center gap-1">
					<span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Final Profit</span>
					<span class="text-[10px] text-muted-foreground/70 cursor-help" title="Realized profit from confirmed/completed accounts profit records">ⓘ</span>
				</div>
				<span class="text-lg font-bold font-mono text-teal-600 dark:text-teal-400"><MoneyDisplay amount={summary.totalFinalProfit} /></span>
			</div>
			<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-1">
				<span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Credit to Collect</span>
				<span class="text-lg font-bold font-mono text-amber-600 dark:text-amber-400"><MoneyDisplay amount={summary.totalCreditToCollect} /></span>
			</div>
		</div>

		<!-- Table Filter Controls -->
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-3">
			<div class="relative w-full max-w-[320px]">
				<span class="absolute inset-y-0 left-3 flex items-center text-muted-foreground/60">
					<Search class="h-4 w-4" />
				</span>
				<input
					type="text"
					placeholder="Search by name or email..."
					bind:value={search}
					class="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder-muted-foreground/60"
				/>
			</div>

			<div class="flex items-center gap-2 text-xs">
				<Button
					variant="outline"
					class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5"
					onclick={handleExportCSV}
					disabled={filteredReports.length === 0}
				>
					<FileSpreadsheet class="h-3.5 w-3.5" />
					<span>CSV</span>
				</Button>
				<Button
					variant="outline"
					class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5"
					onclick={handleExportPDF}
					disabled={filteredReports.length === 0}
				>
					<FileDown class="h-3.5 w-3.5" />
					<span>PDF</span>
				</Button>
			</div>
		</div>

		<!-- Main Reports Data Table -->
		{#if filteredReports.length === 0}
			<div class="p-12 text-center text-muted-foreground border border-border rounded-2xl bg-card">
				No salesmen records found matching your filters.
			</div>
		{:else}
			<div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
				<div class="overflow-x-auto">
					<table class="w-full min-w-[750px] text-left border-collapse text-xs">
						<thead>
							<tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold">
								<th class="p-4 w-20">ID</th>
								<th class="p-4 cursor-pointer hover:bg-muted/20 transition-colors select-none" onclick={() => handleSort('name')}>
									<div class="flex items-center gap-1">
										<span>Salesman</span>
										<ArrowUpDown class="h-3 w-3" />
									</div>
								</th>
								<th class="p-4 cursor-pointer hover:bg-muted/20 transition-colors select-none text-center" onclick={() => handleSort('leadsCount')}>
									<div class="flex items-center justify-center gap-1">
										<span>Leads</span>
										<ArrowUpDown class="h-3 w-3" />
									</div>
								</th>
								<th class="p-4 cursor-pointer hover:bg-muted/20 transition-colors select-none text-center" onclick={() => handleSort('bookingsCount')}>
									<div class="flex items-center justify-center gap-1">
										<span>Entries Made</span>
										<ArrowUpDown class="h-3 w-3" />
									</div>
								</th>
								<th class="p-4 cursor-pointer hover:bg-muted/20 transition-colors select-none text-right" onclick={() => handleSort('totalSalesValue')}>
									<div class="flex items-center justify-end gap-1">
										<span>Sales Value</span>
										<ArrowUpDown class="h-3 w-3" />
									</div>
								</th>
								<th class="p-4 cursor-pointer hover:bg-muted/20 transition-colors select-none text-right" onclick={() => handleSort('totalFinalProfit')}>
									<div class="flex items-center justify-end gap-1">
										<span>Final Profit</span>
										<span class="text-[10px] text-muted-foreground/70 cursor-help" title="Realized profit from confirmed/completed accounts profit records">ⓘ</span>
										<ArrowUpDown class="h-3 w-3" />
									</div>
								</th>
								<th class="p-4 cursor-pointer hover:bg-muted/20 transition-colors select-none text-right" onclick={() => handleSort('creditToCollect')}>
									<div class="flex items-center justify-end gap-1">
										<span>Credit to Collect</span>
										<ArrowUpDown class="h-3 w-3" />
									</div>
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/60">
							{#each filteredReports as s}
								<!-- Main Row -->
								<tr class="hover:bg-muted/10 transition-colors cursor-pointer" onclick={() => toggleExpand(s.id, s.name)}>
									<td class="p-4 font-mono font-medium text-muted-foreground">
										<div class="flex items-center gap-1.5">
											{#if expandedSalesmanId === s.id}
												<ChevronUp class="h-3.5 w-3.5 text-primary" />
											{:else}
												<ChevronDown class="h-3.5 w-3.5 text-muted-foreground/60" />
											{/if}
											<span>#{s.id}</span>
										</div>
									</td>
									<td class="p-4">
										<div class="font-bold text-foreground">{s.name}</div>
										<div class="text-[10px] text-muted-foreground">{s.email}</div>
									</td>
									<td class="p-4 text-center font-mono font-bold text-foreground">{s.leadsCount}</td>
									<td class="p-4 text-center font-mono font-bold text-foreground">{s.bookingsCount}</td>
									<td class="p-4 text-right font-mono font-bold text-foreground">
										<MoneyDisplay amount={s.totalSalesValue} />
									</td>
									<td class="p-4 text-right font-mono font-bold text-teal-600 dark:text-teal-400">
										<MoneyDisplay amount={s.totalFinalProfit || 0} />
									</td>
									<td class="p-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
										<MoneyDisplay amount={s.creditToCollect || 0} />
									</td>
								</tr>

								<!-- Expandable Detail Sub-Row -->
								{#if expandedSalesmanId === s.id}
									{@const currentS = (expandedSalesmanId === s.id && indSalesmanReport) ? indSalesmanReport : s}
									<tr class="bg-muted/5">
										<td colspan="7" class="p-5 border-t border-border">
											<div class="space-y-4 bg-card border border-border/80 rounded-2xl p-5 shadow-xs">

												<!-- Sub-row header with tabs, search bar + export buttons -->
												<div class="flex items-center justify-between flex-wrap gap-3">
													<div class="flex items-center gap-1 bg-muted/40 rounded-xl p-1">
														<button
															type="button"
															onclick={() => { expandedTab = 'summary'; }}
															class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer
																{expandedTab === 'summary' ? 'bg-background text-foreground shadow-sm border border-border/60' : 'text-muted-foreground hover:text-foreground'}"
														>
															<BarChart2 class="h-3.5 w-3.5" />
															Summary Breakdown
														</button>
														<button
															type="button"
															onclick={() => switchToEntries(s.id, s.name, entriesServiceType)}
															class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer
																{expandedTab === 'entries' ? 'bg-background text-foreground shadow-sm border border-border/60' : 'text-muted-foreground hover:text-foreground'}"
														>
															<List class="h-3.5 w-3.5" />
															Sales Entries & Activity
														</button>
														<button
															type="button"
															onclick={() => switchToProfit(s.id)}
															class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer
																{expandedTab === 'profit' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
														>
															<TrendingUp class="h-3.5 w-3.5" />
															Salesman Profit Records
														</button>
													</div>

													<div class="flex items-center gap-2 flex-wrap">
														<!-- Individual Report Search Bar -->
														<div class="relative min-w-[200px] sm:w-60">
															<Search class="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
															<input
																type="text"
																placeholder={expandedTab === 'entries' ? `Search ${SERVICE_LABELS[entriesServiceType]}...` : expandedTab === 'profit' ? 'Search profit records...' : 'Filter categories...'}
																bind:value={individualSearch}
																class="h-7.5 w-full pl-8 pr-7 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60 font-medium"
															/>
															{#if individualSearch}
																<button
																	type="button"
																	onclick={() => individualSearch = ''}
																	class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
																	title="Clear search"
																>
																	<X class="h-3 w-3" />
																</button>
															{/if}
														</div>

														<Button
															variant="outline"
															class="h-7 px-2.5 text-[10px] rounded-lg cursor-pointer flex items-center gap-1"
															onclick={() => handleExportIndividualCSV(s)}
														>
															<FileSpreadsheet class="h-3 w-3" />
															<span>CSV</span>
														</Button>
														<Button
															variant="outline"
															class="h-7 px-2.5 text-[10px] rounded-lg cursor-pointer flex items-center gap-1"
															onclick={() => handleExportIndividualPDF(s)}
														>
															<FileDown class="h-3 w-3" />
															<span>PDF</span>
														</Button>
														<span class="text-[10px] text-muted-foreground font-mono ml-1">ID: #{s.id}</span>
													</div>
												</div>

												<!-- Individual Salesman Date Filter Controls -->
												<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 p-2.5 bg-muted/20 border border-border/60 rounded-xl text-xs">
													<div class="flex items-center gap-2 flex-wrap">
														<Calendar class="h-3.5 w-3.5 text-primary" />
														<span class="text-[11px] font-bold text-foreground">Date Filter:</span>
														
														<!-- Preset buttons -->
														<div class="flex flex-wrap items-center gap-1">
															<button
																type="button"
																onclick={() => setIndividualPreset(s, 'all')}
																class="px-2 py-0.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer {indActivePreset === 'all' && !indStartDate && !indEndDate ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
															>
																All Time
															</button>
															<button
																type="button"
																onclick={() => setIndividualPreset(s, 'today')}
																class="px-2 py-0.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer {indActivePreset === 'today' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
															>
																Today
															</button>
															<button
																type="button"
																onclick={() => setIndividualPreset(s, 'this_week')}
																class="px-2 py-0.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer {indActivePreset === 'this_week' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
															>
																This Week
															</button>
															<button
																type="button"
																onclick={() => setIndividualPreset(s, 'this_month')}
																class="px-2 py-0.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer {indActivePreset === 'this_month' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
															>
																This Month
															</button>
															<button
																type="button"
																onclick={() => setIndividualPreset(s, 'last_30')}
																class="px-2 py-0.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer {indActivePreset === 'last_30' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
															>
																Last 30 Days
															</button>
															<button
																type="button"
																onclick={() => setIndividualPreset(s, 'this_year')}
																class="px-2 py-0.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer {indActivePreset === 'this_year' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
															>
																This Year
															</button>
														</div>
													</div>

													<!-- Custom Date Inputs -->
													<div class="flex items-center gap-2 flex-wrap text-xs">
														<div class="flex items-center gap-1.5">
															<span class="text-muted-foreground text-[11px] font-medium">From:</span>
															<input
																type="date"
																bind:value={indStartDate}
																onchange={() => handleIndividualCustomDateChange(s)}
																class="h-7 px-2 py-0.5 rounded-lg border border-border bg-background text-foreground text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/30"
															/>
														</div>
														<div class="flex items-center gap-1.5">
															<span class="text-muted-foreground text-[11px] font-medium">To:</span>
															<input
																type="date"
																bind:value={indEndDate}
																onchange={() => handleIndividualCustomDateChange(s)}
																class="h-7 px-2 py-0.5 rounded-lg border border-border bg-background text-foreground text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/30"
															/>
														</div>
														{#if indStartDate || indEndDate}
															<button
																type="button"
																onclick={() => setIndividualPreset(s, 'all')}
																class="inline-flex items-center gap-1 h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer rounded-lg hover:bg-muted border border-border/50"
																title="Clear date filter"
															>
																<X class="h-3 w-3" />
																<span>Clear</span>
															</button>
															<span class="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono text-[10px] font-semibold">
																{indStartDate || 'Start'} &rarr; {indEndDate || 'End'}
															</span>
														{/if}
													</div>
												</div>

												<!-- TAB: Summary Breakdown -->
												{#if expandedTab === 'summary'}
													{#if indSummaryLoading}
														<div class="flex items-center justify-center py-10 text-muted-foreground gap-2 text-xs">
															<Loader2 class="h-4 w-4 animate-spin text-primary" />
															<span>Loading breakdown for selected date range...</span>
														</div>
													{:else}
														<div class="overflow-hidden border border-border/60 rounded-xl">
															<table class="w-full text-left border-collapse text-[11px]">
																<thead>
																	<tr class="bg-muted/20 border-b border-border/50 text-muted-foreground font-semibold">
																		<th class="p-2.5">Category</th>
																		<th class="p-2.5 text-center w-24">Total Count</th>
																		<th class="p-2.5 text-right w-32">Total Sales Value</th>
																		<th class="p-2.5 text-right w-32">
																			<div class="flex items-center justify-end gap-1">
																				<span>Final Profit</span>
																				<span class="text-[9px] text-muted-foreground/70 cursor-help" title="Realized profit from confirmed/completed accounts profit records">ⓘ</span>
																			</div>
																		</th>
																		<th class="p-2.5 text-center w-24">View Items</th>
																	</tr>
																</thead>
																<tbody class="divide-y divide-border/40 text-foreground font-medium">
																	{#each [
																		{ label: 'Leads Logged', count: currentS.leadsCount, sales: null, finalProfit: null, service: 'leads' as ServiceType },
																		{ label: 'Receipts Issued', count: null, sales: null, finalProfit: null, service: 'receipts' as ServiceType },
																		{ label: 'Flight Bookings', count: currentS.flightCount, sales: currentS.flightSales, finalProfit: currentS.flightFinalProfit, service: 'flights' as ServiceType },
																		{ label: 'Hotel Bookings', count: currentS.hotelCount, sales: currentS.hotelSales, finalProfit: currentS.hotelFinalProfit, service: 'hotels' as ServiceType },
																		{ label: 'Visa Applications', count: currentS.visaCount, sales: currentS.visaSales, finalProfit: currentS.visaFinalProfit, service: 'visa' as ServiceType },
																		{ label: 'VFS Appointments', count: currentS.vfsCount, sales: currentS.vfsSales, finalProfit: currentS.vfsFinalProfit, service: 'vfs' as ServiceType },
																		{ label: 'Holiday Packages', count: currentS.holidayCount, sales: currentS.holidaySales, finalProfit: currentS.holidayFinalProfit, service: 'holiday-packages' as ServiceType },
																		{ label: 'Transportations', count: currentS.transportCount, sales: currentS.transportSales, finalProfit: currentS.transportFinalProfit, service: 'transportation' as ServiceType },
																		{ label: 'Other Services', count: currentS.otherCount, sales: currentS.otherSales, finalProfit: currentS.otherFinalProfit, service: 'other-services' as ServiceType },
																	].filter(cat => !individualSearch.trim() || cat.label.toLowerCase().includes(individualSearch.toLowerCase().trim())) as cat}
																		<tr class="hover:bg-muted/5 transition-colors">
																			<td class="p-2.5 font-bold">{cat.label}</td>
																			<td class="p-2.5 text-center font-mono">
																				{#if cat.count !== null}
																					{cat.count}
																				{:else}
																					<span class="text-muted-foreground/40">—</span>
																				{/if}
																			</td>
																			<td class="p-2.5 text-right font-mono">
																				{#if cat.sales !== null}
																					<MoneyDisplay amount={cat.sales} />
																				{:else}
																					<span class="text-muted-foreground/40">—</span>
																				{/if}
																			</td>
																			<td class="p-2.5 text-right font-mono font-semibold text-teal-600 dark:text-teal-400">
																				{#if cat.finalProfit !== null && cat.finalProfit !== undefined}
																					<MoneyDisplay amount={cat.finalProfit} />
																				{:else}
																					<span class="text-muted-foreground/40">—</span>
																				{/if}
																			</td>
																			<td class="p-2.5 text-center">
																				{#if cat.count === null || cat.count > 0}
																					<button
																						type="button"
																						onclick={() => switchToEntries(s.id, s.name, cat.service)}
																						class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/8 hover:bg-primary/15 text-primary text-[10px] font-semibold transition-colors cursor-pointer border border-primary/20"
																					>
																						<List class="h-3 w-3" />
																						View {cat.count !== null ? cat.count : 'Receipts'}
																					</button>
																				{:else}
																					<span class="text-muted-foreground/40 text-[10px]">—</span>
																				{/if}
																			</td>
																		</tr>
																	{/each}
																	<tr class="hover:bg-muted/5 transition-colors bg-amber-500/5">
																		<td class="p-2.5 font-bold text-amber-700 dark:text-amber-400">Credit to Collect (Outstanding)</td>
																		<td class="p-2.5 text-center font-mono text-muted-foreground">—</td>
																		<td class="p-2.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
																			<MoneyDisplay amount={currentS.creditToCollect || 0} />
																		</td>
																		<td class="p-2.5 text-right font-mono text-muted-foreground/40">—</td>
																		<td class="p-2.5"></td>
																	</tr>
																	<!-- Totals row -->
																	<tr class="bg-muted/20 font-bold border-t-2 border-border">
																		<td class="p-2.5">Total Summary (Bookings)</td>
																		<td class="p-2.5 text-center font-mono">{currentS.bookingsCount}</td>
																		<td class="p-2.5 text-right font-mono"><MoneyDisplay amount={currentS.totalSalesValue} /></td>
																		<td class="p-2.5 text-right font-mono text-teal-600 dark:text-teal-400"><MoneyDisplay amount={currentS.totalFinalProfit || 0} /></td>
																		<td class="p-2.5"></td>
																	</tr>
																</tbody>
															</table>
														</div>
													{/if}

												<!-- TAB: Sales Entries & Activity -->
												{:else if expandedTab === 'entries'}
													<!-- Service type selector -->
													<div class="flex items-center gap-1.5 overflow-x-auto pb-1 flex-nowrap scrollbar-thin">
														{#each Object.entries(SERVICE_LABELS) as [svc, label]}
															<button
																type="button"
																onclick={() => handleEntriesServiceChange(s.id, s.name, svc as ServiceType)}
																class="px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap
																	{entriesServiceType === svc ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}"
															>
																{label}
															</button>
														{/each}
													</div>

													{#if entriesLoading}
														<div class="flex items-center justify-center py-10 text-muted-foreground gap-2 text-xs">
															<Loader2 class="h-4 w-4 animate-spin" />
															Loading items...
														</div>
													{:else if entriesData.length === 0}
														<div class="text-center py-10 text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl">
															No {SERVICE_LABELS[entriesServiceType]} records found for <strong>{s.name}</strong>.
														</div>
													{:else if filteredEntriesData.length === 0}
														<div class="text-center py-10 text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl space-y-2">
															<p>No {SERVICE_LABELS[entriesServiceType]} matching "<strong>{individualSearch}</strong>" for <strong>{s.name}</strong>.</p>
															<Button variant="outline" size="sm" class="h-7 text-xs cursor-pointer" onclick={() => individualSearch = ''}>
																Clear Search
															</Button>
														</div>
													{:else if entriesServiceType === 'leads'}
														<div class="overflow-x-auto border border-border/60 rounded-xl">
															<table class="w-full text-left border-collapse text-[11px]">
																<thead>
																	<tr class="bg-muted/20 border-b border-border/50 text-muted-foreground font-semibold">
																		<th class="p-2.5 w-16">Lead #</th>
																		<th class="p-2.5">Lead Name</th>
																		<th class="p-2.5">Phone / Contact</th>
																		<th class="p-2.5">Services Interested</th>
																		<th class="p-2.5">Source</th>
																		<th class="p-2.5 text-center w-24">Status</th>
																		<th class="p-2.5 w-28">Logged Date</th>
																	</tr>
																</thead>
																<tbody class="divide-y divide-border/40 text-foreground">
																	{#each filteredEntriesData as row}
																		<tr class="hover:bg-muted/5 transition-colors">
																			<td class="p-2.5 font-mono font-bold text-foreground text-[10px]">#{row.id}</td>
																			<td class="p-2.5 font-semibold text-foreground">{row.name}</td>
																			<td class="p-2.5 font-mono text-muted-foreground">{row.countryCode} {row.mobileNo}</td>
																			<td class="p-2.5 text-muted-foreground">{row.services || '—'}</td>
																			<td class="p-2.5 text-muted-foreground capitalize">{row.leadSource || '—'}</td>
																			<td class="p-2.5 text-center">
																				<span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold capitalize
																					{row.status === 'converted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
																					 row.status === 'lost' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}">
																					{row.status}
																				</span>
																			</td>
																			<td class="p-2.5 font-mono text-muted-foreground text-[10px]">
																				<DateDisplay value={row.createdAt} />
																			</td>
																		</tr>
																	{/each}
																</tbody>
															</table>
														</div>
														<p class="text-[10px] text-muted-foreground text-right pt-1">
															Showing {filteredEntriesData.length}{filteredEntriesData.length !== entriesData.length ? ` of ${entriesData.length}` : ''} leads{indStartDate || indEndDate ? ' (date filtered)' : ''} · fetched from latest records
														</p>
													{:else if entriesServiceType === 'receipts'}
														<div class="overflow-x-auto border border-border/60 rounded-xl">
															<table class="w-full text-left border-collapse text-[11px]">
																<thead>
																	<tr class="bg-muted/20 border-b border-border/50 text-muted-foreground font-semibold">
																		<th class="p-2.5 w-32">Receipt #</th>
																		<th class="p-2.5">Customer Head</th>
																		<th class="p-2.5">Service Category</th>
																		<th class="p-2.5 text-right w-32">Amount</th>
																		<th class="p-2.5 text-center w-24">Payment Mode</th>
																		<th class="p-2.5 text-center w-24">Status</th>
																		<th class="p-2.5 w-28">Logged Date</th>
																		<th class="p-2.5 w-10 text-center"></th>
																	</tr>
																</thead>
																<tbody class="divide-y divide-border/40 text-foreground">
																	{#each filteredEntriesData as row}
																		<tr class="hover:bg-muted/5 transition-colors">
																			<td class="p-2.5 font-mono font-bold text-foreground text-[10px]">{row.documentNumber || row.receiptId || `#${row.id}`}</td>
																			<td class="p-2.5 font-semibold text-foreground">{row.headName ?? '—'}</td>
																			<td class="p-2.5 text-muted-foreground uppercase font-semibold">{row.service || '—'}</td>
																			<td class="p-2.5 text-right font-mono font-bold text-foreground"><MoneyDisplay amount={row.amount ?? 0} /></td>
																			<td class="p-2.5 text-center capitalize font-medium text-muted-foreground">{row.paymentMode || 'cash'}</td>
																			<td class="p-2.5 text-center">
																				<span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold capitalize
																					{row.status === 'success' || row.status === 'posted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
																					 row.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'}">
																					{row.status}
																				</span>
																			</td>
																			<td class="p-2.5 font-mono text-muted-foreground text-[10px]">
																				<DateDisplay value={row.createdAt} />
																			</td>
																			<td class="p-2.5 text-center">
																				<a
																					href={`/sales/receipts/${row.id}`}
																					class="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
																					title="Open receipt"
																				>
																					<ExternalLink class="h-3 w-3" />
																				</a>
																			</td>
																		</tr>
																	{/each}
																</tbody>
															</table>
														</div>
														<p class="text-[10px] text-muted-foreground text-right pt-1">
															Showing {filteredEntriesData.length}{filteredEntriesData.length !== entriesData.length ? ` of ${entriesData.length}` : ''} receipts{indStartDate || indEndDate ? ' (date filtered)' : ''} · fetched from latest records
														</p>
													{:else}
														<div class="overflow-x-auto border border-border/60 rounded-xl">
															<table class="w-full text-left border-collapse text-[11px]">
																<thead>
																	<tr class="bg-muted/20 border-b border-border/50 text-muted-foreground font-semibold">
																		<th class="p-2.5 w-32">Document #</th>
																		<th class="p-2.5">Customer Head</th>
																		<th class="p-2.5">Details</th>
																		<th class="p-2.5 text-right w-32">Amount</th>
																		
																		<th class="p-2.5 text-center w-24">Payment</th>
																		<th class="p-2.5 text-center w-24">Status</th>
																		<th class="p-2.5 w-28">Date</th>
																		<th class="p-2.5 w-10 text-center"></th>
																	</tr>
																</thead>
																<tbody class="divide-y divide-border/40 text-foreground">
																	{#each filteredEntriesData as row}
																		<tr class="hover:bg-muted/5 transition-colors">
																			<td class="p-2.5 font-mono font-bold text-foreground text-[10px]">{row.documentNumber ?? `#${row.id}`}</td>
																			<td class="p-2.5 font-semibold text-foreground">{row.headName ?? '—'}</td>
																			<td class="p-2.5 text-muted-foreground">{getEntryMainDetail(row, entriesServiceType)}</td>
																			<td class="p-2.5 text-right font-mono font-bold text-foreground"><MoneyDisplay amount={row.payableAmount ?? row.amount ?? 0} /></td>
																			
																			<td class="p-2.5 text-center">
																				<span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold capitalize
																					{row.paymentStatus === 'paid' || row.paymentStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
																					 row.paymentStatus === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'}">
																					{row.paymentStatus}
																				</span>
																			</td>
																			<td class="p-2.5 text-center">
																				<span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold capitalize bg-muted text-muted-foreground border border-border/60">
																					{row.processingStatus}
																				</span>
																			</td>
																			<td class="p-2.5 font-mono text-muted-foreground text-[10px]">
																				<DateDisplay value={row.createdAt} />
																			</td>
																			<td class="p-2.5 text-center">
																				<a
																					href={getEntryLinkPath(row, entriesServiceType)}
																					class="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
																					title="Open entry"
																				>
																					<ExternalLink class="h-3 w-3" />
																				</a>
																			</td>
																		</tr>
																	{/each}
																</tbody>
															</table>
														</div>
														<p class="text-[10px] text-muted-foreground text-right pt-1">
															Showing {filteredEntriesData.length}{filteredEntriesData.length !== entriesData.length ? ` of ${entriesData.length}` : ''} entries{indStartDate || indEndDate ? ' (date filtered)' : ''} · fetched from latest 500 records
														</p>
													{/if}
												{:else if expandedTab === 'profit'}
													{#if profitRecordsLoading}
														<div class="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
															<Loader2 class="h-4 w-4 animate-spin text-primary" />
															<span>Loading profit records for {s.name}...</span>
														</div>
													{:else if profitRecordsError}
														<div class="p-6 text-center text-red-600 dark:text-red-400 bg-red-500/10 rounded-xl border border-red-500/30 space-y-2">
															<p class="font-bold text-xs">Error Loading Profit Records</p>
															<p class="text-[11px] font-mono">{profitRecordsError}</p>
															<button type="button" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-red-500/40 hover:bg-red-500/10 text-xs font-semibold cursor-pointer transition-colors" onclick={() => loadProfitRecords(s.id)}>
																<RefreshCw class="h-3 w-3" /> Retry
															</button>
														</div>
													{:else if profitRecordsData.length === 0}
														<div class="p-8 text-center text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/80 space-y-1">
															<p class="font-semibold text-foreground text-xs">No Profit Records Found</p>
															<p class="text-[11px]">No profit records exist in Sales Portal database for {s.name} matching selected filters.</p>
														</div>
													{:else if filteredProfitRecordsData.length === 0}
														<div class="p-8 text-center text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/80 space-y-2">
															<p class="font-semibold text-foreground text-xs">No Matching Profit Records</p>
															<p class="text-[11px]">No profit records found matching "<strong>{individualSearch}</strong>".</p>
															<Button variant="outline" size="sm" class="h-7 text-xs cursor-pointer" onclick={() => individualSearch = ''}>
																Clear Search
															</Button>
														</div>
													{:else}
														<!-- Profit Records Stat Bar -->
														{@const openDealsList = filteredProfitRecordsData.filter(r => !r.isFinal)}
														{@const closedDealsList = filteredProfitRecordsData.filter(r => r.isFinal)}
														{@const openDealsProfit = openDealsList.reduce((acc, r) => acc + (r.profitAmount || 0), 0)}
														{@const closedDealsProfit = closedDealsList.reduce((acc, r) => acc + (r.profitAmount || 0), 0)}
														<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-muted/20 p-3 rounded-xl border border-border/60">
															<div class="space-y-0.5">
																<span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Closed Deals (Final Profit)</span>
																<span class="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
																	<MoneyDisplay amount={closedDealsProfit} />
																</span>
																<span class="text-[10px] text-muted-foreground block font-mono">{closedDealsList.length} finalized deals</span>
															</div>
															<div class="space-y-0.5">
																<span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Open Deals (Estimated)</span>
																<span class="text-sm font-bold font-mono text-amber-600 dark:text-amber-400">
																	<MoneyDisplay amount={openDealsProfit} />
																</span>
																<span class="text-[10px] text-muted-foreground block font-mono">{openDealsList.length} open / unapproved</span>
															</div>
															<div class="space-y-0.5">
																<span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Combined Net Profit</span>
																<span class="text-sm font-bold font-mono text-foreground">
																	<MoneyDisplay amount={openDealsProfit + closedDealsProfit} />
																</span>
																<span class="text-[10px] text-muted-foreground block font-mono">Open + Closed margin</span>
															</div>
															<div class="space-y-0.5">
																<span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Total Bookings Tracked</span>
																<span class="text-sm font-bold font-mono text-primary">
																	{closedDealsList.length} / {filteredProfitRecordsData.length} finalized
																</span>
																<span class="text-[10px] text-muted-foreground block font-mono">{filteredProfitRecordsData.length} total records</span>
															</div>
														</div>

														<div class="overflow-x-auto border border-border/60 rounded-xl">
															<table class="w-full text-left border-collapse text-[11px]">
																<thead>
																	<tr class="bg-muted/20 border-b border-border/50 text-muted-foreground font-semibold">
																		<th class="p-2.5 w-32">Document #</th>
																		<th class="p-2.5 w-24">Category</th>
																		<th class="p-2.5 text-center w-28">Deal Status</th>
																		<th class="p-2.5 text-right w-28">Payable Sale</th>
																		<th class="p-2.5 text-right w-28">Supplier Cost</th>
																		<th class="p-2.5 text-right w-28">Approved Cost</th>
																		<th class="p-2.5 text-right w-28">Open Deal</th>
																		<th class="p-2.5 text-right w-28">Closed Deal</th>
																		<th class="p-2.5 w-28">Date</th>
																	</tr>
																</thead>
																<tbody class="divide-y divide-border/40 text-foreground">
																	{#each filteredProfitRecordsData as row}
																		<tr class="hover:bg-muted/5 transition-colors">
																			<td class="p-2.5 font-mono font-bold text-foreground text-[10px]">{row.documentNumber || `#${row.bookingId}`}</td>
																			<td class="p-2.5 text-muted-foreground font-semibold uppercase">{row.bookingType}</td>
																			<td class="p-2.5 text-center">
																				{#if row.isFinal}
																					<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
																						Closed Deal
																					</span>
																				{:else}
																					<span
																						class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
																						title={row.accountsApprovedTotal === null || row.accountsApprovedTotal === undefined ? 'Cost pending Accounts approval' : 'Deal still open'}
																					>
																						Open Deal
																					</span>
																				{/if}
																			</td>
																			<td class="p-2.5 text-right font-mono font-bold text-foreground"><MoneyDisplay amount={row.payableAmount} /></td>
																			<td class="p-2.5 text-right font-mono text-muted-foreground"><MoneyDisplay amount={row.finalSupplierCost} /></td>
																			<td class="p-2.5 text-right font-mono text-muted-foreground">
																				{#if row.accountsApprovedTotal !== null && row.accountsApprovedTotal !== undefined}
																					<MoneyDisplay amount={row.accountsApprovedTotal} />
																				{:else}
																					<span class="text-muted-foreground/40">—</span>
																				{/if}
																			</td>
																			<td class="p-2.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
																				{#if !row.isFinal}
																					<MoneyDisplay amount={row.profitAmount} />
																				{:else}
																					<span class="text-muted-foreground/40 font-normal">—</span>
																				{/if}
																			</td>
																			<td class="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
																				{#if row.isFinal}
																					<MoneyDisplay amount={row.profitAmount} />
																				{:else}
																					<span class="text-muted-foreground/40 font-normal">—</span>
																				{/if}
																			</td>
																			<td class="p-2.5 font-mono text-muted-foreground text-[10px]">
																				<DateDisplay value={row.bookingCreatedAt} />
																			</td>
																		</tr>
																	{/each}
																</tbody>
																<tfoot class="bg-muted/20 border-t border-border/60 font-bold text-foreground">
																	<tr>
																		<td colspan="3" class="p-2.5 text-xs">Totals ({filteredProfitRecordsData.length} records)</td>
																		<td class="p-2.5 text-right font-mono"><MoneyDisplay amount={filteredProfitRecordsData.reduce((acc, r) => acc + (r.payableAmount || 0), 0)} /></td>
																		<td class="p-2.5 text-right font-mono text-muted-foreground"><MoneyDisplay amount={filteredProfitRecordsData.reduce((acc, r) => acc + (r.finalSupplierCost || 0), 0)} /></td>
																		<td class="p-2.5 text-right font-mono text-muted-foreground"><MoneyDisplay amount={filteredProfitRecordsData.reduce((acc, r) => acc + (r.accountsApprovedTotal ?? 0), 0)} /></td>
																		<td class="p-2.5 text-right font-mono text-amber-600 dark:text-amber-400"><MoneyDisplay amount={openDealsProfit} /></td>
																		<td class="p-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400"><MoneyDisplay amount={closedDealsProfit} /></td>
																		<td class="p-2.5"></td>
																	</tr>
																</tfoot>
															</table>
														</div>
														<p class="text-[10px] text-muted-foreground text-right pt-1">
															Showing {filteredProfitRecordsData.length}{filteredProfitRecordsData.length !== profitRecordsData.length ? ` of ${profitRecordsData.length}` : ''} profit records fetched from Sales Portal DB
														</p>
													{/if}
												{/if}

											</div>
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Reconciliation Banner -->
			{#if rawReports.length > 0 && rawReports[0]}
				{@const first = rawReports[0]}
				<div class="flex items-center justify-between p-3.5 rounded-2xl border text-xs font-medium {first?.isReconciled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'}">
					<div class="flex items-center gap-2">
						{#if first?.isReconciled}
							<CheckCircle class="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
							<span><strong>Reconciliation Verified:</strong> Expected profit across all salesmen matches the Sales Entries totals perfectly.</span>
						{:else}
							<AlertCircle class="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
							<span><strong>Reconciliation Warning:</strong> Expected profit difference of {first?.reconciliationDifference ?? 0} BHD detected between booking tables and salesmen totals.</span>
						{/if}
					</div>
					<span class="text-[11px] font-mono text-muted-foreground">Source: Authoritative Bookings Financial Aggregate</span>
				</div>
			{/if}
		{/if}
	{/if}
</div>
