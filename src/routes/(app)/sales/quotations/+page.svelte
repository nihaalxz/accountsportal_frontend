<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getQuotations, downloadQuotationPdf, type QuotationSummary } from '$features/sales/api/quotations';
  import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
  import FinancialTableSkeleton from '$lib/components/financial/FinancialTableSkeleton.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { Button } from '$lib/components/ui/button';
  import { previewDocument } from '$lib/utils/preview-document';
  import { toast } from '$lib/stores/toast';
  import { exportToCSV } from '$lib/utils/csv-exporter';
  import { formatDateOnly, getBahrainDateString } from '$lib/formatters/date';
  import { DateDisplay } from '$lib/components';
  import {
    FileText,
    Search,
    Calendar,
    RotateCcw,
    FileSpreadsheet,
    Eye,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Download,
    Printer
  } from 'lucide-svelte';

  let items = $state<QuotationSummary[]>([]);
  let totalCount = $state(0);
  let totalPages = $state(1);
  let loading = $state(true);
  let errorMsg = $state<string | null>(null);

  // Filters
  let searchVal = $state('');
  let statusFilter = $state('all'); // 'all' | 'pending' | 'approved' | 'rejected' | 'success'
  let startDate = $state('');
  let endDate = $state('');
  let currentPage = $state(1);
  let pageSize = $state(15);

  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;

  async function loadData() {
    if (abortController) abortController.abort();
    abortController = new AbortController();
    loading = true;
    errorMsg = null;

    try {
      const res = await getQuotations(
        {
          page: currentPage,
          pageSize,
          search: searchVal.trim() || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        },
        abortController.signal
      );

      items = res.items || [];
      totalCount = res.totalCount || 0;
      totalPages = res.totalPages || 1;
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      errorMsg = err.message || 'Failed to load quotations from Sales Portal.';
    } finally {
      loading = false;
    }
  }

  function handleSearchInput(e: Event & { currentTarget: HTMLInputElement }) {
    searchVal = e.currentTarget.value;
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      currentPage = 1;
      loadData();
    }, 300);
  }

  function resetFilters() {
    searchVal = '';
    statusFilter = 'all';
    startDate = '';
    endDate = '';
    currentPage = 1;
    loadData();
  }

  function statusClass(status: string): string {
    const s = (status ?? '').toLowerCase().trim();
    if (s === 'approved' || s === 'success') {
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
    }
    if (s === 'pending' || s === 'processing' || !s) {
      return 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
    }
    if (s === 'rejected' || s === 'cancelled') {
      return 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800';
    }
    return 'bg-muted text-muted-foreground border border-border';
  }

  async function handleRowDownloadPdf(e: MouseEvent, q: QuotationSummary) {
    e.stopPropagation();
    try {
      await downloadQuotationPdf(q.id, q.documentNumber);
      toast.success('Quotation PDF downloaded.');
    } catch (err: any) {
      toast.error('Failed to download PDF.');
    }
  }

  function handleRowPrint(e: MouseEvent, q: QuotationSummary) {
    e.stopPropagation();
    previewDocument('report', 'quotation', q.id);
  }

  function exportCSV() {
    if (items.length === 0) return;

    const csvHeaders = [
      'Quotation Number',
      'Date',
      'Client Type',
      'Customer / Head Name',
      'Contact',
      'Email',
      'Sales Representative',
      'Items Count',
      'Total Amount (BHD)',
      'Status'
    ];

    const csvRows = items.map((q) => [
      q.documentNumber,
      q.createdAt ? formatDateOnly(q.createdAt) : '',
      q.clientType,
      q.customerName,
      q.customerContact || '',
      q.customerEmail || '',
      q.salesmanName,
      q.itemsCount,
      q.totalAmount,
      q.status || 'pending'
    ]);

    exportToCSV(`Sales_Quotations_${getBahrainDateString()}.csv`, csvHeaders, csvRows);
    toast.success('CSV exported successfully.');
  }

  onMount(() => {
    loadData();
    return () => {
      if (abortController) abortController.abort();
    };
  });
</script>

