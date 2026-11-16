# Phase 2 Currency Formatting Strategy

This document details the standards and implementation rules for displaying currency values in the Texas Accounts Portal.

## Currency Standards

Texas Travels operates in the Middle East region (specifically Bahrain). The portal defaults to the following formatting standards:

- **Currency Code**: `BHD` (Bahraini Dinar)
- **Decimal Precision**: **3 decimal places** (standard for BHD, KWD, and OMR dinars).
- **Locale**: `en-BH` (English - Bahrain)
- **Format**: `BHD 12,450.750` or `12,450.750 BHD` depending on the UI alignment.

---

## Technical Implementations

1.  **Format Utility**: `src/lib/formatters/money.ts`
    - Exposes `formatMoney(amount, currency = 'BHD', locale = 'en-BH')`.
    - Ensures dynamic fraction digits mapping based on currency code (3 for dinar codes, 2 otherwise).
2.  **Display Component**: `src/lib/components/financial/MoneyAmount.svelte` and `src/lib/components/MoneyDisplay.svelte`.
    - Utilizes tabular numbers styling (`font-mono` or `tabular-nums`) to ensure vertical column alignment in ledger tables.
    - Adds semantic text coloring indicators (emerald-600/red-600) based on positive (money in) or negative (money out) values.
    - Uses screen-reader-friendly `aria-label` tags to read formatted amounts with their respective currency code.
3.  **Strict Rule**: The frontend **never** rounds ledger balances during calculation. The running balance displayed in accounts detail is rendered exactly as returned by the authoritative backend database.
