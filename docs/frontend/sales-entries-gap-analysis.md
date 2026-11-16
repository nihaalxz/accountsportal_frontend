# Sales Entries Workspace Gap Analysis

This document provides a detailed gap analysis between the legacy monolithic Sales Integration page and the modern, scalable, responsive workspace required for **Phase 7 — Sales Entries Workspace Completion**.

---

## 1. Dashboard Module

### Current State
* Displays a minimal overview with 4 KPI cards (Gross Sales Profit, Total Sales Payable, Active Leads, Customer Heads).
* Shows a static text grid for "Global Sales Volume Breakdown".
* Uses basic Tailwind layouts with no dynamic charts, drill-downs, or recent activity streams.

### Gap / Missing Features
* **Today's Bookings**: Count of all bookings created today.
* **Today's Collections**: Total receipt amounts logged today.
* **Today's Revenue**: Today's margins/profit.
* **Outstanding Receivables**: Summary of customer balances.
* **Outstanding Payables**: Summary of supplier credit wallet balances.
* **Balances**: Cash, Bank, and Wallet balances (from reconciliation endpoint).
* **Revenue Breakdown Charts**: Revenue by Service and Revenue by Salesman (using CSS/SVG charts).
* **Work Queues**: Pending Financial Posting and Pending Supplier Payments counts.
* **Recent Activities**: A stream of recent transactions and receipts.

---

## 2. Bookings Workspace

### Current State
* The bookings workspace is a single tab with a select dropdown to switch service types.
* Grid displays basic columns but lacks search, detailed filtering, sorting, or grid customizability.

### Gap / Missing Features
* **Routing**: Separate sub-pages/routes for each service type instead of tabs.
* **Paging**: True server-side pagination with page size selector.
* **Sorting**: Column header clicks to trigger sorting.
* **Filtering**: Advanced filtering by date range, payment status, processing status, and salesman.
* **Grid Controls**: Column chooser to toggle column visibility.
* **Export**: Action buttons to export data to Excel (CSV), PDF, or print.

---

## 3. Booking Detail Drawer

### Current State
* Simple slide-out drawer showing basic detail fields, a simple ledger table, supplier payments list, and outbox sync status.

### Gap / Missing Features
* **Inspector Structure**: Needs tabbed layout (Overview, Customer, Financial, Receipts, Ledger, Journal Entries, Supplier Payments, Timeline, Synchronization, Audit).
* **Unified Financial Data**: Display linked receipts, journal logs, outbox cost syncs, and purchase/sales return notes.
* **Timeline**: Interactive activity history timeline for each booking.
* **Action Shortcuts**: Quick action triggers for syncing, posting review, or downloading invoice summaries.

---

## 4. Heads (Customer Ledger) Workspace

### Current State
* Simple list displaying name, email, nationality, normal balance, wallet balance, and status.

### Gap / Missing Features
* **Grid Additions**: Booking count, receipt count, and last activity date.
* **Actions**: Quick receipt creation button, quick ledger view, quick booking list action.
* **Customer Drawer**: A dedicated detailed drawer covering customer profile details, full ledger statement, list of bookings, and activity timeline.

---

## 5. Leads Workspace

### Current State
* Minimalist grid with name, phone, interested services, source, status, and reminder date.

### Gap / Missing Features
* **Metadata Columns**: Lead Source, Assigned Salesman, Priority level, Expected Revenue, and Last Contact date.
* **Grid Features**: Advanced filters (priority, status, salesman), sorting, and search.

---

## 6. Receipts Workspace

### Current State
* Simple grid with ID, customer name, service type, amount, mode, status, and date.

### Gap / Missing Features
* **Receipts Grid**: Detailed columns including payment method, cash/bank/wallet split, and accountant approval status.
* **Receipt Drawer**: Dynamic slide-out containing detailed receipt metadata, links to incoming transactions, posted journal IDs, and general ledger impacts.

---

## 7. Customer Ledger

### Current State
* Ledger statements are nested inside the head detail tab, showing basic debit/credit listings.

### Gap / Missing Features
* **Ledger Explorer**: Dedicated page/module for ledger statement exploration.
* **Explorer Features**: Interactive date range picker, running balance calculation, print option, and spreadsheet export.

---

## 8. Global Search

### Current State
* Search is localized to individual lists (passenger search or head search).

### Gap / Missing Features
* **Unified Global Search Box**: In header/navbar to query across Bookings, Customers, Receipts, and Leads.
* **Advanced Fields**: Match passport numbers, phone numbers, booking reference IDs, and customer emails.
* **Result Layout**: Category-grouped search results overlay with quick navigation links.

---

## 9. Navigation & Export

### Current State
* Sidebar contains a single static link to `/sales`.

### Gap / Missing Features
* **Sidebar Submenu**: Collapsible nested menu for Sales Entries:
  * Overview Dashboard
  * Bookings (Flights, Hotels, Visa, Holiday, VFS, Transportation, Other Services)
  * Customer Heads
  * Sales Leads
  * Receipts & Ledgers
  * Customer Ledger Explorer
* **Pending Item Badges**: Badges next to menu items showing pending synchronization messages, pending approvals, or unposted transactions.
* **Export Utilities**: Standard Excel (CSV), PDF formatting, and Print media styles.
