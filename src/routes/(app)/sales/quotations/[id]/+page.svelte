<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getQuotationById, updateQuotationStatus, downloadQuotationPdf, type QuotationDetail } from '$features/sales/api/quotations';
  import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
  import { DateDisplay } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
  import { previewDocument } from '$lib/utils/preview-document';
  import { toast } from '$lib/stores/toast';
  import {
    ArrowLeft,
    FileText,
    RefreshCw,
    Download,
    Printer,
    User,
    Mail,
    Phone,
    Calendar,
    Briefcase,
    Layers,
    CheckCircle2,
    XCircle,
    Clock,
    Hash
  } from 'lucide-svelte';

  const quotationId = $derived($page.params.id ?? '');

  let loading = $state(false);
  let actionLoading = $state(false);
  let quotationDetail = $state<QuotationDetail | null>(null);
  let error = $state<string | null>(null);

  // Confirmation dialog state
  let showConfirmModal = $state(false);
  let confirmTitle = $state('');
  let confirmMessage = $state('');
  let confirmActionLabel = $state('');
  let confirmIsDestructive = $state(false);
  let targetStatusToApply = $state('');

  async function fetchQuotationDetails() {
    if (!quotationId) {
      error = 'Invalid quotation identifier.';
      return;
    }
    loading = true;
    error = null;
    try {
      quotationDetail = await getQuotationById(quotationId);
    } catch (err: any) {
      error = err?.message || 'Failed to load quotation details.';
      console.error('Failed to load quotation details:', err);
    } finally {
      loading = false;
    }
  }

  function requestStatusChange(newStatus: string) {
    if (actionLoading || !quotationDetail) return;

    targetStatusToApply = newStatus;
    if (newStatus === 'approved') {
      confirmTitle = 'Approve Sales Quotation';
      confirmMessage = `Are you sure you want to approve quotation ${quotationDetail.documentNumber}? This will mark it as approved in the Sales Portal.`;
      confirmActionLabel = 'Approve Quotation';
      confirmIsDestructive = false;
    } else if (newStatus === 'rejected') {
      confirmTitle = 'Reject Sales Quotation';
      confirmMessage = `Are you sure you want to reject quotation ${quotationDetail.documentNumber}?`;
      confirmActionLabel = 'Reject Quotation';
      confirmIsDestructive = true;
    }
    showConfirmModal = true;
  }

  async function executeStatusChange() {
    if (!quotationDetail || !targetStatusToApply) return;
    actionLoading = true;
    try {
      await updateQuotationStatus(quotationDetail.id, targetStatusToApply);
      toast.success(`Quotation ${targetStatusToApply} successfully.`);
      await fetchQuotationDetails();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update quotation status.');
    } finally {
      actionLoading = false;
      showConfirmModal = false;
    }
  }

  async function handleDownloadPdf() {
    if (!quotationDetail) return;
    try {
      await downloadQuotationPdf(quotationDetail.id, quotationDetail.documentNumber);
      toast.success('Quotation PDF downloaded.');
    } catch (err: any) {
      toast.error('Failed to download PDF.');
    }
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

  function getServiceBadgeColor(svc: string): string {
    const s = (svc || '').toLowerCase();
    if (s.includes('flight')) return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    if (s.includes('hotel')) return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    if (s.includes('visa')) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    if (s.includes('vfs')) return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    if (s.includes('holiday')) return 'bg-pink-500/10 text-pink-600 border-pink-500/20';
    if (s.includes('transport')) return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
    return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
  }

  $effect(() => {
    if (quotationId) {
      fetchQuotationDetails();
    }
  });
</script>

<svelte:head>
  <title>Quotation {quotationDetail?.documentNumber || ''} — Accounts Portal</title>
</svelte:head>

<div class="space-y-6 print:space-y-2">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
    <div class="flex items-center gap-3">
      <Button
        variant="outline"
        class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs"
        onclick={() => goto('/sales/quotations')}
      >
        <ArrowLeft class="h-3.5 w-3.5" /> Back to Quotations
      </Button>
      <div>
        <h1 class="text-xl font-bold text-foreground flex items-center gap-2">
          Quotation <span class="font-mono text-primary">{quotationDetail?.documentNumber || ''}</span>
        </h1>
        {#if quotationDetail}
          <p class="text-xs text-muted-foreground mt-0.5 font-mono">
            Quotation Ref: {quotationDetail.documentNumber}
          </p>
        {/if}
      </div>
    </div>

    <div class="flex items-center gap-2">
      {#if quotationDetail}
        <Button
          variant="default"
          class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs bg-primary text-primary-foreground"
          onclick={() => previewDocument('report', 'quotation', quotationDetail?.id)}
        >
          <Printer class="h-3.5 w-3.5" /> Print Invoice
        </Button>
        <Button
          variant="outline"
          class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs"
          onclick={handleDownloadPdf}
        >
          <Download class="h-3.5 w-3.5" /> Download PDF
        </Button>
      {/if}
      <Button
        variant="outline"
        class="h-8.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs"
        onclick={fetchQuotationDetails}
        disabled={loading}
      >
        <RefreshCw class={['h-3.5 w-3.5', loading ? 'animate-spin' : ''].join(' ')} /> Reload
      </Button>
    </div>
  </div>

  <!-- Main Details Area -->
  {#if loading && !quotationDetail}
    <div class="bg-card border border-border rounded-2xl p-16 flex items-center justify-center animate-pulse">
      <RefreshCw class="h-8 w-8 text-primary animate-spin" />
    </div>
  {:else if error}
    <div class="bg-card border border-border rounded-2xl p-16 text-center text-red-600 text-sm">
      {error}
    </div>
  {:else if quotationDetail}
    <div class="max-w-4xl mx-auto space-y-6">
      <!-- General Summary Card -->
      <div class="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-xs font-sans">
        <div class="flex justify-between border-b border-border/40 pb-4">
          <div class="flex items-center gap-3">
            <div class="p-2.5 bg-primary/10 text-primary rounded-xl">
              <FileText class="h-6 w-6" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-foreground">Quotation Summary</h3>
              <p class="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-semibold">
                {quotationDetail.clientType} Quotation
              </p>
            </div>
          </div>
          <span
            class={[
              'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold capitalize h-fit border',
              statusClass(quotationDetail.status)
            ].join(' ')}
          >
            {quotationDetail.status || 'pending'}
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs leading-relaxed">
          <!-- Client Information -->
          <div class="space-y-1">
            <span class="text-muted-foreground block">Client / Customer Name</span>
            <strong class="text-foreground text-sm block">{quotationDetail.customerName || '—'}</strong>
            <div class="flex flex-wrap items-center gap-2 mt-1">
              <span class="text-[10px] text-muted-foreground/80 bg-muted px-2 py-0.5 rounded capitalize font-semibold">
                {quotationDetail.clientType}
              </span>
              {#if quotationDetail.headId}
                <span class="text-[10px] text-muted-foreground font-mono">
                  Head ID: #{quotationDetail.headId}
                </span>
              {/if}
            </div>
            {#if quotationDetail.customerContact}
              <span class="text-muted-foreground block mt-1 flex items-center gap-1 font-mono">
                <Phone class="h-3 w-3 text-muted-foreground/70" /> {quotationDetail.customerContact}
              </span>
            {/if}
            {#if quotationDetail.customerEmail}
              <span class="text-muted-foreground block flex items-center gap-1">
                <Mail class="h-3 w-3 text-muted-foreground/70" /> {quotationDetail.customerEmail}
              </span>
            {/if}
          </div>

          <!-- Sales Representative -->
          <div class="space-y-1">
            <span class="text-muted-foreground block">Sales Representative</span>
            <span class="text-sm font-bold text-foreground block">{quotationDetail.salesmanName || '—'}</span>
            <span class="text-muted-foreground block text-[11px]">User ID: #{quotationDetail.userId}</span>
          </div>

          <!-- Total Amount -->
          <div class="space-y-1">
            <span class="text-muted-foreground block">Total Quoted Amount</span>
            <strong class="text-foreground font-mono text-base block text-primary">
              <MoneyDisplay amount={quotationDetail.totalAmount} />
            </strong>
          </div>

          <!-- Logged Date -->
          <div class="space-y-1">
            <span class="text-muted-foreground block">Logged At</span>
            <span class="block font-mono text-muted-foreground text-sm">
              <DateDisplay value={quotationDetail.createdAt} />
            </span>
          </div>

          <!-- Remarks / Notes -->
          {#if quotationDetail.remarks}
            <div class="sm:col-span-2 space-y-1">
              <span class="text-muted-foreground block">Remarks & Terms</span>
              <p class="text-foreground text-xs leading-relaxed bg-muted/20 p-3 rounded-xl border border-border/40 font-medium whitespace-pre-wrap">
                {quotationDetail.remarks}
              </p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Quoted Services & Items Breakdown Table -->
      <div class="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        <div class="p-5 border-b border-border/80 bg-muted/20 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Layers class="h-4 w-4 text-primary" />
            <h3 class="text-sm font-bold text-foreground">Quoted Services & Itemization</h3>
          </div>
          <span class="text-xs text-muted-foreground font-semibold">
            {quotationDetail.items?.length || 0} service line items
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-muted/40 border-b border-border/80 text-muted-foreground font-semibold">
                <th class="p-3.5 w-40">Service Type</th>
                <th class="p-3.5">Description</th>
                <th class="p-3.5 w-20 text-center">Quantity</th>
                <th class="p-3.5 w-32 text-right">Unit Price</th>
                <th class="p-3.5 w-36 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/60">
              {#each quotationDetail.items || [] as item (item.id || item.description)}
                <tr class="hover:bg-muted/10 transition-colors">
                  <td class="p-3.5">
                    <span class={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${getServiceBadgeColor(item.serviceType)}`}>
                      {item.serviceType}
                    </span>
                  </td>
                  <td class="p-3.5 text-foreground font-medium">{item.description}</td>
                  <td class="p-3.5 text-center text-muted-foreground font-mono font-semibold">{item.quantity}</td>
                  <td class="p-3.5 text-right text-muted-foreground font-mono">
                    <MoneyDisplay amount={item.unitPrice} />
                  </td>
                  <td class="p-3.5 text-right font-bold text-foreground font-mono">
                    <MoneyDisplay amount={item.totalAmount} />
                  </td>
                </tr>
              {/each}
            </tbody>
            <tfoot>
              <tr class="bg-muted/30 border-t border-border/80 font-bold">
                <td colspan="4" class="p-4 text-right uppercase tracking-wider text-muted-foreground text-xs">
                  Grand Total
                </td>
                <td class="p-4 text-right text-base text-primary font-mono">
                  <MoneyDisplay amount={quotationDetail.totalAmount} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Action Panel for Status Updates (if pending) -->
      {#if quotationDetail.status === 'pending' || !quotationDetail.status}
        <div class="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 class="text-sm font-bold text-foreground">Quotation Workflow Actions</h4>
            <p class="text-xs text-muted-foreground">Update quotation approval state in the Sales Portal.</p>
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              class="rounded-xl text-xs py-5 px-4 cursor-pointer font-semibold border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              disabled={actionLoading}
              onclick={() => requestStatusChange('approved')}
            >
              <CheckCircle2 class="h-3.5 w-3.5 mr-1.5" />
              Approve Quotation
            </Button>
            <Button
              variant="outline"
              class="rounded-xl text-xs py-5 px-4 cursor-pointer font-semibold border-red-500/40 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              disabled={actionLoading}
              onclick={() => requestStatusChange('rejected')}
            >
              <XCircle class="h-3.5 w-3.5 mr-1.5" />
              Reject Quotation
            </Button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Status Confirmation Modal -->
<ConfirmationDialog
  bind:open={showConfirmModal}
  title={confirmTitle}
  message={confirmMessage}
  confirmLabel={confirmActionLabel}
  isDestructive={confirmIsDestructive}
  onConfirm={executeStatusChange}
/>