<svelte:head>
  <title>Sales Quotations — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
  <!-- Page Header -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <h1 class="text-xl font-bold text-foreground">Sales Quotations</h1>
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
          Sales Portal Sync
        </span>
      </div>
      <p class="text-xs text-muted-foreground">
        Review, inspect service itemizations, track quoted volume, and export official quotations from the Sales Portal.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        class="rounded-xl text-xs py-5 px-4 cursor-pointer font-semibold"
        onclick={exportCSV}
        disabled={items.length === 0}
      >
        <FileSpreadsheet class="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
        Export CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        class="rounded-xl text-xs py-5 px-4 cursor-pointer font-semibold"
        onclick={loadData}
        disabled={loading}
      >
        <RefreshCw class={['h-3.5 w-3.5 mr-1.5', loading ? 'animate-spin' : ''].join(' ')} />
        Refresh
      </Button>
    </div>
  </div>

  <!-- Filters & Search Toolbar -->
  <div class="bg-card border border-border rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
    <!-- Search Input -->
    <div class="relative flex-1">
      <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
      <input
        type="text"
        placeholder="Search by Quotation # (TXSQT...), Customer Name, Contact, Email, or Salesman..."
        class="pl-10 h-10 w-full bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
        value={searchVal}
        oninput={handleSearchInput}
      />
    </div>

    <!-- Secondary Controls: Status, Date Range & Reset -->
    <div class="flex flex-wrap items-center gap-3">
      <!-- Status Filter -->
      <div class="flex items-center gap-2">
        <span class="font-medium text-muted-foreground">Status:</span>
        <select
          class="h-10 bg-background border border-border rounded-xl px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          bind:value={statusFilter}
          onchange={() => { currentPage = 1; loadData(); }}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="success">Success</option>
        </select>
      </div>

      <!-- Date Range -->
      <div class="flex items-center gap-2">
        <Calendar class="h-4 w-4 text-muted-foreground" />
        <input
          type="date"
          class="h-10 bg-background border border-border rounded-xl px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          bind:value={startDate}
          onchange={() => { currentPage = 1; loadData(); }}
        />
        <span class="text-muted-foreground">—</span>
        <input
          type="date"
          class="h-10 bg-background border border-border rounded-xl px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          bind:value={endDate}
          onchange={() => { currentPage = 1; loadData(); }}
        />
      </div>

      <!-- Reset Filters Button -->
      {#if searchVal || statusFilter !== 'all' || startDate || endDate}
        <Button
          variant="ghost"
          size="sm"
          class="h-10 px-3 text-xs text-muted-foreground hover:text-foreground rounded-xl cursor-pointer flex items-center gap-1.5"
          onclick={resetFilters}
        >
          <RotateCcw class="h-3.5 w-3.5" />
          Reset
        </Button>
      {/if}
    </div>
  </div>

  <!-- Main Quotations Table -->
  {#if errorMsg}
    <ErrorState message={errorMsg} retryAction={loadData} />
  {:else}
    {#if loading}
      <div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        <FinancialTableSkeleton rows={5} columns={9} />
      </div>
    {:else if items.length === 0}
      <EmptyState
        title="No sales quotations found"
        description="There are currently no quotations matching the applied filter or search term."
        icon={FileText}
      />
    {:else}
      <div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[900px] text-left border-collapse text-xs">
            <thead>
              <tr class="bg-muted/30 border-b border-border text-muted-foreground font-semibold">
                <th class="p-4 w-32">Quotation No.</th>
                <th class="p-4">Customer Name</th>
                <th class="p-4 w-32">Salesman</th>
                <th class="p-4 w-24 text-center">Items</th>
                <th class="p-4 w-32 text-right">Quoted Amount</th>
                <th class="p-4 w-28 text-center">Status</th>
                <th class="p-4 w-32">Logged Date</th>
                <th class="p-4 w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/60">
              {#each items as q (q.id)}
                <tr
                  class="hover:bg-muted/10 transition-colors cursor-pointer"
                  onclick={() => goto(`/sales/quotations/${q.id}`)}
                >
                  <td class="p-4 font-mono font-bold text-foreground">
                    <a
                      href={`/sales/quotations/${q.id}`}
                      class="hover:underline hover:text-primary cursor-pointer outline-none text-left font-bold font-mono"
                      onclick={(e) => { e.stopPropagation(); }}
                    >
                      {q.documentNumber}
                    </a>
                  </td>
                  <td class="p-4">
                    <span class="font-bold text-foreground block truncate max-w-[220px]" title={q.customerName}>
                      {q.customerName}
                    </span>
                    <span class="block text-[9px] text-muted-foreground capitalize mt-0.5">
                      {q.clientType} {q.customerContact ? `• ${q.customerContact}` : ''}
                    </span>
                  </td>
                  <td class="p-4 text-muted-foreground truncate max-w-[140px]" title={q.salesmanName}>
                    {q.salesmanName || '—'}
                  </td>
                  <td class="p-4 text-center">
                    <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-muted text-[11px] font-mono font-semibold">
                      {q.itemsCount}
                    </span>
                  </td>
                  <td class="p-4 text-right font-bold text-foreground font-mono">
                    <MoneyDisplay amount={q.totalAmount} />
                  </td>
                  <td class="p-4 text-center">
                    <span
                      class={[
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize border',
                        statusClass(q.status)
                      ].join(' ')}
                    >
                      {q.status || 'pending'}
                    </span>
                  </td>
                  <td class="p-4 font-mono text-muted-foreground">
                    <DateDisplay value={q.createdAt} />
                  </td>
                  <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-1">
                      <a
                        href={`/sales/quotations/${q.id}`}
                        class="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer inline-block"
                        title="Inspect details"
                        onclick={(e) => { e.stopPropagation(); }}
                      >
                        <Eye class="h-4 w-4" />
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-primary cursor-pointer"
                        title="Download PDF"
                        onclick={(e) => handleRowDownloadPdf(e, q)}
                      >
                        <Download class="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-primary cursor-pointer"
                        title="Print Preview"
                        onclick={(e) => handleRowPrint(e, q)}
                      >
                        <Printer class="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        <div class="p-4 border-t border-border/80 bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div class="text-muted-foreground">
            Showing <span class="font-bold text-foreground">{items.length}</span> of <span class="font-bold text-foreground">{totalCount}</span> quotations
          </div>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground whitespace-nowrap">Rows per page:</span>
              <select
                value={pageSize}
                onchange={(e) => {
                  pageSize = Number((e.target as HTMLSelectElement).value);
                  currentPage = 1;
                  loadData();
                }}
                class="bg-background border border-border rounded-lg px-2.5 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1000 (All)</option>
              </select>
            </div>
            <div class="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                class="h-8 text-xs cursor-pointer rounded-lg"
                disabled={currentPage <= 1 || loading}
                onclick={() => { currentPage--; loadData(); }}
              >
                <ChevronLeft class="h-3.5 w-3.5 mr-1" />
                Previous
              </Button>
              <span class="px-2 font-semibold text-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                class="h-8 text-xs cursor-pointer rounded-lg"
                disabled={currentPage >= totalPages || loading}
                onclick={() => { currentPage++; loadData(); }}
              >
                Next
                <ChevronRight class="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>
