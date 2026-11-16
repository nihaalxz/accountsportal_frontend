# Phase 1 Responsive Data Strategy

This document governs the representation of dense ledger tables across mobile, tablet, and desktop viewports.

## Layout Strategies

1. **Desktop viewports (>= 1024px)**:
    - Dense semantic tables (`<table>`, `<thead>`, `<tbody>`).
    - Sticky table headers (`sticky top-0`) to keep columns visible during vertical scrolling.
    - Text alignment rules: Numeric values (money, balances, counts) are strictly **right-aligned** to ensure decimals match. Text labels are left-aligned. Status badges are centered.
    - Action columns (edit, approve, void triggers) are locked to the right.

2. **Mobile viewports (< 1024px)**:
    - Squeezing multi-column tables is prohibited.
    - **Alternative Card Grid**: The table layout converts to responsive cards. Each row becomes a container card displaying primary indicators (date, supplier, money) as primary labels, and secondary details (reference, status) as metadata labels.
    - **Scrollable Horizontal Viewports**: For comparisons where card layouts degrade clarity (e.g. journal splits), columns are wrapped in a horizontally scrollable container (`overflow-x-auto`) with a clear swipe indicator.
