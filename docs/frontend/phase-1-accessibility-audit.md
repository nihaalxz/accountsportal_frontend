# Phase 1 Accessibility Audit

This document registers the WCAG 2.1 AA/AAA compliance parameters for the Texas Accounts Portal frontend.

## Visual Contrast Parameters

- **Theme Primary Color**: `#EAB308` (Yellow / Amber 500)
    - Evaluated contrast against dark slate background (`#0F172A` / `#1E293B`) yields > **4.5:1** (Compliant with AA/AAA criteria for active UI text blocks).
    - Normal text elements are rendered in high-contrast charcoal or pure white depending on dark/light modes.

## Semantic HTML & ARIA Rules

- **Interactive Elements**: All custom triggers (like dropdown user menus, drawer overflow links, and confirmation buttons) declare native `<button>` markup or explicit `role="button"` descriptors.
- **Aria Attributes**: Mapped error summaries on the Login Page declare `role="alert"`. The confirmation dialog declares `role="dialog"`, `aria-modal="true"`, and links to details via `aria-labelledby`/`aria-describedby`.
- **Keyboard Navigation**: Focus transitions are bounded using tab indices. Sidebar collapsed states and confirmation buttons are keyboard-navigable and triggerable via `Space` and `Enter`.
