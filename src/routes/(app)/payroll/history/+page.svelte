<script lang="ts">
	import { onMount } from 'svelte';
	import { getSalaryPayments } from '$features/payroll/services/payroll-api';
	import type { SalaryPayment } from '$features/payroll/types';
	import {
		History,
		Search,
		RefreshCw,
		AlertCircle,
		X,
		FileText,
		Building2,
		Landmark,
		Printer,
		Download
	} from 'lucide-svelte';

	let loading = $state(true);
	let error = $state<string | null>(null);

	let payments = $state<SalaryPayment[]>([]);

	let filterStatus = $state<string>('all');
	let filterPortal = $state<string>('all');
	let searchQuery = $state<string>('');

	let selectedPayment = $state<SalaryPayment | null>(null);

	onMount(async () => {
		await loadHistory();
	});

	async function loadHistory() {
		loading = true;
		error = null;
		try {
			payments = await getSalaryPayments();
		} catch (err: any) {
			error = err?.message || 'Failed to load payroll history';
		} finally {
			loading = false;
		}
	}

	const filteredPayments = $derived(() => {
		return payments.filter((p) => {
			const statusStr = p.status || '';
			const portalStr = p.portalType || '';
			const nameStr = p.employeeName || '';
			const codeStr = p.employeeCode || '';
			const refStr = p.transactionReference || '';

			const matchesStatus = filterStatus === 'all' || statusStr.toLowerCase() === filterStatus.toLowerCase();
			const matchesPortal = filterPortal === 'all' || portalStr.toLowerCase() === filterPortal.toLowerCase();
			const matchesSearch =
				!searchQuery ||
				nameStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
				codeStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
				refStr.toLowerCase().includes(searchQuery.toLowerCase());

			return matchesStatus && matchesPortal && matchesSearch;
		});
	});

	function formatCurrency(val: number, curr = 'BHD') {
		return `${curr} ${(val || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
	}

	const months = [
		'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
		'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
	];

	function exportSalarySlipPdf(p: SalaryPayment) {
		const printWindow = window.open('', '_blank', 'width=850,height=950');
		if (!printWindow) return;

		const monthName = months[p.payrollMonth - 1];
		const paidFrom = p.paymentMethod === 'Cash Account' ? (p.cashAccountName || 'Cash Account') : (p.bankAccountName || 'Bank Account');
		const grossEarnings = (p.basicSalary || 0) + (p.incentive || 0) + (p.bonus || 0) + (p.allowance || 0);
		const remarksHtml = p.remarks
			? '<div style="font-size:11px; color:#475569; background:#f8fafc; padding:10px 14px; border-radius:6px; border:1px solid #e2e8f0; margin-bottom: 20px;"><strong>Remarks / Voucher Notes:</strong> ' + p.remarks + '</div>'
			: '';

		const htmlParts = [
			'<!DOCTYPE html><html><head><title>Salary Slip - ', p.employeeName, ' (', monthName, ' ', p.payrollYear, ')</title>',
			'<style>',
			'@page { size: A4; margin: 15mm; }',
			'body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #fff; }',
			'.container { max-width: 750px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 36px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }',
			'.header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 24px; }',
			'.logo { height: 55px; object-fit: contain; }',
			'.company-title { text-align: right; }',
			'.company-title h1 { margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; }',
			'.company-title p { margin: 4px 0 0 0; font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }',
			'.document-badge { display: inline-block; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-top: 6px; }',
			'.details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 24px; }',
			'.detail-item { font-size: 12px; }',
			'.detail-label { color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }',
			'.detail-value { color: #0f172a; font-weight: 700; margin-top: 3px; }',
			'.tables-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 24px; }',
			'table { width: 100%; border-collapse: collapse; font-size: 12px; }',
			'th { background: #f1f5f9; color: #334155; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 8px 12px; text-align: left; }',
			'td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }',
			'.text-right { text-align: right; }',
			'.total-row td { font-weight: 700; border-top: 2px solid #cbd5e1; border-bottom: none; background: #f8fafc; }',
			'.net-banner { background: #0f172a; color: #fff; border-radius: 8px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }',
			'.net-label { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }',
			'.net-amount { font-size: 22px; font-weight: 900; color: #f59e0b; font-family: monospace; }',
			'.footer { margin-top: 32px; text-align: center; font-size: 10px; color: #94a3b8; }',
			'@media print { body { padding: 0; } .container { border: none; box-shadow: none; padding: 0; } }',
			'</style>',
			'</head><body>',
			'<div class="container">',
			'<div class="header"><div><img src="https://admin.texastravelsbh.com/assets/images/texas-logo.png" alt="Texas Travels" class="logo" /></div>',
			'<div class="company-title"><h1>TEXAS TRAVELS & TOURISM</h1><p>Official Payslip Voucher</p><div class="document-badge">Ref: ', (p.transactionReference || ('PAY-' + p.id)), '</div></div></div>',
			'<div class="details-grid">',
			'<div class="detail-item"><div class="detail-label">Employee Name</div><div class="detail-value">', p.employeeName, '</div></div>',
			'<div class="detail-item"><div class="detail-label">Employee Code</div><div class="detail-value">', p.employeeCode, '</div></div>',
			'<div class="detail-item"><div class="detail-label">Department / Portal</div><div class="detail-value">', p.portalType, ' Staff</div></div>',
			'<div class="detail-item"><div class="detail-label">Pay Period</div><div class="detail-value">', monthName, ' ', p.payrollYear, '</div></div>',
			'<div class="detail-item"><div class="detail-label">Payment Date</div><div class="detail-value">', new Date(p.paymentDate).toLocaleDateString(), '</div></div>',
			'<div class="detail-item"><div class="detail-label">Payment Channel</div><div class="detail-value">', p.paymentMethod, ' (', paidFrom, ')</div></div>',
			'</div>',
			'<div class="tables-grid">',
			'<div><table><thead><tr><th>Earnings</th><th class="text-right">Amount (BHD)</th></tr></thead><tbody>',
			'<tr><td>Basic Salary</td><td class="text-right">', p.basicSalary.toFixed(3), '</td></tr>',
			'<tr><td>Incentive</td><td class="text-right">', p.incentive.toFixed(3), '</td></tr>',
			'<tr><td>Bonus</td><td class="text-right">', p.bonus.toFixed(3), '</td></tr>',
			'<tr><td>Allowance</td><td class="text-right">', p.allowance.toFixed(3), '</td></tr>',
			'<tr class="total-row"><td>Gross Earnings</td><td class="text-right">', grossEarnings.toFixed(3), '</td></tr>',
			'</tbody></table></div>',
			'<div><table><thead><tr><th>Deductions</th><th class="text-right">Amount (BHD)</th></tr></thead><tbody>',
			'<tr><td>Salary Deduction</td><td class="text-right">', p.deduction.toFixed(3), '</td></tr>',
			'<tr class="total-row"><td>Total Deductions</td><td class="text-right">', p.deduction.toFixed(3), '</td></tr>',
			'</tbody></table></div>',
			'</div>',
			'<div class="net-banner"><div class="net-label">Net Salary Paid</div><div class="net-amount">BHD ', p.netSalary.toFixed(3), '</div></div>',
			remarksHtml,
			'<div class="footer">This is a computer-generated salary slip created by Texas Accounts Portal.</div>',
			'</div>',
			'<' + 'script' + '>',
			'window.onload = function() { setTimeout(function() { window.print(); }, 400); };',
			'<' + '/script' + '>',
			'</body></html>'
		];

		printWindow.document.write(htmlParts.join(''));
		printWindow.document.close();
	}
</script>

<div class="space-y-6">
	<!-- Top Header -->
	<div class="bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-xl font-bold text-foreground flex items-center gap-2">
				<History class="h-6 w-6 text-primary" />
				Payroll History
			</h1>
			<p class="text-xs text-muted-foreground mt-1">
				Audit trail of past staff salary payments and payouts across all portals. Paid records are completely immutable.
			</p>
		</div>
		<button
			onclick={loadHistory}
			class="h-10 px-4 rounded-xl border border-border text-xs font-bold hover:bg-muted transition-colors cursor-pointer flex items-center gap-2 self-start sm:self-auto"
		>
			<RefreshCw class="h-4 w-4" />
			<span>Refresh History</span>
		</button>
	</div>

	{#if error}
		<div class="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center justify-between">
			<div class="flex items-center gap-2">
				<AlertCircle class="h-4 w-4 shrink-0" />
				<span>{error}</span>
			</div>
			<button onclick={() => (error = null)} class="hover:opacity-80"><X class="h-4 w-4" /></button>
		</div>
	{/if}

	<!-- Controls & Filters Bar -->
	<div class="flex flex-col md:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
		<div class="flex flex-wrap items-center gap-2 w-full md:w-auto">
			<!-- Status Filter -->
			<select
				bind:value={filterStatus}
				class="h-9 px-3 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
			>
				<option value="all">All Statuses</option>
				<option value="Paid">Paid</option>
				<option value="Pending">Pending</option>
				<option value="Cancelled">Cancelled</option>
			</select>

			<!-- Portal Filter -->
			<select
				bind:value={filterPortal}
				class="h-9 px-3 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
			>
				<option value="all">All Portals</option>
				<option value="Account">Accounts Staff</option>
				<option value="Sales">Sales Staff</option>
				<option value="Operational">Operational Staff</option>
			</select>
		</div>

		<!-- Search Input -->
		<div class="relative w-full md:w-72">
			<Search class="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search employee, ref, code..."
				class="w-full h-9 pl-9 pr-4 rounded-xl border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
			/>
		</div>
	</div>

	<!-- History Table -->
	<div class="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
		{#if loading}
			<div class="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
				<RefreshCw class="h-6 w-6 animate-spin text-primary" />
				<span class="text-xs font-medium">Loading payroll history...</span>
			</div>
		{:else if filteredPayments().length === 0}
			<div class="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
				<FileText class="h-10 w-10 text-muted-foreground/40" />
				<p class="text-sm font-semibold text-foreground">No payroll records found</p>
				<p class="text-xs">Adjust your search or filter parameters to view records.</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs border-collapse">
					<thead>
						<tr class="border-b border-border bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
							<th class="py-3 px-4">Employee</th>
							<th class="py-3 px-4">Portal</th>
							<th class="py-3 px-4">Period</th>
							<th class="py-3 px-4 text-right">Net Salary</th>
							<th class="py-3 px-4">Payment Method</th>
							<th class="py-3 px-4">Paid From</th>
							<th class="py-3 px-4">Reference</th>
							<th class="py-3 px-4 text-center">Status</th>
							<th class="py-3 px-4">Paid Date</th>
							<th class="py-3 px-4 text-center">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each filteredPayments() as p}
							{@const statusStr = p.status}
							{@const portalStr = p.portalType}
							{@const methodStr = p.paymentMethod}
							{@const paidFrom = methodStr === 'Cash Account' ? p.cashAccountName : p.bankAccountName}
							<tr
								onclick={() => (selectedPayment = p)}
								class="hover:bg-muted/30 transition-colors cursor-pointer"
							>
								<td class="py-3.5 px-4 font-semibold text-foreground">
									<div>{p.employeeName}</div>
									<div class="text-[10px] text-muted-foreground font-mono">{p.employeeCode}</div>
								</td>
								<td class="py-3.5 px-4">
									<span
										class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider
										{portalStr === 'Account' ? 'bg-blue-500/10 text-blue-600' : ''}
										{portalStr === 'Sales' ? 'bg-amber-500/10 text-amber-600' : ''}
										{portalStr === 'Operational' ? 'bg-purple-500/10 text-purple-600' : ''}"
									>
										{portalStr}
									</span>
								</td>
								<td class="py-3.5 px-4 font-medium text-foreground">
									{months[p.payrollMonth - 1]} {p.payrollYear}
								</td>
								<td class="py-3.5 px-4 text-right font-bold text-foreground">
									{formatCurrency(p.netSalary)}
								</td>
								<td class="py-3.5 px-4 text-muted-foreground">
									<div class="flex items-center gap-1.5">
										{#if methodStr === 'Cash Account'}
											<Landmark class="h-3.5 w-3.5 text-amber-500" />
										{:else}
											<Building2 class="h-3.5 w-3.5 text-blue-500" />
										{/if}
										<span>{methodStr}</span>
									</div>
								</td>
								<td class="py-3.5 px-4 text-muted-foreground">
									{paidFrom || '—'}
								</td>
								<td class="py-3.5 px-4 font-mono text-muted-foreground">
									{p.transactionReference || '—'}
								</td>
								<td class="py-3.5 px-4 text-center">
									<span
										class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase
										{statusStr === 'Paid' ? 'bg-emerald-500/10 text-emerald-600' : ''}
										{statusStr === 'Pending' ? 'bg-amber-500/10 text-amber-600' : ''}
										{statusStr === 'Cancelled' ? 'bg-destructive/10 text-destructive' : ''}"
									>
										{statusStr}
									</span>
								</td>
								<td class="py-3.5 px-4 text-muted-foreground">
									{new Date(p.paymentDate).toLocaleDateString()}
								</td>
								<td class="py-3.5 px-4 text-center" onclick={(e) => e.stopPropagation()}>
									<button
										onclick={() => exportSalarySlipPdf(p)}
										title="Export Salary Slip PDF"
										class="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
									>
										<Printer class="h-4 w-4 text-amber-600" />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<!-- Modal: View Payment Details -->
{#if selectedPayment}
	{@const p = selectedPayment}
	{@const statusStr = p.status}
	{@const methodStr = p.paymentMethod}
	{@const paidFrom = methodStr === 'Cash Account' ? p.cashAccountName : p.bankAccountName}
	<div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
		<div class="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
			<div class="flex items-center justify-between p-5 border-b border-border">
				<div>
					<h2 class="text-base font-bold text-foreground">Payroll Payout Details</h2>
					<p class="text-xs text-muted-foreground mt-0.5">Payment Record #{p.id}</p>
				</div>
				<button onclick={() => (selectedPayment = null)} class="text-muted-foreground hover:text-foreground">
					<X class="h-5 w-5" />
				</button>
			</div>
			<div class="p-6 space-y-4 text-xs">
				<div class="p-4 rounded-xl bg-muted/30 border border-border space-y-2">
					<div class="flex justify-between">
						<span class="text-muted-foreground">Employee:</span>
						<span class="font-bold text-foreground">{p.employeeName} ({p.employeeCode})</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Portal:</span>
						<span class="font-semibold text-foreground">{p.portalType}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Period:</span>
						<span class="font-semibold text-foreground">{months[p.payrollMonth - 1]} {p.payrollYear}</span>
					</div>
				</div>

				<div class="space-y-1.5 p-3 rounded-xl border border-border bg-card">
					<div class="flex justify-between text-muted-foreground">
						<span>Basic Salary:</span>
						<span>{formatCurrency(p.basicSalary)}</span>
					</div>
					<div class="flex justify-between text-muted-foreground">
						<span>Incentive:</span>
						<span>+ {formatCurrency(p.incentive)}</span>
					</div>
					<div class="flex justify-between text-muted-foreground">
						<span>Bonus:</span>
						<span>+ {formatCurrency(p.bonus)}</span>
					</div>
					<div class="flex justify-between text-muted-foreground">
						<span>Allowance:</span>
						<span>+ {formatCurrency(p.allowance)}</span>
					</div>
					<div class="flex justify-between text-muted-foreground">
						<span>Deduction:</span>
						<span>- {formatCurrency(p.deduction)}</span>
					</div>
					<div class="flex justify-between pt-2 border-t border-border font-bold text-sm text-foreground">
						<span>Net Salary:</span>
						<span class="text-primary">{formatCurrency(p.netSalary)}</span>
					</div>
				</div>

				<div class="space-y-2 text-muted-foreground">
					<div class="flex justify-between">
						<span>Payment Method:</span>
						<span class="font-semibold text-foreground">{methodStr}</span>
					</div>
					<div class="flex justify-between">
						<span>Paid From Account:</span>
						<span class="font-semibold text-foreground">{paidFrom || 'N/A'}</span>
					</div>
					<div class="flex justify-between">
						<span>Transaction Ref:</span>
						<span class="font-mono text-foreground">{p.transactionReference || 'N/A'}</span>
					</div>
					<div class="flex justify-between">
						<span>Payment Date:</span>
						<span class="text-foreground">{new Date(p.paymentDate).toLocaleDateString()}</span>
					</div>
					<div class="flex justify-between">
						<span>Status:</span>
						<span class="font-bold text-emerald-600">{statusStr}</span>
					</div>
					{#if p.remarks}
						<div class="pt-1">
							<span class="block text-[11px] font-semibold text-muted-foreground">Remarks:</span>
							<p class="text-foreground italic">{p.remarks}</p>
						</div>
					{/if}
				</div>
			</div>
			<div class="p-4 border-t border-border bg-muted/10 flex items-center justify-between">
				<button
					onclick={() => exportSalarySlipPdf(p)}
					class="h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
				>
					<Printer class="h-4 w-4" />
					<span>Export Salary Slip PDF</span>
				</button>
				<button
					onclick={() => (selectedPayment = null)}
					class="h-9 px-4 rounded-xl border border-border text-xs font-bold hover:bg-muted transition-colors cursor-pointer"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
